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
  titleTokens?: string[];
  ingredientTokens?: string[];
  instructionTokens?: string[];
  captionTokens?: string[];
  /** Why this row matched, when the title itself doesn't show it. */
  matchLabel?: string;
  /** Query plus corrected or stemmed words to highlight. */
  highlightTerms?: string;
}
