import type { SearchableRecipe } from './types';

interface RankedResult {
  recipe: SearchableRecipe;
  score: number;
}

const DEFAULT_LIMIT = 100;

function tokenize(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function scoreRecipe(recipe: SearchableRecipe, tokens: string[]): number | null {
  let total = 0;

  for (const token of tokens) {
    const nameContains = recipe.normalizedName.includes(token);
    const ingredientContains = recipe.normalizedIngredientText.includes(token);

    if (!nameContains && !ingredientContains) {
      return null; // all tokens must match somewhere
    }

    const startsWith = recipe.normalizedName.startsWith(token);
    total += startsWith ? 0 : nameContains ? 1 : 2;
  }

  return total;
}

export function searchRecipes(
  recipes: SearchableRecipe[],
  query: string,
  limit = DEFAULT_LIMIT
): SearchableRecipe[] {
  const tokens = tokenize(query);

  if (tokens.length === 0) {
    return recipes.slice(0, limit);
  }

  const ranked: RankedResult[] = [];

  for (const recipe of recipes) {
    const score = scoreRecipe(recipe, tokens);
    if (score !== null) {
      ranked.push({ recipe, score });
    }
  }

  ranked.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }

    return a.recipe.name.localeCompare(b.recipe.name);
  });

  return ranked.slice(0, limit).map((entry) => entry.recipe);
}
