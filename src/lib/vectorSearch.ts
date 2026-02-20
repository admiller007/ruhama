import type { SearchableRecipe } from './types';

/**
 * Cosine similarity between two normalized vectors.
 * Since embeddings from all-MiniLM-L6-v2 are L2-normalized,
 * this is equivalent to the dot product.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

export interface VectorResult {
  recipe: SearchableRecipe;
  score: number;
}

/**
 * Find the top-K most semantically similar recipes to the query embedding.
 */
export function vectorSearch(
  queryEmbedding: number[],
  recipeEmbeddings: number[][],
  recipes: SearchableRecipe[],
  topK = 20
): VectorResult[] {
  const scores: VectorResult[] = [];

  for (let i = 0; i < recipeEmbeddings.length; i++) {
    const score = cosineSimilarity(queryEmbedding, recipeEmbeddings[i]);
    scores.push({ recipe: recipes[i], score });
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Apply mustInclude / mustExclude ingredient filters from the AI parser.
 */
export function applyIngredientFilters(
  results: VectorResult[],
  mustInclude: string[],
  mustExclude: string[]
): VectorResult[] {
  return results.filter(({ recipe }) => {
    const text = recipe.normalizedIngredientText;

    if (mustInclude.length > 0) {
      const hasAll = mustInclude.every((ing) =>
        text.includes(ing.toLowerCase())
      );
      if (!hasAll) return false;
    }

    if (mustExclude.length > 0) {
      const hasNone = mustExclude.every(
        (ing) => !text.includes(ing.toLowerCase())
      );
      if (!hasNone) return false;
    }

    return true;
  });
}
