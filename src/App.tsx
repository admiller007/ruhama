import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import rawRecipes from './data/recipes.json';
import { RecipeCard } from './components/RecipeCard';
import { SearchBar } from './components/SearchBar';
import { FilterChips, FILTER_CHIP_DEFS } from './components/FilterChips';
import { buildSearchableRecipes } from './lib/normalize';
import { searchRecipes } from './lib/search';
import { useFavorites } from './hooks/useFavorites';
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

const SUGGESTIONS = ['chicken', 'pasta', 'salmon', 'beef', 'potato'];

export default function App({
  initialRecipes = rawRecipes as Recipe[],
  resultLimit = 100,
  debounceMs = 150
}: AppProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(resultLimit);
  const [isSearchElevated, setIsSearchElevated] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const { toggleFavorite, isFavorite, count: favoritesCount } = useFavorites();
  const focusedCardIndexRef = useRef(-1);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored) return stored === 'dark';
    } catch {
      // ignore storage errors
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

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
    focusedCardIndexRef.current = -1;
  }, [debouncedQuery, activeFilters, showFavoritesOnly, resultLimit]);

  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY;
      setIsSearchElevated(scrolled > 72);
      setShowScrollTop(scrolled > 300);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const getSummaries = () =>
      Array.from(document.querySelectorAll<HTMLElement>('.recipe-card details > summary'));

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (isTyping) {
        if (e.key === 'Escape') target.blur();
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[aria-label="Search recipes"]')?.focus();
        return;
      }

      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();

      const summaries = getSummaries();
      if (summaries.length === 0) return;

      const next =
        e.key === 'ArrowDown'
          ? Math.min(focusedCardIndexRef.current + 1, summaries.length - 1)
          : Math.max(focusedCardIndexRef.current - 1, 0);

      focusedCardIndexRef.current = next;
      summaries[next].focus();
      summaries[next].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches('.recipe-card details > summary')) {
        const idx = getSummaries().indexOf(target);
        if (idx !== -1) focusedCardIndexRef.current = idx;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    try {
      localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [darkMode]);

  const searchResults = useMemo(
    () => searchRecipes(searchableRecipes, debouncedQuery, searchableRecipes.length),
    [searchableRecipes, debouncedQuery]
  );

  const filteredResults = useMemo(
    () =>
      activeFilters.length === 0
        ? searchResults
        : searchResults.filter((recipe) =>
            matchesAllFilters(recipe, activeFilters)
          ),
    [searchResults, activeFilters]
  );

  const allResults = useMemo(
    () =>
      showFavoritesOnly
        ? filteredResults.filter((r) => isFavorite(r.shortcode ?? r.name))
        : filteredResults,
    [filteredResults, showFavoritesOnly, isFavorite]
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
        <div className="header-decoration" aria-hidden="true"></div>
        <button
          type="button"
          className="dark-mode-toggle"
          onClick={() => setDarkMode((d) => !d)}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
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
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
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

      {favoritesCount > 0 && (
        <div className="favorites-toggle-bar">
          <button
            type="button"
            className={`favorites-toggle${showFavoritesOnly ? ' is-active' : ''}`}
            onClick={() => setShowFavoritesOnly((v) => !v)}
            aria-pressed={showFavoritesOnly}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            Favorites
            <span className="favorites-toggle-count">{favoritesCount}</span>
          </button>
        </div>
      )}

      {allResults.length === 0 ? (
        <div className="empty-state" role="status">
          <p className="empty-state-heading">No recipes found</p>
          <p className="empty-state-hint">
            {showFavoritesOnly
              ? 'No favorites match the current search or filters.'
              : query
                ? `Nothing matched "${query}" — try a different search term.`
                : 'No recipes match the selected filters.'}
          </p>
          <div className="empty-state-suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="empty-state-suggestion"
                onClick={() => {
                  setQuery(suggestion);
                  clearFilters();
                }}
              >
                {suggestion}
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
                isFavorite={isFavorite(recipe.shortcode ?? recipe.name)}
                onToggleFavorite={toggleFavorite}
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
        <p>
          Recipes from{' '}
          <a
            href="https://www.instagram.com/ruhamasfood/"
            target="_blank"
            rel="noreferrer"
          >
            @ruhamas_food
          </a>
        </p>
      </footer>

      <button
        type="button"
        className={`scroll-top-button${showScrollTop ? ' is-visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Scroll to top"
        aria-hidden={!showScrollTop}
        tabIndex={showScrollTop ? 0 : -1}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
    </main>
  );
}
