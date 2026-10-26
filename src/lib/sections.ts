/** A standalone "Frying-" / "For the sauce:" line, not a step that happens to end with a colon. */
export function isSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\s'’&/-]{0,42}[-–:]$/u.test(trimmed)) return false;
  const body = trimmed.slice(0, -1);
  if (/[,.!;?]/.test(body)) return false;
  if (/\d/.test(body)) return false;
  const words = body.trim().split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 6;
}

export function sectionHeadingText(line: string): string {
  return line.trim().replace(/[-–:]\s*$/, "").trim();
}
