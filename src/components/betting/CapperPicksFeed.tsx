import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTablePagination } from '@/components/crud/DataTablePagination';
import { CheckCircle, XCircle, Clock, Copy, Search, Filter, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const SPORTS = ['NBA', 'WNBA', 'NFL', 'MLB', 'NHL', 'Soccer', 'UFC', 'Tennis', 'NCAAB', 'NCAAF'];
const MARKET_TYPES = ['prop', 'moneyline', 'spread', 'total', 'futures', 'parlay'];

const sportColors: Record<string, string> = {
  NBA: 'text-orange-500 border-orange-500/30 bg-orange-500/10',
  WNBA: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  NFL: 'text-green-500 border-green-500/30 bg-green-500/10',
  MLB: 'text-red-500 border-red-500/30 bg-red-500/10',
  NHL: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
  Soccer: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
  UFC: 'text-red-600 border-red-600/30 bg-red-600/10',
  Tennis: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10',
  NCAAB: 'text-blue-600 border-blue-600/30 bg-blue-600/10',
  NCAAF: 'text-green-600 border-green-600/30 bg-green-600/10',
};

const tierColors: Record<string, string> = {
  elite: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  verified: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  tracked: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  new: 'text-muted-foreground',
};

interface CapperPicksFeedProps {
  cappers: any[];
  onRefetch: () => void;
}

type SortField = 'created_at' | 'game_date' | 'capper' | 'result';
type SortDir = 'asc' | 'desc';

export function CapperPicksFeed({ cappers, onRefetch }: CapperPicksFeedProps) {
  // Filters
  const [resultFilter, setResultFilter] = useState<string>('pending');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [marketFilter, setMarketFilter] = useState<string>('all');
  const [capperFilter, setCapperFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Sort
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const qc = useQueryClient();

  // Fetch with server-side pagination
  const { data: queryResult, isLoading } = useQuery({
    queryKey: ['sbo-picks-feed', resultFilter, sportFilter, marketFilter, capperFilter, sortField, sortDir, page, pageSize],
    queryFn: async () => {
      let q = (supabase as any).from('sbo_capper_picks')
        .select('*, sbo_cappers(name, tier, source, group_type)', { count: 'exact' });

      // Filters
      if (resultFilter === 'pending') q = q.or('result.eq.pending,result.is.null');
      else if (resultFilter === 'won') q = q.eq('result', 'won');
      else if (resultFilter === 'lost') q = q.eq('result', 'lost');

      if (sportFilter !== 'all') q = q.eq('sport', sportFilter);
      if (marketFilter !== 'all') q = q.eq('bet_type', marketFilter);
      if (capperFilter !== 'all') q = q.eq('capper_id', capperFilter);

      // Sort
      const dbSort = sortField === 'capper' ? 'capper_id' : sortField;
      q = q.order(dbSort, { ascending: sortDir === 'asc' });

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, count, error } = await q;
      if (error) throw error;
      return { data: data || [], totalCount: count || 0 };
    },
  });

  const picks = queryResult?.data || [];
  const totalCount = queryResult?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Client-side search filter (on current page data)
  const filteredPicks = useMemo(() => {
    if (!searchQuery.trim()) return picks;
    const q = searchQuery.toLowerCase();
    return picks.filter((p: any) =>
      (p.player_name || '').toLowerCase().includes(q) ||
      (p.pick_text || '').toLowerCase().includes(q) ||
      (p.sbo_cappers?.name || '').toLowerCase().includes(q) ||
      (p.team || '').toLowerCase().includes(q)
    );
  }, [picks, searchQuery]);

  // Selection helpers
  const allSelected = filteredPicks.length > 0 && filteredPicks.every((p: any) => selectedIds.has(p.id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPicks.map((p: any) => p.id)));
    }
  };

  // Bulk actions
  const selectedPicks = filteredPicks.filter((p: any) => selectedIds.has(p.id));

  const copyPicks = useCallback(() => {
    if (selectedPicks.length === 0) return;
    const grouped: Record<string, string[]> = {};
    for (const p of selectedPicks) {
      const date = p.game_date || new Date(p.created_at).toLocaleDateString();
      if (!grouped[date]) grouped[date] = [];
      const parts = [];
      if (p.player_name) parts.push(p.player_name);
      if (p.direction) parts.push(p.direction);
      if (p.line != null) parts.push(String(p.line));
      if (p.prop_type) parts.push(p.prop_type);
      if (!p.player_name && p.pick_text) parts.push(p.pick_text);
      grouped[date].push(parts.join(' '));
    }
    const text = Object.entries(grouped).map(([date, lines]) =>
      `DATE: ${date}\n${lines.join('\n')}`
    ).join('\n\n');
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${selectedPicks.length} picks to clipboard`);
  }, [selectedPicks]);

  const bulkUpdateResult = async (result: string) => {
    if (selectedPicks.length === 0) return;
    const ids = selectedPicks.map((p: any) => p.id);
    for (const id of ids) {
      await (supabase as any).from('sbo_capper_picks').update({ result }).eq('id', id);
    }
    toast.success(`Marked ${ids.length} picks as ${result}`);
    setSelectedIds(new Set());
    qc.invalidateQueries({ queryKey: ['sbo-picks-feed'] });
    onRefetch();
  };

  const updateResult = async (pickId: string, result: string) => {
    await (supabase as any).from('sbo_capper_picks').update({ result }).eq('id', pickId);
    toast.success(`Marked ${result}`);
    qc.invalidateQueries({ queryKey: ['sbo-picks-feed'] });
    onRefetch();
  };

  // Reset page when filters change
  const handleFilterChange = (setter: (v: any) => void, value: any) => {
    setter(value);
    setPage(1);
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-3">
      {/* Search + Filter Toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search player, team, capper..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Button
          size="sm" variant="outline" className="gap-1.5 text-xs h-8"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-3 w-3" />
          Filters
          {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Select value={resultFilter} onValueChange={v => handleFilterChange(setResultFilter, v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Result" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Results</SelectItem>
              <SelectItem value="pending">🟡 Pending</SelectItem>
              <SelectItem value="won">🟢 Won</SelectItem>
              <SelectItem value="lost">🔴 Lost</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sportFilter} onValueChange={v => handleFilterChange(setSportFilter, v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sport" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sports</SelectItem>
              {SPORTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={marketFilter} onValueChange={v => handleFilterChange(setMarketFilter, v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Market" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Markets</SelectItem>
              {MARKET_TYPES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={capperFilter} onValueChange={v => handleFilterChange(setCapperFilter, v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Capper" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cappers</SelectItem>
              {cappers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Bulk Action Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleSelectAll}
            className="h-4 w-4"
          />
          <span className="text-xs text-muted-foreground">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
          </span>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={copyPicks}>
              <Copy className="h-3 w-3" /> Copy
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-emerald-500" onClick={() => bulkUpdateResult('won')}>
              <CheckCircle className="h-3 w-3" /> Win
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-destructive" onClick={() => bulkUpdateResult('lost')}>
              <XCircle className="h-3 w-3" /> Loss
            </Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => bulkUpdateResult('pending')}>
              Reset
            </Button>
          </div>
        )}

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Sort:</span>
          <Select value={`${sortField}-${sortDir}`} onValueChange={v => {
            const [f, d] = v.split('-') as [SortField, SortDir];
            setSortField(f);
            setSortDir(d);
            setPage(1);
          }}>
            <SelectTrigger className="h-7 text-[10px] w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at-desc">Newest First</SelectItem>
              <SelectItem value="created_at-asc">Oldest First</SelectItem>
              <SelectItem value="game_date-desc">Game Date ↓</SelectItem>
              <SelectItem value="game_date-asc">Game Date ↑</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pick Cards */}
      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Loading picks...</CardContent></Card>
      ) : filteredPicks.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-8 text-center">
          <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No picks match your filters</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-1.5">
          {filteredPicks.map((p: any) => {
            const isPending = !p.result || p.result === 'pending';
            const isSelected = selectedIds.has(p.id);
            return (
              <Card
                key={p.id}
                className={`overflow-hidden transition-colors ${
                  isPending ? 'border-yellow-500/20' : ''
                } ${isSelected ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/20'}`}
              >
                <CardContent className="p-2.5 flex items-start gap-2">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(p.id)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${tierColors[p.sbo_cappers?.tier] || ''}`}>
                        {p.sbo_cappers?.name || 'Unknown'}
                      </Badge>
                      <Badge className={`text-[10px] ${sportColors[p.sport] || sportColors.NBA}`}>
                        {p.sport || 'NBA'}
                      </Badge>
                      {p.bet_type && p.bet_type !== 'prop' && (
                        <Badge variant="outline" className="text-[10px]">{p.bet_type}</Badge>
                      )}
                      {isPending && (
                        <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/30 bg-yellow-500/10">
                          🟡 PENDING
                        </Badge>
                      )}
                      {p.parsed_by_ai && <Badge variant="outline" className="text-[8px] text-blue-400 border-blue-400/30">🤖 AI</Badge>}
                      {p.matched_prop_id && <Badge variant="outline" className="text-[8px] text-emerald-400 border-emerald-400/30">🔗</Badge>}
                      {p.sharp_flag && <Badge variant="outline" className="text-[8px] text-purple-400 border-purple-400/30">🧠</Badge>}
                      {p.player_name && <span className="text-sm font-medium">{p.player_name}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {p.direction && (
                        <Badge variant="outline" className={`text-[10px] ${
                          p.direction === 'OVER' || p.direction === 'WIN'
                            ? 'text-emerald-500 border-emerald-500/30'
                            : 'text-blue-500 border-blue-500/30'
                        }`}>{p.direction}</Badge>
                      )}
                      {p.prop_type && <Badge variant="outline" className="text-[10px]">{p.prop_type}</Badge>}
                      {p.line != null && <span className="text-xs font-medium">{p.line}</span>}
                      {p.odds && <span className="text-xs text-muted-foreground">{p.odds > 0 ? '+' : ''}{p.odds}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(p.created_at).toLocaleDateString()}</span>
                      {p.game_date && <span>· {p.game_date}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isPending ? (
                      <>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-emerald-500" onClick={() => updateResult(p.id, 'won')}>
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive" onClick={() => updateResult(p.id, 'lost')}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Badge variant={p.result === 'won' ? 'default' : 'destructive'} className="text-[10px]">
                        {p.result === 'won' ? '✅ Won' : p.result === 'push' ? '↔️ Push' : '❌ Lost'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <DataTablePagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalCount}
          onPageChange={p => { setPage(p); setSelectedIds(new Set()); }}
          onPageSizeChange={s => { setPageSize(s); setPage(1); setSelectedIds(new Set()); }}
          pageSizeOptions={[25, 50, 100]}
        />
      )}
    </div>
  );
}
