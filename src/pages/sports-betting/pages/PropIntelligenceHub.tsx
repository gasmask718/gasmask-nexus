import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Search, Upload, RefreshCw, TrendingUp, Trophy, Target, Zap, BarChart3,
  ChevronUp, ChevronDown, Filter, ImagePlus, Layers, Brain, ArrowLeft, ArrowRight,
  CheckCircle, XCircle, Clock
} from 'lucide-react';
import { usePropsMaster, usePropsMasterStats, usePropCrossIntelligence, usePropMutations, PropMaster, TimeRange } from '@/hooks/usePropsMaster';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: 'all', label: 'All' },
];

const PLATFORMS = [
  { value: 'all', label: 'All Platforms' },
  { value: 'prizepicks', label: 'PrizePicks' },
  { value: 'bovada', label: 'Bovada' },
  { value: 'draftkings', label: 'DraftKings' },
  { value: 'fanduel', label: 'FanDuel' },
  { value: 'betmgm', label: 'BetMGM' },
  { value: 'underdog', label: 'Underdog' },
  { value: 'manual', label: 'Manual' },
];

function getTodayEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export default function PropIntelligenceHub() {
  const [platform, setPlatform] = useState('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [gameDate, setGameDate] = useState('');
  const [minConfidence, setMinConfidence] = useState(0);
  const [bestOnly, setBestOnly] = useState(false);
  const [searchPlayer, setSearchPlayer] = useState('');
  const [selectedProp, setSelectedProp] = useState<PropMaster | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadPlatform, setUploadPlatform] = useState('prizepicks');
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = usePropsMaster({
    platform,
    gameDate: gameDate || undefined,
    minConfidence: minConfidence || undefined,
    searchPlayer: searchPlayer || undefined,
    page,
    pageSize,
  });
  const props = data?.props ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const { data: stats } = usePropsMasterStats(gameDate || undefined);
  const { data: crossIntel = [] } = usePropCrossIntelligence(selectedProp?.player_name, selectedProp?.stat_type);
  const { syncBooks, runAnalysis, uploadImage } = usePropMutations();

  // Apply client-side best-only filter
  let filtered = bestOnly ? props.filter(p => (p.confidence_score || 0) >= 70) : props;

  // Group by player+stat for cross-platform view
  const grouped = new Map<string, PropMaster[]>();
  for (const p of filtered) {
    const key = `${p.player_name}|${p.stat_type}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      uploadImage.mutate({ imageBase64: base64, platform: uploadPlatform });
      setShowUpload(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            ⚡ Prop Intelligence Hub
          </h1>
          <p className="text-sm text-muted-foreground">
            All props. All platforms. One engine.
            {totalCount > 0 && <span className="ml-2 font-medium text-foreground">{totalCount.toLocaleString()} total props</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={showUpload} onOpenChange={setShowUpload}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ImagePlus className="h-4 w-4" /> Upload Props
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload Prop Slip</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Platform</Label>
                  <Select value={uploadPlatform} onValueChange={setUploadPlatform}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.filter(p => p.value !== 'all').map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Screenshot</Label>
                  <Input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} />
                </div>
                {uploadImage.isPending && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Parsing with AI...
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Button 
            onClick={() => runAnalysis.mutate()} 
            disabled={runAnalysis.isPending}
            variant="outline" 
            size="sm" 
            className="gap-1.5"
          >
            {runAnalysis.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {runAnalysis.isPending ? 'Analyzing...' : 'Run Analysis'}
          </Button>

          <Button 
            onClick={() => syncBooks.mutate()} 
            disabled={syncBooks.isPending}
            size="sm" 
            className="gap-1.5"
          >
            {syncBooks.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncBooks.isPending ? 'Syncing...' : 'Sync Books'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { label: 'Total Props', value: stats?.total ?? 0, icon: Layers, color: 'text-blue-500' },
          { label: 'Best Picks', value: stats?.bestPicks ?? 0, icon: Trophy, color: 'text-amber-500' },
          { label: 'Analyzed', value: stats?.withPrediction ?? 0, icon: Brain, color: 'text-purple-500' },
          { label: 'No Stats', value: stats?.noStats ?? 0, icon: Target, color: 'text-muted-foreground' },
          { label: 'Wins', value: stats?.wins ?? 0, icon: CheckCircle, color: 'text-green-500' },
          { label: 'Losses', value: stats?.losses ?? 0, icon: XCircle, color: 'text-red-500' },
          { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, color: 'text-yellow-500' },
          { label: 'Accuracy', value: `${stats?.winRate ?? 0}%`, icon: BarChart3, color: 'text-emerald-500' },
        ].map(s => (
          <Card key={s.label} className="border-border/40">
            <CardContent className="p-2.5">
              <div className="flex items-center gap-1.5">
                <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-lg font-bold mt-0.5">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Platform Breakdown */}
      {stats?.byPlatform && Object.keys(stats.byPlatform).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.byPlatform).map(([plat, count]) => (
            <Badge key={plat} variant="outline" className="capitalize text-xs gap-1">
              {plat}: <span className="font-bold">{count}</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Stat Type Breakdown */}
      {stats?.byStatType && Object.keys(stats.byStatType).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(stats.byStatType)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 12)
            .map(([stat, info]) => (
              <Badge key={stat} variant="secondary" className="text-[10px] capitalize gap-1">
                {stat}: {info.total}
                {info.wins + info.losses > 0 && (
                  <span className="text-green-500 ml-0.5">
                    {Math.round((info.wins / (info.wins + info.losses)) * 100)}%
                  </span>
                )}
              </Badge>
            ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input 
            placeholder="Search player..." 
            className="pl-8 w-44 h-9" 
            value={searchPlayer} 
            onChange={e => { setSearchPlayer(e.target.value); setPage(1); }} 
          />
        </div>
        <Select value={platform} onValueChange={v => { setPlatform(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input 
          type="date" 
          className="w-36 h-9" 
          value={gameDate} 
          onChange={e => { setGameDate(e.target.value); setPage(1); }} 
        />
        <div className="flex items-center gap-1.5">
          <Switch checked={bestOnly} onCheckedChange={setBestOnly} id="best-only" />
          <Label htmlFor="best-only" className="text-xs cursor-pointer">Best Only (70%+)</Label>
        </div>
        {gameDate && (
          <Button variant="ghost" size="sm" onClick={() => { setGameDate(''); setPage(1); }}>
            Clear Date
          </Button>
        )}
      </div>

      {/* Props Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
          Loading props...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {totalCount === 0 
                ? 'No props in system yet. Click "Sync Books" to ingest from all sportsbooks.'
                : 'No props match your filters. Try adjusting filters or clearing the date.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from(grouped.entries()).map(([key, groupProps]) => {
            const primary = groupProps[0];
            const hasMultiple = groupProps.length > 1;

            return (
              <Card
                key={key}
                className={`cursor-pointer transition-all hover:border-primary/40 ${
                  primary.result === 'win' ? 'border-green-500/40 bg-green-500/5' :
                  primary.result === 'loss' ? 'border-red-500/40 bg-red-500/5' : 'border-border/50'
                }`}
                onClick={() => setSelectedProp(primary)}
              >
                <CardContent className="p-3 space-y-2">
                  {/* Player Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm">{primary.player_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[primary.team, primary.opponent ? `vs ${primary.opponent}` : null].filter(Boolean).join(' ')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {primary.result === 'win' && <Badge className="bg-green-500/20 text-green-500 text-[10px]">WIN ✅</Badge>}
                      {primary.result === 'loss' && <Badge className="bg-red-500/20 text-red-500 text-[10px]">LOSS ❌</Badge>}
                      {hasMultiple && <Badge variant="outline" className="text-[10px]">{groupProps.length} books</Badge>}
                    </div>
                  </div>

                  {/* Stat + Line */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs capitalize">{primary.stat_type}</Badge>
                      <span className="text-lg font-bold">{primary.line}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{primary.platform}</Badge>
                  </div>

                  {/* AI Prediction */}
                  {primary.prediction && (
                    <div className={`flex items-center justify-between p-2 rounded-md ${
                      primary.prediction === 'MORE' || primary.prediction === 'OVER'
                        ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        {primary.prediction === 'MORE' || primary.prediction === 'OVER'
                          ? <ChevronUp className="h-4 w-4 text-green-500" />
                          : <ChevronDown className="h-4 w-4 text-red-500" />}
                        <span className="text-sm font-semibold">{primary.prediction}</span>
                      </div>
                      {primary.confidence_score != null && (
                        <span className={`text-sm font-bold ${
                          primary.confidence_score >= 75 ? 'text-green-500' :
                          primary.confidence_score >= 60 ? 'text-yellow-500' : 'text-muted-foreground'
                        }`}>
                          {primary.confidence_score}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stats Row */}
                  {(primary.season_avg || primary.last_5_avg) && (
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <div className="bg-muted/30 rounded p-1 text-center">
                        <p className="text-muted-foreground">Season</p>
                        <p className="font-semibold">{primary.season_avg ?? '—'}</p>
                      </div>
                      <div className="bg-muted/30 rounded p-1 text-center">
                        <p className="text-muted-foreground">L5</p>
                        <p className="font-semibold">{primary.last_5_avg ?? '—'}</p>
                      </div>
                      <div className="bg-muted/30 rounded p-1 text-center">
                        <p className="text-muted-foreground">L10</p>
                        <p className="font-semibold">{primary.last_10_avg ?? '—'}</p>
                      </div>
                    </div>
                  )}

                  {/* Cross-platform mini */}
                  {hasMultiple && (
                    <div className="border-t border-border/30 pt-1.5 space-y-0.5">
                      {groupProps.map(gp => (
                        <div key={gp.id} className="flex justify-between text-[10px]">
                          <span className="capitalize text-muted-foreground">{gp.platform}</span>
                          <span className="font-mono">{gp.line}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Result */}
                  {primary.actual_result != null && (
                    <div className="text-xs text-muted-foreground border-t border-border/30 pt-1">
                      Actual: <span className="font-bold text-foreground">{primary.actual_result}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button 
            variant="outline" size="sm" 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page <= 1}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalCount.toLocaleString()} props)
          </span>
          <Button 
            variant="outline" size="sm" 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
            disabled={page >= totalPages}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Detail Drawer */}
      <Sheet open={!!selectedProp} onOpenChange={o => !o && setSelectedProp(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedProp && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedProp.player_name} — {selectedProp.stat_type}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Team:</span> {selectedProp.team || '—'}</div>
                  <div><span className="text-muted-foreground">Opponent:</span> {selectedProp.opponent || '—'}</div>
                  <div><span className="text-muted-foreground">Line:</span> <span className="font-bold">{selectedProp.line}</span></div>
                  <div><span className="text-muted-foreground">Platform:</span> {selectedProp.platform}</div>
                  <div><span className="text-muted-foreground">Source:</span> {selectedProp.source}</div>
                  <div><span className="text-muted-foreground">Odds:</span> {selectedProp.odds || '—'}</div>
                </div>

                {/* AI Analysis */}
                {selectedProp.prediction && (
                  <Card className="border-primary/30">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">🧠 AI Analysis</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span>Direction</span>
                        <Badge className={selectedProp.prediction === 'MORE' || selectedProp.prediction === 'OVER' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}>
                          {selectedProp.prediction}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Confidence</span>
                        <span className="font-bold">{selectedProp.confidence_score}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Edge</span>
                        <span className="font-bold">{selectedProp.edge_score || '—'}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Stats */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">📊 Stats</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Season Avg: <span className="font-bold">{selectedProp.season_avg ?? '—'}</span></div>
                      <div>Last 5: <span className="font-bold">{selectedProp.last_5_avg ?? '—'}</span></div>
                      <div>Last 10: <span className="font-bold">{selectedProp.last_10_avg ?? '—'}</span></div>
                      <div>Hit Rate: <span className="font-bold">{selectedProp.hit_rate ? `${selectedProp.hit_rate}%` : '—'}</span></div>
                      <div>Matchup: <span className="font-bold">{selectedProp.matchup_avg ?? '—'}</span></div>
                    </div>
                  </CardContent>
                </Card>

                {/* Cross-Platform */}
                {crossIntel.length > 1 && (
                  <Card className="border-orange-500/30">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">🌐 Cross-Platform Lines</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-1.5">
                        {crossIntel.map(ci => (
                          <div key={ci.id} className="flex justify-between items-center text-sm">
                            <Badge variant="outline" className="capitalize text-xs">{ci.platform}</Badge>
                            <span className="font-mono font-bold">{ci.line}</span>
                            {ci.odds && <span className="text-xs text-muted-foreground">{ci.odds}</span>}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Result */}
                {selectedProp.result !== 'pending' && (
                  <Card className={selectedProp.result === 'win' ? 'border-green-500/40' : 'border-red-500/40'}>
                    <CardContent className="p-3 flex justify-between items-center">
                      <span className="font-medium">Result</span>
                      <Badge className={selectedProp.result === 'win' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}>
                        {selectedProp.result === 'win' ? 'WIN ✅' : 'LOSS ❌'}
                      </Badge>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
