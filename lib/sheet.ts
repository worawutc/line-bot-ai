let cachedData: string | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 60 * 1000; // 60 seconds

export async function getFaqData(): Promise<string> {
  const now = Date.now();
  if (cachedData && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedData;
  }

  const sheetUrl = process.env.SHEET_CSV_URL;
  if (!sheetUrl) {
    throw new Error('SHEET_CSV_URL is not defined in environment variables');
  }

  try {
    const response = await fetch(sheetUrl, { next: { revalidate: 60 } });
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
    }
    const text = await response.text();
    cachedData = text;
    lastFetchTime = now;
    return cachedData;
  } catch (error) {
    console.error('Error fetching FAQ data:', error);
    throw error;
  }
}
