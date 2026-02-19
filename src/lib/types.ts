export interface Recipe {
  name: string;
  handle?: string;
  url?: string;
  shortcode?: string;
  macros?: Record<string, unknown>;
  servings?: number | null;
  ingredients?: string[];
  instructions?: string[];
  caption_snippet?: string;
  has_ingredients?: boolean;
  has_instructions?: boolean;
}

export interface SearchableRecipe extends Recipe {
  cleanIngredients: string[];
  normalizedName: string;
  normalizedIngredientText: string;
}
