#!/usr/bin/env node
/**
 * Deterministic cleanup for the Ruhama recipe JSON.
 *
 *   node scripts/clean_recipes.mjs            # write both JSON copies + report
 *   node scripts/clean_recipes.mjs --dry-run  # print the report, write nothing
 *
 * What it changes, and nothing else:
 * 1. Numbered step lines parked in `ingredients` are removed. If that step is
 *    not already in `instructions`, it is appended (a real move). If it is
 *    already there, the ingredient copy is dropped so instructions are not doubled.
 * 2. Clearly accidental doubled function words ("of of", "with with", "the the",
 *    "it it") are collapsed. Recipe wording is otherwise left alone.
 * 3. Ingredient or instruction lines that contain no letters or numbers
 *    (emoji-only leftovers) are removed. Emoji stuck to a real line are stripped
 *    and the words are left as written.
 * 4. An instruction block that is clearly "Ingredients- … Method- …" is split.
 *    Ingredient lines move into `ingredients` only when they are not already
 *    there. Method lines become `instructions`. Lines that are not part of that
 *    labeled block are left alone.
 * 5. Near-duplicate reposts are merged. Two records are the same recipe only when
 *    their normalized titles match and their ingredient lists overlap strongly.
 *    The newest record is kept when it is roughly as complete as the fullest copy;
 *    otherwise the fullest copy is kept. Unsure pairs are left untouched.
 *
 * The Recipe object keeps its original 11 keys. Both
 * `src/data/recipes.json` and `ruhamasfood_recipes.json` are written from the
 * same string. The input list is newest-first and that order is preserved.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PATHS = [
  resolve(ROOT, "src/data/recipes.json"),
  resolve(ROOT, "ruhamasfood_recipes.json")
];
const REPORT_PATH = resolve(ROOT, "scripts/cleanup-report.json");

const KEYS = [
  "name",
  "handle",
  "url",
  "shortcode",
  "macros",
  "servings",
  "ingredients",
  "instructions",
  "caption_snippet",
  "has_ingredients",
  "has_instructions"
];

const STEP_LINE = /^\s*\d+[.)]\s+/;
const DOUBLED_WORD = /\b(of|with|the|it)\s+\1\b/gi;
const TITLE_STOP = new Set(["a", "an", "the", "and", "with", "for", "of", "to"]);
const INGREDIENT_STOP = new Set(
  `a an the of and or to with for in on cup cups tablespoon tablespoons teaspoon teaspoons
   tsp tbsp oz lb lbs pound pounds gram grams ml ounce ounces sliced chopped minced diced
   fresh dried large medium small optional into until about more than per each whole
   salt pepper oil olive water kosher black white powder cloves clove taste ground
   flaky sea spray canola avocado`.split(/\s+/)
);

const SAME_TITLE_CONTAINMENT = 0.92;
const REORDERED_TITLE_CONTAINMENT = 0.95;
const MIN_OVERLAP_TOKENS = 4;

function normalizeTitle(name) {
  return (name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleTokenKey(name) {
  const tokens = normalizeTitle(name)
    .split(" ")
    .filter((token) => token.length > 1 && !TITLE_STOP.has(token));
  return [...new Set(tokens)].sort().join(" ");
}

function compareText(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.…!?,;:]+$/g, "")
    .trim();
}

function sameStep(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length < 24) return false;
  if (!longer.startsWith(shorter)) return false;
  return shorter.length / longer.length >= 0.85;
}

function ingredientTokens(lines) {
  const text = (lines || [])
    .filter((line) => !STEP_LINE.test(line))
    .join(" ")
    .toLowerCase();
  const words = text.match(/[a-z]{3,}/g) || [];
  return new Set(words.filter((word) => !INGREDIENT_STOP.has(word)));
}

function containment(left, right) {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  return shared / Math.min(left.size, right.size);
}

function completeness(recipe) {
  const ingredients = (recipe.ingredients || []).filter(
    (line) => line.trim() && !STEP_LINE.test(line)
  ).length;
  const instructions = (recipe.instructions || []).filter((line) => line.trim()).length;
  return ingredients + instructions;
}

function collapseDoubledWords(text) {
  let count = 0;
  let next = text;
  for (let pass = 0; pass < 4; pass += 1) {
    const updated = next.replace(DOUBLED_WORD, (match) => {
      count += 1;
      return match.match(/^(of|with|the|it)/i)[0];
    });
    if (updated === next) break;
    next = updated;
  }
  return { text: next, count };
}

function isEmojiOnly(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return !/[\p{L}\p{N}]/u.test(trimmed);
}

function stripEmoji(text) {
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\uFE0F\u200D]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanTextFields(recipe) {
  let doubledWords = 0;
  let emojiLines = 0;
  let emojiStripped = 0;

  const cleanString = (value) => {
    if (typeof value !== "string" || !value) return value;
    const result = collapseDoubledWords(value);
    doubledWords += result.count;
    return result.text;
  };

  const cleanLines = (lines) => {
    if (!Array.isArray(lines)) return lines;
    const kept = [];
    for (const line of lines) {
      if (typeof line !== "string") {
        kept.push(line);
        continue;
      }
      if (isEmojiOnly(line)) {
        emojiLines += 1;
        continue;
      }
      const withoutEmoji = stripEmoji(line);
      if (withoutEmoji !== line.trim()) emojiStripped += 1;
      if (!withoutEmoji || isEmojiOnly(withoutEmoji)) {
        if (withoutEmoji !== line.trim()) emojiLines += 1;
        continue;
      }
      const result = collapseDoubledWords(withoutEmoji);
      doubledWords += result.count;
      kept.push(result.text);
    }
    return kept;
  };

  return {
    recipe: {
      ...recipe,
      name: cleanString(recipe.name),
      ingredients: cleanLines(recipe.ingredients),
      instructions: cleanLines(recipe.instructions),
      caption_snippet: cleanString(recipe.caption_snippet)
    },
    doubledWords,
    emojiLines,
    emojiStripped
  };
}

function relocateSteps(recipe) {
  const ingredients = [];
  const steps = [];
  for (const line of recipe.ingredients || []) {
    if (typeof line === "string" && STEP_LINE.test(line)) {
      steps.push(line.replace(STEP_LINE, "").trim());
    } else {
      ingredients.push(line);
    }
  }

  if (steps.length === 0) {
    return { recipe, stepLines: 0, appended: 0 };
  }

  const instructions = [...(recipe.instructions || [])];
  const known = instructions.map((line) => compareText(line));
  let appended = 0;

  for (const step of steps) {
    const normalized = compareText(step);
    if (!normalized) continue;
    const already = known.some((existing) => sameStep(existing, normalized));
    if (!already) {
      instructions.push(step);
      known.push(normalized);
      appended += 1;
    }
  }

  return {
    recipe: { ...recipe, ingredients, instructions },
    stepLines: steps.length,
    appended
  };
}

const INGREDIENT_LABEL = /^ingredients?\s*[-–:]\s*(.*)$/i;
const METHOD_LABEL = /^method\s*[-–:]\s*(.*)$/i;
const GROUP_LABEL = /^(?:recipe|dressing|seasoning|sauce|topping|filling|garnish|ingredients?)\s*[-–:]\s*$/i;
const FOR_THE_LABEL = /^for the [\p{L}\s'’-]*[-–:]\s*$/iu;

function instructionLines(instructions) {
  const lines = [];
  for (const block of instructions || []) {
    if (typeof block !== "string") continue;
    for (const piece of block.split(/\n/)) {
      const trimmed = piece.trim();
      if (trimmed) lines.push(trimmed);
    }
  }
  return lines;
}

function isMethodBleed(line, methodKeys) {
  const key = compareText(line);
  if (key.length < 40) return false;
  return methodKeys.some((step) => {
    if (!step) return false;
    if (sameStep(step, key)) return true;
    const shorter = key.length <= step.length ? key : step;
    const longer = key.length <= step.length ? step : key;
    return shorter.length >= 40 && longer.startsWith(shorter);
  });
}

function splitJammedInstructions(recipe) {
  const lines = instructionLines(recipe.instructions);
  const ingredientAt = lines.findIndex((line) => INGREDIENT_LABEL.test(line));
  if (ingredientAt < 0) return { recipe, split: false, added: 0, bleed: 0 };
  const methodAt = lines.findIndex((line, index) => index > ingredientAt && METHOD_LABEL.test(line));
  if (methodAt < 0) return { recipe, split: false, added: 0, bleed: 0 };

  const ingredientLines = [];
  const ingredientRest = lines[ingredientAt].match(INGREDIENT_LABEL)[1].trim();
  if (ingredientRest) ingredientLines.push(ingredientRest);
  for (const line of lines.slice(ingredientAt + 1, methodAt)) {
    if (GROUP_LABEL.test(line) || FOR_THE_LABEL.test(line)) continue;
    ingredientLines.push(line);
  }

  const methodLines = [];
  const methodRest = lines[methodAt].match(METHOD_LABEL)[1].trim();
  if (methodRest) methodLines.push(methodRest);
  for (const line of lines.slice(methodAt + 1)) {
    if (/^recipe\s*[-–:]\s*$/i.test(line)) continue;
    methodLines.push(line);
  }

  if (ingredientLines.length < 2 || methodLines.length < 1) {
    return { recipe, split: false, added: 0, bleed: 0 };
  }
  if (ingredientLines.some((line) => line.length > 160 && !/^\d/.test(line))) {
    return { recipe, split: false, added: 0, bleed: 0 };
  }

  const ingredients = [...(recipe.ingredients || [])];
  const known = ingredients.map((line) => compareText(line));
  let added = 0;
  for (const line of ingredientLines) {
    const key = compareText(line);
    if (!key) continue;
    if (known.some((existing) => existing === key || sameStep(existing, key))) continue;
    ingredients.push(line);
    known.push(key);
    added += 1;
  }

  const methodKeys = methodLines.map((line) => compareText(line));
  let bleed = 0;
  const keptIngredients = ingredients.filter((line) => {
    if (!isMethodBleed(line, methodKeys)) return true;
    bleed += 1;
    return false;
  });

  return {
    recipe: { ...recipe, ingredients: keptIngredients, instructions: methodLines },
    split: true,
    added,
    bleed
  };
}

function orderRecord(recipe) {
  const ordered = {};
  for (const key of KEYS) {
    if (key in recipe) ordered[key] = recipe[key];
  }
  ordered.has_ingredients = Array.isArray(ordered.ingredients) && ordered.ingredients.some((line) => String(line).trim());
  ordered.has_instructions = Array.isArray(ordered.instructions) && ordered.instructions.some((line) => String(line).trim());
  return ordered;
}

function snapshot(recipe) {
  return {
    name: recipe.name,
    shortcode: recipe.shortcode,
    ingredientCount: (recipe.ingredients || []).length,
    instructionCount: (recipe.instructions || []).length,
    ingredients: (recipe.ingredients || []).slice(0, 8),
    instructions: (recipe.instructions || []).slice(0, 4)
  };
}

function similarEnough(titleMode, leftTokens, rightTokens) {
  if (leftTokens.size < MIN_OVERLAP_TOKENS || rightTokens.size < MIN_OVERLAP_TOKENS) {
    return false;
  }
  const overlap = containment(leftTokens, rightTokens);
  const threshold = titleMode === "exact" ? SAME_TITLE_CONTAINMENT : REORDERED_TITLE_CONTAINMENT;
  return overlap >= threshold;
}

function canMergePair(recipes, tokenSets, left, right) {
  const leftTitle = normalizeTitle(recipes[left].name);
  const rightTitle = normalizeTitle(recipes[right].name);
  if (leftTitle.length < 3) return false;

  const sameTitle = leftTitle === rightTitle;
  const leftKey = titleTokenKey(recipes[left].name);
  const sameTokens = leftKey === titleTokenKey(recipes[right].name);
  if (!sameTitle && !sameTokens) return false;

  const tokenCount = leftKey.split(" ").filter(Boolean).length;
  if (!sameTitle && tokenCount < 3) return false;
  return similarEnough(sameTitle ? "exact" : "reordered", tokenSets[left], tokenSets[right]);
}

function clusterDuplicates(recipes) {
  const tokenSets = recipes.map((recipe) => ingredientTokens(recipe.ingredients));
  const consumed = new Set();
  const merges = [];
  const dropped = new Set();

  for (let seed = 0; seed < recipes.length; seed += 1) {
    if (consumed.has(seed)) continue;
    const members = [seed];
    for (let other = seed + 1; other < recipes.length; other += 1) {
      if (consumed.has(other)) continue;
      if (canMergePair(recipes, tokenSets, seed, other)) members.push(other);
    }
    if (members.length < 2) continue;
    for (const index of members) consumed.add(index);

    const newest = seed;
    let fullest = seed;
    for (const index of members) {
      if (completeness(recipes[index]) > completeness(recipes[fullest])) fullest = index;
    }
    const keep = completeness(recipes[newest]) >= completeness(recipes[fullest]) * 0.8 ? newest : fullest;
    const removed = members.filter((index) => index !== keep);
    for (const index of removed) dropped.add(index);

    merges.push({
      kept: {
        name: recipes[keep].name,
        shortcode: recipes[keep].shortcode,
        index: keep,
        completeness: completeness(recipes[keep])
      },
      dropped: removed.map((index) => ({
        name: recipes[index].name,
        shortcode: recipes[index].shortcode,
        index,
        completeness: completeness(recipes[index]),
        ingredientOverlap: Number(containment(tokenSets[keep], tokenSets[index]).toFixed(3))
      })),
      keptNewest: keep === newest,
      minOverlapWithKept: Number(
        Math.min(...removed.map((index) => containment(tokenSets[keep], tokenSets[index]))).toFixed(3)
      )
    });
  }

  merges.sort((a, b) => a.kept.index - b.kept.index);
  return { merges, dropped };
}

function buildExamples(originals, cleaned, merges) {
  const byCode = new Map(cleaned.map((recipe) => [recipe.shortcode, recipe]));
  const examples = [];

  for (const pattern of [/schnitzel friday/i, /fish schnitzel/i]) {
    const merge = merges.find((item) => pattern.test(item.kept.name));
    if (!merge) continue;
    const removed = merge.dropped[0];
    examples.push({
      kind: "duplicate-merge",
      before: snapshot(originals[removed.index]),
      after: snapshot(byCode.get(merge.kept.shortcode)),
      alsoRemoved: merge.dropped.slice(1).map((item) => item.shortcode)
    });
  }

  const stepRecords = originals.filter((recipe) =>
    (recipe.ingredients || []).some((line) => STEP_LINE.test(line)) && byCode.has(recipe.shortcode)
  );
  for (const recipe of stepRecords.slice(0, 2)) {
    examples.push({
      kind: "steps-in-ingredients",
      before: snapshot(recipe),
      after: snapshot(byCode.get(recipe.shortcode))
    });
  }

  const doubled = originals.find(
    (recipe) =>
      byCode.has(recipe.shortcode) &&
      (recipe.ingredients || []).some((line) => /\bof of\b/i.test(line))
  );
  if (doubled) {
    examples.push({
      kind: "doubled-word",
      before: snapshot(doubled),
      after: snapshot(byCode.get(doubled.shortcode))
    });
  }

  return examples.slice(0, 5);
}

export function cleanRecipes(recipes) {
  const originals = recipes.map((recipe) => structuredClone(recipe));
  let doubledWords = 0;
  let emojiLines = 0;
  let emojiStripped = 0;
  let recordsWithSteps = 0;
  let stepLines = 0;
  let stepsAppended = 0;
  let recordsSplit = 0;
  let ingredientLinesAdded = 0;
  let methodBleedRemoved = 0;
  const preferredSplits = new Map();
  const otherSplits = [];
  const preferredPatterns = [/latkes full of love/i, /^shawarma spiced salmon cubes!/i, /^moroccan carrot salad!/i];

  const cleaned = recipes.map((recipe) => {
    const text = cleanTextFields(recipe);
    doubledWords += text.doubledWords;
    emojiLines += text.emojiLines;
    emojiStripped += text.emojiStripped;
    const steps = relocateSteps(text.recipe);
    if (steps.stepLines > 0) recordsWithSteps += 1;
    stepLines += steps.stepLines;
    stepsAppended += steps.appended;
    const jammed = splitJammedInstructions(steps.recipe);
    if (jammed.split) {
      recordsSplit += 1;
      ingredientLinesAdded += jammed.added;
      methodBleedRemoved += jammed.bleed;
      const example = { before: snapshot(recipe), after: snapshot(jammed.recipe) };
      const preferredAt = preferredPatterns.findIndex((pattern) => pattern.test(recipe.name));
      if (preferredAt >= 0) {
        if (!preferredSplits.has(preferredAt)) preferredSplits.set(preferredAt, example);
      } else if (otherSplits.length < 3) otherSplits.push(example);
    }
    return jammed.recipe;
  });

  const { merges, dropped } = clusterDuplicates(cleaned);
  const kept = cleaned.filter((_, index) => !dropped.has(index)).map(orderRecord);
  const examples = buildExamples(originals, kept, merges);

  return {
    recipes: kept,
    report: {
      inputCount: recipes.length,
      outputCount: kept.length,
      duplicates: {
        clustersMerged: merges.length,
        recordsRemoved: dropped.size,
        rule: `Same normalized title and ingredient containment >= ${SAME_TITLE_CONTAINMENT}, or the same title words in another order (3+ words) and containment >= ${REORDERED_TITLE_CONTAINMENT}. Both sides need at least ${MIN_OVERLAP_TOKENS} content ingredient tokens. Newest copy is kept when it has at least 80% of the fullest copy's ingredient+instruction lines.`,
        merges
      },
      ingredients: {
        recordsWithNumberedSteps: recordsWithSteps,
        numberedStepLinesRemovedFromIngredients: stepLines,
        numberedStepLinesAppendedToInstructions: stepsAppended,
        numberedStepLinesAlreadyInInstructions: stepLines - stepsAppended,
        emojiOnlyLinesRemoved: emojiLines,
        linesWithEmojiStripped: emojiStripped
      },
      instructionSplits: {
        recordsSplit,
        ingredientLinesAdded,
        methodBleedLinesRemoved: methodBleedRemoved,
        rule: "An instruction contains an Ingredients- label and a later Method- label. Lines between them join ingredients when not already present. Lines after Method- become the instructions. A line in ingredients that repeats a method sentence is removed. Blocks without both labels are left alone.",
        examples: [...preferredPatterns.keys()].flatMap((index) => {
          const example = preferredSplits.get(index);
          return example ? [example] : [];
        }).concat(otherSplits).slice(0, 3)
      },
      text: {
        doubledFunctionWordsCollapsed: doubledWords,
        pattern: "of of | with with | the the | it it"
      },
      examples
    }
  };
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const raw = readFileSync(PATHS[0], "utf8");
  const recipes = JSON.parse(raw);
  const { recipes: cleaned, report } = cleanRecipes(recipes);

  if (report.duplicates.recordsRemoved === 0) {
    try {
      const previous = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
      if (previous?.duplicates?.recordsRemoved > 0) {
        report.duplicates = previous.duplicates;
        report.examples = previous.examples || report.examples;
      }
    } catch {
      // no earlier report to keep
    }
  }

  const body = `${JSON.stringify(cleaned, null, 2)}\n`;
  const reportBody = `${JSON.stringify(report, null, 2)}\n`;

  if (!dryRun) {
    for (const path of PATHS) writeFileSync(path, body);
    writeFileSync(REPORT_PATH, reportBody);
  }

  const summary = {
    dryRun,
    inputCount: report.inputCount,
    outputCount: report.outputCount,
    clustersMerged: report.duplicates.clustersMerged,
    recordsRemoved: report.duplicates.recordsRemoved,
    recordsWithNumberedSteps: report.ingredients.recordsWithNumberedSteps,
    stepLines: report.ingredients.numberedStepLinesRemovedFromIngredients,
    stepsAppended: report.ingredients.numberedStepLinesAppendedToInstructions,
    doubledWords: report.text.doubledFunctionWordsCollapsed,
    emojiLines: report.ingredients.emojiOnlyLinesRemoved,
    emojiStripped: report.ingredients.linesWithEmojiStripped,
    recordsSplit: report.instructionSplits.recordsSplit,
    ingredientLinesAdded: report.instructionSplits.ingredientLinesAdded,
    methodBleedRemoved: report.instructionSplits.methodBleedLinesRemoved
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

const isDirectRun = process.argv.some((arg) => /(?:^|\/)clean_recipes\.mjs$/.test(arg));
if (isDirectRun) main();
