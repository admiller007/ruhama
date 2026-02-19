import { useEffect, useMemo, useState } from 'react';
import rawRecipes from './data/recipes.json';
import { RecipeCard } from './components/RecipeCard';
import { SearchBar } from './components/SearchBar';
import { buildSearchableRecipes } from './lib/normalize';
import { searchRecipes } from './lib/search';
import type { Recipe } from './lib/types';

interface AppProps {
  initialRecipes?: Recipe[];
  resultLimit?: number;
  debounceMs?: number;
}

export default function App({
  initialRecipes = rawRecipes as Recipe[],
  resultLimit = 100,
  debounceMs = 150
}: AppProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(resultLimit);

  const searchableRecipes = useMemo(
    () => buildSearchableRecipes(initialRecipes),
    [initialRecipes]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => window.clearTimeout(timeout);
  }, [query, debounceMs]);

  useEffect(() => {
    setVisibleCount(resultLimit);
  }, [debouncedQuery, resultLimit]);

  const allResults = useMemo(
    () => searchRecipes(searchableRecipes, debouncedQuery, searchableRecipes.length),
    [searchableRecipes, debouncedQuery]
  );

  const visibleResults = useMemo(
    () => allResults.slice(0, visibleCount),
    [allResults, visibleCount]
  );

  const canLoadMore = visibleResults.length < allResults.length;

  return (
    <main className="app-shell">
      <header>
        <h1>Ruhama&apos;s Recipe Search</h1>
        <p>
          Showing {visibleResults.length} of {allResults.length} recipes
        </p>
      </header>

      <SearchBar
        query={query}
        onChange={setQuery}
        onClear={() => setQuery('')}
      />

      {allResults.length === 0 ? (
        <p className="empty-state">No recipes matched your search.</p>
      ) : (
        <>
          <section className="results-grid" aria-label="Recipe search results">
            {visibleResults.map((recipe) => (
              <RecipeCard key={recipe.shortcode ?? recipe.name} recipe={recipe} />
            ))}
          </section>
          {canLoadMore ? (
            <button
              type="button"
              className="load-more-button"
              onClick={() => setVisibleCount((current) => current + resultLimit)}
            >
              Load more
            </button>
          ) : null}
        </>
      )}
    </main>
  );
}
