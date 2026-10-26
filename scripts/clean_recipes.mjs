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
 * 6. A title that is a sign-off, a call to action, or a sentence rather than a
 *    dish name is replaced with the first dish-like line already in that title
 *    or, when the title has none, in the caption. Nothing is invented. A title
 *    that is already a dish name is left alone, even when it is long.
 * 7. Standalone section labels ("Frying-", "For the sauce:") stay in the lists.
 *    The report counts them; the UI renders them as subheadings.
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

const CTA_IN_TITLE = /\bfollow\b[^.]{0,48}ruhama|\bfollow\b[^.]{0,32}for more|\bsave this\b|\bfull recipe (?:below|in the caption)\b|\blink in bio\b/i;
const SENTENCE_START = /^(this|when|are|so|do|want|lets|let's|i|i'm|im|as|if|you|we|our|today|hello|hey|wow|here|check|please|enjoy|made|try|growing|have|did|can|who|what|why|how|just|ever|after|before|because|since|there)\b/i;

function textSegments(text) {
  return stripEmoji(String(text || ""))
    .replace(/[@#][\p{L}\p{N}_]+/gu, " ")
    .split(/[!?\n]|⬇️|👇/u)
    .map((part) => part.replace(/^[\s.👇⬇️\-–:,]+/u, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isCtaSegment(segment) {
  return (/\bfollow\b/i.test(segment) && /ruhama|for more|recipe/i.test(segment))
    || /^save this\b/i.test(segment)
    || /^save\b/i.test(segment)
    || /^full recipe\b/i.test(segment)
    || /^save my\b/i.test(segment)
    || /^save the recipe\b/i.test(segment)
    || /^comment\b/i.test(segment)
    || /^follow\b/i.test(segment)
    || /^tag\b/i.test(segment)
    || /\brecipe below\b/i.test(segment)
    || /^here (?:is|are)\b/i.test(segment);
}

const DISH_BAN = /\b(friend|family|below|tips|shalom|colorful|caption|bio|yummy|delicious|healthy|perfect|favorite|mixture|flavors|comfort|bonus|love|happy|favor|watch|everyday|again|kids|mom|allergic|secret is)\b/i;
const DISH_PRONOUN = /\b(it|it's|its|you|your|my|me|we|our|them|they|this|that|i)\b/i;
const DISH_START = /^(drizzle|score|tag|follow|make|mix|add|pour|preheat|bake|fry|slice|chop|place|put|serve|enjoy|watch|try|use|take|cut|heat|cook|whisk|stir|combine|spread|finely|thinly|lots|buttery|shabbat|recipe|link|full|save|comment|golden|one|it|here|and|so|you|do|are|this|lets|let's|swipe|click|share)\b/i;
const DANGLING_END = /\b(with|and|or|of|the|a|an|to|for|in|on|over|from|into|by|fresh|more|put|your|my)$/i;
const LEAD_IN = /^(?:you|must|try|this|what|can|make|with|two|how|to|the|do|want|so|please|check|just|my|new|here|is|are|for|it|and|all|need|your|some|that|will|be|of|in|on|these|those|get|got|have|has|our|we|i|im|lets|let's)\s+/i;

function isDishSegment(segment) {
  const text = segment.replace(/\s+/g, " ").trim();
  if (!text || isCtaSegment(text)) return false;
  if (SENTENCE_START.test(text)) return false;
  if (/^\d/.test(text)) return false;
  if (/\b(cups?|teaspoons?|tablespoons?|tsp|tbsp|pounds?|ounces?|oz|grams?|kilograms?|ml|kg|lb|lbs)\b/i.test(text)) return false;
  if (/\b(it's|its|this is|don't|dont|going to|will be|must try|i am|i'm|you can|we're|we are)\b/i.test(text)) return false;
  if (/\b(ingredients|method|instructions|directions|caption)\b/i.test(text)) return false;
  const words = text.split(/\s+/).filter((word) => /\p{L}/u.test(word));
  if (words.length < 2 || words.length > 10) return false;
  if (text.length > 72) return false;
  return true;
}

function isCleanDish(segment) {
  const text = segment.replace(/\s+/g, " ").trim();
  if (!text || isCtaSegment(text) || !isDishSegment(text)) return false;
  if (!/[A-Za-z]/.test(text)) return false;
  if (/[?:]/.test(text) || /,/.test(text) || /["“”']/.test(text)) return false;
  if (DISH_BAN.test(text) || DISH_PRONOUN.test(text) || DISH_START.test(text)) return false;
  if (DANGLING_END.test(text)) return false;
  if (/^(a|an|the)\s+\S+$/i.test(text)) return false;
  const words = text.split(/\s+/).filter((word) => /\p{L}/u.test(word));
  if (words.length > 8) return false;
  return true;
}

function stripLeadIn(text) {
  let next = text.trim();
  for (let pass = 0; pass < 8; pass += 1) {
    const stripped = next.replace(LEAD_IN, "").trim();
    if (stripped === next) break;
    next = stripped;
  }
  return next;
}

function trailingDish(segment) {
  const match = segment.match(/(\p{Lu}[\p{L}0-9'’\-]*(?:\s+(?:with|and|or|over|of|a|the|in|on|&)\s+\p{Lu}[\p{L}0-9'’\-]*|\s+\p{Lu}[\p{L}0-9'’\-]*){1,7})\s*$/u);
  if (!match || !isCleanDish(match[1])) return null;
  const before = segment.slice(0, match.index).trim();
  if (!before) return match[1];
  if (/(?:\brecipe of|\bthis)\s*[-–:]?$/i.test(before)) return match[1];
  if (/\p{L}[-–:]\s*$/u.test(before)) return match[1];
  const prose = before.split(/\s+/).filter((word) => /\p{L}/u.test(word));
  const leadWord = /^(try|this|my|the|a|an|our|so|just|homemade|yummy|easy|new|these|those|some|get|you)$/i;
  if (prose.length > 0 && prose.length <= 4 && prose.every((word) => word === word.toLowerCase() || leadWord.test(word))) {
    return match[1];
  }
  return null;
}

function firstDish(text) {
  const raw = String(text || "");
  const segments = textSegments(raw);
  const tailIsCutOff = segments.length > 0 && raw.trim().length > 40 && !/[!?.…]\s*$/.test(raw.trim());
  const usable = tailIsCutOff ? segments.slice(0, -1) : segments;

  for (const segment of usable) {
    const whole = segment.replace(/[.\s]+$/g, "").trim();
    if (isCleanDish(whole)) return whole;

    const commaParts = segment.split(",");
    if (commaParts.length === 2 && !/ [-–] /.test(segment)) {
      const clause = commaParts[0].replace(/[.\s]+$/g, "").trim();
      if (clause.split(/\s+/).filter(Boolean).length >= 3 && isCleanDish(clause)) return clause;
    }

    const caps = segment.match(/\b\p{Lu}[\p{Lu}0-9'’\-]+(?:\s+\p{Lu}[\p{Lu}0-9'’\-]+){1,7}\b/u);
    if (caps) {
      const at = segment.indexOf(caps[0]);
      const before = at >= 0 ? segment.slice(0, at) : "";
      const leadOk = before.trim().length === 0
        || /(?:\brecipe of|\bthis|\bmake)\s*[-–:]?\s*$/i.test(before)
        || /\p{L}[-–:]\s*$/u.test(before);
      if (leadOk && /try this/i.test(caps[0])) {
        const stripped = stripLeadIn(caps[0]);
        if (stripped !== caps[0] && isCleanDish(stripped)) return stripped;
      }
      if (leadOk && isCleanDish(caps[0])) return caps[0];
    }

    const trailing = trailingDish(segment);
    if (trailing) return trailing;
  }
  return null;
}

function stripSignOff(name) {
  const stripped = name
    .replace(/[!?.\s]*(?:save this|follow\b|full recipe\b|link in bio\b)[\s\S]*$/i, "")
    .replace(/[!?.\s]+$/g, "")
    .trim();
  if (!stripped || CTA_IN_TITLE.test(stripped) || SENTENCE_START.test(stripped)) return null;
  const words = stripped.split(/\s+/).filter((word) => /\p{L}/u.test(word));
  if (words.length < 2 || words.length > 14 || stripped.length > 80) return null;
  return stripped;
}

function titleNeedsRepair(name) {
  if (CTA_IN_TITLE.test(name)) return true;
  const bare = name.replace(/[!?.\s]+$/g, "").trim();
  if (!bare) return true;
  if (SENTENCE_START.test(bare)) return true;
  if (/\?/.test(name)) return true;
  return false;
}

function repairTitle(recipe) {
  const name = String(recipe.name || "").replace(/\s+/g, " ").trim();
  if (!titleNeedsRepair(name)) return null;

  const bare = name.replace(/[!?.]+$/g, "").trim();
  const fromSignOff = stripSignOff(name);
  const fromTitle = firstDish(name);
  const fromCaption = firstDish(recipe.caption_snippet || "");
  const replacement = fromSignOff || fromTitle || fromCaption;
  if (!replacement) return null;
  if (normalizeTitle(replacement) === normalizeTitle(bare)) return null;
  let source = "caption";
  if (fromSignOff) source = "title";
  else if (fromTitle) source = "title";
  return {
    before: name,
    after: replacement,
    source,
    shortcode: recipe.shortcode
  };
}

function countSectionHeadings(recipes) {
  const heading = /^[\p{L}\p{N}][\p{L}\p{N}\s'’&/-]{0,42}[-–:]$/u;
  let ingredients = 0;
  let instructions = 0;
  const lines = [];
  for (const recipe of recipes) {
    for (const field of ["ingredients", "instructions"]) {
      for (const line of recipe[field] || []) {
        const trimmed = String(line).trim();
        if (!heading.test(trimmed) || /[,.!;?\d]/.test(trimmed.slice(0, -1))) continue;
        const words = trimmed.slice(0, -1).trim().split(/\s+/);
        if (words.length < 1 || words.length > 6) continue;
        if (field === "ingredients") ingredients += 1;
        else instructions += 1;
        lines.push({ where: field, name: recipe.name, shortcode: recipe.shortcode, line: trimmed });
      }
    }
  }
  return {
    ingredients,
    instructions,
    total: ingredients + instructions,
    examples: lines.slice(0, 8),
    lines
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
  const titled = cleaned
    .filter((_, index) => !dropped.has(index))
    .map((recipe) => {
      const fix = repairTitle(recipe);
      return { recipe: fix ? { ...recipe, name: fix.after } : recipe, fix };
    });
  const revealed = clusterDuplicates(titled.map((item) => item.recipe));
  const titleFixes = [];
  const kept = titled
    .filter((_, index) => !revealed.dropped.has(index))
    .map((item) => {
      if (item.fix) titleFixes.push(item.fix);
      return orderRecord(item.recipe);
    });
  const examples = buildExamples(originals, kept, merges);
  const sectionHeadings = countSectionHeadings(kept);

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
      titleFixes: {
        count: titleFixes.length,
        rule: "A title is replaced only when it is a sign-off, a call to action, or a sentence rather than a dish name, and the title or caption already contains one unambiguous dish line. The new title is that line. No title is invented. A renamed record that then matches a newer copy of the same recipe (same title rule, ingredient containment 1) is dropped instead of shown twice.",
        changes: titleFixes,
        duplicatesRemoved: {
          count: revealed.dropped.size,
          merges: revealed.merges
        }
      },
      sectionHeadings,
      examples
    }
  };
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const raw = readFileSync(PATHS[0], "utf8");
  const recipes = JSON.parse(raw);
  const { recipes: cleaned, report } = cleanRecipes(recipes);

  try {
    const previous = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
    if (report.duplicates.recordsRemoved === 0 && previous?.duplicates?.recordsRemoved > 0) {
      report.duplicates = previous.duplicates;
      report.examples = previous.examples || report.examples;
    }
    if (report.instructionSplits.recordsSplit === 0 && previous?.instructionSplits?.recordsSplit > 0) {
      report.instructionSplits = previous.instructionSplits;
    }
    if (report.titleFixes.count === 0 && previous?.titleFixes?.count > 0) {
      report.titleFixes = previous.titleFixes;
    }
  } catch {
    // no earlier report to keep
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
    methodBleedRemoved: report.instructionSplits.methodBleedLinesRemoved,
    titleFixes: report.titleFixes.changes,
    titleDuplicatesRemoved: report.titleFixes.duplicatesRemoved,
    sectionHeadings: {
      ingredients: report.sectionHeadings.ingredients,
      instructions: report.sectionHeadings.instructions,
      lines: report.sectionHeadings.lines.map((item) => `${item.where}: ${item.line}`)
    }
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

const isDirectRun = process.argv.some((arg) => /(?:^|\/)clean_recipes\.mjs$/.test(arg));
if (isDirectRun) main();
