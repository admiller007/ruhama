import { useCallback, useMemo, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'favorites';

/** Read the raw Set<string> from localStorage. */
function readFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set<string>(parsed);
    }
  } catch {
    // corrupted data — start fresh
  }
  return new Set<string>();
}

/** Write the Set<string> to localStorage and notify listeners. */
function writeFavorites(next: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // storage full or unavailable
  }
  // Notify all subscribed components
  for (const listener of listeners) listener();
}

// ── Tiny external store so every component shares the same snapshot ──

let listeners: Array<() => void> = [];
let snapshot: Set<string> = readFavorites();

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  return snapshot;
}

function updateSnapshot(next: Set<string>) {
  snapshot = next;
  writeFavorites(next);
}

// ── Hook ──

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot);

  const toggleFavorite = useCallback((key: string) => {
    const next = new Set(snapshot);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    updateSnapshot(next);
  }, []);

  const isFavorite = useCallback(
    (key: string) => favorites.has(key),
    [favorites]
  );

  const clearFavorites = useCallback(() => {
    updateSnapshot(new Set());
  }, []);

  const count = useMemo(() => favorites.size, [favorites]);

  return { favorites, toggleFavorite, isFavorite, clearFavorites, count } as const;
}
