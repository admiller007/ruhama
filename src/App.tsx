import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import recipesUrl from './data/recipes.json?url';
import { RecipeCard } from './components/RecipeCard';
import { SearchBar } from './components/SearchBar';
import { FilterChips, FILTER_CHIP_DEFS } from './components/FilterChips';
import { buildSearchableRecipes } from './lib/normalize';
import { searchRecipes, suggestQueries } from './lib/search';
import { buildRecipeUrl, readRecipeUrl } from './lib/url';
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

const SUGGESTIONS = ['chicken', 'shakshuka', 'soup', 'pasta', 'potatoes'];

const BROWSE_QUERIES = [
  { label: 'Rosh Hashanah', query: 'rosh hashanah' },
  { label: 'Shabbat', query: 'shabbat' },
  { label: 'Passover', query: 'passover' },
  { label: 'Hanukkah', query: 'hanukkah' },
  { label: 'Weeknight', query: 'weeknight' },
  { label: 'Soup', query: 'soup' },
  { label: 'Salad', query: 'salad' }
];

function readStoredTheme(): 'dark' | 'light' | null {
  try {
    const value = localStorage.getItem('theme');
    if (value === 'dark' || value === 'light') return value;
  } catch {
    // ignore storage errors
  }
  return null;
}

function systemPrefersDark(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function scrollBehavior(): ScrollBehavior {
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 'auto';
  }
  return 'smooth';
}

function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#131311' : '#f3efe6');
}

export default function App({
  initialRecipes,
  resultLimit = 100,
  debounceMs = 0
}: AppProps) {
  const initialLocation = readRecipeUrl(window.location.search);
  const [query, setQuery] = useState(initialLocation.query);
  const [debouncedQuery, setDebouncedQuery] = useState(initialLocation.query);
  const [openShortcode, setOpenShortcode] = useState(initialLocation.shortcode);
  const [visibleCount, setVisibleCount] = useState(resultLimit);
  const [isSearchElevated, setIsSearchElevated] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [remoteRecipes, setRemoteRecipes] = useState<Recipe[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const { toggleFavorite, isFavorite, count: favoritesCount } = useFavorites();
  const focusedCardIndexRef = useRef(-1);
  const pendingQueryRef = useRef<string | null>(null);
  const openShortcodeRef = useRef(openShortcode);
  openShortcodeRef.current = openShortcode;
  const themeChosenRef = useRef(readStoredTheme() !== null);
  const [darkMode, setDarkMode] = useState(() => {
    const stored = readStoredTheme();
    if (stored) return stored === 'dark';
    return systemPrefersDark();
  });

  const sourceRecipes = initialRecipes ?? remoteRecipes;

  const searchableRecipes = useMemo(
    () => (sourceRecipes ? buildSearchableRecipes(sourceRecipes) : []),
    [sourceRecipes]
  );

  useEffect(() => {
    if (initialRecipes) return;
    let cancelled = false;

    fetch(recipesUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Recipe request failed (${response.status})`);
        return response.json() as Promise<Recipe[]>;
      })
      .then((data) => {
        if (!cancelled) setRemoteRecipes(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [initialRecipes]);

  useEffect(() => {
    const { query: initialQuery, shortcode } = readRecipeUrl(window.location.search);
    const listUrl = buildRecipeUrl(window.location.pathname, initialQuery, '');
    if (shortcode) {
      history.replaceState({ recipe: '' }, '', listUrl);
      history.pushState(
        { recipe: shortcode },
        '',
        buildRecipeUrl(window.location.pathname, initialQuery, shortcode)
      );
    } else {
      history.replaceState({ recipe: '' }, '', listUrl);
    }

    const onPop = () => {
      const next = readRecipeUrl(window.location.search);
      const typed = pendingQueryRef.current;
      pendingQueryRef.current = null;
      const nextQuery = typed ?? next.query;
      setQuery(nextQuery);
      setDebouncedQuery(nextQuery);
      setOpenShortcode(typed ? '' : next.shortcode);
      if (typed != null) {
        history.replaceState(
          { recipe: '' },
          '',
          buildRecipeUrl(window.location.pathname, nextQuery, '')
        );
      }
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const applyQuery = useCallback((next: string) => {
    setQuery(next);
    if (openShortcodeRef.current && history.state?.recipe) {
      pendingQueryRef.current = next;
      setOpenShortcode('');
      history.back();
      return;
    }
    history.replaceState({ recipe: '' }, '', buildRecipeUrl(window.location.pathname, next, ''));
  }, []);

  const openRecipe = useCallback((shortcode: string) => {
    const listUrl = buildRecipeUrl(window.location.pathname, query, '');
    const openUrl = buildRecipeUrl(window.location.pathname, query, shortcode);
    if (history.state?.recipe) {
      history.replaceState({ recipe: shortcode }, '', openUrl);
    } else {
      history.replaceState({ recipe: '' }, '', listUrl);
      history.pushState({ recipe: shortcode }, '', openUrl);
    }
    setOpenShortcode(shortcode);
  }, [query]);

  const closeRecipe = useCallback(() => {
    if (history.state?.recipe) {
      history.back();
      return;
    }
    setOpenShortcode('');
    history.replaceState({ recipe: '' }, '', buildRecipeUrl(window.location.pathname, query, ''));
  }, [query]);

  useEffect(() => {
    if (!openShortcode) return;
    document.getElementById(`recipe-${openShortcode}`)?.scrollIntoView({
      block: 'start',
      behavior: scrollBehavior()
    });
  }, [openShortcode, sourceRecipes]);

  useEffect(() => {
    if (debounceMs <= 0) return;
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => window.clearTimeout(timeout);
  }, [query, debounceMs]);

  const activeQuery = debounceMs > 0 ? debouncedQuery : query;

  useEffect(() => {
    setVisibleCount(resultLimit);
    focusedCardIndexRef.current = -1;
  }, [activeQuery, activeFilters, showFavoritesOnly, resultLimit]);

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
      summaries[next].scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
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
    applyTheme(darkMode);
    if (!themeChosenRef.current) return;
    try {
      localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [darkMode]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      if (themeChosenRef.current) return;
      setDarkMode(event.matches);
    };
    if (typeof media.addEventListener !== 'function') return;
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const chooseTheme = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    themeChosenRef.current = true;
    setDarkMode((value) => !value);
  };

  const searchResults = useMemo(
    () => searchRecipes(searchableRecipes, activeQuery, searchableRecipes.length),
    [searchableRecipes, activeQuery]
  );

  const suggestions = useMemo(() => {
    const corrections =
      activeQuery.trim() && searchResults.length === 0
        ? suggestQueries(searchableRecipes, activeQuery)
        : [];
    const merged = [...corrections];
    for (const suggestion of SUGGESTIONS) {
      if (!merged.some((item) => item.toLowerCase() === suggestion)) merged.push(suggestion);
    }
    return merged.slice(0, 6);
  }, [activeQuery, searchResults.length, searchableRecipes]);

  const filteredResults = useMemo(
    () =>
      activeFilters.length === 0
        ? searchResults
        : searchResults.filter((recipe) =>
            matchesAllFilters(recipe, activeFilters)
          ),
    [searchResults, activeFilters]
  );

  const allResults = useMemo(() => {
    const listed = showFavoritesOnly
      ? filteredResults.filter((r) => isFavorite(r.shortcode ?? r.name))
      : filteredResults;
    if (!openShortcode) return listed;
    if (listed.some((recipe) => (recipe.shortcode ?? recipe.name) === openShortcode)) return listed;
    const opened = searchableRecipes.find(
      (recipe) => (recipe.shortcode ?? recipe.name) === openShortcode
    );
    return opened ? [opened, ...listed] : listed;
  }, [filteredResults, showFavoritesOnly, isFavorite, openShortcode, searchableRecipes]);

  const openIndex = openShortcode
    ? allResults.findIndex((recipe) => (recipe.shortcode ?? recipe.name) === openShortcode)
    : -1;

  const visibleResults = useMemo(() => {
    const page = allResults.slice(0, visibleCount);
    if (openIndex < visibleCount) return page;
    return [allResults[openIndex], ...page];
  }, [allResults, visibleCount, openIndex]);

  const browseLinks = useMemo(
    () =>
      BROWSE_QUERIES.filter((link) => {
        const tokens = link.query.split(/\s+/);
        return searchableRecipes.some((recipe) => {
          const haystack = `${recipe.normalizedName} ${recipe.caption_snippet ?? ""}`.toLowerCase();
          return tokens.every((token) => haystack.includes(token));
        });
      }),
    [searchableRecipes]
  );

  const showBrowse =
    !query.trim() && activeFilters.length === 0 && !showFavoritesOnly && browseLinks.length > 0;

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
        <div className="masthead">
          <div className="masthead-titles">
            <h1 className="site-title">
              <span className="title-script">Ruhama’s</span>
              <span className="title-main">Recipe Search</span>
            </h1>
            <span className="masthead-rule" aria-hidden="true" />
          </div>
          <button
            type="button"
            className="dark-mode-toggle"
            onClick={chooseTheme}
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
        </div>
      </header>

      <div className={`search-bar-sticky${isSearchElevated ? ' is-elevated' : ''}`}>
        <SearchBar
          query={query}
          onChange={applyQuery}
          onClear={() => applyQuery('')}
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

      <div className="results-slot">
      {sourceRecipes === null && !loadError ? (
        <p className="recipe-count" role="status">Loading recipes…</p>
      ) : loadError ? (
        <div className="empty-state" role="alert">
          <p className="empty-state-heading">Recipes didn’t load</p>
          <p className="empty-state-hint">Refresh the page to try again.</p>
        </div>
      ) : (
      <>
      {showBrowse && (
        <div className="browse">
          <p className="browse-kicker">Browse</p>
          <div className="browse-chips">
            {browseLinks.map((link) => (
              <button
                key={link.query}
                type="button"
                className="browse-chip"
                onClick={() => applyQuery(link.query)}
              >
                {link.label}
              </button>
            ))}
          </div>
          <p className="browse-newest">Newest from Ruhama</p>
        </div>
      )}
      <p className="recipe-count">
        Showing {visibleResults.length} of {allResults.length} recipes
      </p>

      {allResults.length === 0 ? (
        <div className="empty-state" role="status">
          <p className="empty-state-heading">
            {query.trim() ? 'Nothing matches' : 'No recipes found'}
          </p>
          <p className="empty-state-hint">
            {showFavoritesOnly
              ? 'No favorites match the current search or filters.'
              : query.trim()
                ? `Nothing matched "${query.trim()}". Try a dish, an ingredient, or one of these.`
                : 'No recipes match the selected filters.'}
          </p>
          {browseLinks.length > 0 && (
            <div className="browse-chips empty-browse">
              {browseLinks.map((link) => (
                <button
                  key={link.query}
                  type="button"
                  className="browse-chip"
                  onClick={() => {
                    applyQuery(link.query);
                    clearFilters();
                  }}
                >
                  {link.label}
                </button>
              ))}
            </div>
          )}
          <div className="empty-state-suggestions">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="empty-state-suggestion"
                onClick={() => {
                  applyQuery(suggestion);
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
            {visibleResults.map((recipe) => (
              <RecipeCard
                key={recipe.shortcode ?? recipe.name}
                recipe={recipe}
                searchQuery={activeQuery}
                isFavorite={isFavorite(recipe.shortcode ?? recipe.name)}
                onToggleFavorite={toggleFavorite}
                open={(recipe.shortcode ?? recipe.name) === openShortcode}
                onOpenChange={(next) => {
                  const key = recipe.shortcode ?? recipe.name;
                  if (next) openRecipe(key);
                  else if (openShortcodeRef.current === key) closeRecipe();
                }}
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
      )}
      </div>

      <footer className="site-footer">
        <p>
          Recipes from{' '}
          <a
            href="https://www.instagram.com/ruhamasfood/"
            target="_blank"
            rel="noreferrer"
          >
            @ruhamas_food
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </p>
      </footer>

      <button
        type="button"
        className={`scroll-top-button${showScrollTop ? ' is-visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}
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
