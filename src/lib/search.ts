import { tokenize } from "./text";
import type { SearchableRecipe } from "./types";

const DEFAULT_LIMIT = 100;

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "with", "of", "for", "to", "in", "on", "from",
  "what", "whats", "can", "i", "im", "make", "me", "something", "using", "do",
  "how", "should", "some", "my", "your", "this", "that", "it", "dish", "dishes",
  "recipe", "recipes", "food", "please", "want", "need", "into", "over"
]);

const COMPOUND_TAIL = new Set([
  "noodle", "noodles", "pudding", "flour", "wine", "vinegar", "paper", "milk", "powder"
]);

const CATEGORY_TERMS: Record<string, string[]> = {
  dessert: [
    "cake", "cookie", "brownie", "cheesecake", "halva", "muffin",
    "doughnut", "donut", "pudding", "fudge", "dessert"
  ]
};

const TITLE_EXACT = 50;
const TITLE_PREFIX = 22;
const INGREDIENT_EXACT = 16;
const INGREDIENT_PREFIX = 7;
const INSTRUCTION_EXACT = 5;
const INSTRUCTION_PREFIX = 2;
const CAPTION_EXACT = 6;
const CAPTION_PREFIX = 2;

type FieldName = "title" | "ingredients" | "instructions" | "caption";

interface Fields {
  title: string[];
  ingredients: string[];
  instructions: string[];
  caption: string[];
}

interface ResolvedToken {
  /** Surface form used for matching (a spelling correction, or the typed token). */
  term: string;
  typed: string;
  mode: "exact" | "prefix";
  fuzzy: boolean;
}

interface Vocab {
  counts: Map<string, number>;
  variants: Set<string>;
  byPrefix: Map<string, string[]>;
}

interface Hit {
  score: number;
  matched: number;
  fields: Set<FieldName>;
  surfaces: string[];
  partial: boolean;
}

const variantCache = new Map<string, string[]>();
const vocabCache = new WeakMap<SearchableRecipe[], Vocab>();

function variants(word: string): string[] {
  const cached = variantCache.get(word);
  if (cached) return cached;

  const forms = [word];
  const keepsS = word.endsWith("ss") || word.endsWith("us") || word.endsWith("is");
  if (!keepsS && word.length > 3 && word.endsWith("s")) forms.push(word.slice(0, -1));
  if (!word.endsWith("ss") && word.length > 4 && word.endsWith("es")) forms.push(word.slice(0, -2));

  variantCache.set(word, forms);
  return forms;
}

function sharesVariant(left: string, right: string): boolean {
  if (left === right) return true;
  const rightForms = new Set(variants(right));
  return variants(left).some((form) => rightForms.has(form));
}

function fieldsOf(recipe: SearchableRecipe): Fields {
  return {
    title: recipe.titleTokens ?? tokenize(recipe.normalizedName),
    ingredients: recipe.ingredientTokens ?? tokenize(recipe.normalizedIngredientText),
    instructions: recipe.instructionTokens ?? tokenize((recipe.instructions ?? []).join(" ")),
    caption: recipe.captionTokens ?? tokenize(recipe.caption_snippet ?? "")
  };
}

function getVocab(recipes: SearchableRecipe[]): Vocab {
  const cached = vocabCache.get(recipes);
  if (cached) return cached;

  const counts = new Map<string, number>();
  const forms = new Set<string>();
  const byPrefix = new Map<string, string[]>();

  for (const recipe of recipes) {
    const fields = fieldsOf(recipe);
    const seen = new Set<string>();
    for (const token of [...fields.title, ...fields.ingredients, ...fields.caption]) {
      if (seen.has(token)) continue;
      seen.add(token);
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  for (const token of counts.keys()) {
    for (const form of variants(token)) forms.add(form);
    const bucket = token.slice(0, 3);
    const list = byPrefix.get(bucket);
    if (list) list.push(token);
    else byPrefix.set(bucket, [token]);
  }

  const vocab = { counts, variants: forms, byPrefix };
  vocabCache.set(recipes, vocab);
  return vocab;
}

function editDistance(left: string, right: string, max: number): number {
  if (Math.abs(left.length - right.length) > max) return max + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = new Array<number>(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    let rowMin = current[0];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (current[j] < rowMin) rowMin = current[j];
    }
    if (rowMin > max) return max + 1;
    [previous, current] = [current, previous];
  }

  return previous[right.length];
}

function knownExact(term: string, vocab: Vocab): boolean {
  return variants(term).some((form) => vocab.variants.has(form));
}

function hasPrefix(term: string, vocab: Vocab): boolean {
  if (term.length < 3) return false;
  const list = vocab.byPrefix.get(term.slice(0, 3));
  if (!list) return false;
  return list.some((word) => word !== term && word.startsWith(term));
}

function fuzzyCorrect(term: string, vocab: Vocab): string | null {
  if (term.length < 5) return null;
  let best: string | null = null;
  let bestCount = -1;
  let secondCount = -1;

  for (const candidate of vocab.counts.keys()) {
    if (candidate[0] !== term[0]) continue;
    if (candidate.length < 5) continue;
    if (Math.abs(candidate.length - term.length) > 1) continue;
    if (editDistance(term, candidate, 1) !== 1) continue;
    const count = vocab.counts.get(candidate) ?? 0;
    if (count > bestCount) {
      secondCount = bestCount;
      best = candidate;
      bestCount = count;
    } else if (count > secondCount) {
      secondCount = count;
    }
  }

  if (!best) return null;
  if (secondCount >= 0 && bestCount < secondCount * 2) return null;
  return best;
}

function resolveToken(typed: string, vocab: Vocab): ResolvedToken | null {
  if (knownExact(typed, vocab)) return { term: typed, typed, mode: "exact", fuzzy: false };
  if (hasPrefix(typed, vocab)) return { term: typed, typed, mode: "prefix", fuzzy: false };
  const corrected = fuzzyCorrect(typed, vocab);
  if (!corrected) return null;
  return { term: corrected, typed, mode: "exact", fuzzy: true };
}

function meaningfulTokens(query: string): string[] {
  return tokenize(query).filter((token) => !STOPWORDS.has(token));
}

function weightFor(field: FieldName, kind: "exact" | "prefix"): number {
  if (field === "title") return kind === "exact" ? TITLE_EXACT : TITLE_PREFIX;
  if (field === "ingredients") return kind === "exact" ? INGREDIENT_EXACT : INGREDIENT_PREFIX;
  if (field === "instructions") return kind === "exact" ? INSTRUCTION_EXACT : INSTRUCTION_PREFIX;
  return kind === "exact" ? CAPTION_EXACT : CAPTION_PREFIX;
}

function tokenHit(resolved: ResolvedToken, docToken: string): "exact" | "prefix" | null {
  if (sharesVariant(resolved.term, docToken)) return "exact";
  if (resolved.mode === "prefix" && docToken.startsWith(resolved.term)) return "prefix";
  return null;
}

function queryIncludes(resolved: ResolvedToken[], docToken: string): boolean {
  return resolved.some((token) => tokenHit(token, docToken) !== null);
}

function scoreFields(fields: Fields, resolved: ResolvedToken[]): Hit | null {
  let score = 0;
  let matched = 0;
  const matchedFields = new Set<FieldName>();
  const surfaces: string[] = [];
  const titlePositions: number[] = [];
  let titleMatches = 0;
  const fieldNames: FieldName[] = ["title", "ingredients", "instructions", "caption"];

  for (const token of resolved) {
    let bestWeight = 0;
    let bestField: FieldName | null = null;
    let bestIndex = -1;
    let bestSurface = "";

    for (const field of fieldNames) {
      const docTokens = fields[field];
      for (let index = 0; index < docTokens.length; index += 1) {
        const kind = tokenHit(token, docTokens[index]);
        if (!kind) continue;
        const weight = weightFor(field, kind);
        if (weight > bestWeight) {
          bestWeight = weight;
          bestField = field;
          bestIndex = index;
          bestSurface = docTokens[index];
        }
      }
    }

    if (!bestField) continue;
    matched += 1;
    score += bestWeight;
    matchedFields.add(bestField);
    surfaces.push(bestSurface);
    if (bestField === "title") {
      titleMatches += 1;
      titlePositions.push(bestIndex);
      if (resolved.length > 1) {
        const next = fields.title[bestIndex + 1];
        if (
          next &&
          COMPOUND_TAIL.has(next) &&
          !queryIncludes(resolved, next)
        ) {
          score -= 40;
        }
      }
    }
  }

  if (matched === 0) return null;

  if (titleMatches > 0 && fields.title.length > 0) {
    score += Math.round((48 * titleMatches) / fields.title.length);
  }

  if (titleMatches === resolved.length && resolved.length > 1 && titlePositions.length === resolved.length) {
    score += 18;
    const span = Math.max(...titlePositions) - Math.min(...titlePositions);
    const gaps = span - (resolved.length - 1);
    score += Math.max(0, 16 - gaps * 4);
  }

  if (resolved.length === 1 && fields.title.length > 0) {
    const first = fields.title[0];
    const only = resolved[0];
    if (tokenHit(only, first)) score += 14;
  }

  if (fields.title.length > 14) {
    score -= Math.min(8, fields.title.length - 14);
  }

  return {
    score,
    matched,
    fields: matchedFields,
    surfaces,
    partial: matched < resolved.length
  };
}

function matchLabel(hit: Hit): string {
  if (hit.partial) return "Closest match";
  if (hit.fields.has("title")) return "";
  if (hit.fields.has("ingredients")) return "Ingredients";
  if (hit.fields.has("instructions")) return "In the method";
  if (hit.fields.has("caption")) return "In the post";
  return "";
}

function highlightTerms(query: string, surfaces: string[]): string {
  const terms = new Set<string>(meaningfulTokens(query));
  for (const surface of surfaces) terms.add(surface);
  return [...terms].join(" ");
}

function withMatch(recipe: SearchableRecipe, query: string, hit: Hit): SearchableRecipe {
  return {
    ...recipe,
    matchLabel: matchLabel(hit),
    highlightTerms: highlightTerms(query, hit.surfaces)
  };
}

interface Ranked {
  recipe: SearchableRecipe;
  hit: Hit;
  index: number;
}

function rankResolved(
  recipes: SearchableRecipe[],
  resolved: ResolvedToken[],
  query: string,
  limit: number
): SearchableRecipe[] {
  const full: Ranked[] = [];
  const partial: Ranked[] = [];

  recipes.forEach((recipe, index) => {
    const hit = scoreFields(fieldsOf(recipe), resolved);
    if (!hit) return;
    const entry = { recipe, hit, index };
    if (hit.partial) partial.push(entry);
    else full.push(entry);
  });

  const chosen = full.length > 0 ? full : partial;
  chosen.sort((a, b) => {
    if (b.hit.score !== a.hit.score) return b.hit.score - a.hit.score;
    const aLen = fieldsOf(a.recipe).title.length;
    const bLen = fieldsOf(b.recipe).title.length;
    if (aLen !== bLen) return aLen - bLen;
    return a.index - b.index;
  });

  return chosen.slice(0, limit).map((entry) => withMatch(entry.recipe, query, entry.hit));
}

function resolveAll(tokens: string[], vocab: Vocab): ResolvedToken[] | null {
  const resolved: ResolvedToken[] = [];
  for (const token of tokens) {
    const match = resolveToken(token, vocab);
    if (!match) return null;
    resolved.push(match);
  }
  return resolved;
}

export function searchRecipes(
  recipes: SearchableRecipe[],
  query: string,
  limit = DEFAULT_LIMIT
): SearchableRecipe[] {
  const trimmed = query.trim();
  if (!trimmed) return recipes.slice(0, limit);

  const tokens = meaningfulTokens(trimmed);
  if (tokens.length === 0) return [];

  const vocab = getVocab(recipes);

  if (tokens.length === 1 && CATEGORY_TERMS[tokens[0]]) {
    const terms = CATEGORY_TERMS[tokens[0]];
    const best = new Map<number, Hit>();
    for (const term of terms) {
      const resolved = resolveToken(term, vocab);
      if (!resolved) continue;
      recipes.forEach((recipe, index) => {
        const hit = scoreFields(fieldsOf(recipe), [resolved]);
        if (!hit || hit.partial) return;
        const previous = best.get(index);
        if (!previous || hit.score > previous.score) best.set(index, hit);
      });
    }

    return [...best.entries()]
      .sort((a, b) => b[1].score - a[1].score || a[0] - b[0])
      .slice(0, limit)
      .map(([index, hit]) => withMatch(recipes[index], trimmed, hit));
  }

  const resolved = resolveAll(tokens, vocab);
  if (!resolved) return [];
  return rankResolved(recipes, resolved, trimmed, limit);
}

export function suggestQueries(recipes: SearchableRecipe[], query: string): string[] {
  const tokens = meaningfulTokens(query);
  if (tokens.length === 0) return [];
  const vocab = getVocab(recipes);
  const suggestions: string[] = [];

  for (const token of tokens) {
    if (token.length < 5 || resolveToken(token, vocab)) continue;
    const neighbors: { word: string; count: number; distance: number }[] = [];
    for (const candidate of vocab.counts.keys()) {
      if (candidate[0] !== token[0] || candidate.length < 5) continue;
      if (Math.abs(candidate.length - token.length) > 2) continue;
      const distance = editDistance(token, candidate, 2);
      if (distance < 1 || distance > 2) continue;
      neighbors.push({ word: candidate, count: vocab.counts.get(candidate) ?? 0, distance });
    }
    neighbors.sort((a, b) => a.distance - b.distance || b.count - a.count);
    for (const neighbor of neighbors.slice(0, 2)) {
      const suggestion = tokens.map((item) => (item === token ? neighbor.word : item)).join(" ");
      if (!suggestions.includes(suggestion)) suggestions.push(suggestion);
    }
  }

  return suggestions.slice(0, 3);
}
