import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, ArrowRightLeft, TrendingUp, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCrossPlatformProps, type CrossPlatformProp } from '@/hooks/useCrossPlatformProps';
import { PropStatContextCard } from '@/components/sbo/PropStatContextCard';
import { ActionTooltip } from '@/components/sbo/ActionTooltip';

const PROP_LABELS: Record<string, string> = {
  points: 'Points', rebounds: 'Rebounds', assists: 'Assists',
  threes: '3-Pointers', blocks: 'Blocks', steals: 'Steals',
  turnovers: 'Turnovers', pts_reb_ast: 'Pts+Reb+Ast',
  pts_reb: 'Pts+Reb', pts_ast: 'Pts+Ast', reb_ast: 'Reb+Ast',
};

const SOURCE_COLORS: Record<string, string> = {
  bovada: 'bg-red-500/15 text-red-500 border-red-500/30',
  draftkings: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  fanduel: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  betmgm: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  caesars: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
  prizepicks: 'bg-pink-500/15 text-pink-500 border-pink-500/30',
  manual: 'bg-muted text-muted-foreground border-border',
};

function PropComparisonCard({ prop }: { prop: CrossPlatformProp }) {
  const propLabel = PROP_LABELS[prop.prop_type] || prop.prop_type;

  return (
    <Card className={`${prop.has_edge ? 'border-primary/50 bg-primary/5' : ''}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">{prop.player_name}</p>
            <p className="text-xs text-muted-foreground">{propLabel}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {prop.has_edge && (
              <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px]">
                <Zap className="h-3 w-3 mr-0.5" />
                EDGE {prop.line_spread.toFixed(1)}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {prop.sources.length} {prop.sources.length === 1 ? 'book' : 'books'}
            </Badge>
          </div>
        </div>

        {/* Lines by source */}
        <div className="space-y-1.5">
          {prop.sources.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <Badge variant="outline" className={`text-[10px] px-1.5 ${SOURCE_COLORS[s.source] || SOURCE_COLORS.manual}`}>
                {s.source}
              </Badge>
              <div className="flex items-center gap-3">
                <span className="font-mono font-medium">{s.line}</span>
                <span className="text-muted-foreground">
                  O {s.over_odds ? (s.over_odds > 0 ? `+${s.over_odds}` : s.over_odds) : '—'} / U {s.under_odds ? (s.under_odds > 0 ? `+${s.under_odds}` : s.under_odds) : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Best play */}
        {prop.sources.length > 1 && (
          <div className="pt-2 border-t border-border/50 flex gap-3 text-[10px]">
            {prop.best_over && (
              <div className="flex-1 p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-emerald-500 font-medium">Best OVER</p>
                <p className="text-muted-foreground">{prop.best_over.source}: {prop.best_over.line}</p>
              </div>
            )}
            {prop.best_under && (
              <div className="flex-1 p-1.5 rounded bg-orange-500/10 border border-orange-500/20">
                <p className="text-orange-500 font-medium">Best UNDER</p>
                <p className="text-muted-foreground">{prop.best_under.source}: {prop.best_under.line}</p>
              </div>
            )}
          </div>
        )}

        {/* Stat intelligence panel */}
        {prop.prop_id && (
          <div className="pt-2 border-t border-border/50">
            <PropStatContextCard
              propId={prop.prop_id}
              playerName={prop.player_name}
              propType={prop.prop_type}
              line={prop.sources[0]?.line || 0}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BookPropsComparison() {
  const { data: crossProps, isLoading, refetch } = useCrossPlatformProps();
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showEdgesOnly, setShowEdgesOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-ingest-book-props', {
        body: { bookmakers: 'bovada,betonlineag,draftkings,fanduel,betmgm' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Ingested: ${data.inserted} new, ${data.updated} updated from ${Object.keys(data.book_stats || {}).length} books`);
      refetch();
    } catch (e: any) {
      const msg = e.message || 'Unknown error';
      setSyncError(msg);
      toast.error(`Sync failed: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  // Get unique sources
  const allSources = new Set<string>();
  (crossProps || []).forEach(p => p.sources.forEach(s => allSources.add(s.source)));

  const filtered = (crossProps || []).filter(p => {
    if (search && !p.player_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (showEdgesOnly && !p.has_edge) return false;
    if (sourceFilter !== 'all' && !p.sources.some(s => s.source === sourceFilter)) return false;
    return true;
  });

  const multiSourceCount = (crossProps || []).filter(p => p.sources.length > 1).length;
  const edgeCount = (crossProps || []).filter(p => p.has_edge).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Cross-Platform Props</CardTitle>
            </div>
            <Button size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sync Book Props
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Stats bar */}
          <div className="flex gap-3 text-xs">
            <Badge variant="outline">{crossProps?.length || 0} total props</Badge>
            <Badge variant="outline" className="text-blue-500 border-blue-500/30">
              {multiSourceCount} multi-source
            </Badge>
            <Badge variant="outline" className="text-primary border-primary/30">
              <Zap className="h-3 w-3 mr-0.5" />
              {edgeCount} edges
            </Badge>
            {[...allSources].map(s => (
              <Badge key={s} variant="outline" className={`text-[10px] ${SOURCE_COLORS[s] || ''}`}>
                {s}
              </Badge>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Input
              placeholder="Search player..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Books</SelectItem>
                {[...allSources].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant={showEdgesOnly ? 'default' : 'outline'}
              className="h-8 text-xs"
              onClick={() => setShowEdgesOnly(!showEdgesOnly)}
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              Edges Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No props found for today.</p>
            {syncError && (
              <p className="text-xs text-destructive">Last sync error: {syncError}</p>
            )}
            <Button size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sync Book Props Now
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((prop, i) => (
            <PropComparisonCard key={`${prop.player_name}-${prop.prop_type}-${i}`} prop={prop} />
          ))}
        </div>
      )}
    </div>
  );
}
