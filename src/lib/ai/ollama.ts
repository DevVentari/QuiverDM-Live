/**
 * Ollama API Client
 *
 * Provides interface to local Ollama instance for LLM-based markdown parsing
 * Uses local models without needing API keys
 */

const DEFAULT_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

export interface OllamaOptions {
  model?: string; // Default: 'llama3.2'
  temperature?: number; // 0-1, default: 0.1 for structured extraction
  stream?: boolean; // Default: false
  baseUrl?: string; // Default: OLLAMA_BASE_URL env var or http://localhost:11434
  format?: 'json' | string; // Request specific output format (e.g., 'json')
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Check if Ollama is running and accessible
 */
export async function isOllamaAvailable(baseUrl = DEFAULT_BASE_URL): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * List available models in Ollama
 */
export async function listOllamaModels(baseUrl = DEFAULT_BASE_URL): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch (error) {
    console.error('[Ollama] Failed to list models:', error);
    return [];
  }
}

/**
 * Chat with Ollama using the chat API
 */
export async function chatWithOllama(
  messages: OllamaMessage[],
  options: OllamaOptions = {}
): Promise<string> {
  const {
    model = 'llama3.2',
    temperature = 0.1,
    stream = false,
    baseUrl = DEFAULT_BASE_URL,
  } = options;

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream,
        options: {
          temperature,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data: OllamaResponse = await response.json();
    return data.message.content;
  } catch (error) {
    console.error('[Ollama] Chat failed:', error);
    throw error;
  }
}

/**
 * Generate completion with Ollama (simpler API for single prompts)
 */
export async function generateWithOllama(
  prompt: string,
  options: OllamaOptions = {}
): Promise<string> {
  const {
    model = 'llama3.2',
    temperature = 0.1,
    stream = false,
    baseUrl = DEFAULT_BASE_URL,
    format,
  } = options;

  try {
    const requestBody: Record<string, unknown> = {
      model,
      prompt,
      stream,
      options: {
        temperature,
      },
    };

    // Add format if specified (e.g., 'json' for structured output)
    if (format) {
      requestBody.format = format;
    }

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('[Ollama] Generation failed:', error);
    throw error;
  }
}

/**
 * Extract structured data from text using Ollama
 * Returns JSON output based on the schema prompt
 */
export async function extractStructuredData<T = any>(
  text: string,
  schemaPrompt: string,
  options: OllamaOptions = {}
): Promise<T> {
  const systemMessage: OllamaMessage = {
    role: 'system',
    content: `You are a precise data extraction assistant. Extract information from the provided text and return ONLY valid JSON that matches the requested schema. Do not include any explanations or markdown formatting - just the raw JSON object.`,
  };

  const userMessage: OllamaMessage = {
    role: 'user',
    content: `${schemaPrompt}\n\nText to extract from:\n\n${text}`,
  };

  const response = await chatWithOllama([systemMessage, userMessage], {
    ...options,
    temperature: 0.1, // Low temperature for consistent extraction
  });

  // Clean up response - remove markdown code blocks if present
  let cleanedResponse = response.trim();
  if (cleanedResponse.startsWith('```json')) {
    cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanedResponse.startsWith('```')) {
    cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(cleanedResponse) as T;
  } catch (error) {
    console.error('[Ollama] Failed to parse JSON response:', cleanedResponse);
    throw new Error(`Failed to parse Ollama response as JSON: ${error}`);
  }
}
