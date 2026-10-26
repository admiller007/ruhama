import { splitHighlightSegments } from '../lib/highlight';
import { cardMeta } from '../lib/meta';
import type { SearchableRecipe } from '../lib/types';

interface RecipeCardProps {
  recipe: SearchableRecipe;
  searchQuery?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (key: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface RecipeFact {
  label: string;
  value: string;
}

function formatFactValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return null;
}

function titleCaseLabel(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function recipeFacts(recipe: SearchableRecipe): RecipeFact[] {
  const facts: RecipeFact[] = [];

  if (typeof recipe.servings === 'number' && Number.isFinite(recipe.servings)) {
    facts.push({ label: 'Servings', value: String(recipe.servings) });
  }

  for (const [key, value] of Object.entries(recipe.macros ?? {})) {
    const formatted = formatFactValue(value);
    if (!formatted) continue;
    facts.push({ label: titleCaseLabel(key), value: formatted });
  }

  return facts;
}

export function RecipeCard({
  recipe,
  searchQuery = '',
  isFavorite = false,
  onToggleFavorite,
  open = false,
  onOpenChange
}: RecipeCardProps) {
  const instructions = recipe.instructions ?? [];
  const recipeKey = recipe.shortcode ?? recipe.name;
  const highlightQuery = recipe.highlightTerms || searchQuery;
  const meta = cardMeta(recipe.cleanIngredients, recipe.macros, highlightQuery);
  const facts = recipeFacts(recipe);

  const renderHighlightedText = (text: string) =>
    splitHighlightSegments(text, highlightQuery).map((segment, index) =>
      segment.isMatch ? (
        <mark key={`${text}-${index}`} className="search-highlight">
          {segment.text}
        </mark>
      ) : (
        <span key={`${text}-${index}`}>{segment.text}</span>
      )
    );

  return (
    <article className="recipe-card" id={`recipe-${recipeKey}`}>
      <details open={onOpenChange ? open : undefined}>
        <summary
          onClick={(event) => {
            if (!onOpenChange) return;
            event.preventDefault();
            onOpenChange(!open);
          }}
        >
          <span className="recipe-index" aria-hidden="true" />
          <div className="card-summary-content">
            <h2>{renderHighlightedText(recipe.name)}</h2>
            <p className="ingredient-preview">
              {recipe.matchLabel ? (
                <span className="match-reason">{recipe.matchLabel}</span>
              ) : null}
              {recipe.matchLabel && meta ? <span className="meta-dot"> · </span> : null}
              {meta ? renderHighlightedText(meta) : recipe.matchLabel ? null : 'No ingredients listed'}
            </p>
          </div>
          <div className="card-actions">
            {onToggleFavorite && (
              <button
                type="button"
                className={`favorite-button${isFavorite ? ' is-favorited' : ''}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleFavorite(recipeKey);
                }}
                aria-label={
                  isFavorite
                    ? `Remove ${recipe.name} from favorites`
                    : `Add ${recipe.name} to favorites`
                }
                aria-pressed={isFavorite}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill={isFavorite ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            )}
            <span className="expand-chevron" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </div>
        </summary>

        <section className="recipe-details">
          <div className="recipe-details-inner">
            {facts.length > 0 && (
              <dl className="recipe-facts">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="recipe-columns">
              <div className="recipe-column">
                <h3>Ingredients</h3>
                {recipe.cleanIngredients.length === 0 ? (
                  <p className="empty-note">No ingredients listed.</p>
                ) : (
                  <ul className="ingredient-list">
                    {recipe.cleanIngredients.map((ingredient, index) => (
                      <li key={`${recipeKey}-ingredient-${index}`}>{ingredient}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="recipe-column">
                <h3>Instructions</h3>
                {instructions.length === 0 ? (
                  <p className="empty-note">No instructions listed.</p>
                ) : (
                  <ol className="instruction-list">
                    {instructions.map((step, index) => (
                      <li key={`${recipeKey}-step-${index}`}>{step}</li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            {recipe.url ? (
              <a
                className="source-link"
                href={recipe.url}
                target="_blank"
                rel="noreferrer"
              >
                View on Instagram
                <span className="visually-hidden"> (opens in a new tab)</span>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 17L17 7" />
                  <path d="M8 7h9v9" />
                </svg>
              </a>
            ) : null}
          </div>
        </section>
      </details>
    </article>
  );
}
