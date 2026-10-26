const NOISE = new Set([
  "a", "an", "the", "of", "and", "or", "to", "for", "with", "in", "on", "into",
  "until", "about", "optional", "fresh", "dried", "large", "medium", "small",
  "sliced", "chopped", "minced", "diced", "thin", "thick", "whole", "finely",
  "peeled", "halved", "thinly", "shredded", "cut", "boneless", "skinless",
  "bone-in", "bone", "patted", "dry", "cubed", "drained", "trimmed", "crushed",
  "grated", "rinsed", "washed", "softened", "melted", "beaten", "divided",
  "heaping", "packed", "precooked", "unsalted", "extra", "virgin", "fine", "plain", "leaves",
  "leaf", "paste", "spray", "paper", "towels", "preferably", "each", "plus",
  "more", "room", "temperature", "season", "taste", "cubes", "cube", "strips",
  "pieces", "piece", "clove", "cloves", "just", "part", "white", "any", "you", "like",
  "half", "lengthwise", "through", "core", "round", "rounds", "thawed", "rolled",
  "cooked", "uncooked", "cooled", "raw", "boiled", "pitted", "roughly", "cup", "cups", "tablespoon", "tablespoons",
  "teaspoon", "teaspoons", "tsp", "tbsp", "ounce", "ounces", "oz", "pound",
  "pounds", "lb", "lbs", "gram", "grams", "kg", "ml", "can", "cans", "package",
  "packages", "bunch", "handful", "pinch", "dash", "sprig", "head", "slice",
  "slices", "box", "jar", "bag"
]);

const PANTRY_WORD = new Set([
  "salt", "pepper", "oil", "water", "sugar", "garlic", "onion", "onions",
  "flour", "flaky", "kosher", "sea", "black", "olive", "avocado", "vegetable",
  "canola", "sunflower", "powder"
]);

/** Fits one line under the title at 375px. Longer lists drop items instead of clipping a word. */
const META_CHAR_BUDGET = 34;

function pantryPhrase(words: string[]): boolean {
  if (words.length === 0) return true;
  if (words.every((word) => PANTRY_WORD.has(word))) return true;
  const phrase = words.join(" ");
  return /^(extra virgin |virgin |olive |avocado |vegetable |canola |sunflower )+oil$/.test(phrase);
}

function sameToken(left: string, right: string): boolean {
  if (left === right) return true;
  return left + "s" === right || right + "s" === left || left + "es" === right || right + "es" === left;
}

/** Core noun phrase for one ingredient line, or null when it is only pantry. */
export function ingredientLabel(line: string): string | null {
  const withoutNotes = line
    .replace(/[@#][\p{L}\p{N}_]+/gu, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\bto (?:season|taste|coat|fry|drizzle)\b.*/gi, " ")
    .replace(/[,;]/g, " ");

  const words = withoutNotes
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter((word) => word.length > 1 && !NOISE.has(word));

  const unique: string[] = [];
  for (const word of words) {
    if (unique.some((kept) => sameToken(kept, word))) continue;
    unique.push(word);
  }

  if (pantryPhrase(unique)) return null;
  const label = unique.slice(0, 4).join(" ");
  return label || null;
}

export function keyIngredients(ingredients: string[], query = "", budget = META_CHAR_BUDGET): string[] {
  const needles = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);
  const matched: string[] = [];
  const rest: string[] = [];
  const seen = new Set<string>();

  for (const line of ingredients) {
    const label = ingredientLabel(line);
    if (!label || label.length > budget) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const hitsQuery = needles.some((token) => key.includes(token));
    (hitsQuery ? matched : rest).push(label);
  }

  const chosen: string[] = [];
  for (const label of [...matched, ...rest]) {
    if (chosen.length >= 3) break;
    const next = [...chosen, label].join(" · ");
    if (chosen.length > 0 && next.length > budget) break;
    chosen.push(label);
  }
  return chosen;
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
  query = "",
  budget = META_CHAR_BUDGET
): string {
  const macrosLine = formatMacros(macros);
  const reserve = macrosLine ? macrosLine.length + 3 : 0;
  const keys = keyIngredients(ingredients, query, Math.max(12, budget - reserve));
  return [...keys, ...(macrosLine ? [macrosLine] : [])].join(" · ");
}
