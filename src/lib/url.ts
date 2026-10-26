export interface RecipeLocation {
  query: string;
  shortcode: string;
}

export function readRecipeUrl(search: string): RecipeLocation {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    query: params.get("q") ?? "",
    shortcode: params.get("r") ?? ""
  };
}

export function buildRecipeUrl(pathname: string, query: string, shortcode: string): string {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) params.set("q", trimmed);
  if (shortcode) params.set("r", shortcode);
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ""}`;
}
