/**
 * Search quality eval for Ruhama's recipe index.
 *
 * Run: npx vite-node scripts/search_eval.ts
 * Writes a JSON report to stdout. Exit code is 0 either way so a baseline
 * can be recorded before ranking changes. The vitest wrapper asserts the
 * cases pass.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSearchableRecipes } from "../src/lib/normalize";
import { searchRecipes } from "../src/lib/search";
import type { Recipe, SearchableRecipe } from "../src/lib/types";

export interface EvalCase {
  id: string;
  query: string;
  kind: string;
  /** Top result must satisfy this. Predicates use fields that survive dedupe. */
  accept?: (recipe: SearchableRecipe) => boolean;
  /** The query has no matching recipe in the archive, so the top of the list must be empty. */
  expectEmpty?: boolean;
}

function nameHas(pattern: RegExp) {
  return (recipe: SearchableRecipe) => pattern.test(recipe.name);
}

function nameHasAll(patterns: RegExp[]) {
  return (recipe: SearchableRecipe) => patterns.every((pattern) => pattern.test(recipe.name));
}

export const SEARCH_EVAL_CASES: EvalCase[] = [
  { id: "dish-schnitzel", query: "schnitzel", kind: "dish", accept: nameHas(/\bschnitzel\b/i) },
  { id: "dish-shakshuka", query: "shakshuka", kind: "dish", accept: nameHas(/\bshakshuka\b/i) },
  { id: "dish-fish-schnitzel", query: "fish schnitzel", kind: "dish", accept: nameHasAll([/\bfish\b/i, /\bschnitzel\b/i]) },
  { id: "dish-oven-schnitzel", query: "oven baked schnitzel", kind: "dish", accept: nameHasAll([/\boven\b/i, /\bschnitzel\b/i]) },
  { id: "dish-hummus", query: "hummus", kind: "dish", accept: nameHas(/\bhummus\b/i) },
  { id: "dish-shawarma", query: "shawarma", kind: "dish", accept: nameHas(/\bshawarma\b/i) },
  { id: "dish-ptitim", query: "ptitim", kind: "dish", accept: nameHas(/\bptitim\b/i) },
  { id: "dish-matbucha", query: "matbucha", kind: "dish", accept: nameHas(/\bmatbucha\b/i) },
  { id: "dish-bourekas", query: "bourekas", kind: "dish", accept: nameHas(/\bbourekas\b/i) },
  { id: "dish-chocolate-cake", query: "chocolate cake", kind: "dish", accept: nameHasAll([/\bchocolate\b/i, /\bcake\b/i]) },
  { id: "dish-apple-cake", query: "apple cake", kind: "dish", accept: nameHasAll([/\bapple\b/i, /\bcake\b/i]) },
  { id: "dish-split-pea-soup", query: "split pea soup", kind: "dish", accept: nameHasAll([/split pea/i, /\bsoup\b/i]) },
  { id: "dish-beef-stew", query: "beef stew", kind: "dish", accept: nameHasAll([/\bbeef\b/i, /\bstew\b/i]) },
  { id: "dish-cheesecake", query: "cheesecake", kind: "dessert", accept: nameHas(/\bcheesecake\b/i) },
  { id: "dish-brownie", query: "brownie", kind: "dessert", accept: nameHas(/\bbrownie/i) },
  { id: "ingredient-chickpeas", query: "chickpeas", kind: "ingredient", accept: nameHas(/\bchickpeas?\b/i) },
  { id: "ingredient-chickpea", query: "chickpea", kind: "ingredient", accept: nameHas(/\bchickpeas?\b/i) },
  { id: "ingredient-ground-beef", query: "ground beef", kind: "ingredient", accept: nameHas(/ground beef/i) },
  { id: "ingredient-salmon", query: "salmon", kind: "ingredient", accept: nameHas(/\bsalmon\b/i) },
  { id: "ingredient-eggplant", query: "eggplant", kind: "ingredient", accept: nameHas(/\beggplants?\b/i) },
  {
    id: "multi-chicken-rice",
    query: "chicken rice",
    kind: "multi",
    accept: (recipe) =>
      /\bchicken\b/i.test(recipe.name) &&
      /\brice\b/i.test(recipe.name) &&
      !/noodle/i.test(recipe.name)
  },
  {
    id: "multi-chicken-rice-phrase",
    query: "what can I make with chicken and rice",
    kind: "multi",
    accept: (recipe) =>
      /\bchicken\b/i.test(recipe.name) &&
      /\brice\b/i.test(recipe.name) &&
      !/noodle/i.test(recipe.name)
  },
  { id: "multi-cabbage-salad", query: "cabbage salad", kind: "multi", accept: nameHasAll([/\bcabbage\b/i, /\bsalad\b/i]) },
  { id: "typo-shnitzel", query: "shnitzel", kind: "typo", accept: nameHas(/\bschnitzel\b/i) },
  { id: "typo-chiken", query: "chiken", kind: "typo", accept: nameHas(/\bchicken\b/i) },
  { id: "plural-potatoes", query: "potatoes", kind: "plural", accept: nameHas(/\bpotato(?:es)?\b/i) },
  { id: "plural-potato", query: "potato", kind: "plural", accept: nameHas(/\bpotato(?:es)?\b/i) },
  { id: "plural-meatballs", query: "meatballs", kind: "plural", accept: nameHas(/\bmeatballs?\b/i) },
  { id: "plural-meatball", query: "meatball", kind: "plural", accept: nameHas(/\bmeatballs?\b/i) },
  { id: "plural-cookies", query: "cookies", kind: "plural", accept: nameHas(/\bcookies?\b/i) },
  { id: "category-soup", query: "soup", kind: "category", accept: nameHas(/\bsoup\b/i) },
  {
    id: "category-dessert",
    query: "dessert",
    kind: "category",
    accept: nameHas(/\b(cake|cookies?|brownies?|cheesecake|halva|muffins?|doughnuts?|donuts?|pies?|tarts?|pudding|fudge)\b/i)
  },
  { id: "category-one-pan", query: "one pan", kind: "category", accept: nameHas(/one[\s-]?pan/i) },
  { id: "category-pasta", query: "pasta", kind: "category", accept: nameHas(/\bpasta\b/i) },
  { id: "intent-quick", query: "quick", kind: "intent", accept: nameHas(/\bquick\b/i) },
  {
    id: "intent-high-protein",
    query: "high protein",
    kind: "intent",
    accept: (recipe) => /protein/i.test(`${recipe.name}\n${recipe.caption_snippet ?? ""}`)
  }
];

export interface EvalFailure {
  id: string;
  query: string;
  kind: string;
  top: string[];
}

export interface EvalReport {
  recipeCount: number;
  caseCount: number;
  passed: number;
  failed: number;
  passRate: number;
  failures: EvalFailure[];
}

export function evaluateCases(recipes: Recipe[], cases: EvalCase[], limit = 5): EvalReport {
  const searchable = buildSearchableRecipes(recipes);
  const failures: EvalFailure[] = [];

  for (const testCase of cases) {
    const results = searchRecipes(searchable, testCase.query, limit);
    const top = results[0];
    const passed = testCase.expectEmpty
      ? !top
      : Boolean(top && testCase.accept?.(top));
    if (!passed) {
      failures.push({
        id: testCase.id,
        query: testCase.query,
        kind: testCase.kind,
        top: results.slice(0, 3).map((recipe) => recipe.name)
      });
    }
  }

  const caseCount = cases.length;
  const failed = failures.length;
  const passed = caseCount - failed;

  return {
    recipeCount: recipes.length,
    caseCount,
    passed,
    failed,
    passRate: caseCount === 0 ? 0 : Number((passed / caseCount).toFixed(4)),
    failures
  };
}

export function evaluateSearch(recipes: Recipe[], limit = 5): EvalReport {
  return evaluateCases(recipes, SEARCH_EVAL_CASES, limit);
}

function loadRecipes(): Recipe[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, "../src/data/recipes.json");
  return JSON.parse(readFileSync(path, "utf8")) as Recipe[];
}

const isDirectRun = process.argv.some((arg) => /(?:^|\/)search_eval\.ts$/.test(arg));

if (isDirectRun) {
  const report = evaluateSearch(loadRecipes());
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
