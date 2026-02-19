import type { Recipe, SearchableRecipe } from './types';

const NUMBERED_STEP_PATTERN = /^\s*\d+\.\s+/;

export function isLikelyInstructionLine(line: string): boolean {
  return NUMBERED_STEP_PATTERN.test(line);
}

export function cleanIngredients(ingredients: string[] | undefined): string[] {
  if (!ingredients || ingredients.length === 0) {
    return [];
  }

  return ingredients
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => !isLikelyInstructionLine(item));
}

export function buildSearchableRecipes(recipes: Recipe[]): SearchableRecipe[] {
  return recipes.map((recipe) => {
    const clean = cleanIngredients(recipe.ingredients);

    return {
      ...recipe,
      cleanIngredients: clean,
      normalizedName: recipe.name.toLowerCase(),
      normalizedIngredientText: clean.join(' ').toLowerCase()
    };
  });
}
