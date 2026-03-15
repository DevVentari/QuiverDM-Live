import { logApiUsage } from './usage-logger';

const TEXT_MODEL = 'gemini-2.5-flash-lite';
const VISION_MODEL = 'gemini-2.0-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 60_000;

interface GeminiCallOpts {
  userId?: string;
  feature?: string;
  maxOutputTokens?: number;
}

export async function callGemini(prompt: string, userKey?: string, opts?: GeminiCallOpts): Promise<string> {
  const apiKey = userKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('No Gemini API key available');

  const res = await fetch(`${BASE_URL}/${TEXT_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const json = await res.json();

  if (opts?.userId) {
    void logApiUsage({
      userId: opts.userId,
      provider: 'gemini',
      model: TEXT_MODEL,
      feature: opts.feature || 'unknown',
      tokensIn: json.usageMetadata?.promptTokenCount || 0,
      tokensOut: json.usageMetadata?.candidatesTokenCount || 0,
    });
  }

  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export async function callGeminiVision(
  prompt: string,
  images: Array<{ mimeType: string; base64Data: string }>,
  userKey?: string,
  opts?: GeminiCallOpts
): Promise<string> {
  const apiKey = userKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('No Gemini API key available');

  const parts: unknown[] = [{ text: prompt }];
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64Data } });
  }

  const res = await fetch(`${BASE_URL}/${VISION_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: opts?.maxOutputTokens ?? 4096 },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`Gemini Vision error ${res.status}: ${await res.text()}`);
  const json = await res.json();

  if (opts?.userId) {
    void logApiUsage({
      userId: opts.userId,
      provider: 'gemini',
      model: VISION_MODEL,
      feature: opts.feature || 'unknown',
      tokensIn: json.usageMetadata?.promptTokenCount || 0,
      tokensOut: json.usageMetadata?.candidatesTokenCount || 0,
    });
  }

  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
