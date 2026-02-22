import { useEffect, useRef, useState } from 'react';
import { splitHighlightSegments } from '../lib/highlight';
import type { SearchableRecipe } from '../lib/types';

interface RecipeCardProps {
  recipe: SearchableRecipe;
  searchQuery?: string;
  animationDelay?: number;
  isFavorite?: boolean;
  onToggleFavorite?: (key: string) => void;
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

export function RecipeCard({
  recipe,
  searchQuery = '',
  animationDelay = 0,
  isFavorite = false,
  onToggleFavorite
}: RecipeCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const instructions = recipe.instructions ?? [];
  const recipeKey = recipe.shortcode ?? recipe.name;
  const ingredientCount = recipe.cleanIngredients.length;
  const ingredientPreviewText = ingredientPreview(recipe.cleanIngredients);

  const renderHighlightedText = (text: string) =>
    splitHighlightSegments(text, searchQuery).map((segment, index) =>
      segment.isMatch ? (
        <mark key={`${text}-${index}`} className="search-highlight">
          {segment.text}
        </mark>
      ) : (
        <span key={`${text}-${index}`}>{segment.text}</span>
      )
    );

  useEffect(() => {
    const cardElement = cardRef.current;
    if (!cardElement || isVisible) {
      return;
    }

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || typeof window.IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -6% 0px'
      }
    );

    observer.observe(cardElement);

    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <article
      ref={cardRef}
      className={`recipe-card${isVisible ? ' is-visible' : ''}`}
      style={{ transitionDelay: `${animationDelay}ms` }}
    >
      <details>
        <summary>
          <div className="card-summary-content">
            <h2>{renderHighlightedText(recipe.name)}</h2>
            <p className="ingredient-preview">
              {renderHighlightedText(ingredientPreviewText)}
            </p>
            {ingredientCount > 0 && (
              <span className="ingredient-count-badge">
                {ingredientCount} ingredient{ingredientCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {onToggleFavorite && (
            <button
              type="button"
              className={`favorite-button${isFavorite ? ' is-favorited' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(recipeKey);
              }}
              aria-label={isFavorite ? `Remove ${recipe.name} from favorites` : `Add ${recipe.name} to favorites`}
              aria-pressed={isFavorite}
            >
              {isFavorite ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              )}
            </button>
          )}
          <span className="expand-chevron" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </summary>

        <section className="recipe-details">
          <div className="recipe-details-inner">
            <div className="details-divider"></div>

            <h3>Ingredients</h3>
            {recipe.cleanIngredients.length === 0 ? (
              <p className="empty-note">No ingredients listed.</p>
            ) : (
              <ul>
                {recipe.cleanIngredients.map((ingredient, index) => (
                  <li key={`${recipeKey}-ingredient-${index}`}>{ingredient}</li>
                ))}
              </ul>
            )}

            <h3>Instructions</h3>
            {instructions.length === 0 ? (
              <p className="empty-note">No instructions listed.</p>
            ) : (
              <ol>
                {instructions.map((step, index) => (
                  <li key={`${recipeKey}-step-${index}`}>{step}</li>
                ))}
              </ol>
            )}

            {recipe.url ? (
              <a
                className="source-link"
                href={recipe.url}
                target="_blank"
                rel="noreferrer"
              >
                View on Instagram
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            ) : null}
          </div>
        </section>
      </details>
    </article>
  );
}
