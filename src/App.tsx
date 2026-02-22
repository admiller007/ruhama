import { useCallback, useEffect, useMemo, useState } from 'react';
import rawRecipes from './data/recipes.json';
import { RecipeCard } from './components/RecipeCard';
import { SearchBar } from './components/SearchBar';
import { FilterChips, FILTER_CHIP_DEFS } from './components/FilterChips';
import { buildSearchableRecipes } from './lib/normalize';
import { searchRecipes } from './lib/search';
import type { Recipe, SearchableRecipe } from './lib/types';

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
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ruhama-dark-mode');
      if (stored !== null) return stored === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(resultLimit);
  const [isSearchElevated, setIsSearchElevated] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

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
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('ruhama-dark-mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    setVisibleCount(resultLimit);
  }, [debouncedQuery, activeFilters, resultLimit]);

  useEffect(() => {
    const onScroll = () => {
      setIsSearchElevated(window.scrollY > 72);
      setShowScrollTop(window.scrollY > 600);
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

  return (
    <main className="app-shell">
      <header className="site-header">
        <button
          type="button"
          className="dark-mode-toggle"
          onClick={() => setDarkMode((prev) => !prev)}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
        <div className="header-decoration" aria-hidden="true">
          <svg width="120" height="16" viewBox="0 0 120 16" fill="none" aria-hidden="true">
            <path d="M0 8 Q15 0 30 8 Q45 16 60 8 Q75 0 90 8 Q105 16 120 8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.3" />
            <circle cx="60" cy="8" r="3" fill="currentColor" opacity="0.4" />
          </svg>
        </div>
        <h1 className="site-title">
          <span className="title-script">Ruhama&apos;s</span>
          <span className="title-main">Recipe Search</span>
        </h1>
        <p className="recipe-count">
          Showing {visibleResults.length} of {allResults.length} recipes
        </p>
      </header>

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
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="24" cy="24" r="20" />
              <path d="M16 28c0 0 3 4 8 4s8-4 8-4" />
              <line x1="18" y1="18" x2="18.01" y2="18" strokeWidth="3" />
              <line x1="30" y1="18" x2="30.01" y2="18" strokeWidth="3" />
            </svg>
          </div>
          <p className="empty-state-text">Nothing here yet &mdash; try a different search!</p>
          <div className="empty-state-suggestions">
            {['Chicken', 'Pasta', 'Salmon', 'Dessert', 'Rice'].map((term) => (
              <button
                key={term}
                type="button"
                className="empty-state-chip"
                onClick={() => { setQuery(term); setActiveFilters([]); }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
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
      <footer className="site-footer">
        <p>Recipes from <a href="https://www.instagram.com/ruhamasfood/" target="_blank" rel="noreferrer">@ruhamasfood</a></p>
      </footer>

      <button
        type="button"
        className={`scroll-to-top${showScrollTop ? ' is-visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Scroll to top"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
    </main>
  );
}
