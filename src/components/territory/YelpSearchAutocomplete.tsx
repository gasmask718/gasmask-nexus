// YelpSearchAutocomplete - business name autocomplete via Yelp API
import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, Building2, Tag, Type, Loader2 } from 'lucide-react';

interface AutocompleteBusiness {
  id: string;
  name: string;
  location?: { city?: string; state?: string };
}

interface AutocompleteResult {
  businesses?: AutocompleteBusiness[];
  categories?: { alias: string; title: string }[];
  terms?: { text: string }[];
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onBusinessSelect?: (business: AutocompleteBusiness) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function YelpSearchAutocomplete({ value, onChange, onBusinessSelect, placeholder, onKeyDown }: Props) {
  const [suggestions, setSuggestions] = useState<AutocompleteResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 2) {
      setSuggestions(null);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('yelp-business-search', {
        body: { action: 'autocomplete', term: text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSuggestions(data);
      setOpen(true);
    } catch {
      setSuggestions(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const selectBusiness = (b: AutocompleteBusiness) => {
    onChange(b.name);
    setOpen(false);
    onBusinessSelect?.(b);
  };

  const selectTerm = (text: string) => {
    onChange(text);
    setOpen(false);
  };

  const hasSuggestions = suggestions &&
    ((suggestions.businesses?.length ?? 0) > 0 ||
     (suggestions.categories?.length ?? 0) > 0 ||
     (suggestions.terms?.length ?? 0) > 0);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          onFocus={() => hasSuggestions && setOpen(true)}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && hasSuggestions && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg max-h-64 overflow-y-auto">
          {/* Businesses */}
          {suggestions!.businesses && suggestions!.businesses.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3 w-3" /> Businesses
              </div>
              {suggestions!.businesses.map(b => (
                <button
                  key={b.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                  onClick={() => selectBusiness(b)}
                >
                  <span className="font-medium">{b.name}</span>
                  {b.location?.city && (
                    <span className="text-muted-foreground ml-1.5 text-xs">
                      — {b.location.city}{b.location.state ? `, ${b.location.state}` : ''}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Categories */}
          {suggestions!.categories && suggestions!.categories.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-t">
                <Tag className="h-3 w-3" /> Categories
              </div>
              {suggestions!.categories.map(c => (
                <button
                  key={c.alias}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                  onClick={() => selectTerm(c.title)}
                >
                  {c.title}
                </button>
              ))}
            </div>
          )}

          {/* Terms */}
          {suggestions!.terms && suggestions!.terms.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-t">
                <Type className="h-3 w-3" /> Suggestions
              </div>
              {suggestions!.terms.map((t, i) => (
                <button
                  key={i}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                  onClick={() => selectTerm(t.text)}
                >
                  {t.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
