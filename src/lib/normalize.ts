import { tokenize } from './text';
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

    const normalizedIngredientText = clean.join(' ').toLowerCase();

    return {
      ...recipe,
      cleanIngredients: clean,
      normalizedName: recipe.name.toLowerCase(),
      normalizedIngredientText,
      titleTokens: tokenize(recipe.name),
      ingredientTokens: tokenize(normalizedIngredientText),
      instructionTokens: tokenize((recipe.instructions ?? []).join(' ')),
      captionTokens: tokenize(recipe.caption_snippet ?? '')
    };
  });
}
