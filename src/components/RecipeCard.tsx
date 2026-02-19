import type { SearchableRecipe } from '../lib/types';

interface RecipeCardProps {
  recipe: SearchableRecipe;
}

function ingredientPreview(ingredients: string[]): string {
  if (ingredients.length === 0) {
    return 'No ingredients listed';
  }

  const previewCount = 4;
  const preview = ingredients.slice(0, previewCount).join(' | ');
  const extra = ingredients.length - previewCount;

  return extra > 0 ? `${preview} | +${extra} more` : preview;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const instructions = recipe.instructions ?? [];
  const recipeKey = recipe.shortcode ?? recipe.name;

  return (
    <article className="recipe-card">
      <details>
        <summary>
          <h2>{recipe.name}</h2>
          <p>{ingredientPreview(recipe.cleanIngredients)}</p>
        </summary>

        <section className="recipe-details">
          <h3>Ingredients</h3>
          {recipe.cleanIngredients.length === 0 ? (
            <p>No ingredients listed.</p>
          ) : (
            <ul>
              {recipe.cleanIngredients.map((ingredient, index) => (
                <li key={`${recipeKey}-ingredient-${index}`}>{ingredient}</li>
              ))}
            </ul>
          )}

          <h3>Instructions</h3>
          {instructions.length === 0 ? (
            <p>No instructions listed.</p>
          ) : (
            <ol>
              {instructions.map((step, index) => (
                <li key={`${recipeKey}-step-${index}`}>{step}</li>
              ))}
            </ol>
          )}

          {recipe.url ? (
            <p>
              <a href={recipe.url} target="_blank" rel="noreferrer">
                View source post
              </a>
            </p>
          ) : null}
        </section>
      </details>
    </article>
  );
}
