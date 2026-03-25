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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Wallet, Plus, Activity, Trophy, Clock, AlertTriangle, Settings, Eye, ArrowUpRight, ArrowDownRight, LogOut as ExitIcon, Zap } from 'lucide-react';
import { toast } from 'sonner';

const tierColors: Record<string, string> = {
  elite: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
  strong: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
  watch: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
  low: 'text-muted-foreground border-border bg-muted/50',
};

const eventIcons: Record<string, typeof Zap> = {
  new: Zap,
  add: ArrowUpRight,
  reduce: ArrowDownRight,
  exit: ExitIcon,
};

const eventColors: Record<string, string> = {
  new: 'text-emerald-500',
  add: 'text-blue-500',
  reduce: 'text-amber-500',
  exit: 'text-destructive',
};

// ─── Add Wallet Dialog ────────────────────────────────────────────────
function AddWalletDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [priority, setPriority] = useState('normal');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!address.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from('sbo_pm_tracked_wallets').insert({
      wallet_address: address.trim(),
      label: label.trim() || null,
      priority_level: priority,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Wallet tracked');
      setAddress(''); setLabel(''); setPriority('normal');
      setOpen(false);
      onAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-3 w-3" /> Track Wallet</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Track Polymarket Wallet</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Wallet Address</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="0x..." className="font-mono text-sm" />
          </div>
          <div>
            <Label className="text-xs">Label (optional)</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Sharp Whale #1" />
          </div>
          <div>
            <Label className="text-xs">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">🔴 High</SelectItem>
                <SelectItem value="normal">🟡 Normal</SelectItem>
                <SelectItem value="low">⚪ Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={saving || !address.trim()} className="w-full">
            {saving ? 'Adding…' : 'Track Wallet'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Log Event Dialog ─────────────────────────────────────────────────
function LogEventDialog({ wallets, onAdded }: { wallets: any[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [walletId, setWalletId] = useState('');
  const [eventType, setEventType] = useState('new');
  const [market, setMarket] = useState('');
  const [side, setSide] = useState('YES');
  const [oldSize, setOldSize] = useState('');
  const [newSize, setNewSize] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!walletId || !market) return;
    const oldS = parseFloat(oldSize) || 0;
    const newS = parseFloat(newSize) || 0;
    setSaving(true);
    const { error } = await (supabase as any).from('sbo_pm_wallet_events').insert({
      wallet_id: walletId,
      event_type: eventType,
      market_question: market,
      side,
      old_size: oldS,
      new_size: newS,
      delta: newS - oldS,
      explanation: `${eventType.toUpperCase()}: ${side} position ${eventType === 'exit' ? 'closed' : `moved $${oldS} → $${newS}`}`,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Event logged');
      setOpen(false);
      onAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5"><Activity className="h-3 w-3" /> Log Event</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Log Wallet Event</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Wallet</Label>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
              <SelectContent>
                {wallets.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>{w.label || w.wallet_address.slice(0, 12) + '…'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Event Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">⚡ New Position</SelectItem>
                  <SelectItem value="add">📈 Add Size</SelectItem>
                  <SelectItem value="reduce">📉 Reduce</SelectItem>
                  <SelectItem value="exit">🚪 Exit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Side</Label>
              <Select value={side} onValueChange={setSide}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="YES">YES</SelectItem>
                  <SelectItem value="NO">NO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Market Question</Label>
            <Input value={market} onChange={e => setMarket(e.target.value)} placeholder="e.g. Will Lakers win NBA Championship?" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Old Size ($)</Label>
              <Input type="number" value={oldSize} onChange={e => setOldSize(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">New Size ($)</Label>
              <Input type="number" value={newSize} onChange={e => setNewSize(e.target.value)} placeholder="1000" />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={saving || !walletId || !market} className="w-full">
            {saving ? 'Logging…' : 'Log Event'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────
function SettingsPanel({ wallets, refetch }: { wallets: any[]; refetch: () => void }) {
  const toggleStatus = async (id: string, current: string) => {
    const next = current === 'active' ? 'paused' : 'active';
    await (supabase as any).from('sbo_pm_tracked_wallets').update({ status: next }).eq('id', id);
    toast.success(`Wallet ${next}`);
    refetch();
  };

  const removeWallet = async (id: string) => {
    await (supabase as any).from('sbo_pm_tracked_wallets').delete().eq('id', id);
    toast.success('Wallet removed');
    refetch();
  };

  return (
    <div className="space-y-2">
      {wallets.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-6 text-center text-sm text-muted-foreground">No wallets tracked. Add one to begin.</CardContent></Card>
      ) : wallets.map((w: any) => (
        <Card key={w.id}>
          <CardContent className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{w.label || 'Unnamed'}</p>
              <p className="text-[10px] text-muted-foreground font-mono truncate">{w.wallet_address}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="outline" className={`text-[10px] ${w.status === 'active' ? 'text-emerald-500 border-emerald-500/30' : 'text-muted-foreground'}`}>
                {w.status}
              </Badge>
              <Badge variant="outline" className="text-[10px]">{w.priority_level}</Badge>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => toggleStatus(w.id, w.status)}>
                {w.status === 'active' ? 'Pause' : 'Resume'}
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => removeWallet(w.id)}>
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
export default function SBOWalletTracker() {
  const qc = useQueryClient();

  const { data: wallets = [] } = useQuery({
    queryKey: ['sbo-pm-wallets'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_pm_tracked_wallets')
        .select('*')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ['sbo-pm-events'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_pm_wallet_events')
        .select('*, sbo_pm_tracked_wallets(label, wallet_address)')
        .order('event_time', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const { data: scores = [] } = useQuery({
    queryKey: ['sbo-pm-scores'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_pm_wallet_scores')
        .select('*, sbo_pm_tracked_wallets(label, wallet_address)')
        .order('score', { ascending: false });
      return data || [];
    },
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['sbo-pm-wallets'] });
    qc.invalidateQueries({ queryKey: ['sbo-pm-events'] });
    qc.invalidateQueries({ queryKey: ['sbo-pm-scores'] });
  };

  const activeWallets = wallets.filter((w: any) => w.status === 'active');
  const eliteCount = scores.filter((s: any) => s.tier === 'elite').length;
  const recentEvents = events.filter((e: any) => {
    const diff = Date.now() - new Date(e.event_time).getTime();
    return diff < 24 * 60 * 60 * 1000;
  });

  return (
    <TooltipProvider>
      <div className="p-4 space-y-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                Wallet Intelligence
                <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400">Polymarket</Badge>
              </h1>
              <p className="text-xs text-muted-foreground">Track smart money · Detect positions · Generate signals</p>
            </div>
          </div>
          <div className="flex gap-2">
            <LogEventDialog wallets={wallets} onAdded={refetchAll} />
            <AddWalletDialog onAdded={refetchAll} />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help"><CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-foreground">{activeWallets.length}</p>
                <p className="text-[10px] text-muted-foreground">Active Wallets</p>
              </CardContent></Card>
            </TooltipTrigger>
            <TooltipContent><p>Wallets currently being monitored</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help"><CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-amber-500">{eliteCount}</p>
                <p className="text-[10px] text-muted-foreground">Elite Tier</p>
              </CardContent></Card>
            </TooltipTrigger>
            <TooltipContent><p>Wallets scoring 80+ with proven track records</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help"><CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-foreground">{events.length}</p>
                <p className="text-[10px] text-muted-foreground">Total Events</p>
              </CardContent></Card>
            </TooltipTrigger>
            <TooltipContent><p>All position changes detected</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help"><CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-emerald-500">{recentEvents.length}</p>
                <p className="text-[10px] text-muted-foreground">Last 24h Events</p>
              </CardContent></Card>
            </TooltipTrigger>
            <TooltipContent><p>Position changes in the last 24 hours</p></TooltipContent>
          </Tooltip>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="feed">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="feed" className="text-xs gap-1"><Activity className="h-3 w-3" /> Live Feed</TabsTrigger>
            <TabsTrigger value="leaderboard" className="text-xs gap-1"><Trophy className="h-3 w-3" /> Leaderboard</TabsTrigger>
            <TabsTrigger value="wallets" className="text-xs gap-1"><Eye className="h-3 w-3" /> Wallets</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs gap-1"><Settings className="h-3 w-3" /> Settings</TabsTrigger>
          </TabsList>

          {/* Live Feed */}
          <TabsContent value="feed" className="mt-3 space-y-2">
            {events.length === 0 ? (
              <Card className="border-dashed"><CardContent className="p-8 text-center">
                <Activity className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No events detected yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Log wallet events to build your intelligence feed.</p>
              </CardContent></Card>
            ) : events.map((e: any) => {
              const Icon = eventIcons[e.event_type] || Zap;
              const color = eventColors[e.event_type] || 'text-foreground';
              return (
                <Card key={e.id} className="overflow-hidden hover:border-primary/20 transition-colors">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {e.sbo_pm_tracked_wallets?.label || e.sbo_pm_tracked_wallets?.wallet_address?.slice(0, 10) + '…'}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${color}`}>
                            {e.event_type.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{e.side}</Badge>
                        </div>
                        <p className="text-sm font-medium mt-1">{e.market_question}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {e.delta !== 0 && (
                            <span className={e.delta > 0 ? 'text-emerald-500' : 'text-destructive'}>
                              {e.delta > 0 ? '+' : ''}${e.delta?.toLocaleString()}
                            </span>
                          )}
                          <span>${e.old_size?.toLocaleString()} → ${e.new_size?.toLocaleString()}</span>
                          <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{new Date(e.event_time).toLocaleString()}</span>
                        </div>
                        {e.explanation && <p className="text-[10px] text-muted-foreground mt-1 italic">{e.explanation}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Leaderboard */}
          <TabsContent value="leaderboard" className="mt-3 space-y-2">
            {scores.length === 0 ? (
              <Card className="border-dashed"><CardContent className="p-8 text-center">
                <Trophy className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No wallet scores yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Scores populate as events are tracked and analyzed.</p>
              </CardContent></Card>
            ) : scores.map((s: any, i: number) => (
              <Card key={s.id} className={i === 0 ? 'border-amber-500/30' : ''}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6 text-center">#{i + 1}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${tierColors[s.tier]}`}>{s.tier}</Badge>
                        <span className="font-medium text-sm">
                          {s.sbo_pm_tracked_wallets?.label || 'Unnamed'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {s.sbo_pm_tracked_wallets?.wallet_address?.slice(0, 20)}…
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs space-y-0.5">
                    <p className="text-lg font-bold">{Number(s.score).toFixed(0)}</p>
                    <p className="text-muted-foreground">{s.total_events} events</p>
                    {s.last_activity && (
                      <p className="text-muted-foreground">{new Date(s.last_activity).toLocaleDateString()}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Wallets Detail */}
          <TabsContent value="wallets" className="mt-3 space-y-2">
            {wallets.length === 0 ? (
              <Card className="border-dashed"><CardContent className="p-8 text-center">
                <Wallet className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No wallets tracked yet.</p>
              </CardContent></Card>
            ) : wallets.map((w: any) => {
              const walletEvents = events.filter((e: any) => e.wallet_id === w.id);
              const walletScore = scores.find((s: any) => s.wallet_id === w.id);
              return (
                <Card key={w.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{w.label || 'Unnamed'}</span>
                          <Badge variant="outline" className={`text-[10px] ${w.status === 'active' ? 'text-emerald-500 border-emerald-500/30' : 'text-muted-foreground'}`}>
                            {w.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{w.priority_level}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{w.wallet_address}</p>
                      </div>
                      {walletScore && (
                        <div className="text-right">
                          <p className="text-xl font-bold">{Number(walletScore.score).toFixed(0)}</p>
                          <Badge variant="outline" className={`text-[10px] ${tierColors[walletScore.tier]}`}>{walletScore.tier}</Badge>
                        </div>
                      )}
                    </div>
                    {walletEvents.length > 0 && (
                      <div className="border-t border-border pt-2">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1">Recent Events ({walletEvents.length})</p>
                        <div className="space-y-1">
                          {walletEvents.slice(0, 3).map((e: any) => {
                            const Icon = eventIcons[e.event_type] || Zap;
                            return (
                              <div key={e.id} className="flex items-center gap-2 text-xs">
                                <Icon className={`h-3 w-3 ${eventColors[e.event_type]}`} />
                                <span className="truncate flex-1">{e.market_question}</span>
                                <span className="text-muted-foreground">{e.side}</span>
                                <span className={e.delta > 0 ? 'text-emerald-500' : e.delta < 0 ? 'text-destructive' : ''}>
                                  {e.delta > 0 ? '+' : ''}${e.delta?.toLocaleString()}
                                </span>
                              </div>
                            );
                          })}
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
            <SettingsPanel wallets={wallets} refetch={refetchAll} />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
