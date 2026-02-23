export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

const REGEX_META_CHARS = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(text: string): string {
  return text.replace(REGEX_META_CHARS, '\\$&');
}

export function splitHighlightSegments(text: string, query: string): HighlightSegment[] {
  const trimmed = query.trim();

  if (!text || !trimmed) {
    return text ? [{ text, isMatch: false }] : [];
  }

  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);

  // Build a single alternation pattern that matches any token, longest first
  // to avoid partial matches when one token is a prefix of another.
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  const pattern = sorted.map(escapeRegex).join('|');
  const matcher = new RegExp(`(${pattern})`, 'ig');

  const segments = text.split(matcher).filter((segment) => segment.length > 0);
  const lowerTokens = tokens.map((t) => t.toLowerCase());

  return segments.map((segment) => ({
    text: segment,
    isMatch: lowerTokens.includes(segment.toLowerCase())
  }));
}
