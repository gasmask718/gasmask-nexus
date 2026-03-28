import { useState, useRef } from 'react';
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
import { Users, Plus, MessageSquare, Trophy, Activity, Settings, Eye, CheckCircle, XCircle, Clock, Zap, Camera, Upload, Loader2, AlertTriangle, Filter, Link2 } from 'lucide-react';
import { toast } from 'sonner';

const SPORTS = ['NBA', 'WNBA', 'NFL', 'MLB', 'NHL', 'Soccer', 'UFC', 'Tennis', 'NCAAB', 'NCAAF'] as const;
const BET_TYPES = ['prop', 'moneyline', 'spread', 'total', 'futures', 'parlay'] as const;

const sportColors: Record<string, string> = {
  NBA: 'text-orange-500 border-orange-500/30 bg-orange-500/10',
  WNBA: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  NFL: 'text-green-500 border-green-500/30 bg-green-500/10',
  MLB: 'text-red-500 border-red-500/30 bg-red-500/10',
  NHL: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
  Soccer: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
  UFC: 'text-red-600 border-red-600/30 bg-red-600/10',
  Tennis: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10',
  NCAAB: 'text-purple-500 border-purple-500/30 bg-purple-500/10',
  NCAAF: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
};

const tierColors: Record<string, string> = {
  elite: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
  good: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
  unproven: 'text-muted-foreground border-border bg-muted/50',
};

// ─── Photo Upload Dialog ──────────────────────────────────────────────
function PhotoUploadDialog({ cappers, onAdded }: { cappers: any[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [capperId, setCapperId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [parsedPicks, setParsedPicks] = useState<any[]>([]);
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Max 10MB'); return; }

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleParse = async () => {
    if (!preview || !capperId) { toast.error('Select a capper and upload an image'); return; }
    setUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-parse-capper-image', {
        body: { image: preview, capper_id: capperId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Parse failed');

      setParsedPicks(data.picks || []);
      setStep('review');
      toast.success(`Parsed ${data.count} picks (${data.needs_review} need review)`);
      onAdded();
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse image');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setPreview(null); setParsedPicks([]); setStep('upload'); setCapperId('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
          <Camera className="h-3 w-3" /> AI Photo Parse
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>📸 AI Capper Pick Parser</DialogTitle></DialogHeader>

        {step === 'upload' ? (
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
              <Input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="Preview" className="w-full rounded-lg border max-h-60 object-contain bg-muted" />
                  <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-6 text-xs" onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ''; }}>✕</Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full h-32 border-dashed flex-col gap-2" onClick={() => inputRef.current?.click()}>
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Upload screenshot of picks</span>
                </Button>
              )}
            </div>
            <Button onClick={handleParse} disabled={!preview || !capperId || uploading} className="w-full">
              {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Parsing with AI…</> : '🧠 Parse Picks'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs">{parsedPicks.length} picks parsed</Badge>
              <Badge variant="outline" className={`text-xs ${parsedPicks.some(p => p.parse_confidence < 70) ? 'text-amber-500 border-amber-500/30' : 'text-emerald-500 border-emerald-500/30'}`}>
                {parsedPicks.filter(p => p.parse_confidence < 70).length} need review
              </Badge>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {parsedPicks.map((p: any, i: number) => (
                <Card key={i} className={p.parse_confidence < 70 ? 'border-amber-500/30' : ''}>
                  <CardContent className="p-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[10px] ${sportColors[p.sport] || ''}`}>{p.sport}</Badge>
                      <Badge variant="outline" className="text-[10px]">{p.bet_type}</Badge>
                      {p.parse_confidence < 70 && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      <span className="text-[10px] text-muted-foreground ml-auto">{p.parse_confidence}% conf</span>
                    </div>
                    <div className="mt-1">
                      <span className="text-sm font-medium">{p.player_name || p.team}</span>
                      {p.direction && <Badge variant="outline" className={`ml-2 text-[10px] ${p.direction === 'OVER' || p.direction === 'WIN' ? 'text-emerald-500 border-emerald-500/30' : 'text-blue-500 border-blue-500/30'}`}>{p.direction}</Badge>}
                      {p.line != null && <span className="ml-1 text-xs font-medium">{p.line}</span>}
                      {p.stat_type && <span className="ml-1 text-xs text-muted-foreground">{p.stat_type}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} className="flex-1">Upload Another</Button>
              <Button onClick={() => { setOpen(false); reset(); }} className="flex-1">Done ✅</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Capper Dialog ────────────────────────────────────────────────
function AddCapperDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [source, setSource] = useState('telegram');
  const [sports, setSports] = useState<string[]>(['NBA']);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleSport = (s: string) => setSports(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from('sbo_cappers').insert({
      name: name.trim(), source,
      source_handle: handle.trim() || null,
      notes: notes.trim() || null,
      sports,
    });
    setSaving(false);
    if (error) { toast.error(error.message); } else {
      toast.success('Capper added');
      setName(''); setHandle(''); setNotes(''); setSports(['NBA']);
      setOpen(false); onAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3 w-3" /> Add Capper</Button>
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
                  <SelectItem value="instagram">📷 Instagram</SelectItem>
                  <SelectItem value="youtube">📺 YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Handle (optional)</Label>
              <Input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@handle" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Sports</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SPORTS.map(s => (
                <Badge key={s} variant="outline" className={`text-[10px] cursor-pointer transition-all ${sports.includes(s) ? sportColors[s] : 'opacity-40'}`}
                  onClick={() => toggleSport(s)}>{s}</Badge>
              ))}
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

// ─── Log Pick Dialog (with auto-parser + multi-sport) ─────────────────
function AddPickDialog({ cappers, onAdded }: { cappers: any[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [capperId, setCapperId] = useState('');
  const [pickText, setPickText] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [propType, setPropType] = useState('');
  const [line, setLine] = useState('');
  const [direction, setDirection] = useState('');
  const [odds, setOdds] = useState('');
  const [sport, setSport] = useState('NBA');
  const [betType, setBetType] = useState('prop');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!capperId || !pickText.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from('sbo_capper_picks').insert({
      capper_id: capperId, pick_text: pickText.trim(),
      player_name: playerName.trim() || null, prop_type: propType || null,
      line: line ? parseFloat(line) : null, direction: direction || null,
      odds: odds ? parseInt(odds) : null, sport, bet_type: betType,
      game_date: new Date().toISOString().split('T')[0],
      parse_confidence: 100, review_status: 'verified',
    });
    setSaving(false);
    if (error) { toast.error(error.message); } else {
      toast.success('Pick logged');
      setPickText(''); setPlayerName(''); setPropType(''); setLine(''); setDirection(''); setOdds('');
      setOpen(false); onAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5"><MessageSquare className="h-3 w-3" /> Manual Pick</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Log Capper Pick</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Capper</Label>
              <Select value={capperId} onValueChange={setCapperId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{cappers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sport</Label>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SPORTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Pick Text</Label>
            <Textarea value={pickText} onChange={e => setPickText(e.target.value)} placeholder='e.g. "LeBron James over 27.5 points -110"' rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Player</Label>
              <Input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="LeBron James" />
            </div>
            <div>
              <Label className="text-xs">Stat</Label>
              <Input value={propType} onChange={e => setPropType(e.target.value)} placeholder="points" />
            </div>
            <div>
              <Label className="text-xs">Bet Type</Label>
              <Select value={betType} onValueChange={setBetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BET_TYPES.map(bt => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}</SelectContent>
              </Select>
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
                  <SelectItem value="WIN">WIN</SelectItem>
                  <SelectItem value="LOSE">LOSE</SelectItem>
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
    toast.success('Capper removed'); refetch();
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
              <div className="flex gap-1 mt-1">
                {(c.sports || ['NBA']).map((s: string) => (
                  <Badge key={s} variant="outline" className={`text-[8px] ${sportColors[s] || ''}`}>{s}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="outline" className={`text-[10px] ${c.is_active ? 'text-emerald-500 border-emerald-500/30' : 'text-muted-foreground'}`}>
                {c.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => toggleActive(c.id, c.is_active)}>
                {c.is_active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => removeCapper(c.id)}>Remove</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Review Queue ─────────────────────────────────────────────────────
function ReviewQueue({ onResolved }: { onResolved: () => void }) {
  const { data: picks = [] } = useQuery({
    queryKey: ['sbo-capper-picks-review'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_capper_picks')
        .select('*, sbo_cappers(name)')
        .eq('review_status', 'needs_review')
        .order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  const approve = async (id: string) => {
    await (supabase as any).from('sbo_capper_picks').update({ review_status: 'verified' }).eq('id', id);
    toast.success('Pick verified'); onResolved();
  };
  const reject = async (id: string) => {
    await (supabase as any).from('sbo_capper_picks').delete().eq('id', id);
    toast.success('Pick removed'); onResolved();
  };

  if (picks.length === 0) return (
    <Card className="border-dashed"><CardContent className="p-8 text-center">
      <CheckCircle className="h-8 w-8 mx-auto text-emerald-500/50 mb-2" />
      <p className="text-sm text-muted-foreground">All picks verified ✅</p>
    </CardContent></Card>
  );

  return (
    <div className="space-y-2">
      <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">{picks.length} picks need review</Badge>
      {picks.map((p: any) => (
        <Card key={p.id} className="border-amber-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{p.sbo_cappers?.name}</Badge>
                  <Badge className={`text-[10px] ${sportColors[p.sport] || ''}`}>{p.sport}</Badge>
                  <span className="text-[10px] text-amber-500">{p.parse_confidence}% confidence</span>
                </div>
                <p className="text-sm mt-1">{p.player_name} {p.direction} {p.line} {p.prop_type}</p>
                <p className="text-[10px] text-muted-foreground truncate">{p.pick_text}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" className="h-7 text-emerald-500" onClick={() => approve(p.id)}>✅</Button>
                <Button size="sm" variant="outline" className="h-7 text-destructive" onClick={() => reject(p.id)}>❌</Button>
              </div>
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
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [matching, setMatching] = useState(false);

  const { data: cappers = [] } = useQuery({
    queryKey: ['sbo-cappers'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_cappers').select('*').order('win_rate', { ascending: false });
      return data || [];
    },
  });

  const { data: picks = [] } = useQuery({
    queryKey: ['sbo-capper-picks', sportFilter],
    queryFn: async () => {
      let q = (supabase as any).from('sbo_capper_picks')
        .select('*, sbo_cappers(name, tier, source)')
        .order('created_at', { ascending: false }).limit(200);
      if (sportFilter !== 'all') q = q.eq('sport', sportFilter);
      const { data } = await q;
      return data || [];
    },
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['sbo-cappers'] });
    qc.invalidateQueries({ queryKey: ['sbo-capper-picks'] });
    qc.invalidateQueries({ queryKey: ['sbo-capper-picks-review'] });
  };

  const runMatchAndResolve = async () => {
    setMatching(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-match-capper-picks', {
        body: { mode: 'match_and_resolve' },
      });
      if (error) throw error;
      toast.success(`Matched ${data.matched} picks, resolved ${data.resolved} results`);
      refetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Match failed');
    } finally {
      setMatching(false);
    }
  };

  const updateResult = async (pickId: string, result: string) => {
    await (supabase as any).from('sbo_capper_picks').update({ result }).eq('id', pickId);
    const pick = picks.find((p: any) => p.id === pickId);
    if (pick) {
      const allPicks = picks.filter((p: any) => p.capper_id === pick.capper_id);
      const updated = allPicks.map((p: any) => p.id === pickId ? { ...p, result } : p);
      const resolved = updated.filter((p: any) => p.result !== 'pending');
      const wins = resolved.filter((p: any) => p.result === 'won').length;
      const winRate = resolved.length > 0 ? (wins / resolved.length) * 100 : 0;
      await (supabase as any).from('sbo_cappers').update({
        total_picks: updated.length, win_rate: winRate, updated_at: new Date().toISOString(),
      }).eq('id', pick.capper_id);
    }
    toast.success(`Marked ${result}`); refetchAll();
  };

  const pendingPicks = picks.filter((p: any) => p.result === 'pending');
  const resolvedPicks = picks.filter((p: any) => p.result !== 'pending');
  const overallWinRate = resolvedPicks.length > 0
    ? ((resolvedPicks.filter((p: any) => p.result === 'won').length / resolvedPicks.length) * 100).toFixed(1) : '—';

  // Sport breakdown
  const sportBreakdown = picks.reduce((acc: Record<string, { total: number; wins: number }>, p: any) => {
    const s = p.sport || 'NBA';
    if (!acc[s]) acc[s] = { total: 0, wins: 0 };
    if (p.result !== 'pending') { acc[s].total++; if (p.result === 'won') acc[s].wins++; }
    return acc;
  }, {} as Record<string, { total: number; wins: number }>);

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
                <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">Multi-Sport</Badge>
              </h1>
              <p className="text-xs text-muted-foreground">AI photo parser · Multi-sport · Performance tracking</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={runMatchAndResolve} disabled={matching}>
              {matching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
              {matching ? 'Linking...' : '🔗 Match & Resolve'}
            </Button>
            <PhotoUploadDialog cappers={cappers} onAdded={refetchAll} />
            <AddPickDialog cappers={cappers} onAdded={refetchAll} />
            <AddCapperDialog onAdded={refetchAll} />
          </div>
        </div>

        {/* Sport Filter */}
        <div className="flex gap-1.5 flex-wrap">
          <Badge variant="outline" className={`text-[10px] cursor-pointer ${sportFilter === 'all' ? 'bg-primary text-primary-foreground' : ''}`}
            onClick={() => setSportFilter('all')}>All Sports</Badge>
          {SPORTS.map(s => (
            <Badge key={s} variant="outline" className={`text-[10px] cursor-pointer ${sportFilter === s ? sportColors[s] : 'opacity-50'}`}
              onClick={() => setSportFilter(s)}>{s}</Badge>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          <Card><CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{cappers.length}</p>
            <p className="text-[10px] text-muted-foreground">Cappers</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-amber-500">{cappers.filter((c: any) => c.tier === 'elite').length}</p>
            <p className="text-[10px] text-muted-foreground">Elite Tier</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{pendingPicks.length}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className={`text-lg font-bold ${parseFloat(String(overallWinRate)) >= 55 ? 'text-emerald-500' : ''}`}>{overallWinRate}%</p>
            <p className="text-[10px] text-muted-foreground">Win Rate</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{Object.keys(sportBreakdown).length}</p>
            <p className="text-[10px] text-muted-foreground">Sports Active</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-emerald-500">{picks.filter((p: any) => p.matched_prop_id).length}</p>
            <p className="text-[10px] text-muted-foreground">🔗 Linked</p>
          </CardContent></Card>
        </div>

        {/* Sport Breakdown */}
        {Object.keys(sportBreakdown).length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {(Object.entries(sportBreakdown) as [string, { total: number; wins: number }][]).map(([s, data]) => {
              const wr = data.total > 0 ? ((data.wins / data.total) * 100).toFixed(0) : '—';
              return (
                <Badge key={s} variant="outline" className={`text-[10px] ${sportColors[s] || ''}`}>
                  {s}: {wr}% ({data.wins}W/{data.total - data.wins}L)
                </Badge>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="feed">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="feed" className="text-xs gap-1"><Activity className="h-3 w-3" /> Feed</TabsTrigger>
            <TabsTrigger value="review" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" /> Review</TabsTrigger>
            <TabsTrigger value="leaderboard" className="text-xs gap-1"><Trophy className="h-3 w-3" /> Board</TabsTrigger>
            <TabsTrigger value="cappers" className="text-xs gap-1"><Eye className="h-3 w-3" /> Cappers</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs gap-1"><Settings className="h-3 w-3" /> Settings</TabsTrigger>
          </TabsList>

          {/* Pick Feed */}
          <TabsContent value="feed" className="mt-3 space-y-2">
            {picks.length === 0 ? (
              <Card className="border-dashed"><CardContent className="p-8 text-center">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No picks logged yet. Use 📸 AI Photo Parse to get started.</p>
              </CardContent></Card>
            ) : picks.map((p: any) => (
              <Card key={p.id} className="overflow-hidden hover:border-primary/20 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${tierColors[p.sbo_cappers?.tier] || ''}`}>{p.sbo_cappers?.name || 'Unknown'}</Badge>
                        <Badge className={`text-[10px] ${sportColors[p.sport] || sportColors.NBA}`}>{p.sport || 'NBA'}</Badge>
                        {p.bet_type && p.bet_type !== 'prop' && <Badge variant="outline" className="text-[10px]">{p.bet_type}</Badge>}
                        {p.parsed_by_ai && <Badge variant="outline" className="text-[8px] text-blue-400 border-blue-400/30">🤖 AI</Badge>}
                        {p.matched_prop_id && <Badge variant="outline" className="text-[8px] text-emerald-400 border-emerald-400/30">🔗 Linked</Badge>}
                        {p.player_name && <span className="text-sm font-medium">{p.player_name}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {p.direction && <Badge variant="outline" className={`text-[10px] ${p.direction === 'OVER' || p.direction === 'WIN' ? 'text-emerald-500 border-emerald-500/30' : 'text-blue-500 border-blue-500/30'}`}>{p.direction}</Badge>}
                        {p.prop_type && <Badge variant="outline" className="text-[10px]">{p.prop_type}</Badge>}
                        {p.line != null && <span className="text-xs font-medium">{p.line}</span>}
                        {p.odds && <span className="text-xs text-muted-foreground">{p.odds > 0 ? '+' : ''}{p.odds}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(p.created_at).toLocaleString()}</span>
                        {p.game_date && <span>· {p.game_date}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.result === 'pending' ? (
                        <>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-emerald-500" onClick={() => updateResult(p.id, 'won')}><CheckCircle className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive" onClick={() => updateResult(p.id, 'lost')}><XCircle className="h-3.5 w-3.5" /></Button>
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

          {/* Review Queue */}
          <TabsContent value="review" className="mt-3">
            <ReviewQueue onResolved={refetchAll} />
          </TabsContent>

          {/* Leaderboard */}
          <TabsContent value="leaderboard" className="mt-3 space-y-2">
            {cappers.filter((c: any) => c.is_active).sort((a: any, b: any) => (b.win_rate || 0) - (a.win_rate || 0)).map((c: any, i: number) => {
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
                        </div>
                        <div className="flex gap-1 mt-1">
                          {(c.sports || ['NBA']).map((s: string) => (
                            <Badge key={s} variant="outline" className={`text-[8px] ${sportColors[s] || ''}`}>{s}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs space-y-0.5">
                      <p className="text-sm font-bold">{wr.toFixed(1)}% WR</p>
                      <p className="text-muted-foreground">{capperPicks.length} picks · {wins}W/{resolved.length - wins}L</p>
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

              // Sport breakdown for this capper
              const cSportBreakdown: Record<string, { w: number; l: number }> = capperPicks.reduce((acc: Record<string, { w: number; l: number }>, p: any) => {
                const s = p.sport || 'NBA';
                if (!acc[s]) acc[s] = { w: 0, l: 0 };
                if (p.result === 'won') acc[s].w++;
                else if (p.result === 'lost') acc[s].l++;
                return acc;
              }, {} as Record<string, { w: number; l: number }>);

              return (
                <Card key={c.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{c.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${tierColors[c.tier]}`}>{c.tier}</Badge>
                        </div>
                        <div className="flex gap-1 mt-1">
                          {(c.sports || ['NBA']).map((s: string) => (
                            <Badge key={s} variant="outline" className={`text-[8px] ${sportColors[s] || ''}`}>{s}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{wr.toFixed(0)}%</p>
                        <p className="text-[10px] text-muted-foreground">{capperPicks.length} picks</p>
                      </div>
                    </div>
                    {/* Sport accuracy */}
                    {Object.keys(cSportBreakdown).length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {Object.entries(cSportBreakdown).map(([s, d]) => (
                          <Badge key={s} variant="outline" className={`text-[8px] ${sportColors[s] || ''}`}>
                            {s}: {d.w + d.l > 0 ? Math.round((d.w / (d.w + d.l)) * 100) : 0}%
                          </Badge>
                        ))}
                      </div>
                    )}
                    {capperPicks.length > 0 && (
                      <div className="border-t border-border pt-2">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1">Recent Picks</p>
                        <div className="space-y-1">
                          {capperPicks.slice(0, 3).map((p: any) => (
                            <div key={p.id} className="flex items-center gap-2 text-xs">
                              {p.result === 'won' ? <CheckCircle className="h-3 w-3 text-emerald-500" /> :
                               p.result === 'lost' ? <XCircle className="h-3 w-3 text-destructive" /> :
                               <Clock className="h-3 w-3 text-muted-foreground" />}
                              <Badge className={`text-[8px] ${sportColors[p.sport] || ''}`}>{p.sport || 'NBA'}</Badge>
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
