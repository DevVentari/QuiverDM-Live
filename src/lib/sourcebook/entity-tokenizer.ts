export interface EntityIndexItem {
  id: string;
  name: string;
  aliases: string[];
  type: string;
}

interface MatchTerm {
  id: string;
  term: string;
  lowerTerm: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMatchTerms(entities: EntityIndexItem[]): MatchTerm[] {
  const terms: MatchTerm[] = [];
  for (const entity of entities) {
    for (const rawTerm of [entity.name, ...entity.aliases]) {
      const term = rawTerm.trim();
      if (term.length < 3) continue;
      terms.push({ id: entity.id, term, lowerTerm: term.toLowerCase() });
    }
  }
  terms.sort((a, b) => b.term.length - a.term.length || a.term.localeCompare(b.term));
  return terms;
}

function splitProtectedSegments(markdown: string): Array<{ text: string; protected: boolean }> {
  const segments: Array<{ text: string; protected: boolean }> = [];
  const re = /(```[\s\S]*?```|`[^`]+`|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: markdown.slice(lastIndex, match.index), protected: false });
    }
    segments.push({ text: match[0], protected: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < markdown.length) {
    segments.push({ text: markdown.slice(lastIndex), protected: false });
  }

  return segments;
}

function tokenizeSegment(text: string, terms: MatchTerm[]): string {
  if (terms.length === 0) return text;

  const pattern = terms.map((term) => escapeRegex(term.term)).join('|');
  const re = new RegExp(`\\b(${pattern})\\b`, 'gi');
  const byLower = new Map<string, string>();
  for (const term of terms) {
    if (!byLower.has(term.lowerTerm)) {
      byLower.set(term.lowerTerm, term.id);
    }
  }

  return text.replace(re, (match) => {
    const id = byLower.get(match.toLowerCase());
    return id ? `[[entity:${id}|${match}]]` : match;
  });
}

export function tokenizeEntities(markdown: string, entities: EntityIndexItem[]): string {
  const terms = buildMatchTerms(entities);
  if (terms.length === 0) return markdown;

  return splitProtectedSegments(markdown)
    .map((segment) => (segment.protected ? segment.text : tokenizeSegment(segment.text, terms)))
    .join('');
}
