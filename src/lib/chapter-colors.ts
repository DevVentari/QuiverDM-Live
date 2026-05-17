export const CHAPTER_COLORS = [
  { bg: 'oklch(0.7 0.16 55)', border: 'oklch(0.7 0.16 55 / 0.4)', text: 'oklch(0.7 0.16 55)' },
  { bg: 'oklch(0.6 0.15 290)', border: 'oklch(0.6 0.15 290 / 0.4)', text: 'oklch(0.6 0.15 290)' },
  { bg: 'oklch(0.65 0.15 140)', border: 'oklch(0.65 0.15 140 / 0.4)', text: 'oklch(0.65 0.15 140)' },
  { bg: 'oklch(0.65 0.15 220)', border: 'oklch(0.65 0.15 220 / 0.4)', text: 'oklch(0.65 0.15 220)' },
  { bg: 'oklch(0.65 0.15 15)', border: 'oklch(0.65 0.15 15 / 0.4)', text: 'oklch(0.65 0.15 15)' },
  { bg: 'oklch(0.7 0.14 75)', border: 'oklch(0.7 0.14 75 / 0.4)', text: 'oklch(0.7 0.14 75)' },
  { bg: 'oklch(0.6 0.15 320)', border: 'oklch(0.6 0.15 320 / 0.4)', text: 'oklch(0.6 0.15 320)' },
  { bg: 'oklch(0.65 0.14 175)', border: 'oklch(0.65 0.14 175 / 0.4)', text: 'oklch(0.65 0.14 175)' },
  { bg: 'oklch(0.6 0.15 260)', border: 'oklch(0.6 0.15 260 / 0.4)', text: 'oklch(0.6 0.15 260)' },
  { bg: 'oklch(0.65 0.13 100)', border: 'oklch(0.65 0.13 100 / 0.4)', text: 'oklch(0.65 0.13 100)' },
] as const;

export function getChapterColor(chapterIndex: number) {
  const index = ((chapterIndex % CHAPTER_COLORS.length) + CHAPTER_COLORS.length) % CHAPTER_COLORS.length;
  return CHAPTER_COLORS[index];
}
