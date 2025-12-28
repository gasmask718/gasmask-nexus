import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, TrendingUp, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStateCompliance, STATE_LABELS } from '@/hooks/useStateCompliance';
import { format } from 'date-fns';

const LINE_MISMATCH_THRESHOLD = 1.5; // Points difference to flag

export default function LineShopping() {
  const { currentState, allowedPlatforms, isPlatformAllowed } = useStateCompliance();
  const [searchPlayer, setSearchPlayer] = useState('');
  const [searchMarket, setSearchMarket] = useState('');

  const { data: lines, isLoading } = useQuery({
    queryKey: ['sportsbook-lines', currentState],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sportsbook_lines')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Group lines by player + market for comparison
  const groupedLines = useMemo(() => {
    if (!lines) return [];

    const filtered = lines.filter(line => {
      const matchesPlayer = !searchPlayer || 
        line.player_or_team?.toLowerCase().includes(searchPlayer.toLowerCase());
      const matchesMarket = !searchMarket || 
        line.market_type?.toLowerCase().includes(searchMarket.toLowerCase());
      return matchesPlayer && matchesMarket;
    });

    // Group by player + market
    const groups: Record<string, typeof lines> = {};
    filtered.forEach(line => {
      const key = `${line.player_or_team}-${line.market_type}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(line);
    });

    return Object.entries(groups).map(([key, groupLines]) => {
      const lineValues = groupLines.map(l => l.line_value).filter(v => v !== null) as number[];
      const minLine = Math.min(...lineValues);
      const maxLine = Math.max(...lineValues);
      const hasMismatch = maxLine - minLine >= LINE_MISMATCH_THRESHOLD;
      
      // Find best line (lowest for under, highest for over depending on context)
      const bestLineForOver = groupLines.reduce((best, curr) => {
        if (!best || (curr.line_value && (!best.line_value || curr.line_value < best.line_value))) {
          return curr;
        }
        return best;
      }, null as (typeof groupLines)[0] | null);

      return {
        key,
        player: groupLines[0].player_or_team,
        market: groupLines[0].market_type,
        lines: groupLines,
        hasMismatch,
        minLine,
        maxLine,
        bestLineForOver,
      };
    });
  }, [lines, searchPlayer, searchMarket]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Search className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Line Shopping</h1>
          <p className="text-muted-foreground">
            Compare lines across platforms in {STATE_LABELS[currentState]}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="player">Player</Label>
            <Input
              id="player"
              placeholder="Search by player name..."
              value={searchPlayer}
              onChange={(e) => setSearchPlayer(e.target.value)}
            />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="market">Market</Label>
            <Input
              id="market"
              placeholder="PTS, AST, REB, PRA..."
              value={searchMarket}
              onChange={(e) => setSearchMarket(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : groupedLines.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No lines found. Upload lines via Line Intake first.
            </CardContent>
          </Card>
        ) : (
          groupedLines.map((group) => (
            <Card key={group.key} className={group.hasMismatch ? 'border-amber-500/50' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{group.player}</CardTitle>
                    <CardDescription>{group.market}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {group.hasMismatch && (
                      <Badge variant="outline" className="bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Line Mismatch
                      </Badge>
                    )}
                    {group.bestLineForOver && (
                      <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-300">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Best: {group.bestLineForOver.line_value} @ {group.bestLineForOver.sportsbook}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead className="text-right">Line</TableHead>
                      <TableHead className="text-right">Over</TableHead>
                      <TableHead className="text-right">Under</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.lines.map((line) => {
                      const isAllowed = isPlatformAllowed(line.sportsbook as any);
                      const isBest = line.id === group.bestLineForOver?.id;
                      return (
                        <TableRow 
                          key={line.id} 
                          className={`${!isAllowed ? 'opacity-50' : ''} ${isBest ? 'bg-green-500/10' : ''}`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {line.sportsbook}
                              {!isAllowed && (
                                <Badge variant="secondary" className="text-xs">N/A in {currentState}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {line.line_value}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {line.over_odds}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {line.under_odds}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm">
                            {line.uploaded_at ? format(new Date(line.uploaded_at), 'MMM d, h:mm a') : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
