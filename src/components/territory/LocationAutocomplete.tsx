import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, Clock } from 'lucide-react';

interface PlaceSuggestion {
  id: string;
  place_name: string;
  text: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  searchHistory?: string[];
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

export function LocationAutocomplete({ value, onChange, placeholder, onKeyDown, searchHistory }: Props) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 2 || !MAPBOX_TOKEN) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setShowHistory(false);
    setLoading(true);
    try {
      const encoded = encodeURIComponent(text);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&types=place,locality,neighborhood,region&country=us&limit=5`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Mapbox request failed');
      const data = await resp.json();
      const results: PlaceSuggestion[] = (data.features || []).map((f: any) => ({
        id: f.id,
        place_name: f.place_name,
        text: f.text,
      }));
      setSuggestions(results);
      setOpen(results.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    onChange(val);
    if (!val.trim() && searchHistory && searchHistory.length > 0) {
      setShowHistory(true);
      setOpen(false);
      return;
    }
    setShowHistory(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleFocus = () => {
    if (!value.trim() && searchHistory && searchHistory.length > 0) {
      setShowHistory(true);
    } else if (suggestions.length > 0) {
      setOpen(true);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const select = (s: PlaceSuggestion) => {
    onChange(s.place_name);
    setOpen(false);
    setShowHistory(false);
  };

  const selectHistoryItem = (text: string) => {
    onChange(text);
    setShowHistory(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          onFocus={handleFocus}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search history dropdown */}
      {showHistory && searchHistory && searchHistory.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg max-h-52 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Recent Locations
          </div>
          {searchHistory.map((loc, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer flex items-center gap-2"
              onClick={() => selectHistoryItem(loc)}
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{loc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Live suggestions */}
      {open && !showHistory && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg max-h-52 overflow-y-auto">
          {suggestions.map(s => (
            <button
              key={s.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer flex items-center gap-2"
              onClick={() => select(s)}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{s.place_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
