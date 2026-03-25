import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, Plus, TrendingUp, Activity, Trophy, Clock, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const tierColors: Record<string, string> = {
  elite: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
  good: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
  unproven: 'text-muted-foreground border-border bg-muted/50',
};

function AddWalletDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!address.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from('sbo_tracked_wallets').insert({
      wallet_address: address.trim(),
      label: label.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Wallet added');
      setAddress('');
      setLabel('');
      setOpen(false);
      onAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-3 w-3" /> Add Wallet</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Track New Wallet</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Wallet Address</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="0x..." className="font-mono text-sm" />
          </div>
          <div>
            <Label className="text-xs">Label (optional)</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Sharp Whale #1" />
          </div>
          <Button onClick={handleAdd} disabled={saving || !address.trim()} className="w-full">
            {saving ? 'Adding…' : 'Track Wallet'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddActivityDialog({ wallets, onAdded }: { wallets: any[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [walletId, setWalletId] = useState('');
  const [market, setMarket] = useState('');
  const [position, setPosition] = useState('');
  const [size, setSize] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!walletId || !market || !position) return;
    setSaving(true);
    const { error } = await (supabase as any).from('sbo_wallet_activity').insert({
      wallet_id: walletId,
      market,
      position,
      size: size ? parseFloat(size) : null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Activity logged');
      setOpen(false);
      onAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5"><Activity className="h-3 w-3" /> Log Activity</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Log Wallet Activity</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Wallet</Label>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
              <SelectContent>
                {wallets.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>{w.label || w.wallet_address.slice(0, 10) + '…'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Market</Label>
            <Input value={market} onChange={e => setMarket(e.target.value)} placeholder="e.g. Lakers vs Celtics" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Position</Label>
              <Input value={position} onChange={e => setPosition(e.target.value)} placeholder="e.g. YES / Lakers ML" />
            </div>
            <div>
              <Label className="text-xs">Size ($)</Label>
              <Input type="number" value={size} onChange={e => setSize(e.target.value)} placeholder="1000" />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={saving || !walletId || !market} className="w-full">
            {saving ? 'Logging…' : 'Log Activity'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SBOWalletTracker() {
  const qc = useQueryClient();

  const { data: wallets = [] } = useQuery({
    queryKey: ['sbo-wallets'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_tracked_wallets')
        .select('*')
        .order('tier', { ascending: true })
        .order('win_rate', { ascending: false });
      return data || [];
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ['sbo-wallet-activity'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_wallet_activity')
        .select('*, sbo_tracked_wallets(label, wallet_address, tier)')
        .order('detected_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['sbo-wallets'] });
    qc.invalidateQueries({ queryKey: ['sbo-wallet-activity'] });
  };

  const updateResult = async (activityId: string, result: string) => {
    await (supabase as any).from('sbo_wallet_activity').update({ result }).eq('id', activityId);
    toast.success(`Marked ${result}`);
    refetchAll();
  };

  const eliteWallets = wallets.filter((w: any) => w.tier === 'elite');
  const totalBets = wallets.reduce((s: number, w: any) => s + (w.total_bets || 0), 0);

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-emerald-500" />
          <div>
            <h1 className="text-xl font-bold">Wallet Tracker</h1>
            <p className="text-xs text-muted-foreground">Track sharp money on-chain positions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <AddActivityDialog wallets={wallets} onAdded={refetchAll} />
          <AddWalletDialog onAdded={refetchAll} />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{wallets.length}</p><p className="text-[10px] text-muted-foreground">Tracked Wallets</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-500">{eliteWallets.length}</p><p className="text-[10px] text-muted-foreground">Elite Wallets</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{totalBets}</p><p className="text-[10px] text-muted-foreground">Total Bets Tracked</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{activity.length}</p><p className="text-[10px] text-muted-foreground">Recent Moves</p></CardContent></Card>
      </div>

      <Tabs defaultValue="feed">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="feed" className="text-xs">📡 Live Feed</TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-xs">🏆 Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="mt-3 space-y-2">
          {activity.length === 0 ? (
            <Card className="border-dashed"><CardContent className="p-6 text-center text-muted-foreground text-sm">No wallet activity logged yet.</CardContent></Card>
          ) : activity.map((a: any) => (
            <Card key={a.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${tierColors[a.sbo_tracked_wallets?.tier] || ''}`}>
                        {a.sbo_tracked_wallets?.label || a.sbo_tracked_wallets?.wallet_address?.slice(0, 8) + '…'}
                      </Badge>
                      <span className="text-sm font-medium">{a.market}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{a.position}</span>
                      {a.size && <span>· ${a.size.toLocaleString()}</span>}
                      <span>· {new Date(a.detected_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {a.result === 'pending' ? (
                      <>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] text-emerald-500" onClick={() => updateResult(a.id, 'won')}>W</Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] text-destructive" onClick={() => updateResult(a.id, 'lost')}>L</Button>
                      </>
                    ) : (
                      <Badge variant={a.result === 'won' ? 'default' : 'destructive'} className="text-[10px]">{a.result}</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-3 space-y-2">
          {wallets.length === 0 ? (
            <Card className="border-dashed"><CardContent className="p-6 text-center text-muted-foreground text-sm">No wallets tracked yet.</CardContent></Card>
          ) : wallets.map((w: any) => (
            <Card key={w.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${tierColors[w.tier]}`}>{w.tier}</Badge>
                    <span className="font-medium text-sm">{w.label || 'Unnamed'}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{w.wallet_address.slice(0, 20)}…</p>
                </div>
                <div className="text-right text-xs space-y-0.5">
                  <p>{w.total_bets || 0} bets · {w.win_rate?.toFixed(0) || 0}% WR</p>
                  <p className={`${(w.profit_estimate || 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                    {(w.profit_estimate || 0) >= 0 ? '+' : ''}${(w.profit_estimate || 0).toFixed(0)}
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
