import { useCallback, useEffect, useMemo, useState } from 'react';
import rawRecipes from './data/recipes.json';
import { RecipeCard } from './components/RecipeCard';
import { SearchBar } from './components/SearchBar';
import { FilterChips, FILTER_CHIP_DEFS } from './components/FilterChips';
import { ConversationalSearch } from './components/ConversationalSearch';
import { buildSearchableRecipes } from './lib/normalize';
import { searchRecipes } from './lib/search';
import type { Recipe, SearchableRecipe } from './lib/types';

type SearchMode = 'simple' | 'ai';

interface AppProps {
  initialRecipes?: Recipe[];
  resultLimit?: number;
  debounceMs?: number;
}

function matchesAllFilters(
  recipe: SearchableRecipe,
  activeFilters: string[]
): boolean {
  return activeFilters.every((label) => {
    const chip = FILTER_CHIP_DEFS.find((c) => c.label === label);
    if (!chip) return true;
    return chip.patterns.some(
      (pattern) =>
        pattern.test(recipe.normalizedName) ||
        pattern.test(recipe.normalizedIngredientText)
    );
  });
}

export default function App({
  initialRecipes = rawRecipes as Recipe[],
  resultLimit = 100,
  debounceMs = 150
}: AppProps) {
  const [mode, setMode] = useState<SearchMode>('simple');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(resultLimit);
  const [isSearchElevated, setIsSearchElevated] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Lazy-load embeddings only when AI mode is activated (~3-4MB, cached after first load)
  const [embeddings, setEmbeddings] = useState<number[][] | null>(null);
  const [embeddingsLoading, setEmbeddingsLoading] = useState(false);

  const searchableRecipes = useMemo(
    () => buildSearchableRecipes(initialRecipes),
    [initialRecipes]
  );

  useEffect(() => {
    if (mode === 'ai' && !embeddings && !embeddingsLoading) {
      setEmbeddingsLoading(true);
      import('./data/embeddings.json')
        .then((m) => {
          setEmbeddings(m.default as number[][]);
          setEmbeddingsLoading(false);
        })
        .catch(() => setEmbeddingsLoading(false));
    }
  }, [mode, embeddings, embeddingsLoading]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);
    return () => window.clearTimeout(timeout);
  }, [query, debounceMs]);

  useEffect(() => {
    setVisibleCount(resultLimit);
  }, [debouncedQuery, activeFilters, resultLimit]);

  useEffect(() => {
    const onScroll = () => {
      setIsSearchElevated(window.scrollY > 72);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const searchResults = useMemo(
    () => searchRecipes(searchableRecipes, debouncedQuery, searchableRecipes.length),
    [searchableRecipes, debouncedQuery]
  );

  const allResults = useMemo(
    () =>
      activeFilters.length === 0
        ? searchResults
        : searchResults.filter((recipe) =>
            matchesAllFilters(recipe, activeFilters)
          ),
    [searchResults, activeFilters]
  );

  const visibleResults = useMemo(
    () => allResults.slice(0, visibleCount),
    [allResults, visibleCount]
  );

  const canLoadMore = visibleResults.length < allResults.length;

  const toggleFilter = useCallback((label: string) => {
    setActiveFilters((prev) =>
      prev.includes(label)
        ? prev.filter((f) => f !== label)
        : [...prev, label]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const chip of FILTER_CHIP_DEFS) {
      counts[chip.label] = searchResults.filter((r) =>
        chip.patterns.some(
          (pattern) =>
            pattern.test(r.normalizedName) ||
            pattern.test(r.normalizedIngredientText)
        )
      ).length;
    }
    return counts;
  }, [searchResults]);

  const handleModeSwitch = (newMode: SearchMode) => {
    setMode(newMode);
    if (newMode === 'simple') {
      setQuery('');
    }
  };

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="header-decoration" aria-hidden="true"></div>
        <h1 className="site-title">
          <span className="title-script">Ruhama&apos;s</span>
          <span className="title-main">Recipe Search</span>
        </h1>
        {mode === 'simple' && (
          <p className="recipe-count">
            Showing {visibleResults.length} of {allResults.length} recipes
          </p>
        )}
      </header>

      {/* Mode toggle */}
      <div className="mode-toggle">
        <button
          type="button"
          className={`mode-tab${mode === 'simple' ? ' mode-tab--active' : ''}`}
          onClick={() => handleModeSwitch('simple')}
        >
          Simple Search
        </button>
        <button
          type="button"
          className={`mode-tab${mode === 'ai' ? ' mode-tab--active' : ''}`}
          onClick={() => handleModeSwitch('ai')}
        >
          <span className="mode-tab-ai-icon" aria-hidden="true">✦</span>
          Ask AI
        </button>
      </div>

      {mode === 'simple' ? (
        <>
          <div className={`search-bar-sticky${isSearchElevated ? ' is-elevated' : ''}`}>
            <SearchBar
              query={query}
              onChange={setQuery}
              onClear={() => setQuery('')}
            />
          </div>

          <FilterChips
            activeFilters={activeFilters}
            onToggle={toggleFilter}
            onClearAll={clearFilters}
            counts={filterCounts}
          />

          {allResults.length === 0 ? (
            <p className="empty-state">No recipes matched your search.</p>
          ) : (
            <>
              <section className="results-grid" aria-label="Recipe search results">
                {visibleResults.map((recipe, index) => (
                  <RecipeCard
                    key={recipe.shortcode ?? recipe.name}
                    recipe={recipe}
                    searchQuery={debouncedQuery}
                    animationDelay={Math.min(index * 30, 600)}
                  />
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
        </>
      ) : (
        <>
          {embeddingsLoading && (
            <div className="ai-embeddings-loading">
              <div className="ai-loading-bar" />
              <p className="ai-loading-text">Loading AI search...</p>
            </div>
          )}
          {embeddings && (
            <ConversationalSearch
              recipes={searchableRecipes}
              embeddings={embeddings}
            />
          )}
        </>
      )}
    </main>
  );
}
