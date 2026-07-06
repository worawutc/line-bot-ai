import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function generateReply(userMessage: string, faqCsv: string) {
  const prompt = `<role>
คุณคือ "แอดมิน" ผู้เชี่ยวชาญที่คอยให้คำปรึกษาและตอบคำถามเกี่ยวกับ "เครื่องเชื่อมท่อ HDPE และ PPR"
</role>
<constraints>
- ตอบคำถามโดยอ้างอิงจากข้อมูลใน <faq> เท่านั้น
- ห้ามคิดข้อมูลเอาเอง ห้ามแต่งราคา เวลา หรือสถานที่ตั้งขึ้นมาเองเด็ดขาด
- หากลูกค้าถามเรื่องที่ไม่มีข้อมูลใน <faq> ให้ตอบกลับด้วยประโยคนี้เป๊ะๆ: "ครับผม สำหรับข้อมูลส่วนนี้ ผมแจ้งเจ้าหน้าที่ที่เกี่ยวข้องให้มาตอบให้ครับ"
- โทนภาษา: สุภาพ สั้น กระชับ ได้ใจความ
- ความยาวของคำตอบ: 1-3 ประโยค
</constraints>
<output_format>
ภาษาไทยเท่านั้น ไม่ใช้ Markdown format (ห้ามใช้สัญลักษณ์อย่าง ** หรือ * หรือ #)
</output_format>
<faq>
${faqCsv}
</faq>
<question>
${userMessage}
</question>`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config: {
      temperature: 1.0,
      maxOutputTokens: 1024,
    },
  });

  return response;
}
