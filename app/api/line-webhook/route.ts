import { NextRequest, NextResponse } from 'next/server';
import { messagingApi, webhook, validateSignature } from '@line/bot-sdk';
import { getFaqData } from '@/lib/sheet';
import { generateReply } from '@/lib/gemini';

const lineSecret = process.env.LINE_CHANNEL_SECRET || '';
const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: lineToken,
});

const DEFAULT_REPLY = "ครับผม สำหรับข้อมูลส่วนนี้ ผมแจ้งเจ้าหน้าที่ที่เกี่ยวข้องให้มาตอบให้ครับ";

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('x-line-signature') || '';

    // 1. Verify Signature
    if (!validateSignature(bodyText, lineSecret, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body: webhook.CallbackRequest = JSON.parse(bodyText);

    if (!body.events || body.events.length === 0) {
      return NextResponse.json({ status: 'ok' });
    }

    const event = body.events[0];
    if (event.type !== 'message' || event.message.type !== 'text') {
      return NextResponse.json({ status: 'ok' });
    }

    const replyToken = (event as webhook.MessageEvent).replyToken;
    if (!replyToken) {
      return NextResponse.json({ status: 'ok' });
    }
    const userMessage = event.message.text;

    // 2. Fetch FAQ
    let faqCsv = '';
    try {
      faqCsv = await getFaqData();
    } catch (e) {
      console.error('Sheet fetch error:', e);
      // ถ้าดึงข้อมูลไม่ได้ ให้ตอบ Default Message
      await lineClient.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: DEFAULT_REPLY }],
      });
      return NextResponse.json({ status: 'ok' });
    }

    // 3. Call Gemini & Timeout Handling (10 seconds total -> set Gemini timeout to 8s)
    let answerText = DEFAULT_REPLY;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Gemini Timeout')), 8000);
      });
      
      const geminiResponse = await Promise.race([
        generateReply(userMessage, faqCsv),
        timeoutPromise
      ]);
      
      const candidate = geminiResponse.candidates?.[0];
      const finishReason = candidate?.finishReason;
      
      // Log สำหรับ Debug
      console.log(`[Gemini] Finish Reason: ${finishReason}`);
      console.log(`[Gemini] Tokens Usage:`, geminiResponse.usageMetadata);

      // 4. Check Finish Reason (ป้องกันตอบครึ่งประโยค)
      if (finishReason === 'MAX_TOKENS') {
        answerText = DEFAULT_REPLY;
      } else if (geminiResponse.text) {
        answerText = geminiResponse.text;
      }
    } catch (e) {
      console.error('Gemini error:', e);
      answerText = DEFAULT_REPLY;
    }

    // 5. Reply Message
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: answerText }],
    });

  } catch (error) {
    // 6. Error Handling
    // เสมอ return 200 OK เพื่อป้องกัน LINE retry ซ้ำจนระบบรวน
    console.error('Webhook error:', error);
  }

  return NextResponse.json({ status: 'ok' });
}
