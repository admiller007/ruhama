import type { SearchableRecipe } from './types';

interface RankedResult {
  recipe: SearchableRecipe;
  score: number;
}

const DEFAULT_LIMIT = 100;

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function searchRecipes(
  recipes: SearchableRecipe[],
  query: string,
  limit = DEFAULT_LIMIT
): SearchableRecipe[] {
  const normalized = normalizeQuery(query);

  if (!normalized) {
    return recipes.slice(0, limit);
  }

  const ranked: RankedResult[] = [];

  for (const recipe of recipes) {
    const startsWith = recipe.normalizedName.startsWith(normalized);
    const nameContains = recipe.normalizedName.includes(normalized);
    const ingredientContains = recipe.normalizedIngredientText.includes(normalized);

    if (!nameContains && !ingredientContains) {
      continue;
    }

    const score = startsWith ? 0 : nameContains ? 1 : 2;
    ranked.push({ recipe, score });
  }

  ranked.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }

    return a.recipe.name.localeCompare(b.recipe.name);
  });

  return ranked.slice(0, limit).map((entry) => entry.recipe);
}
