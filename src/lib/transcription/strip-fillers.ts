const FILLER_PATTERNS = [
  /\b(um+|uh+|er+|ah+)\b/gi,
  /\b(you know,?\s*)/gi,
  /\b(i mean,?\s*)/gi,
  /\b(sort of,?\s*)/gi,
  /\b(kind of,?\s*)/gi,
  /\b(basically,?\s*)/gi,
  /\b(literally,?\s*)/gi,
];

export function stripFillers(text: string): string {
  let result = text;
  for (const pattern of FILLER_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result.replace(/\s{2,}/g, ' ').trim();
}
