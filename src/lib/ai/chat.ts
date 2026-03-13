/**
 * Multi-provider chat utility for workers.
 * Tries OpenAI → Gemini → Ollama in order, returning first successful response.
 */

import OpenAI from 'openai';
import { callGemini } from './gemini';
import { chatWithOllama, isOllamaAvailable } from './ollama';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  temperature?: number;
  userGeminiKey?: string;
  userId?: string;
}

async function tryGroq(messages: ChatMessage[], temperature: number): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error('No Groq key');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature, max_tokens: 4096 }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

async function tryOpenAI(messages: ChatMessage[], temperature: number): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error('No OpenAI key');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature,
    max_tokens: 4096,
  });
  return res.choices[0]?.message?.content ?? '';
}

async function tryGemini(messages: ChatMessage[], temperature: number): Promise<string> {
  if (!process.env.GEMINI_API_KEY) throw new Error('No Gemini key');
  // Gemini takes a single prompt — concatenate system + user messages
  const prompt = messages
    .map((m) => (m.role === 'system' ? `Instructions: ${m.content}` : m.content))
    .join('\n\n');
  return callGemini(prompt);
}

async function tryOllama(messages: ChatMessage[], temperature: number): Promise<string> {
  const available = await isOllamaAvailable();
  if (!available) throw new Error('Ollama unavailable');
  return chatWithOllama(messages as any, { temperature });
}

export async function chatWithAI(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const temperature = options.temperature ?? 0.1;
  const { userGeminiKey, userId } = options;

  async function tryGeminiWithUserKey(): Promise<string> {
    const key = userGeminiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('No Gemini key');
    const prompt = messages
      .map((m) => (m.role === 'system' ? `Instructions: ${m.content}` : m.content))
      .join('\n\n');
    return callGemini(prompt, userGeminiKey, { userId });
  }

  const providers: Array<[string, () => Promise<string>]> = userGeminiKey
    ? [
        ['gemini-user', tryGeminiWithUserKey],
        ['groq', () => tryGroq(messages, temperature)],
        ['openai', () => tryOpenAI(messages, temperature)],
        ['ollama', () => tryOllama(messages, temperature)],
      ]
    : [
        ['groq', () => tryGroq(messages, temperature)],
        ['openai', () => tryOpenAI(messages, temperature)],
        ['gemini', () => tryGemini(messages, temperature)],
        ['ollama', () => tryOllama(messages, temperature)],
      ];

  const errors: string[] = [];
  for (const [name, fn] of providers) {
    try {
      const result = await fn();
      if (result) {
        console.log(`[chatWithAI] Used ${name}`);
        return result;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[chatWithAI] ${name} failed: ${msg}`);
      errors.push(`${name}: ${msg}`);
    }
  }

  throw new Error(`All AI providers failed: ${errors.join('; ')}`);
}
