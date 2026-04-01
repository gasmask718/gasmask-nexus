import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Globe, Shield, TrendingUp, Crown, Users, DollarSign, Package, RefreshCw,
  BarChart3, Star, Zap, Award, Lock, ArrowUpRight, CheckCircle2, AlertTriangle,
  Plus, Timer, Target
} from 'lucide-react';
import { useDominationCategories, useCategorySuppliers, useCategoryMutations } from '@/hooks/useCategoryDomination';
import { useSupplierLeaderboard, useReorderRules, useSupplierFeedback, useGSCSMutations } from '@/hooks/useGSCS';

const REDUNDANCY_COLORS: Record<string, string> = {
  primary: 'bg-green-500/20 text-green-400',
  backup: 'bg-amber-500/20 text-amber-400',
  emergency: 'bg-red-500/20 text-red-400',
  standard: 'bg-muted text-muted-foreground',
};

export default function UTGlobalSupplierControl() {
  const { data: categories = [] } = useDominationCategories();
  const { data: leaderboard = [] } = useSupplierLeaderboard();
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  const dominatedCount = categories.filter((c: any) => c.status === 'dominated').length;
  const avgScore = categories.length ? (categories.reduce((s: number, c: any) => s + Number(c.total_score), 0) / categories.length).toFixed(1) : '0';

  // Count preferred partners across all suppliers
  const preferredCount = 0; // Will show from suppliers tab

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Globe className="h-8 w-8 text-primary" /> Global Supplier Control System
        </h1>
        <p className="text-muted-foreground">Preferred lock-in • Volume leverage • Brand ownership • Supply redundancy</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" />
          <div><p className="text-xs text-muted-foreground">Categories</p><p className="text-xl font-bold">{categories.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <Crown className="h-8 w-8 text-amber-400" />
          <div><p className="text-xs text-muted-foreground">Dominated</p><p className="text-xl font-bold">{dominatedCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-green-400" />
          <div><p className="text-xs text-muted-foreground">Avg Score</p><p className="text-xl font-bold">{avgScore}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <Award className="h-8 w-8 text-purple-400" />
          <div><p className="text-xs text-muted-foreground">Top Suppliers</p><p className="text-xl font-bold">{leaderboard.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-400" />
          <div><p className="text-xs text-muted-foreground">Redundancy</p><p className="text-xl font-bold">{categories.length > 0 ? 'Active' : '—'}</p></div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="control" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="control"><Lock className="h-3 w-3 mr-1" />Supplier Lock-In</TabsTrigger>
          <TabsTrigger value="redundancy"><Shield className="h-3 w-3 mr-1" />Redundancy</TabsTrigger>
          <TabsTrigger value="reorder"><RefreshCw className="h-3 w-3 mr-1" />Reorder Engine</TabsTrigger>
          <TabsTrigger value="leaderboard"><Award className="h-3 w-3 mr-1" />Leaderboard</TabsTrigger>
          <TabsTrigger value="feedback"><Star className="h-3 w-3 mr-1" />Feedback Loop</TabsTrigger>
        </TabsList>

        <TabsContent value="control">
          <SupplierLockInTab categories={categories} selectedCatId={selectedCatId} onSelect={setSelectedCatId} />
        </TabsContent>
        <TabsContent value="redundancy">
          <RedundancyTab categories={categories} selectedCatId={selectedCatId} onSelect={setSelectedCatId} />
        </TabsContent>
        <TabsContent value="reorder">
          <ReorderTab categories={categories} selectedCatId={selectedCatId} onSelect={setSelectedCatId} />
        </TabsContent>
        <TabsContent value="leaderboard">
          <LeaderboardTab leaderboard={leaderboard} />
        </TabsContent>
        <TabsContent value="feedback">
          <FeedbackTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── SUPPLIER LOCK-IN TAB ─── */
function SupplierLockInTab({ categories, selectedCatId, onSelect }: { categories: any[]; selectedCatId: string | null; onSelect: (id: string) => void }) {
  const { data: suppliers = [] } = useCategorySuppliers(selectedCatId ?? undefined);
  const { updateCategorySupplier } = useGSCSMutations();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-lg">Categories</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
          {categories.map((c: any) => (
            <button key={c.id} onClick={() => onSelect(c.id)} className={`w-full text-left p-3 rounded-lg border transition ${selectedCatId === c.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}>
              <p className="font-medium text-sm">{c.category_name}</p>
              <p className="text-xs text-muted-foreground">Score: {Number(c.total_score).toFixed(1)}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Lock className="h-5 w-5" /> Preferred Supplier Lock-In</CardTitle></CardHeader>
        <CardContent>
          {!selectedCatId ? <p className="text-muted-foreground">Select a category</p> : suppliers.length === 0 ? <p className="text-muted-foreground">No suppliers in this category</p> : (
            <div className="space-y-3">
              {suppliers.map((s: any) => (
                <div key={s.id} className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{s.supplier_name}</p>
                      <Badge className={REDUNDANCY_COLORS[s.redundancy_role || 'standard']} variant="outline">{s.tier}</Badge>
                    </div>
                    <p className="text-lg font-bold">{Number(s.performance_score).toFixed(0)}<span className="text-sm text-muted-foreground">/100</span></p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Preferred Partner</Label>
                      <Switch checked={s.preferred_partner} onCheckedChange={v => updateCategorySupplier.mutate({ id: s.id, preferred_partner: v })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Priority Production</Label>
                      <Switch checked={s.priority_production} onCheckedChange={v => updateCategorySupplier.mutate({ id: s.id, priority_production: v })} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Lead Time Priority</Label>
                    <Select value={s.lead_time_priority || 'standard'} onValueChange={v => updateCategorySupplier.mutate({ id: s.id, lead_time_priority: v })}>
                      <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{['express','priority','standard','economy'].map(o => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── REDUNDANCY TAB ─── */
function RedundancyTab({ categories, selectedCatId, onSelect }: { categories: any[]; selectedCatId: string | null; onSelect: (id: string) => void }) {
  const { data: suppliers = [] } = useCategorySuppliers(selectedCatId ?? undefined);
  const { updateCategorySupplier } = useGSCSMutations();

  const primary = suppliers.filter((s: any) => s.redundancy_role === 'primary');
  const backup = suppliers.filter((s: any) => s.redundancy_role === 'backup');
  const emergency = suppliers.filter((s: any) => s.redundancy_role === 'emergency');
  const hasFullCoverage = primary.length > 0 && backup.length > 0 && emergency.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-lg">Categories</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
          {categories.map((c: any) => (
            <button key={c.id} onClick={() => onSelect(c.id)} className={`w-full text-left p-3 rounded-lg border transition ${selectedCatId === c.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}>
              <p className="font-medium text-sm">{c.category_name}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" /> Supply Redundancy Control</CardTitle>
          <CardDescription>Every category needs: Primary + Backup + Emergency</CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedCatId ? <p className="text-muted-foreground">Select a category</p> : (
            <div className="space-y-4">
              {hasFullCoverage ? (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-400" /><span className="text-sm font-medium text-green-400">Full redundancy coverage</span></div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-400" /><span className="text-sm font-medium text-amber-400">Missing: {!primary.length ? 'Primary ' : ''}{!backup.length ? 'Backup ' : ''}{!emergency.length ? 'Emergency' : ''}</span></div>
              )}
              {suppliers.length === 0 ? <p className="text-muted-foreground text-sm">No suppliers linked</p> : suppliers.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Badge className={REDUNDANCY_COLORS[s.redundancy_role || 'standard']}>{s.redundancy_role || 'standard'}</Badge>
                    <span className="font-medium">{s.supplier_name}</span>
                  </div>
                  <Select value={s.redundancy_role || 'standard'} onValueChange={v => updateCategorySupplier.mutate({ id: s.id, redundancy_role: v })}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{['primary','backup','emergency','standard'].map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── REORDER ENGINE TAB ─── */
function ReorderTab({ categories, selectedCatId, onSelect }: { categories: any[]; selectedCatId: string | null; onSelect: (id: string) => void }) {
  const { data: rules = [] } = useReorderRules(selectedCatId ?? undefined);
  const { addReorderRule } = useGSCSMutations();
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({ rule_type: 'time_based', trigger_days: 14, trigger_threshold: 0, reorder_qty: 10, auto_notify: true, notes: '' });

  const handleAdd = () => {
    if (!selectedCatId) return;
    addReorderRule.mutate({ ...newRule, category_id: selectedCatId }, { onSuccess: () => setShowAdd(false) });
  };

  const RULE_ICONS: Record<string, typeof Timer> = { time_based: Timer, usage_based: BarChart3, growth_based: TrendingUp };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-lg">Categories</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
          {categories.map((c: any) => (
            <button key={c.id} onClick={() => onSelect(c.id)} className={`w-full text-left p-3 rounded-lg border transition ${selectedCatId === c.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}>
              <p className="font-medium text-sm">{c.category_name}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Reorder Domination Engine</CardTitle>
            <CardDescription>Auto-trigger reorders based on rules</CardDescription>
          </div>
          {selectedCatId && (
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Rule</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Reorder Rule</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Type</Label>
                    <Select value={newRule.rule_type} onValueChange={v => setNewRule(p => ({ ...p, rule_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="time_based">Time-based</SelectItem>
                        <SelectItem value="usage_based">Usage-based</SelectItem>
                        <SelectItem value="growth_based">Growth-based</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newRule.rule_type === 'time_based' && <div><Label>Trigger Days</Label><Input type="number" value={newRule.trigger_days} onChange={e => setNewRule(p => ({ ...p, trigger_days: +e.target.value }))} /></div>}
                  {newRule.rule_type !== 'time_based' && <div><Label>Trigger Threshold</Label><Input type="number" value={newRule.trigger_threshold} onChange={e => setNewRule(p => ({ ...p, trigger_threshold: +e.target.value }))} /></div>}
                  <div><Label>Reorder Qty</Label><Input type="number" value={newRule.reorder_qty} onChange={e => setNewRule(p => ({ ...p, reorder_qty: +e.target.value }))} /></div>
                  <div className="flex items-center gap-2"><Switch checked={newRule.auto_notify} onCheckedChange={v => setNewRule(p => ({ ...p, auto_notify: v }))} /><Label>Auto Notify</Label></div>
                  <div><Label>Notes</Label><Textarea value={newRule.notes} onChange={e => setNewRule(p => ({ ...p, notes: e.target.value }))} /></div>
                  <Button className="w-full" onClick={handleAdd}>Create Rule</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {!selectedCatId ? <p className="text-muted-foreground">Select a category</p> : rules.length === 0 ? <p className="text-muted-foreground text-sm">No reorder rules yet</p> : (
            <div className="space-y-3">
              {rules.map((r: any) => {
                const Icon = RULE_ICONS[r.rule_type] || Timer;
                return (
                  <div key={r.id} className="p-4 rounded-lg border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm capitalize">{r.rule_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.rule_type === 'time_based' ? `Every ${r.trigger_days} days` : `Threshold: ${r.trigger_threshold}`} • Qty: {r.reorder_qty}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.auto_notify && <Badge variant="outline" className="text-[10px]">Auto-Notify</Badge>}
                      <Badge className={r.is_active ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}>{r.is_active ? 'Active' : 'Off'}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── LEADERBOARD TAB ─── */
function LeaderboardTab({ leaderboard }: { leaderboard: any[] }) {
  const medals = ['🏆', '🥈', '🥉'];

  const bestPricing = [...leaderboard].sort((a, b) => b.avg_overall - a.avg_overall)[0];
  const fastest = [...leaderboard].sort((a, b) => b.avg_speed - a.avg_speed)[0];
  const bestQuality = [...leaderboard].sort((a, b) => b.avg_quality - a.avg_quality)[0];
  const bestBranding = [...leaderboard].sort((a, b) => b.avg_branding - a.avg_branding)[0];

  return (
    <div className="space-y-6">
      {/* Quick Awards */}
      {leaderboard.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: '🏆 Top Overall', supplier: bestPricing?.supplier_name, score: bestPricing?.avg_overall },
            { label: '⚡ Fastest', supplier: fastest?.supplier_name, score: fastest?.avg_speed },
            { label: '💎 Best Quality', supplier: bestQuality?.supplier_name, score: bestQuality?.avg_quality },
            { label: '🎨 Best Branding', supplier: bestBranding?.supplier_name, score: bestBranding?.avg_branding },
          ].map(a => (
            <Card key={a.label}><CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">{a.label}</p>
              <p className="font-bold mt-1">{a.supplier || '—'}</p>
              <p className="text-xs text-muted-foreground">{a.score ? `${a.score.toFixed(1)}/10` : ''}</p>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Award className="h-5 w-5" /> Supplier Performance Leaderboard</CardTitle></CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? <p className="text-muted-foreground">Submit supplier feedback to populate the leaderboard</p> : (
            <div className="space-y-2">
              {leaderboard.map((s: any, i: number) => (
                <div key={s.supplier_name} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <span className="text-lg w-8">{medals[i] || `#${i + 1}`}</span>
                    <div>
                      <p className="font-medium">{s.supplier_name}</p>
                      <p className="text-xs text-muted-foreground">{s.review_count} reviews</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center"><p className="text-muted-foreground text-[10px]">Quality</p><p className="font-medium">{s.avg_quality.toFixed(1)}</p></div>
                    <div className="text-center"><p className="text-muted-foreground text-[10px]">Speed</p><p className="font-medium">{s.avg_speed.toFixed(1)}</p></div>
                    <div className="text-center"><p className="text-muted-foreground text-[10px]">Brand</p><p className="font-medium">{s.avg_branding.toFixed(1)}</p></div>
                    <div className="text-center"><p className="text-muted-foreground text-[10px]">Comms</p><p className="font-medium">{s.avg_comms.toFixed(1)}</p></div>
                    <div className="text-center bg-primary/10 rounded px-2 py-1"><p className="text-muted-foreground text-[10px]">Overall</p><p className="font-bold text-primary">{s.avg_overall.toFixed(1)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── FEEDBACK LOOP TAB ─── */
function FeedbackTab() {
  const { data: feedback = [] } = useSupplierFeedback();
  const { addFeedback } = useGSCSMutations();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ supplier_name: '', quality_score: 7, speed_score: 7, branding_score: 7, communication_score: 7, notes: '', order_ref: '' });

  const handleSubmit = () => {
    if (!form.supplier_name) return;
    addFeedback.mutate(form, { onSuccess: () => { setShowAdd(false); setForm({ supplier_name: '', quality_score: 7, speed_score: 7, branding_score: 7, communication_score: 7, notes: '', order_ref: '' }); } });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-lg">Supply Chain Feedback Loop</h3>
          <p className="text-sm text-muted-foreground">Buy → Track → Score → Improve → Repeat</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Submit Review</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Supplier Performance Review</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Supplier Name</Label><Input value={form.supplier_name} onChange={e => setForm(p => ({ ...p, supplier_name: e.target.value }))} /></div>
              <div><Label>Order Ref</Label><Input value={form.order_ref} onChange={e => setForm(p => ({ ...p, order_ref: e.target.value }))} placeholder="Optional" /></div>
              {(['quality_score', 'speed_score', 'branding_score', 'communication_score'] as const).map(k => (
                <div key={k}><Label className="capitalize">{k.replace(/_/g, ' ')} — {form[k]}/10</Label><Slider min={0} max={10} step={0.5} value={[form[k]]} onValueChange={([v]) => setForm(p => ({ ...p, [k]: v }))} /></div>
              ))}
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              <Button className="w-full" onClick={handleSubmit}>Submit Feedback</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loop visualization */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {['Buy', 'Track Performance', 'Score Supplier', 'Improve Negotiation', 'Increase Volume', 'Lower Cost', 'Expand Category'].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium">
                  <span className="text-primary">{i + 1}.</span> {step}
                </div>
                {i < 6 && <ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
            <RefreshCw className="h-5 w-5 text-primary ml-2" />
          </div>
        </CardContent>
      </Card>

      {/* Recent Reviews */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Reviews</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {feedback.length === 0 ? <p className="text-muted-foreground text-sm">No feedback yet</p> : feedback.slice(0, 20).map((f: any) => (
            <div key={f.id} className="p-3 rounded-lg border flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{f.supplier_name}</p>
                <p className="text-xs text-muted-foreground">{f.order_ref ? `Order: ${f.order_ref} • ` : ''}{new Date(f.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span>Q:{Number(f.quality_score).toFixed(1)}</span>
                <span>S:{Number(f.speed_score).toFixed(1)}</span>
                <span>B:{Number(f.branding_score).toFixed(1)}</span>
                <span className="font-bold text-primary">{Number(f.overall_score).toFixed(1)}/10</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
