import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, X, ArrowRight, Loader2 } from 'lucide-react';

interface FunnelConfig {
  key: string;
  label: string;
  table: string;
}

interface Props {
  onClose: () => void;
  funnels: FunnelConfig[];
}

export const DevCommandPalette = ({ onClose, funnels }: Props) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ funnel: string; table: string; rows: any[] }[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const all: { funnel: string; table: string; rows: any[] }[] = [];
      // Search across first 4 funnels for speed
      const searchFunnels = funnels.slice(0, 6);
      await Promise.all(
        searchFunnels.map(async (f) => {
          try {
            const { data } = await supabase
              .from(f.table as any)
              .select('*')
              .or(`email.ilike.%${query}%,id.eq.${query.length === 36 ? query : '00000000-0000-0000-0000-000000000000'}`)
              .limit(5);
            if (data && data.length > 0) {
              all.push({ funnel: f.label, table: f.table, rows: data });
            }
          } catch {
            // table might not have email column — silently skip
          }
        })
      );
      setResults(all);
      setSearching(false);
    }, 350);
    return () => clearTimeout(timeout);
  }, [query, funnels]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0d0d15] border border-[#2a2a3e] rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a2e]">
          <Search className="w-4 h-4 text-[#555] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search leads by email, ID, or name across all funnels..."
            className="flex-1 bg-transparent text-sm text-[#c8c8d0] placeholder:text-[#444] focus:outline-none font-mono"
          />
          {searching && <Loader2 className="w-4 h-4 text-[#00ff88] animate-spin shrink-0" />}
          <button onClick={onClose} className="p-1 text-[#555] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-auto">
          {results.length === 0 && query.length >= 2 && !searching && (
            <div className="px-4 py-8 text-center text-[#444] text-xs font-mono">
              No results found for "{query}"
            </div>
          )}
          {results.map((group, gi) => (
            <div key={gi}>
              <div className="px-4 py-2 text-[9px] uppercase tracking-widest text-[#00ff88]/60 bg-[#0b0b14] sticky top-0">
                {group.funnel} <span className="text-[#333]">({group.rows.length} hits)</span>
              </div>
              {group.rows.map((row, ri) => (
                <div
                  key={ri}
                  className="px-4 py-2 flex items-center gap-3 hover:bg-[#1a1a2e]/50 cursor-pointer transition-colors group"
                >
                  <ArrowRight className="w-3 h-3 text-[#333] group-hover:text-[#00ff88] transition-colors shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-[#c8c8d0] font-mono truncate">
                      {row.email || row.business_name || row.name || row.full_name || row.id}
                    </div>
                    <div className="text-[9px] text-[#444] font-mono truncate">
                      {row.id?.slice(0, 8)} · {row.phone || row.phone_number || '—'}
                    </div>
                  </div>
                  <span className="text-[9px] text-[#333] font-mono">{group.table}</span>
                </div>
              ))}
            </div>
          ))}
          {query.length < 2 && (
            <div className="px-4 py-8 text-center text-[#333] text-xs font-mono">
              Type 2+ characters to search across all funnels
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#1a1a2e] px-4 py-2 flex items-center gap-4 text-[9px] text-[#333]">
          <span><kbd className="px-1 py-0.5 bg-[#1a1a2e] rounded text-[8px]">ESC</kbd> close</span>
          <span><kbd className="px-1 py-0.5 bg-[#1a1a2e] rounded text-[8px]">↑↓</kbd> navigate</span>
        </div>
      </div>
    </div>
  );
};
