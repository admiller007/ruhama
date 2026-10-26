/**
 * A second search eval, written from a home cook's questions rather than
 * from the ranker. Run: npx vite-node --script scripts/search_eval_hard.ts
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Recipe, SearchableRecipe } from "../src/lib/types";
import { evaluateCases, type EvalCase } from "./search_eval";

function nameHas(pattern: RegExp) {
  return (recipe: SearchableRecipe) => pattern.test(recipe.name);
}

function nameHasAll(patterns: RegExp[]) {
  return (recipe: SearchableRecipe) => patterns.every((pattern) => pattern.test(recipe.name));
}

function textHas(pattern: RegExp) {
  return (recipe: SearchableRecipe) =>
    pattern.test(
      [recipe.name, recipe.caption_snippet, ...(recipe.ingredients ?? []), ...(recipe.instructions ?? [])].join(
        "\n"
      )
    );
}

export const HARD_EVAL_CASES: EvalCase[] = [
  { id: "holiday-rosh-hashanah", query: "rosh hashanah", kind: "holiday", accept: nameHas(/rosh hashanah/i) },
  { id: "holiday-passover", query: "passover", kind: "holiday", accept: nameHas(/\bpassover\b/i) },
  { id: "holiday-shabbat", query: "shabbat", kind: "holiday", accept: nameHas(/\bshabbat\b/i) },
  {
    id: "holiday-hanukkah",
    query: "hanukkah",
    kind: "holiday",
    accept: nameHas(/hanukkah|chanukah|\blatkes?\b|sufganiyot|sfinge/i)
  },
  {
    id: "holiday-purim",
    query: "purim",
    kind: "holiday",
    accept: textHas(/purim|hamantaschen|hamentashen|oznei haman|ozney haman/i)
  },
  { id: "holiday-tu-bishvat", query: "tu bishvat", kind: "holiday", accept: nameHas(/tu bishvat/i) },
  { id: "meal-weeknight", query: "weeknight dinner", kind: "meal", accept: textHas(/weeknight/i) },
  { id: "meal-side", query: "side dish", kind: "meal", accept: textHas(/side dish/i) },
  { id: "meal-salad-crowd", query: "salad for a crowd", kind: "meal", accept: nameHas(/\bsalad\b/i) },
  {
    id: "diet-gluten-free",
    query: "gluten free",
    kind: "diet",
    accept: nameHas(/gluten[\s-]*free|\bgf\b/i)
  },
  { id: "diet-dairy-free", query: "dairy free", kind: "diet", accept: nameHas(/dairy[-\s]?free/i) },
  { id: "diet-vegetarian", query: "vegetarian", kind: "diet", accept: nameHas(/\bvegetarian\b/i) },
  { id: "diet-parve", query: "parve", kind: "diet", accept: textHas(/\bparve\b/i) },
  { id: "cuisine-moroccan", query: "moroccan", kind: "cuisine", accept: nameHas(/\bmoroccan\b/i) },
  { id: "cuisine-persian", query: "persian", kind: "cuisine", accept: nameHas(/\bpersian\b/i) },
  { id: "equip-sheet-pan", query: "sheet pan", kind: "equipment", accept: nameHas(/sheet[\s-]?pan/i) },
  { id: "equip-air-fryer", query: "air fryer", kind: "equipment", expectEmpty: true },
  { id: "equip-no-bake", query: "no bake", kind: "equipment", accept: nameHas(/no[-\s]?bake/i) },
  { id: "dish-arayes", query: "arayes", kind: "dish", accept: nameHas(/\barayes\b/i) },
  { id: "dish-zaalouk", query: "zaalouk", kind: "dish", accept: nameHas(/\bzaalouk\b/i) },
  { id: "dish-tbeet", query: "tbeet", kind: "dish", accept: nameHas(/\btbeet\b/i) },
  { id: "dish-charoset", query: "charoset", kind: "dish", accept: nameHas(/\bcharoset\b/i) },
  { id: "dish-mujadara", query: "mujadara", kind: "dish", accept: nameHas(/\bmujadara\b/i) },
  { id: "dish-sufganiyot", query: "sufganiyot", kind: "dish", accept: nameHas(/\bsufganiyot\b/i) },
  { id: "dish-malabi", query: "malabi", kind: "dish", accept: nameHas(/\bmalabi\b/i) },
  { id: "dish-levivot", query: "levivot", kind: "dish", accept: nameHas(/\blevivot\b/i) },
  {
    id: "leftover-eggplant-tahini",
    query: "eggplant and tahini",
    kind: "leftover",
    accept: nameHasAll([/\beggplant/i, /\btahini\b/i])
  },
  {
    id: "leftover-lentils-rice",
    query: "what can I make with lentils and rice",
    kind: "leftover",
    accept: nameHasAll([/\blentils?\b/i, /\brice\b/i])
  },
  {
    id: "leftover-zucchini-feta",
    query: "zucchini and feta",
    kind: "leftover",
    accept: nameHasAll([/\bzucchini\b/i, /\bfeta\b/i])
  },
  {
    id: "leftover-beef-potatoes",
    query: "beef and potatoes",
    kind: "leftover",
    accept: nameHasAll([/\bbeef\b/i, /\bpotato(?:es)?\b/i])
  }
];

function loadRecipes(): Recipe[] {
  const here = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(readFileSync(resolve(here, "../src/data/recipes.json"), "utf8")) as Recipe[];
}

export function evaluateHardSearch(recipes: Recipe[]) {
  return evaluateCases(recipes, HARD_EVAL_CASES);
}

const isDirectRun = process.argv.some((arg) => /(?:^|\/)search_eval_hard\.ts$/.test(arg));

if (isDirectRun) {
  const report = evaluateHardSearch(loadRecipes());
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
