import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Users, Plus, MessageSquare, Trophy, Activity, Settings, Eye, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';

const tierColors: Record<string, string> = {
  elite: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
  good: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
  unproven: 'text-muted-foreground border-border bg-muted/50',
};

// ─── Pick Parser ──────────────────────────────────────────────────────
function parsePick(text: string): { player?: string; propType?: string; line?: number; direction?: string; odds?: number } {
  const result: any = {};
  const lower = text.toLowerCase();

  // Direction
  if (lower.includes('over')) result.direction = 'OVER';
  else if (lower.includes('under')) result.direction = 'UNDER';

  // Odds like -110, +150
  const oddsMatch = text.match(/([+-]\d{3,4})/);
  if (oddsMatch) result.odds = parseInt(oddsMatch[1]);

  // Line like 27.5, 6.5
  const lineMatch = text.match(/(\d+\.5|\d+\.\d)/);
  if (lineMatch) result.line = parseFloat(lineMatch[1]);

  // Prop types
  const propTypes = ['points', 'rebounds', 'assists', 'threes', 'steals', 'blocks', 'pts', 'reb', 'ast', 'stl', 'blk', 'strikeouts', 'touchdowns'];
  for (const pt of propTypes) {
    if (lower.includes(pt)) {
      result.propType = pt.charAt(0).toUpperCase() + pt.slice(1);
      break;
    }
  }

  // Player name — heuristic: capitalized words before "over/under/o/u"
  const nameMatch = text.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/);
  if (nameMatch) result.player = nameMatch[1];

  return result;
}

// ─── Add Capper Dialog ────────────────────────────────────────────────
function AddCapperDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [source, setSource] = useState('telegram');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from('sbo_cappers').insert({
      name: name.trim(),
      source,
      source_handle: handle.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Capper added');
      setName(''); setHandle(''); setNotes('');
      setOpen(false);
      onAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-3 w-3" /> Add Capper</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Capper Source</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SharpAction" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="telegram">📱 Telegram</SelectItem>
                  <SelectItem value="twitter">🐦 Twitter/X</SelectItem>
                  <SelectItem value="manual">✏️ Manual</SelectItem>
                  <SelectItem value="discord">💬 Discord</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Handle (optional)</Label>
              <Input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@handle" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Known for NBA props..." />
          </div>
          <Button onClick={handleAdd} disabled={saving || !name.trim()} className="w-full">
            {saving ? 'Adding…' : 'Add Capper'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Log Pick Dialog (with auto-parser) ───────────────────────────────
function AddPickDialog({ cappers, onAdded }: { cappers: any[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [capperId, setCapperId] = useState('');
  const [pickText, setPickText] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [propType, setPropType] = useState('');
  const [line, setLine] = useState('');
  const [direction, setDirection] = useState('');
  const [odds, setOdds] = useState('');
  const [saving, setSaving] = useState(false);

  const handleParse = () => {
    const parsed = parsePick(pickText);
    if (parsed.player) setPlayerName(parsed.player);
    if (parsed.propType) setPropType(parsed.propType);
    if (parsed.line) setLine(String(parsed.line));
    if (parsed.direction) setDirection(parsed.direction);
    if (parsed.odds) setOdds(String(parsed.odds));
    toast.success('Parsed pick text');
  };

  const handleAdd = async () => {
    if (!capperId || !pickText.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from('sbo_capper_picks').insert({
      capper_id: capperId,
      pick_text: pickText.trim(),
      player_name: playerName.trim() || null,
      prop_type: propType || null,
      line: line ? parseFloat(line) : null,
      direction: direction || null,
      odds: odds ? parseInt(odds) : null,
      game_date: new Date().toISOString().split('T')[0],
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Pick logged');
      setPickText(''); setPlayerName(''); setPropType(''); setLine(''); setDirection(''); setOdds('');
      setOpen(false);
      onAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5"><MessageSquare className="h-3 w-3" /> Log Pick</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Log Capper Pick</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Capper</Label>
            <Select value={capperId} onValueChange={setCapperId}>
              <SelectTrigger><SelectValue placeholder="Select capper" /></SelectTrigger>
              <SelectContent>
                {cappers.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Pick Text (raw message)</Label>
              <Button type="button" size="sm" variant="ghost" className="h-5 text-[10px] gap-1" onClick={handleParse}>
                <Zap className="h-3 w-3" /> Auto-Parse
              </Button>
            </div>
            <Textarea value={pickText} onChange={e => setPickText(e.target.value)} placeholder='e.g. "LeBron James over 27.5 points -110"' rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Player</Label>
              <Input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="LeBron James" />
            </div>
            <div>
              <Label className="text-xs">Prop Type</Label>
              <Input value={propType} onChange={e => setPropType(e.target.value)} placeholder="Points" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Line</Label>
              <Input type="number" value={line} onChange={e => setLine(e.target.value)} placeholder="25.5" />
            </div>
            <div>
              <Label className="text-xs">Direction</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OVER">OVER</SelectItem>
                  <SelectItem value="UNDER">UNDER</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Odds</Label>
              <Input type="number" value={odds} onChange={e => setOdds(e.target.value)} placeholder="-110" />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={saving || !capperId || !pickText.trim()} className="w-full">
            {saving ? 'Logging…' : 'Log Pick'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────
function SettingsPanel({ cappers, refetch }: { cappers: any[]; refetch: () => void }) {
  const toggleActive = async (id: string, current: boolean) => {
    await (supabase as any).from('sbo_cappers').update({ is_active: !current }).eq('id', id);
    toast.success(!current ? 'Capper activated' : 'Capper deactivated');
    refetch();
  };

  const removeCapper = async (id: string) => {
    await (supabase as any).from('sbo_cappers').delete().eq('id', id);
    toast.success('Capper removed');
    refetch();
  };

  return (
    <div className="space-y-2">
      {cappers.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-6 text-center text-sm text-muted-foreground">No cappers tracked. Add one to begin.</CardContent></Card>
      ) : cappers.map((c: any) => (
        <Card key={c.id}>
          <CardContent className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{c.name}</span>
                <Badge variant="outline" className="text-[10px]">{c.source}</Badge>
              </div>
              {c.source_handle && <p className="text-[10px] text-muted-foreground">{c.source_handle}</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="outline" className={`text-[10px] ${c.is_active ? 'text-emerald-500 border-emerald-500/30' : 'text-muted-foreground'}`}>
                {c.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => toggleActive(c.id, c.is_active)}>
                {c.is_active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => removeCapper(c.id)}>
                Remove
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────
export default function SBOCapperTracker() {
  const qc = useQueryClient();

  const { data: cappers = [] } = useQuery({
    queryKey: ['sbo-cappers'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_cappers')
        .select('*')
        .order('win_rate', { ascending: false });
      return data || [];
    },
  });

  const { data: picks = [] } = useQuery({
    queryKey: ['sbo-capper-picks'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_capper_picks')
        .select('*, sbo_cappers(name, tier, source)')
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['sbo-cappers'] });
    qc.invalidateQueries({ queryKey: ['sbo-capper-picks'] });
  };

  const updateResult = async (pickId: string, result: string) => {
    await (supabase as any).from('sbo_capper_picks').update({ result }).eq('id', pickId);

    // Recalculate capper stats
    const pick = picks.find((p: any) => p.id === pickId);
    if (pick) {
      const allPicks = picks.filter((p: any) => p.capper_id === pick.capper_id);
      const updated = allPicks.map((p: any) => p.id === pickId ? { ...p, result } : p);
      const resolved = updated.filter((p: any) => p.result !== 'pending');
      const wins = resolved.filter((p: any) => p.result === 'won').length;
      const winRate = resolved.length > 0 ? (wins / resolved.length) * 100 : 0;

      await (supabase as any).from('sbo_cappers').update({
        total_picks: updated.length,
        win_rate: winRate,
        updated_at: new Date().toISOString(),
      }).eq('id', pick.capper_id);
    }

    toast.success(`Marked ${result}`);
    refetchAll();
  };

  const eliteCappers = cappers.filter((c: any) => c.tier === 'elite');
  const pendingPicks = picks.filter((p: any) => p.result === 'pending');
  const resolvedPicks = picks.filter((p: any) => p.result !== 'pending');
  const overallWinRate = resolvedPicks.length > 0
    ? ((resolvedPicks.filter((p: any) => p.result === 'won').length / resolvedPicks.length) * 100).toFixed(1)
    : '—';

  return (
    <TooltipProvider>
      <div className="p-4 space-y-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                Capper Intelligence
                <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">Picks Tracker</Badge>
              </h1>
              <p className="text-xs text-muted-foreground">Track picks · Score accuracy · Compare vs SBO AI</p>
            </div>
          </div>
          <div className="flex gap-2">
            <AddPickDialog cappers={cappers} onAdded={refetchAll} />
            <AddCapperDialog onAdded={refetchAll} />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help"><CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-foreground">{cappers.length}</p>
                <p className="text-[10px] text-muted-foreground">Tracked Cappers</p>
              </CardContent></Card>
            </TooltipTrigger>
            <TooltipContent><p>Total cappers being monitored for picks</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help"><CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-amber-500">{eliteCappers.length}</p>
                <p className="text-[10px] text-muted-foreground">Elite Tier</p>
              </CardContent></Card>
            </TooltipTrigger>
            <TooltipContent><p>Cappers with proven 60%+ win rates</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help"><CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-foreground">{pendingPicks.length}</p>
                <p className="text-[10px] text-muted-foreground">Pending Picks</p>
              </CardContent></Card>
            </TooltipTrigger>
            <TooltipContent><p>Picks awaiting results (win/loss)</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help"><CardContent className="p-3 text-center">
                <p className={`text-lg font-bold ${parseFloat(String(overallWinRate)) >= 55 ? 'text-emerald-500' : 'text-foreground'}`}>{overallWinRate}%</p>
                <p className="text-[10px] text-muted-foreground">Overall Win Rate</p>
              </CardContent></Card>
            </TooltipTrigger>
            <TooltipContent><p>Combined win rate across all cappers</p></TooltipContent>
          </Tooltip>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="feed">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="feed" className="text-xs gap-1"><Activity className="h-3 w-3" /> Feed</TabsTrigger>
            <TabsTrigger value="leaderboard" className="text-xs gap-1"><Trophy className="h-3 w-3" /> Leaderboard</TabsTrigger>
            <TabsTrigger value="cappers" className="text-xs gap-1"><Eye className="h-3 w-3" /> Cappers</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs gap-1"><Settings className="h-3 w-3" /> Settings</TabsTrigger>
          </TabsList>

          {/* Pick Feed */}
          <TabsContent value="feed" className="mt-3 space-y-2">
            {picks.length === 0 ? (
              <Card className="border-dashed"><CardContent className="p-8 text-center">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No picks logged yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Log a pick to start tracking capper performance.</p>
              </CardContent></Card>
            ) : picks.map((p: any) => (
              <Card key={p.id} className="overflow-hidden hover:border-primary/20 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${tierColors[p.sbo_cappers?.tier] || ''}`}>
                          {p.sbo_cappers?.name || 'Unknown'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{p.sbo_cappers?.source || 'manual'}</Badge>
                        {p.player_name && <span className="text-sm font-medium">{p.player_name}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {p.direction && <Badge variant="outline" className={`text-[10px] ${p.direction === 'OVER' ? 'text-emerald-500 border-emerald-500/30' : 'text-blue-500 border-blue-500/30'}`}>{p.direction}</Badge>}
                        {p.prop_type && <Badge variant="outline" className="text-[10px]">{p.prop_type}</Badge>}
                        {p.line != null && <span className="text-xs font-medium">{p.line}</span>}
                        {p.odds && <span className="text-xs text-muted-foreground">{p.odds > 0 ? '+' : ''}{p.odds}</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">{p.pick_text}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(p.created_at).toLocaleString()}</span>
                        {p.game_date && <span>· Game: {p.game_date}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.result === 'pending' ? (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-emerald-500" onClick={() => updateResult(p.id, 'won')}>
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Mark as Win</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive" onClick={() => updateResult(p.id, 'lost')}>
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Mark as Loss</p></TooltipContent>
                          </Tooltip>
                        </>
                      ) : (
                        <Badge variant={p.result === 'won' ? 'default' : 'destructive'} className="text-[10px]">
                          {p.result === 'won' ? '✅ Won' : p.result === 'push' ? '↔️ Push' : '❌ Lost'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Leaderboard */}
          <TabsContent value="leaderboard" className="mt-3 space-y-2">
            {cappers.length === 0 ? (
              <Card className="border-dashed"><CardContent className="p-8 text-center">
                <Trophy className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No cappers ranked yet.</p>
              </CardContent></Card>
            ) : cappers
                .filter((c: any) => c.is_active)
                .sort((a: any, b: any) => (b.win_rate || 0) - (a.win_rate || 0))
                .map((c: any, i: number) => {
                  const capperPicks = picks.filter((p: any) => p.capper_id === c.id);
                  const resolved = capperPicks.filter((p: any) => p.result !== 'pending');
                  const wins = resolved.filter((p: any) => p.result === 'won').length;
                  const wr = resolved.length > 0 ? ((wins / resolved.length) * 100) : 0;
                  return (
                    <Card key={c.id} className={i === 0 ? 'border-amber-500/30' : ''}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground w-6 text-center">#{i + 1}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-[10px] ${tierColors[c.tier]}`}>{c.tier}</Badge>
                              <span className="font-medium text-sm">{c.name}</span>
                              <Badge variant="outline" className="text-[10px]">{c.source}</Badge>
                            </div>
                            {c.source_handle && <p className="text-[10px] text-muted-foreground mt-0.5">{c.source_handle}</p>}
                          </div>
                        </div>
                        <div className="text-right text-xs space-y-0.5">
                          <p className="text-sm font-bold">{wr.toFixed(1)}% WR</p>
                          <p className="text-muted-foreground">{c.total_picks || capperPicks.length} picks · {wins}W/{resolved.length - wins}L</p>
                          <p className={`${(c.roi_pct || 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                            ROI: {(c.roi_pct || 0) >= 0 ? '+' : ''}{(c.roi_pct || 0).toFixed(1)}%
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
          </TabsContent>

          {/* Cappers Detail */}
          <TabsContent value="cappers" className="mt-3 space-y-2">
            {cappers.length === 0 ? (
              <Card className="border-dashed"><CardContent className="p-8 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No cappers tracked yet.</p>
              </CardContent></Card>
            ) : cappers.map((c: any) => {
              const capperPicks = picks.filter((p: any) => p.capper_id === c.id);
              const resolved = capperPicks.filter((p: any) => p.result !== 'pending');
              const wins = resolved.filter((p: any) => p.result === 'won').length;
              const wr = resolved.length > 0 ? ((wins / resolved.length) * 100) : 0;
              return (
                <Card key={c.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{c.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${tierColors[c.tier]}`}>{c.tier}</Badge>
                          <Badge variant="outline" className={`text-[10px] ${c.is_active ? 'text-emerald-500 border-emerald-500/30' : 'text-muted-foreground'}`}>
                            {c.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>{c.source}</span>
                          {c.source_handle && <span>· {c.source_handle}</span>}
                          {c.notes && <span>· {c.notes}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{wr.toFixed(0)}%</p>
                        <p className="text-[10px] text-muted-foreground">{capperPicks.length} picks</p>
                      </div>
                    </div>
                    {capperPicks.length > 0 && (
                      <div className="border-t border-border pt-2">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1">Recent Picks</p>
                        <div className="space-y-1">
                          {capperPicks.slice(0, 3).map((p: any) => (
                            <div key={p.id} className="flex items-center gap-2 text-xs">
                              {p.result === 'won' ? <CheckCircle className="h-3 w-3 text-emerald-500" /> :
                               p.result === 'lost' ? <XCircle className="h-3 w-3 text-destructive" /> :
                               <Clock className="h-3 w-3 text-muted-foreground" />}
                              <span className="truncate flex-1">{p.player_name || p.pick_text}</span>
                              {p.direction && <Badge variant="outline" className="text-[8px] h-4">{p.direction}</Badge>}
                              {p.line != null && <span className="text-muted-foreground">{p.line}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="mt-3">
            <SettingsPanel cappers={cappers} refetch={refetchAll} />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
