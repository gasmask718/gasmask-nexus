import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, CheckCircle, XCircle, Database } from 'lucide-react';
import { toast } from 'sonner';

export function SyncDashboard() {
  const [syncing, setSyncing] = useState<string | null>(null);

  const { data: syncLogs, refetch } = useQuery({
    queryKey: ['sbo-sync-logs'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: counts } = useQuery({
    queryKey: ['sbo-table-counts'],
    queryFn: async () => {
      const tables = [
        'sbo_player_season_stats',
        'sbo_player_game_logs',
        'sbo_injuries',
        'sbo_player_projections',
        'sbo_sdio_props',
        'sbo_team_stats',
      ];

      const results: Record<string, number> = {};
      for (const table of tables) {
        const { count } = await (supabase as any)
          .from(table)
          .select('*', { count: 'exact', head: true });
        results[table] = count || 0;
      }
      return results;
    },
  });

  const runSync = async (syncType: 'daily' | 'pregame' | 'prizepicks') => {
    setSyncing(syncType);
    try {
      const fnMap: Record<string, string> = {
        daily: 'sbo-sync-daily',
        pregame: 'sbo-sync-pregame',
        prizepicks: 'sbo-sync-prizepicks',
      };
      const labelMap: Record<string, string> = {
        daily: 'Daily',
        pregame: 'Pre-game',
        prizepicks: 'PrizePicks',
      };
      const { data, error } = await supabase.functions.invoke(fnMap[syncType], {
        body: { date: new Date().toISOString().split('T')[0] },
      });
      if (error) throw error;
      toast.success(`${labelMap[syncType]} sync complete`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const tableLabels: Record<string, string> = {
    sbo_player_season_stats: 'Player Season Stats',
    sbo_player_game_logs: 'Game Logs',
    sbo_injuries: 'Injuries',
    sbo_player_projections: 'Projections',
    sbo_sdio_props: 'Player Props (SDIO)',
    sbo_team_stats: 'Team Stats',
  };

  // Get latest sync per feed
  const latestByFeed: Record<string, any> = {};
  for (const log of syncLogs || []) {
    if (!latestByFeed[log.feed_name]) {
      latestByFeed[log.feed_name] = log;
    }
  }

  return (
    <div className="space-y-4">

      {/* Sync controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" onClick={() => runSync('daily')} disabled={!!syncing} className="gap-1.5">
          {syncing === 'daily'
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />
          }
          Run Daily Sync
        </Button>
        <Button size="sm" onClick={() => runSync('pregame')} disabled={!!syncing} className="gap-1.5">
          {syncing === 'pregame'
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />
          }
          Run Pre-Game Sync
        </Button>
        <Button size="sm" variant="outline" onClick={() => runSync('prizepicks')} disabled={!!syncing} className="gap-1.5">
          {syncing === 'prizepicks'
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />
          }
          Sync PrizePicks
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Daily: 8am · Pre-game: 6pm · PrizePicks: anytime
        </p>
      </div>

      {/* Table counts */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            Your NBA Data Library
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(counts || {}).map(([table, count]) => (
              <div key={table} className="bg-muted/40 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-foreground">{count.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">
                  {tableLabels[table] || table}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sync status per feed */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Feed Sync Status</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="space-y-2">
            {Object.entries(latestByFeed).map(([feed, log]) => (
              <div key={feed} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20">
                {log.status === 'success'
                  ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium capitalize">
                    {feed.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {log.records_synced?.toLocaleString() || 0} records ·{' '}
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                  {log.error_message && (
                    <p className="text-[10px] text-red-500 mt-0.5">{log.error_message}</p>
                  )}
                </div>
                <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-[9px] flex-shrink-0">
                  {log.status}
                </Badge>
              </div>
            ))}
            {!Object.keys(latestByFeed).length && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No syncs yet. Run Daily Sync to pull your first data.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Alert>
        <AlertDescription className="space-y-2 text-xs">
          <p className="font-semibold">How Syncing Works</p>
          <p>
            <strong>Daily Sync (8am)</strong> — Pulls season averages for all NBA players,
            current injury report, team standings. Run this once each morning.
          </p>
          <p>
            <strong>Pre-Game Sync (6pm)</strong> — Pulls tonight's player projections,
            all player props from DraftKings/FanDuel/BetMGM, and yesterday's game logs.
            Props auto-populate into the VA Entry tab. Run this before games start.
          </p>
          <p>
            <strong>Stats Brain</strong> — After syncing, every prediction automatically
            uses your real stats. LeBron's last 10 games, injury status, opponent defense
            rating, and tonight's projected minutes all feed into the analysis.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
