export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

const REGEX_META_CHARS = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(text: string): string {
  return text.replace(REGEX_META_CHARS, '\\$&');
}

export function splitHighlightSegments(text: string, query: string): HighlightSegment[] {
  const normalizedQuery = query.trim();

  if (!text || !normalizedQuery) {
    return text ? [{ text, isMatch: false }] : [];
  }

  const matcher = new RegExp(`(${escapeRegex(normalizedQuery)})`, 'ig');
  const segments = text.split(matcher).filter((segment) => segment.length > 0);
  const normalizedLower = normalizedQuery.toLowerCase();

  return segments.map((segment) => ({
    text: segment,
    isMatch: segment.toLowerCase() === normalizedLower
  }));
}
