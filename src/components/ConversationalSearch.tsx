import { useState, useEffect, useRef, useCallback } from 'react';
import type { SearchableRecipe } from '../lib/types';
import { vectorSearch, applyIngredientFilters } from '../lib/vectorSearch';
import { RecipeCard } from './RecipeCard';

interface ConversationalSearchProps {
  recipes: SearchableRecipe[];
  embeddings: number[][];
}

type SearchStatus = 'idle' | 'loading' | 'done' | 'error';

interface SearchState {
  status: SearchStatus;
  reply: string;
  results: SearchableRecipe[];
}

interface WorkerResponse {
  id: number;
  embedding?: number[];
  error?: string;
}

interface ParsedQuery {
  keywords: string[];
  mustInclude: string[];
  mustExclude: string[];
  reply: string;
}

export function ConversationalSearch({ recipes, embeddings }: ConversationalSearchProps) {
  if (embeddings.length === 0) {
    return (
      <div className="ai-not-ready">
        <span className="ai-reply-icon" aria-hidden="true">✦</span>
        <p>
          AI search is not yet set up. Run{' '}
          <code>npm run generate:embeddings</code> locally to generate the
          recipe embeddings, then commit <code>src/data/embeddings.json</code>.
        </p>
      </div>
    );
  }

  const [inputValue, setInputValue] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [state, setState] = useState<SearchState>({
    status: 'idle',
    reply: '',
    results: [],
  });

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/embedding.worker.ts', import.meta.url),
      { type: 'module' }
    );
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const embedQuery = useCallback((query: string): Promise<number[]> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Embedding worker not ready'));
        return;
      }
      const id = Date.now();
      const handler = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.id !== id) return;
        workerRef.current?.removeEventListener('message', handler);
        if (e.data.error) reject(new Error(e.data.error));
        else resolve(e.data.embedding!);
      };
      workerRef.current.addEventListener('message', handler);
      workerRef.current.postMessage({ id, query });
    });
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setSubmittedQuery(trimmed);
    setState({ status: 'loading', reply: '', results: [] });

    try {
      // Run DeepSeek parse + query embedding in parallel
      const [parsed, queryEmbedding] = await Promise.all([
        fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: trimmed }),
        }).then((r) => {
          if (!r.ok) throw new Error(`API error ${r.status}`);
          return r.json() as Promise<ParsedQuery>;
        }),
        embedQuery(trimmed),
      ]);

      // Vector search across all 960 recipes
      const vectorResults = vectorSearch(queryEmbedding, embeddings, recipes, 24);

      // Apply hard ingredient filters from DeepSeek
      const filtered = applyIngredientFilters(
        vectorResults,
        parsed.mustInclude,
        parsed.mustExclude
      );

      setState({
        status: 'done',
        reply: parsed.reply,
        results: filtered.slice(0, 12).map((r) => r.recipe),
      });
    } catch (err) {
      console.error('AI search error:', err);
      setState({
        status: 'error',
        reply: 'Something went wrong. Please try again.',
        results: [],
      });
    }
  }, [recipes, embeddings, embedQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(inputValue);
  };

  const isLoading = state.status === 'loading';

  return (
    <div className="conversational-search">
      <form onSubmit={handleSubmit} className="ai-search-form">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="e.g. find me a quick breakfast under 10 minutes..."
          className="ai-search-input"
          disabled={isLoading}
          aria-label="Ask AI for recipe recommendations"
        />
        <button
          type="submit"
          className="ai-search-button"
          disabled={isLoading || !inputValue.trim()}
        >
          {isLoading ? (
            <span className="ai-button-dots">
              <span /><span /><span />
            </span>
          ) : (
            'Ask AI'
          )}
        </button>
      </form>

      {state.status === 'idle' && (
        <div className="ai-suggestions">
          <p className="ai-suggestions-label">Try asking:</p>
          <div className="ai-suggestion-chips">
            {[
              'Quick breakfast ideas',
              'Vegetarian dinner',
              'Something with chicken and lemon',
              'Easy weeknight pasta',
            ].map((s) => (
              <button
                key={s}
                type="button"
                className="ai-suggestion-chip"
                onClick={() => {
                  setInputValue(s);
                  handleSearch(s);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {state.status === 'loading' && (
        <div className="ai-loading">
          <div className="ai-loading-bar" />
          <p className="ai-loading-text">Searching recipes...</p>
        </div>
      )}

      {(state.status === 'done' || state.status === 'error') && (
        <>
          <div className={`ai-reply ${state.status === 'error' ? 'ai-reply--error' : ''}`}>
            <span className="ai-reply-icon" aria-hidden="true">✦</span>
            <p>{state.reply}</p>
          </div>

          {state.status === 'done' && state.results.length > 0 && (
            <>
              <p className="ai-result-count">
                {state.results.length} recipe{state.results.length !== 1 ? 's' : ''} found
                {submittedQuery ? ` for "${submittedQuery}"` : ''}
              </p>
              <section className="results-grid" aria-label="AI recipe results">
                {state.results.map((recipe) => (
                  <RecipeCard
                    key={recipe.shortcode ?? recipe.name}
                    recipe={recipe}
                    searchQuery=""
                    animationDelay={0}
                  />
                ))}
              </section>
            </>
          )}

          {state.status === 'done' && state.results.length === 0 && (
            <p className="empty-state">
              No recipes matched. Try rephrasing your question!
            </p>
          )}
        </>
      )}
    </div>
  );
}
