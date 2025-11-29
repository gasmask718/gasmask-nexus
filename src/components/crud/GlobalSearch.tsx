import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, Store, Users, Truck, Package, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  name: string;
  type: 'company' | 'store' | 'wholesaler' | 'driver' | 'ambassador';
  subtitle?: string;
}

interface GlobalSearchProps {
  className?: string;
  placeholder?: string;
}

export function GlobalSearch({ className, placeholder = "Search across all entities..." }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results, isLoading } = useQuery({
    queryKey: ["global-search", query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      
      const searchTerm = `%${query}%`;
      const results: SearchResult[] = [];

      // Search companies
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name, neighborhood")
        .ilike("name", searchTerm)
        .limit(5);
      
      companies?.forEach(c => results.push({
        id: c.id,
        name: c.name,
        type: 'company',
        subtitle: c.neighborhood || undefined,
      }));

      // Search stores
      const { data: stores } = await supabase
        .from("stores")
        .select("id, name, neighborhood")
        .ilike("name", searchTerm)
        .limit(5);
      
      stores?.forEach(s => results.push({
        id: s.id,
        name: s.name || 'Unnamed Store',
        type: 'store',
        subtitle: s.neighborhood || undefined,
      }));

      // Search wholesalers
      const { data: wholesalers } = await supabase
        .from("wholesalers")
        .select("id, name")
        .ilike("name", searchTerm)
        .limit(5);
      
      wholesalers?.forEach(w => results.push({
        id: w.id,
        name: w.name,
        type: 'wholesaler',
      }));

      // Search drivers
      const { data: drivers } = await supabase
        .from("grabba_drivers")
        .select("id, name, region")
        .ilike("name", searchTerm)
        .limit(5);
      
      drivers?.forEach(d => results.push({
        id: d.id,
        name: d.name,
        type: 'driver',
        subtitle: d.region || undefined,
      }));

      return results;
    },
    enabled: query.length >= 2,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    setQuery("");
    
    const routes: Record<string, string> = {
      company: `/companies/${result.id}`,
      store: `/stores/${result.id}`,
      wholesaler: `/wholesaler/${result.id}`,
      driver: `/grabba/deliveries`,
      ambassador: `/grabba/ambassadors`,
    };
    
    navigate(routes[result.type] || '/');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'company': return <Building2 className="h-4 w-4" />;
      case 'store': return <Store className="h-4 w-4" />;
      case 'wholesaler': return <Package className="h-4 w-4" />;
      case 'driver': return <Truck className="h-4 w-4" />;
      case 'ambassador': return <Users className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-8"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setIsOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">Searching...</div>
          ) : results && results.length > 0 ? (
            <div className="py-1">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-accent text-left"
                >
                  <span className="text-muted-foreground">{getIcon(result.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.name}</p>
                    {result.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{result.type}</Badge>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
