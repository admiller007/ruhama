const SKIPPED_WORDS = new Set([
  "a", "an", "the", "of", "and", "or", "to", "for", "with", "in", "on", "into",
  "until", "about", "optional", "fresh", "dried", "large", "medium", "small",
  "sliced", "chopped", "minced", "diced", "ground", "thin", "thick", "whole",
  "cup", "cups", "tablespoon", "tablespoons", "teaspoon", "teaspoons", "tsp",
  "tbsp", "ounce", "ounces", "oz", "pound", "pounds", "lb", "lbs", "gram",
  "grams", "kg", "ml", "clove", "cloves", "can", "cans", "bunch", "package",
  "salt", "pepper", "oil", "olive", "water", "garlic", "onion", "powder",
  "black", "kosher", "flaky", "sea", "spray", "taste", "pinch"
]);

function shortenIngredient(line: string): string | null {
  const withoutNotes = line.toLowerCase().replace(/\([^)]*\)/g, " ");
  const words = withoutNotes
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((word) => word.length > 1 && !SKIPPED_WORDS.has(word));

  if (words.length === 0) return null;
  return words.slice(0, 3).join(" ");
}

export function keyIngredients(ingredients: string[], query = ""): string[] {
  const needles = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);
  const matched: string[] = [];
  const rest: string[] = [];
  const seen = new Set<string>();

  for (const line of ingredients) {
    const label = shortenIngredient(line);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const hitsQuery = needles.some((token) => key.includes(token));
    (hitsQuery ? matched : rest).push(label);
  }

  return [...matched, ...rest].slice(0, 4);
}

function macroText(key: string, value: unknown): string | null {
  if (value == null || value === false) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const numeric = typeof value === "number" || /^\d+(\.\d+)?$/.test(raw);
  const label = key.replace(/[_-]+/g, " ").trim().toLowerCase();

  if (label === "calorie" || label === "calories") return numeric ? `${raw} cal` : raw;
  if (label === "protein") return numeric ? `${raw}g protein` : `${raw} protein`;
  if (label === "carb" || label === "carbs" || label === "carbohydrates") {
    return numeric ? `${raw}g carbs` : `${raw} carbs`;
  }
  if (label === "fat") return numeric ? `${raw}g fat` : `${raw} fat`;
  return numeric ? `${raw} ${label}` : `${label} ${raw}`;
}

export function formatMacros(macros: Record<string, unknown> | undefined): string | null {
  if (!macros) return null;
  const preferred = ["calories", "calorie", "protein", "carbs", "carbohydrates", "fat"];
  const keys = [
    ...preferred.filter((key) => key in macros),
    ...Object.keys(macros).filter((key) => !preferred.includes(key))
  ];
  const parts = keys
    .map((key) => macroText(key, macros[key]))
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** One scanning line: a few ingredient names, then macros when the record has them. */
export function cardMeta(
  ingredients: string[],
  macros: Record<string, unknown> | undefined,
  query = ""
): string {
  const keys = keyIngredients(ingredients, query);
  const macrosLine = formatMacros(macros);
  return [...keys, ...(macrosLine ? [macrosLine] : [])].join(" · ");
}
