import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

interface AddressSuggestion {
  id: string;
  place_name: string;
  text: string;
  context?: Array<{ id: string; text: string; short_code?: string }>;
  properties?: { address?: string };
  address?: string;
}

interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  full_address: string;
}

export interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (parsed: ParsedAddress) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

function parseMapboxFeature(feature: AddressSuggestion): ParsedAddress {
  const context = feature.context || [];
  let city = '';
  let state = '';
  let zip = '';

  for (const c of context) {
    if (c.id.startsWith('place')) city = c.text;
    else if (c.id.startsWith('region')) state = c.short_code?.replace('US-', '') || c.text;
    else if (c.id.startsWith('postcode')) zip = c.text;
  }

  // street = house number + street name
  const houseNumber = feature.address || '';
  const streetName = feature.text || '';
  const street = houseNumber ? `${houseNumber} ${streetName}` : streetName;

  return {
    street,
    city,
    state,
    zip,
    full_address: feature.place_name,
  };
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing an address...',
  className,
  id,
  disabled,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressFetchRef = useRef(false);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 3 || !MAPBOX_TOKEN) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    try {
      const encoded = encodeURIComponent(query);
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&country=us&types=address&limit=5&autocomplete=true`
      );
      const data = await res.json();
      if (data.features?.length) {
        setSuggestions(data.features);
        setIsOpen(true);
        setHighlightIndex(-1);
      } else {
        setSuggestions([]);
        setIsOpen(false);
      }
    } catch {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    suppressFetchRef.current = false;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!suppressFetchRef.current) {
        fetchSuggestions(val);
      }
    }, 300);
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    const parsed = parseMapboxFeature(suggestion);
    suppressFetchRef.current = true;
    onChange(parsed.street);
    onSelect?.(parsed);
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          id={id}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={cn('pl-10', className)}
          disabled={disabled}
          autoComplete="off"
        />
      </div>
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-auto">
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={cn(
                'w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-start gap-2',
                i === highlightIndex && 'bg-accent text-accent-foreground'
              )}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{s.place_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
