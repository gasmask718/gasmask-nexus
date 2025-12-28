import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Search, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { PickEntry } from '@/hooks/useAnalyticsData';
import { format, parseISO } from 'date-fns';

interface EntryLedgerProps {
  entries: PickEntry[];
  calculatePL: (entry: PickEntry) => number;
}

type SortKey = 'date' | 'platform' | 'market' | 'stake' | 'profit_loss';

const ITEMS_PER_PAGE = 15;

export function EntryLedger({ entries, calculatePL }: EntryLedgerProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // Filter by search
  const filteredEntries = useMemo(() => {
    if (!search) return entries;
    const lower = search.toLowerCase();
    return entries.filter(e => 
      (e.player?.toLowerCase().includes(lower)) ||
      (e.team?.toLowerCase().includes(lower)) ||
      (e.market?.toLowerCase().includes(lower)) ||
      (e.platform?.toLowerCase().includes(lower))
    );
  }, [entries, search]);

  // Sort
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      let aVal: any = a[sortKey];
      let bVal: any = b[sortKey];
      
      if (sortKey === 'profit_loss') {
        aVal = calculatePL(a);
        bVal = calculatePL(b);
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
  }, [filteredEntries, sortKey, sortDir, calculatePL]);

  // Paginate
  const totalPages = Math.ceil(sortedEntries.length / ITEMS_PER_PAGE);
  const paginatedEntries = sortedEntries.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const exportCSV = () => {
    const headers = ['Date', 'State', 'Platform', 'Format', 'Sport', 'Player/Team', 'Market', 'Line', 'Selection', 'Stake', 'Odds/Multiplier', 'Result', 'P/L', 'Locked At'];
    const rows = sortedEntries.map(e => [
      e.date,
      e.state,
      e.platform,
      e.format_tag,
      e.sport,
      e.player || e.team || '',
      e.market,
      e.line_value ?? '',
      e.side || '',
      e.stake,
      e.format_tag === 'fantasy_pickem' ? (e.multiplier ?? '') : (e.odds ?? ''),
      e.result || '',
      calculatePL(e).toFixed(2),
      e.locked_at || '',
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entries-ledger-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDir === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const getSelectionDisplay = (entry: PickEntry) => {
    const side = entry.side?.toUpperCase();
    if (side === 'MORE') return <span className="text-green-500">▲ MORE</span>;
    if (side === 'LESS') return <span className="text-red-500">▼ LESS</span>;
    return side || '—';
  };

  const getResultBadge = (result: string | null) => {
    if (result === 'W') return <Badge className="bg-green-500/20 text-green-500 border-0">W</Badge>;
    if (result === 'L') return <Badge className="bg-red-500/20 text-red-500 border-0">L</Badge>;
    if (result === 'Push') return <Badge className="bg-amber-500/20 text-amber-500 border-0">P</Badge>;
    return <Badge variant="secondary">—</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Entry Ledger</CardTitle>
            <CardDescription className="text-xs">
              Showing {paginatedEntries.length} of {filteredEntries.length} settled entries
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search player/team..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-8 h-8 w-48 text-xs"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV} className="h-8 text-xs">
              <Download className="h-3.5 w-3.5 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[80px]">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort('date')}
                    className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                  >
                    Date <SortIcon column="date" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs">State</TableHead>
                <TableHead className="text-xs">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort('platform')}
                    className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                  >
                    Platform <SortIcon column="platform" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs">Format</TableHead>
                <TableHead className="text-xs">Player/Team</TableHead>
                <TableHead className="text-xs">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort('market')}
                    className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                  >
                    Market <SortIcon column="market" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs text-right">Line</TableHead>
                <TableHead className="text-xs">Selection</TableHead>
                <TableHead className="text-xs text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort('stake')}
                    className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                  >
                    Stake <SortIcon column="stake" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs text-right">Odds/Mult</TableHead>
                <TableHead className="text-xs text-center">Result</TableHead>
                <TableHead className="text-xs text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort('profit_loss')}
                    className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                  >
                    P/L <SortIcon column="profit_loss" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs w-[30px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-muted-foreground py-8 text-sm">
                    No entries found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEntries.map((entry) => {
                  const pl = calculatePL(entry);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs">{format(parseISO(entry.date), 'M/d/yy')}</TableCell>
                      <TableCell className="text-xs">{entry.state}</TableCell>
                      <TableCell className="text-xs capitalize">{entry.platform}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {entry.format_tag === 'fantasy_pickem' ? 'Pick\'em' : entry.format_tag}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">{entry.player || entry.team || '—'}</TableCell>
                      <TableCell className="text-xs">{entry.market}</TableCell>
                      <TableCell className="text-xs text-right">{entry.line_value ?? '—'}</TableCell>
                      <TableCell className="text-xs">{getSelectionDisplay(entry)}</TableCell>
                      <TableCell className="text-xs text-right">${entry.stake.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-right">
                        {entry.format_tag === 'fantasy_pickem' 
                          ? `${entry.multiplier ?? 2}x`
                          : entry.odds ?? '—'
                        }
                      </TableCell>
                      <TableCell className="text-center">{getResultBadge(entry.result)}</TableCell>
                      <TableCell className={`text-xs text-right font-medium ${pl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {pl >= 0 ? '+' : ''}${pl.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.locked_at && <Lock className="h-3 w-3 text-muted-foreground" />}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
