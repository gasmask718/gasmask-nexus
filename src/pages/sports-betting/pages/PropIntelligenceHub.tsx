import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Search, Upload, RefreshCw, TrendingUp, Trophy, Target, Zap, BarChart3,
  ChevronUp, ChevronDown, Filter, ImagePlus, Layers, Brain, ArrowLeft, ArrowRight,
  CheckCircle, XCircle, Clock, Plus, FileSpreadsheet, Activity, ShieldCheck, AlertTriangle, Database
} from 'lucide-react';
import { usePropsMaster, usePropsMasterStats, usePropCrossIntelligence, usePropMutations, PropMaster, TimeRange } from '@/hooks/usePropsMaster';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

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

const STAT_TYPES = [
  'points', 'rebounds', 'assists', 'threes', 'blocks', 'steals',
  'turnovers', 'pts_reb_ast', 'pts_reb', 'pts_ast', 'reb_ast',
  'fantasy_score', 'double_double', 'triple_double',
];

function getTodayEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// ── Manual Entry Form ─────────────────────────────────────────────────────────
function ManualEntryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    player_name: '', stat_type: 'points', line: '', platform: 'prizepicks',
    team: '', opponent: '', game_date: getTodayEST(), odds: '',
  });

  const handleSave = async () => {
    if (!form.player_name || !form.line) { toast.error('Player name and line are required'); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('props_master').insert({
        player_name: form.player_name.trim(),
        stat_type: form.stat_type,
        line: parseFloat(form.line),
        platform: form.platform,
        team: form.team || null,
        opponent: form.opponent || null,
        game_date: form.game_date,
        odds: form.odds || null,
        source: 'manual',
        sport: 'NBA',
        result: 'pending',
      });
      if (error) throw error;
      toast.success('Prop added successfully');
      qc.invalidateQueries({ queryKey: ['props-master'] });
      qc.invalidateQueries({ queryKey: ['props-master-stats'] });
      setForm({ player_name: '', stat_type: 'points', line: '', platform: 'prizepicks', team: '', opponent: '', game_date: getTodayEST(), odds: '' });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Prop Manually</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Player Name *</Label>
              <Input value={form.player_name} onChange={e => setForm(f => ({ ...f, player_name: e.target.value }))} placeholder="LeBron James" />
            </div>
            <div>
              <Label className="text-xs">Line *</Label>
              <Input type="number" step="0.5" value={form.line} onChange={e => setForm(f => ({ ...f, line: e.target.value }))} placeholder="25.5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Stat Type</Label>
              <Select value={form.stat_type} onValueChange={v => setForm(f => ({ ...f, stat_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAT_TYPES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Platform</Label>
              <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.filter(p => p.value !== 'all').map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Team</Label>
              <Input value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))} placeholder="LAL" />
            </div>
            <div>
              <Label className="text-xs">Opponent</Label>
              <Input value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} placeholder="GSW" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Game Date</Label>
              <Input type="date" value={form.game_date} onChange={e => setForm(f => ({ ...f, game_date: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Odds</Label>
              <Input value={form.odds} onChange={e => setForm(f => ({ ...f, odds: e.target.value }))} placeholder="-110" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Saving...</> : 'Add Prop'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── CSV Upload Dialog ─────────────────────────────────────────────────────────
function CSVUploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [csvPlatform, setCsvPlatform] = useState('prizepicks');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) throw new Error('CSV must have headers + data');
      
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      const playerIdx = headers.findIndex(h => h.includes('player') || h.includes('name'));
      const statIdx = headers.findIndex(h => h.includes('stat') || h.includes('type') || h.includes('prop'));
      const lineIdx = headers.findIndex(h => h.includes('line') || h.includes('value') || h.includes('number'));
      const teamIdx = headers.findIndex(h => h.includes('team'));
      const dateIdx = headers.findIndex(h => h.includes('date'));

      if (playerIdx === -1 || lineIdx === -1) throw new Error('CSV must have player_name and line columns');

      const rows = [];
      let skipped = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const playerName = cols[playerIdx];
        const line = parseFloat(cols[lineIdx]);
        if (!playerName || isNaN(line)) { skipped++; continue; }
        rows.push({
          player_name: playerName,
          stat_type: statIdx >= 0 ? cols[statIdx] || 'points' : 'points',
          line,
          platform: csvPlatform,
          team: teamIdx >= 0 ? cols[teamIdx] || null : null,
          game_date: dateIdx >= 0 ? cols[dateIdx] || getTodayEST() : getTodayEST(),
          source: 'csv_upload',
          sport: 'NBA',
          result: 'pending',
        });
      }

      if (rows.length === 0) throw new Error('No valid rows found');

      // Batch insert
      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await (supabase as any).from('props_master').insert(batch);
        if (error) throw error;
      }

      toast.success(`Imported ${rows.length} props${skipped > 0 ? ` (${skipped} skipped)` : ''}`);
      qc.invalidateQueries({ queryKey: ['props-master'] });
      qc.invalidateQueries({ queryKey: ['props-master-stats'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Upload CSV</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            CSV must include columns: <code>player_name</code>, <code>line</code>. Optional: <code>stat_type</code>, <code>team</code>, <code>date</code>
          </p>
          <div>
            <Label className="text-xs">Platform</Label>
            <Select value={csvPlatform} onValueChange={setCsvPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PLATFORMS.filter(p => p.value !== 'all').map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleCSV} />
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" /> Processing CSV...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Hub ──────────────────────────────────────────────────────────────────
export default function PropIntelligenceHub() {
  const [platform, setPlatform] = useState('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [gameDate, setGameDate] = useState('');
  const [minConfidence, setMinConfidence] = useState(0);
  const [bestOnly, setBestOnly] = useState(false);
  const [searchPlayer, setSearchPlayer] = useState('');
  const [selectedProp, setSelectedProp] = useState<PropMaster | null>(null);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [uploadPlatform, setUploadPlatform] = useState('prizepicks');
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = usePropsMaster({
    platform,
    gameDate: gameDate || undefined,
    timeRange: gameDate ? undefined : timeRange,
    minConfidence: minConfidence || undefined,
    searchPlayer: searchPlayer || undefined,
    page,
    pageSize,
  });
  const props = data?.props ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const { data: stats } = usePropsMasterStats(gameDate || undefined, gameDate ? undefined : timeRange);
  const { data: crossIntel = [] } = usePropCrossIntelligence(selectedProp?.player_name, selectedProp?.stat_type);
  const { syncBooks, runAnalysis, uploadImage } = usePropMutations();

  let filtered = bestOnly ? props.filter(p => (p.confidence_score || 0) >= 70) : props;

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
      setShowImageUpload(false);
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
          {/* Upload Menu */}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowManualEntry(true)}>
            <Plus className="h-4 w-4" /> Manual
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowCSVUpload(true)}>
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowImageUpload(true)}>
            <ImagePlus className="h-4 w-4" /> Image
          </Button>

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
          { label: 'Wins', value: stats?.wins ?? 0, icon: CheckCircle, color: 'text-green-500' },
          { label: 'Losses', value: stats?.losses ?? 0, icon: XCircle, color: 'text-red-500' },
          { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, color: 'text-yellow-500' },
          { label: 'Accuracy', value: `${stats?.winRate ?? 0}%`, icon: BarChart3, color: 'text-emerald-500' },
          { label: 'Health', value: `${stats?.healthPct ?? 0}%`, icon: Activity, color: stats?.healthPct && stats.healthPct >= 80 ? 'text-green-500' : stats?.healthPct && stats.healthPct >= 50 ? 'text-yellow-500' : 'text-red-500' },
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

      {/* Data Health Panel */}
      <Card className="border-border/40">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Data Integrity</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={async () => {
                  toast.info('Collecting missing stats...');
                  try {
                    const { data, error } = await supabase.functions.invoke('sbo-run-analysis', {
                      body: { mode: 'stats_only' },
                    });
                    if (error) throw error;
                    queryClient.invalidateQueries({ queryKey: ['props-master'] });
                    queryClient.invalidateQueries({ queryKey: ['props-master-stats'] });
                    toast.success(`Stats collected for ${data?.analyzed ?? 0} props`);
                  } catch (e: any) {
                    toast.error(`Stats collection failed: ${e.message}`);
                  }
                }}
              >
                <Database className="h-3 w-3" /> Collect Stats
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={async () => {
                  toast.info('Resolving pending results...');
                  try {
                    const { data, error } = await supabase.functions.invoke('sbo-settle-results');
                    if (error) throw error;
                    queryClient.invalidateQueries({ queryKey: ['props-master'] });
                    queryClient.invalidateQueries({ queryKey: ['props-master-stats'] });
                    toast.success(`Resolved ${data?.settled ?? 0} results`);
                  } catch (e: any) {
                    toast.error(`Result resolution failed: ${e.message}`);
                  }
                }}
              >
                <Target className="h-3 w-3" /> Resolve Results
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <div className="bg-muted/30 rounded p-2 text-center">
              <p className="text-muted-foreground">With Stats</p>
              <p className="font-bold text-green-500">{stats?.withStats ?? 0}</p>
            </div>
            <div className="bg-muted/30 rounded p-2 text-center">
              <p className="text-muted-foreground">Missing Stats</p>
              <p className="font-bold text-red-500">{stats?.noStats ?? 0}</p>
            </div>
            <div className="bg-muted/30 rounded p-2 text-center">
              <p className="text-muted-foreground">With Results</p>
              <p className="font-bold text-green-500">{stats?.withResults ?? 0}</p>
            </div>
            <div className="bg-muted/30 rounded p-2 text-center">
              <p className="text-muted-foreground">Missing Results</p>
              <p className="font-bold text-yellow-500">{stats?.missingResults ?? 0}</p>
            </div>
            <div className="bg-muted/30 rounded p-2 text-center">
              <p className="text-muted-foreground">Fully Complete</p>
              <p className="font-bold text-primary">{stats?.fullyComplete ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Breakdown with Colors + Accuracy */}
      {stats?.byPlatform && Object.keys(stats.byPlatform).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {Object.entries(stats.byPlatform).map(([plat, info]) => {
            const platInfo = info as { total: number; wins: number; losses: number; pending: number };
            const acc = platInfo.wins + platInfo.losses > 0 
              ? Math.round((platInfo.wins / (platInfo.wins + platInfo.losses)) * 100) : null;
            const colorMap: Record<string, string> = {
              prizepicks: 'border-purple-500/40 bg-purple-500/10',
              bovada: 'border-red-500/40 bg-red-500/10',
              draftkings: 'border-green-500/40 bg-green-500/10',
              fanduel: 'border-blue-500/40 bg-blue-500/10',
              betmgm: 'border-amber-500/40 bg-amber-500/10',
              underdog: 'border-orange-500/40 bg-orange-500/10',
              manual: 'border-muted-foreground/40 bg-muted/30',
            };
            const dotColor: Record<string, string> = {
              prizepicks: 'bg-purple-500',
              bovada: 'bg-red-500',
              draftkings: 'bg-green-500',
              fanduel: 'bg-blue-500',
              betmgm: 'bg-amber-500',
              underdog: 'bg-orange-500',
              manual: 'bg-muted-foreground',
            };
            return (
              <Card key={plat} className={`border ${colorMap[plat] || 'border-border/40 bg-muted/20'}`}>
                <CardContent className="p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`h-2 w-2 rounded-full ${dotColor[plat] || 'bg-muted-foreground'}`} />
                    <span className="text-xs font-medium capitalize">{plat}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{platInfo.total}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-green-500">{platInfo.wins}W</span>
                    <span className="text-red-500">{platInfo.losses}L</span>
                    {acc !== null && <span className="font-bold ml-auto">{acc}%</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Prediction Direction */}
      {(stats?.overCount || stats?.underCount || stats?.holdCount) ? (
        <div className="flex gap-3 text-xs">
          <Badge variant="outline" className="gap-1 border-green-500/30 text-green-600">
            <ChevronUp className="h-3 w-3" /> Over: {stats.overCount}
          </Badge>
          <Badge variant="outline" className="gap-1 border-red-500/30 text-red-600">
            <ChevronDown className="h-3 w-3" /> Under: {stats.underCount}
          </Badge>
          <Badge variant="outline" className="gap-1 border-muted-foreground/30">
            Hold: {stats.holdCount}
          </Badge>
        </div>
      ) : null}

      {/* Stat Type Breakdown */}
      {stats?.byStatType && Object.keys(stats.byStatType).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(stats.byStatType)
            .sort((a, b) => (b[1] as any).total - (a[1] as any).total)
            .slice(0, 12)
            .map(([stat, info]) => (
              <Badge key={stat} variant="secondary" className="text-[10px] capitalize gap-1">
                {stat}: {(info as any).total}
                {(info as any).wins + (info as any).losses > 0 && (
                  <span className="text-green-500 ml-0.5">
                    {Math.round(((info as any).wins / ((info as any).wins + (info as any).losses)) * 100)}%
                  </span>
                )}
              </Badge>
            ))}
        </div>
      )}

      {/* Time Range Selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex bg-muted/50 rounded-lg p-0.5 gap-0.5">
          {TIME_RANGES.map(tr => (
            <Button
              key={tr.value}
              variant={timeRange === tr.value && !gameDate ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => { setTimeRange(tr.value); setGameDate(''); setPage(1); }}
            >
              {tr.label}
            </Button>
          ))}
        </div>
      </div>

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
                ? 'No props in system yet. Click "Sync Books" to ingest from all sportsbooks, or add manually.'
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

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs capitalize">{primary.stat_type}</Badge>
                      <span className="text-lg font-bold">{primary.line}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] capitalize ${
                      ({
                        prizepicks: 'border-purple-500/50 text-purple-600',
                        bovada: 'border-red-500/50 text-red-600',
                        draftkings: 'border-green-500/50 text-green-600',
                        fanduel: 'border-blue-500/50 text-blue-600',
                        betmgm: 'border-amber-500/50 text-amber-600',
                        underdog: 'border-orange-500/50 text-orange-600',
                      } as Record<string, string>)[primary.platform] || ''
                    }`}>{primary.platform}</Badge>
                  </div>

                  {primary.prediction && primary.prediction !== 'hold' && (
                    <div className={`flex items-center justify-between p-2 rounded-md ${
                      ['more', 'over', 'MORE', 'OVER'].includes(primary.prediction)
                        ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        {['more', 'over', 'MORE', 'OVER'].includes(primary.prediction)
                          ? <ChevronUp className="h-4 w-4 text-green-500" />
                          : <ChevronDown className="h-4 w-4 text-red-500" />}
                        <span className="text-sm font-semibold uppercase">{primary.prediction}</span>
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

      {/* Dialogs */}
      <ManualEntryDialog open={showManualEntry} onOpenChange={setShowManualEntry} />
      <CSVUploadDialog open={showCSVUpload} onOpenChange={setShowCSVUpload} />

      {/* Image Upload Dialog */}
      <Dialog open={showImageUpload} onOpenChange={setShowImageUpload}>
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
    </div>
  );
}