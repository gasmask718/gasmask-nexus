import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Store {
  id: string;
  name: string;
  address_city: string | null;
  address_street: string | null;
  lat: number;
  lng: number;
}

interface SearchBarProps {
  stores: Store[];
  onSelectStore: (store: Store) => void;
}

export const SearchBar = ({ stores, onSelectStore }: SearchBarProps) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Store[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const filtered = stores.filter((store) =>
      store.name.toLowerCase().includes(query.toLowerCase()) ||
      store.address_city?.toLowerCase().includes(query.toLowerCase()) ||
      store.address_street?.toLowerCase().includes(query.toLowerCase())
    );

    setSuggestions(filtered.slice(0, 5));
  }, [query, stores]);

  const handleSelect = (store: Store) => {
    onSelectStore(store);
    setQuery('');
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search stores by name or location..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          className="pl-10 pr-10 bg-card/95 backdrop-blur border-border/50"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-card/95 backdrop-blur border border-border/50 rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in">
          {suggestions.map((store) => (
            <button
              key={store.id}
              onClick={() => handleSelect(store)}
              className="w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border/20 last:border-0"
            >
              <p className="font-medium text-sm">{store.name}</p>
              {store.address_street && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {store.address_street}, {store.address_city}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
