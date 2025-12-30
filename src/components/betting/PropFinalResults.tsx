import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Database, Play, Trophy, Target } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';

interface PropFinalResult {
  id: string;
  game_id: string;
  game_date: string;
  player_name: string;
  team: string;
  opponent: string;
  stat_type: string;
  line_value: number;
  side: string;
  final_stat_value: number;
  actual_winner: string;
  is_correct: boolean;
  ai_probability: number | null;
  ai_confidence_score: number | null;
  stat_source: string;
  dnp: boolean;
  settled_at: string;
  is_valid: boolean;
}

export function PropFinalResults() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isSettling, setIsSettling] = useState(false);

  // Fetch final results for props only
  const { data: propResults, isLoading, refetch } = useQuery({
    queryKey: ['prop-final-results', selectedDate],
    queryFn: async () => {
      const startDate = subDays(new Date(selectedDate), 7).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('final_results')
        .select('*')
        .eq('market_type', 'player_prop')
        .eq('is_valid', true)
        .gte('game_date', startDate)
        .lte('game_date', selectedDate)
        .order('game_date', { ascending: false })
        .order('settled_at', { ascending: false });
      
      if (error) throw error;
      return data as PropFinalResult[];
    },
  });

  // Run prop settlement via edge function
  const runPropSettlement = async () => {
    setIsSettling(true);
    try {
      const { data, error } = await supabase.functions.invoke('nba-stats-engine', {
        body: { action: 'settle_props', date: selectedDate }
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(`Settled ${data.settled} props for ${selectedDate}`);
        if (data.dnp_count > 0) {
          toast.info(`${data.dnp_count} players DNP`);
        }
      } else {
        toast.error(data.error || 'Settlement failed');
      }
      
      await refetch();
    } catch (err) {
      console.error('Prop settlement error:', err);
      toast.error('Failed to run prop settlement');
    } finally {
      setIsSettling(false);
    }
  };

  // Calculate stats
  const stats = propResults ? {
    total: propResults.length,
    wins: propResults.filter(r => r.is_correct === true).length,
    losses: propResults.filter(r => r.is_correct === false).length,
    dnp: propResults.filter(r => r.dnp).length,
    winRate: propResults.length > 0 
      ? (propResults.filter(r => r.is_correct === true).length / propResults.length) * 100 
      : 0,
  } : { total: 0, wins: 0, losses: 0, dnp: 0, winRate: 0 };

  const getResultBadge = (result: string, isCorrect: boolean | null) => {
    if (result === 'Push') {
      return <Badge variant="secondary">Push</Badge>;
    }
    if (isCorrect === true) {
      return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />W</Badge>;
    }
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />L</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Settlement Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Prop Final Results (Authoritative)
              </CardTitle>
              <CardDescription className="mt-1">
                Settled props from final_results using BoxScoresFinal only. Immutable after settlement.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
              <Button 
                onClick={runPropSettlement} 
                disabled={isSettling}
                className="gap-2"
              >
                {isSettling ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Settle Props
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm text-muted-foreground">Total Settled</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-3">
              <div className="text-sm text-green-600">Wins</div>
              <div className="text-2xl font-bold text-green-600">{stats.wins}</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-3">
              <div className="text-sm text-red-600">Losses</div>
              <div className="text-2xl font-bold text-red-600">{stats.losses}</div>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-3">
              <div className="text-sm text-amber-600">DNP</div>
              <div className="text-2xl font-bold text-amber-600">{stats.dnp}</div>
            </div>
            <div className="bg-primary/10 rounded-lg p-3">
              <div className="text-sm text-primary">Win Rate</div>
              <div className="text-2xl font-bold text-primary">{stats.winRate.toFixed(1)}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Settled Prop Results
              </CardTitle>
              <CardDescription>Verified final stats from BoxScoresFinal endpoint</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !propResults?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No prop final results yet</p>
              <p className="text-sm mt-1">Run "Settle Props" to populate from BoxScoresFinal</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Stat</TableHead>
                    <TableHead className="text-right">Line</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="text-right">Conf%</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>DNP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propResults.map((result) => (
                    <TableRow key={result.id} className={result.dnp ? 'opacity-50' : ''}>
                      <TableCell className="text-sm text-muted-foreground">
                        {result.game_date}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{result.player_name}</span>
                          <div className="text-xs text-muted-foreground">
                            {result.team} vs {result.opponent}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{result.stat_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{result.line_value}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={result.side === 'over' ? 'text-green-600 border-green-600' : 'text-red-600 border-red-600'}
                        >
                          {result.side?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {result.final_stat_value}
                      </TableCell>
                      <TableCell>
                        {getResultBadge(result.actual_winner, result.is_correct)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {result.ai_confidence_score ? `${result.ai_confidence_score}%` : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {result.stat_source?.replace('SportsDataIO_', '')}
                      </TableCell>
                      <TableCell>
                        {result.dnp ? (
                          <Badge variant="destructive" className="text-xs">DNP</Badge>
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
