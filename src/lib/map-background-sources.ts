export type MapBackgroundImageCandidate = {
  id: string;
  url: string;
  alt?: string | null;
  sectionHeading?: string | null;
  kind?: string | null;
  chapterTitle?: string | null;
  sourcebookTitle?: string | null;
};

const MAP_HINT_RE =
  /\b(map|maps?|battle ?map|battlefield|floor.?plan|tactical)\b/;
const NON_MAP_RE = /\b(portrait|headshot|character|cover|splash|banner)\b/;

export function isMapBackgroundCandidate(image: MapBackgroundImageCandidate): boolean {
  const kind = (image.kind ?? '').toLowerCase();
  if (kind === 'map') return true;
  if (kind === 'portrait') return false;

  const haystack = [
    image.url,
    image.alt ?? '',
    image.sectionHeading ?? '',
    image.chapterTitle ?? '',
  ].join(' ').toLowerCase();

  if (NON_MAP_RE.test(haystack) && !MAP_HINT_RE.test(haystack)) return false;
  return MAP_HINT_RE.test(haystack);
}

export function dedupeMapBackgroundCandidates<T extends MapBackgroundImageCandidate>(
  images: T[],
): T[] {
  const seen = new Set<string>();
  const candidates: T[] = [];

  for (const image of images) {
    if (!isMapBackgroundCandidate(image)) continue;
    if (seen.has(image.url)) continue;
    seen.add(image.url);
    candidates.push(image);
  }

  return candidates;
}
