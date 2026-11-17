#!/usr/bin/env node
/**
 * Draft meat / dairy / pareve tags for Ruhama's recipes.
 *
 *   node scripts/tag_kosher.mjs            # write kosher_tags_draft.json
 *   node scripts/tag_kosher.mjs --dry-run  # print the summary, write nothing
 *
 * These are guesses read from the ingredient lines, not a kashrut ruling.
 * Every entry carries `confirmed: false` until Ruhama checks it, and the
 * site does not show them. A recipe that matches both meat and dairy words,
 * or uses a "chicken" consommé or soup powder that is usually pareve, is
 * tagged "check" rather than guessed.
 *
 * Output, one entry per recipe in the same order as src/data/recipes.json:
 *   { shortcode, name, tag: "meat"|"dairy"|"pareve"|"check", fish, because, confirmed }
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = resolve(ROOT, "src/data/recipes.json");
const OUTPUT = resolve(ROOT, "kosher_tags_draft.json");

const MEAT = /\b(chicken|beef|brisket|lamb|veal|turkey|duck|goose|sirloin|chuck|flanken|short ribs|pastrami|salami|merguez|schmaltz|ground meat|meat|meatballs?|hot dogs?|pargiyot|drumsticks|chicken wings|liver|bone broth|oxtail|osso buco|corned beef|deli)\b/i;
const DAIRY = /\b(butter|milk|cheese|cheeses|cream|yogurt|yoghurt|feta|mozzarella|parmesan|parmigiano|ricotta|mascarpone|labneh|labane|halloumi|cheddar|gouda|brie|cottage|kefir|ghee|buttermilk|half and half|whey|tzfatit|bulgarian|burrata|gruyere|gruyère|pecorino|provolone|emmental|swiss cheese|goat cheese|cream cheese|sour cream|heavy cream|whipping cream|whipped cream|ice cream|white chocolate|milk chocolate)\b/i;
const FISH = /\b(fish|salmon|tuna|cod|tilapia|branzino|sea bass|halibut|anchov(?:y|ies)|sardines?|trout|mackerel|snapper|grouper|lox|herring|mahi)\b/i;

// Words that look like meat or dairy but are not, checked on the same line.
const NOT_MEAT = /\b(vegan|vegetarian|plant[- ]based|meatless|imitation|mock|pareve|parve|beyond|impossible|soy|seitan|tofu)\b|\bmeat (?:thermometer|mallet|hammer)\b/i;
const NOT_DAIRY = /\b(peanut|almond|cashew|nut|sunflower|seed|apple|shea|cocoa|soy|vegan|plant[- ]based|non[- ]?dairy|dairy[- ]free|pareve|parve|margarine|coconut|oat|rice milk)\b|\bbutter(?:nut|head| beans| lettuce)\b|\bcream of tartar\b|\bcreamy\b/i;
const PAREVE_CHICKEN = /\b(chicken[- ]flavou?red|chicken (?:soup )?(?:powder|consomm[eé]|bouillon|base)|onion soup mix)\b/i;
const TITLE_DAIRY_FREE = /\b(dairy[- ]free|non[- ]?dairy|pareve|parve|vegan)\b/i;
const TITLE_MEATLESS = /\b(vegan|vegetarian|meatless|plant[- ]based)\b/i;

function lines(recipe) {
  return (recipe.ingredients || []).map((line) => String(line));
}

function methodLines(recipe) {
  return (recipe.instructions || []).flatMap((block) => String(block).split(/\n/));
}

function matchesIn(lineList, pattern, exclude) {
  const found = new Set();
  for (const line of lineList) {
    if (exclude && exclude.test(line)) continue;
    const match = line.match(pattern);
    if (match) found.add(match[0].toLowerCase());
  }
  return [...found];
}

export function tagRecipe(recipe) {
  const listed = lines(recipe);
  const method = methodLines(recipe);
  // Some posts put the whole recipe in the method, so read that when there is no list.
  const ingredientLines = listed.length ? listed : method;
  const name = String(recipe.name || "");
  const meatLines = ingredientLines.filter((line) => !PAREVE_CHICKEN.test(line));
  const meat = TITLE_MEATLESS.test(name) ? [] : matchesIn(meatLines, MEAT, NOT_MEAT);
  const dairy = matchesIn(ingredientLines, DAIRY, NOT_DAIRY);
  const fish = matchesIn(ingredientLines, FISH).length > 0;
  const consomme = ingredientLines.some((line) => PAREVE_CHICKEN.test(line));

  let tag = "pareve";
  const because = [];
  if (meat.length && dairy.length) {
    tag = "check";
    because.push(`meat: ${meat.join(", ")}`, `dairy: ${dairy.join(", ")}`);
  } else if (meat.length) {
    tag = "meat";
    because.push(...meat);
  } else if (dairy.length) {
    tag = TITLE_DAIRY_FREE.test(name) ? "check" : "dairy";
    because.push(...dairy);
    if (tag === "check") because.push("title says dairy-free");
  } else if (consomme) {
    tag = "check";
    because.push("chicken-style consommé or soup powder, usually pareve");
  } else if (ingredientLines.length === 0) {
    tag = "check";
    because.push("no ingredient list");
  } else if (listed.length) {
    // A pareve list whose method adds feta or chicken stock ("top it with feta").
    const methodMeat = TITLE_MEATLESS.test(name)
      ? []
      : matchesIn(method.filter((line) => !PAREVE_CHICKEN.test(line)), MEAT, NOT_MEAT);
    const methodDairy = matchesIn(method, DAIRY, NOT_DAIRY);
    if (methodMeat.length || methodDairy.length) {
      tag = "check";
      because.push(`method mentions ${[...methodMeat, ...methodDairy].join(", ")}`);
    }
  }

  return {
    shortcode: recipe.shortcode,
    name: recipe.name,
    tag,
    fish,
    because,
    confirmed: false
  };
}

export function tagRecipes(recipes) {
  const tags = recipes.map((recipe) => tagRecipe(recipe));
  const counts = { meat: 0, dairy: 0, pareve: 0, check: 0, fish: 0 };
  for (const entry of tags) {
    counts[entry.tag] += 1;
    if (entry.fish) counts.fish += 1;
  }
  return { tags, counts };
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const recipes = JSON.parse(readFileSync(INPUT, "utf8"));
  const { tags, counts } = tagRecipes(recipes);
  const body = {
    note: "Draft guesses from ingredient lines. Not confirmed by Ruhama. Do not show as a kashrut ruling.",
    generatedFrom: "src/data/recipes.json",
    counts,
    recipes: tags
  };
  if (!dryRun) writeFileSync(OUTPUT, `${JSON.stringify(body, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ dryRun, total: tags.length, ...counts }, null, 2)}\n`);
}

const isDirectRun = process.argv.some((arg) => /(?:^|\/)tag_kosher\.mjs$/.test(arg));
if (isDirectRun) main();
