import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, TrendingUp, MessageSquare, Trophy } from 'lucide-react';
import { toast } from 'sonner';

const tierColors: Record<string, string> = {
  elite: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
  good: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
  unproven: 'text-muted-foreground border-border bg-muted/50',
};

function AddCapperDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from('sbo_cappers').insert({
      name: name.trim(),
      source_handle: handle.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Capper added');
      setName('');
      setHandle('');
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
        <DialogHeader><DialogTitle>Add Capper</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SharpAction" />
          </div>
          <div>
            <Label className="text-xs">Telegram Handle (optional)</Label>
            <Input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@handle" />
          </div>
          <Button onClick={handleAdd} disabled={saving || !name.trim()} className="w-full">
            {saving ? 'Adding…' : 'Add Capper'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
      setPickText('');
      setOpen(false);
      onAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5"><MessageSquare className="h-3 w-3" /> Log Pick</Button>
      </DialogTrigger>
      <DialogContent>
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
            <Label className="text-xs">Pick Text (raw message)</Label>
            <Textarea value={pickText} onChange={e => setPickText(e.target.value)} placeholder="Paste the pick message here…" rows={3} />
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
        .select('*, sbo_cappers(name, tier)')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['sbo-cappers'] });
    qc.invalidateQueries({ queryKey: ['sbo-capper-picks'] });
  };

  const updateResult = async (pickId: string, result: string) => {
    await (supabase as any).from('sbo_capper_picks').update({ result }).eq('id', pickId);
    toast.success(`Marked ${result}`);
    refetchAll();
  };

  const eliteCappers = cappers.filter((c: any) => c.tier === 'elite');

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-blue-500" />
          <div>
            <h1 className="text-xl font-bold">Capper Tracker</h1>
            <p className="text-xs text-muted-foreground">Track external picks · Score accuracy · Compare vs AI</p>
          </div>
        </div>
        <div className="flex gap-2">
          <AddPickDialog cappers={cappers} onAdded={refetchAll} />
          <AddCapperDialog onAdded={refetchAll} />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{cappers.length}</p><p className="text-[10px] text-muted-foreground">Cappers</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-500">{eliteCappers.length}</p><p className="text-[10px] text-muted-foreground">Elite Tier</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{picks.length}</p><p className="text-[10px] text-muted-foreground">Picks Logged</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{picks.filter((p: any) => p.result === 'pending').length}</p><p className="text-[10px] text-muted-foreground">Pending</p></CardContent></Card>
      </div>

      <Tabs defaultValue="picks">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="picks" className="text-xs">📝 Pick Feed</TabsTrigger>
          <TabsTrigger value="cappers" className="text-xs">🏆 Capper Board</TabsTrigger>
        </TabsList>

        <TabsContent value="picks" className="mt-3 space-y-2">
          {picks.length === 0 ? (
            <Card className="border-dashed"><CardContent className="p-6 text-center text-muted-foreground text-sm">No picks logged yet.</CardContent></Card>
          ) : picks.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${tierColors[p.sbo_cappers?.tier] || ''}`}>
                        {p.sbo_cappers?.name || 'Unknown'}
                      </Badge>
                      {p.player_name && <span className="text-sm font-medium">{p.player_name}</span>}
                      {p.prop_type && <Badge variant="outline" className="text-[10px]">{p.prop_type}</Badge>}
                      {p.direction && <Badge variant="outline" className="text-[10px]">{p.direction}</Badge>}
                      {p.line && <span className="text-xs text-muted-foreground">{p.line}</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">{p.pick_text}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {p.result === 'pending' ? (
                      <>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] text-emerald-500" onClick={() => updateResult(p.id, 'won')}>W</Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] text-destructive" onClick={() => updateResult(p.id, 'lost')}>L</Button>
                      </>
                    ) : (
                      <Badge variant={p.result === 'won' ? 'default' : 'destructive'} className="text-[10px]">{p.result}</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="cappers" className="mt-3 space-y-2">
          {cappers.length === 0 ? (
            <Card className="border-dashed"><CardContent className="p-6 text-center text-muted-foreground text-sm">No cappers added yet.</CardContent></Card>
          ) : cappers.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${tierColors[c.tier]}`}>{c.tier}</Badge>
                    <span className="font-medium text-sm">{c.name}</span>
                    {c.source_handle && <span className="text-xs text-muted-foreground">{c.source_handle}</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Source: {c.source}</p>
                </div>
                <div className="text-right text-xs space-y-0.5">
                  <p>{c.total_picks || 0} picks · {c.win_rate?.toFixed(0) || 0}% WR</p>
                  <p className={`${(c.roi_pct || 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                    ROI: {(c.roi_pct || 0) >= 0 ? '+' : ''}{(c.roi_pct || 0).toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
