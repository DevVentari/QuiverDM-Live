export interface ModelPricing {
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gemini-2.5-flash-lite': { inputPerMillionTokens: 0.075, outputPerMillionTokens: 0.30 },
  'gemini-2.0-flash': { inputPerMillionTokens: 0.10, outputPerMillionTokens: 0.40 },
  'gemini-2.5-pro': { inputPerMillionTokens: 1.25, outputPerMillionTokens: 5.00 },
  'gpt-4o': { inputPerMillionTokens: 2.50, outputPerMillionTokens: 10.00 },
  'gpt-4o-mini': { inputPerMillionTokens: 0.15, outputPerMillionTokens: 0.60 },
  'claude-sonnet-4-20250514': { inputPerMillionTokens: 3.00, outputPerMillionTokens: 15.00 },
  'claude-haiku-4-5-20251001': { inputPerMillionTokens: 0.80, outputPerMillionTokens: 4.00 },
};

export function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (tokensIn / 1_000_000) * pricing.inputPerMillionTokens
       + (tokensOut / 1_000_000) * pricing.outputPerMillionTokens;
}
