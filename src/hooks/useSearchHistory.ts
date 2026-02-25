import { useState, useCallback } from 'react';

interface SearchEntry {
  term: string;
  location: string;
  timestamp: number;
}

const STORAGE_KEY = 'yelp-search-history';
const MAX_ENTRIES = 10;

function readHistory(): SearchEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchEntry[]>(readHistory);

  const addSearch = useCallback((term: string, location: string) => {
    if (!term.trim() && !location.trim()) return;
    setHistory(prev => {
      const deduped = prev.filter(
        e => !(e.term.toLowerCase() === term.toLowerCase() && e.location.toLowerCase() === location.toLowerCase())
      );
      const next = [{ term: term.trim(), location: location.trim(), timestamp: Date.now() }, ...deduped].slice(0, MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const recentTerms = [...new Set(history.map(h => h.term).filter(Boolean))];
  const recentLocations = [...new Set(history.map(h => h.location).filter(Boolean))];

  return { history, addSearch, recentTerms, recentLocations };
}
