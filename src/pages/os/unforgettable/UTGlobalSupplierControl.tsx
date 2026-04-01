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
  Plus, Timer, Target, LineChart, Settings, ClipboardCheck, ArrowDown, ArrowUp
} from 'lucide-react';
import { useDominationCategories, useCategorySuppliers, useCategoryMutations } from '@/hooks/useCategoryDomination';
import {
  useSupplierLeaderboard, useReorderRules, useSupplierFeedback,
  useSupplierPriceHistory, useGSCSAutomationRules, useGSCSApprovals,
  useGSCSMutations
} from '@/hooks/useGSCS';

const REDUNDANCY_COLORS: Record<string, string> = {
  primary: 'bg-green-500/20 text-green-400',
  backup: 'bg-amber-500/20 text-amber-400',
  emergency: 'bg-red-500/20 text-red-400',
  standard: 'bg-muted text-muted-foreground',
};

export default function UTGlobalSupplierControl() {
  const { data: categories = [] } = useDominationCategories();
  const { data: leaderboard = [] } = useSupplierLeaderboard();
  const { data: approvals = [] } = useGSCSApprovals();
  const { data: automationRules = [] } = useGSCSAutomationRules();
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  const dominatedCount = categories.filter((c: any) => c.status === 'dominated').length;
  const avgScore = categories.length ? (categories.reduce((s: number, c: any) => s + Number(c.total_score), 0) / categories.length).toFixed(1) : '0';
  const pendingApprovals = approvals.filter((a: any) => a.status === 'pending').length;
  const activeRules = automationRules.filter((r: any) => r.is_active).length;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Globe className="h-8 w-8 text-primary" /> Global Supplier Control System
        </h1>
        <p className="text-muted-foreground">Lock-in • Volume leverage • Pricing optimization • Automation • Approvals</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { icon: Package, label: 'Categories', value: categories.length, color: 'text-primary' },
          { icon: Crown, label: 'Dominated', value: dominatedCount, color: 'text-amber-400' },
          { icon: TrendingUp, label: 'Avg Score', value: avgScore, color: 'text-green-400' },
          { icon: Award, label: 'Ranked Suppliers', value: leaderboard.length, color: 'text-purple-400' },
          { icon: Settings, label: 'Active Rules', value: activeRules, color: 'text-blue-400' },
          { icon: ClipboardCheck, label: 'Pending Approvals', value: pendingApprovals, color: 'text-red-400' },
        ].map(k => (
          <Card key={k.label}><CardContent className="pt-4 pb-4 flex items-center gap-3">
            <k.icon className={`h-7 w-7 ${k.color}`} />
            <div><p className="text-[10px] text-muted-foreground uppercase">{k.label}</p><p className="text-xl font-bold">{k.value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="control" className="space-y-4">
        <TabsList className="grid grid-cols-4 lg:grid-cols-8 w-full">
          <TabsTrigger value="control"><Lock className="h-3 w-3 mr-1" />Lock-In</TabsTrigger>
          <TabsTrigger value="redundancy"><Shield className="h-3 w-3 mr-1" />Redundancy</TabsTrigger>
          <TabsTrigger value="pricing"><LineChart className="h-3 w-3 mr-1" />Pricing</TabsTrigger>
          <TabsTrigger value="reorder"><RefreshCw className="h-3 w-3 mr-1" />Reorder</TabsTrigger>
          <TabsTrigger value="leaderboard"><Award className="h-3 w-3 mr-1" />Leaderboard</TabsTrigger>
          <TabsTrigger value="automation"><Zap className="h-3 w-3 mr-1" />Automation</TabsTrigger>
          <TabsTrigger value="approvals"><ClipboardCheck className="h-3 w-3 mr-1" />Approvals{pendingApprovals > 0 && <Badge className="ml-1 bg-destructive text-destructive-foreground text-[10px] px-1">{pendingApprovals}</Badge>}</TabsTrigger>
          <TabsTrigger value="feedback"><Star className="h-3 w-3 mr-1" />Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="control"><SupplierLockInTab categories={categories} selectedCatId={selectedCatId} onSelect={setSelectedCatId} /></TabsContent>
        <TabsContent value="redundancy"><RedundancyTab categories={categories} selectedCatId={selectedCatId} onSelect={setSelectedCatId} /></TabsContent>
        <TabsContent value="pricing"><PricingTrendsTab /></TabsContent>
        <TabsContent value="reorder"><ReorderTab categories={categories} selectedCatId={selectedCatId} onSelect={setSelectedCatId} /></TabsContent>
        <TabsContent value="leaderboard"><LeaderboardTab leaderboard={leaderboard} /></TabsContent>
        <TabsContent value="automation"><AutomationTab rules={automationRules} categories={categories} /></TabsContent>
        <TabsContent value="approvals"><ApprovalsTab /></TabsContent>
        <TabsContent value="feedback"><FeedbackTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── SUPPLIER LOCK-IN ─── */
function SupplierLockInTab({ categories, selectedCatId, onSelect }: { categories: any[]; selectedCatId: string | null; onSelect: (id: string) => void }) {
  const { data: suppliers = [] } = useCategorySuppliers(selectedCatId ?? undefined);
  const { updateCategorySupplier } = useGSCSMutations();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <CategoryList categories={categories} selectedCatId={selectedCatId} onSelect={onSelect} />
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Lock className="h-5 w-5" /> Preferred Supplier Lock-In</CardTitle></CardHeader>
        <CardContent>
          {!selectedCatId ? <p className="text-muted-foreground">Select a category</p> : suppliers.length === 0 ? <p className="text-muted-foreground">No suppliers linked</p> : (
            <div className="space-y-3">
              {suppliers.map((s: any) => (
                <div key={s.id} className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div><p className="font-medium">{s.supplier_name}</p>
                      <div className="flex gap-1 mt-1">
                        <Badge className={REDUNDANCY_COLORS[s.redundancy_role || 'standard']}>{s.tier}</Badge>
                        {s.partnership_start_date && <Badge variant="outline" className="text-[10px]">Since {s.partnership_start_date}</Badge>}
                      </div>
                    </div>
                    <p className="text-lg font-bold">{Number(s.performance_score).toFixed(0)}<span className="text-sm text-muted-foreground">/100</span></p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between"><Label className="text-xs">Preferred Partner</Label>
                      <Switch checked={s.preferred_partner} onCheckedChange={v => updateCategorySupplier.mutate({ id: s.id, preferred_partner: v })} /></div>
                    <div className="flex items-center justify-between"><Label className="text-xs">Priority Production</Label>
                      <Switch checked={s.priority_production} onCheckedChange={v => updateCategorySupplier.mutate({ id: s.id, priority_production: v })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Lead Time</Label>
                      <Select value={s.lead_time_priority || 'standard'} onValueChange={v => updateCategorySupplier.mutate({ id: s.id, lead_time_priority: v })}>
                        <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{['express','priority','standard','economy'].map(o => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Volume Commitment</Label>
                      <p className="text-sm font-medium mt-1">{s.volume_commitment_units || 0} units{s.volume_commitment_period ? ` / ${s.volume_commitment_period}` : ''}</p>
                    </div>
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

/* ─── REDUNDANCY ─── */
function RedundancyTab({ categories, selectedCatId, onSelect }: { categories: any[]; selectedCatId: string | null; onSelect: (id: string) => void }) {
  const { data: suppliers = [] } = useCategorySuppliers(selectedCatId ?? undefined);
  const { updateCategorySupplier } = useGSCSMutations();
  const primary = suppliers.filter((s: any) => s.redundancy_role === 'primary');
  const backup = suppliers.filter((s: any) => s.redundancy_role === 'backup');
  const emergency = suppliers.filter((s: any) => s.redundancy_role === 'emergency');
  const full = primary.length > 0 && backup.length > 0 && emergency.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <CategoryList categories={categories} selectedCatId={selectedCatId} onSelect={onSelect} />
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" /> Supply Redundancy</CardTitle><CardDescription>Primary + Backup + Emergency per category</CardDescription></CardHeader>
        <CardContent>
          {!selectedCatId ? <p className="text-muted-foreground">Select a category</p> : (
            <div className="space-y-4">
              {full ? (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-400" /><span className="text-sm font-medium">Full coverage</span></div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-400" /><span className="text-sm">Missing: {!primary.length ? 'Primary ' : ''}{!backup.length ? 'Backup ' : ''}{!emergency.length ? 'Emergency' : ''}</span></div>
              )}
              {suppliers.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3"><Badge className={REDUNDANCY_COLORS[s.redundancy_role || 'standard']}>{s.redundancy_role || 'standard'}</Badge><span className="font-medium">{s.supplier_name}</span></div>
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

/* ─── PRICING TRENDS ─── */
function PricingTrendsTab() {
  const { data: history = [] } = useSupplierPriceHistory();
  const { addPriceRecord } = useGSCSMutations();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ supplier_name: '', product_name: '', unit_cost: 0, previous_cost: 0, negotiated_discount_pct: 0, savings_amount: 0 });

  const totalSavings = history.reduce((s: number, r: any) => s + Number(r.savings_amount || 0), 0);
  const avgDiscount = history.length ? history.reduce((s: number, r: any) => s + Number(r.negotiated_discount_pct || 0), 0) / history.length : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg flex items-center gap-2"><LineChart className="h-5 w-5" /> Pricing Optimization Engine</h3>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Log Price</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Supplier Price</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Supplier</Label><Input value={form.supplier_name} onChange={e => setForm(p => ({ ...p, supplier_name: e.target.value }))} /></div>
              <div><Label>Product</Label><Input value={form.product_name} onChange={e => setForm(p => ({ ...p, product_name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Current Cost</Label><Input type="number" value={form.unit_cost} onChange={e => setForm(p => ({ ...p, unit_cost: +e.target.value }))} /></div>
                <div><Label>Previous Cost</Label><Input type="number" value={form.previous_cost} onChange={e => setForm(p => ({ ...p, previous_cost: +e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Discount %</Label><Input type="number" value={form.negotiated_discount_pct} onChange={e => setForm(p => ({ ...p, negotiated_discount_pct: +e.target.value }))} /></div>
                <div><Label>Savings $</Label><Input type="number" value={form.savings_amount} onChange={e => setForm(p => ({ ...p, savings_amount: +e.target.value }))} /></div>
              </div>
              <Button className="w-full" onClick={() => { addPriceRecord.mutate(form, { onSuccess: () => setShowAdd(false) }); }}>Save Record</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center"><p className="text-xs text-muted-foreground">Total Savings</p><p className="text-2xl font-bold text-green-400">${totalSavings.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-xs text-muted-foreground">Avg Discount</p><p className="text-2xl font-bold">{avgDiscount.toFixed(1)}%</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-xs text-muted-foreground">Price Records</p><p className="text-2xl font-bold">{history.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Price History</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 ? <p className="text-muted-foreground text-sm">No records yet</p> : history.slice(0, 25).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">{r.supplier_name}</p>
                <p className="text-xs text-muted-foreground">{r.product_name || '—'} • {new Date(r.recorded_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-medium">${Number(r.unit_cost).toFixed(2)}</p>
                  {Number(r.price_change_pct) !== 0 && (
                    <div className={`flex items-center gap-1 text-xs ${Number(r.price_change_pct) < 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {Number(r.price_change_pct) < 0 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                      {Math.abs(Number(r.price_change_pct)).toFixed(1)}%
                    </div>
                  )}
                </div>
                {Number(r.savings_amount) > 0 && <Badge className="bg-green-500/20 text-green-400">-${Number(r.savings_amount).toFixed(2)}</Badge>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── REORDER ENGINE ─── */
function ReorderTab({ categories, selectedCatId, onSelect }: { categories: any[]; selectedCatId: string | null; onSelect: (id: string) => void }) {
  const { data: rules = [] } = useReorderRules(selectedCatId ?? undefined);
  const { addReorderRule } = useGSCSMutations();
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({ rule_type: 'time_based', trigger_days: 14, trigger_threshold: 0, reorder_qty: 10, auto_notify: true, notes: '' });
  const RULE_ICONS: Record<string, typeof Timer> = { time_based: Timer, usage_based: BarChart3, growth_based: TrendingUp };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <CategoryList categories={categories} selectedCatId={selectedCatId} onSelect={onSelect} />
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="text-lg flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Reorder Engine</CardTitle></div>
          {selectedCatId && (
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Rule</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Reorder Rule</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Type</Label><Select value={newRule.rule_type} onValueChange={v => setNewRule(p => ({ ...p, rule_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="time_based">Time-based</SelectItem><SelectItem value="usage_based">Usage-based</SelectItem><SelectItem value="growth_based">Growth-based</SelectItem></SelectContent></Select></div>
                  {newRule.rule_type === 'time_based' ? <div><Label>Days</Label><Input type="number" value={newRule.trigger_days} onChange={e => setNewRule(p => ({ ...p, trigger_days: +e.target.value }))} /></div> : <div><Label>Threshold</Label><Input type="number" value={newRule.trigger_threshold} onChange={e => setNewRule(p => ({ ...p, trigger_threshold: +e.target.value }))} /></div>}
                  <div><Label>Qty</Label><Input type="number" value={newRule.reorder_qty} onChange={e => setNewRule(p => ({ ...p, reorder_qty: +e.target.value }))} /></div>
                  <div className="flex items-center gap-2"><Switch checked={newRule.auto_notify} onCheckedChange={v => setNewRule(p => ({ ...p, auto_notify: v }))} /><Label>Auto Notify</Label></div>
                  <Button className="w-full" onClick={() => { if (selectedCatId) addReorderRule.mutate({ ...newRule, category_id: selectedCatId }, { onSuccess: () => setShowAdd(false) }); }}>Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {!selectedCatId ? <p className="text-muted-foreground">Select a category</p> : rules.length === 0 ? <p className="text-muted-foreground text-sm">No rules yet</p> : (
            <div className="space-y-2">{rules.map((r: any) => { const Icon = RULE_ICONS[r.rule_type] || Timer; return (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3"><Icon className="h-5 w-5 text-primary" /><div><p className="font-medium text-sm capitalize">{r.rule_type.replace(/_/g, ' ')}</p><p className="text-xs text-muted-foreground">{r.rule_type === 'time_based' ? `Every ${r.trigger_days}d` : `Threshold: ${r.trigger_threshold}`} • Qty: {r.reorder_qty}</p></div></div>
                <Badge className={r.is_active ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}>{r.is_active ? 'Active' : 'Off'}</Badge>
              </div>
            ); })}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── LEADERBOARD ─── */
function LeaderboardTab({ leaderboard }: { leaderboard: any[] }) {
  const medals = ['🏆', '🥈', '🥉'];
  const best = (key: string) => [...leaderboard].sort((a, b) => b[key] - a[key])[0];

  return (
    <div className="space-y-6">
      {leaderboard.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: '🏆 Top Overall', s: best('avg_overall'), k: 'avg_overall' },
            { label: '⚡ Fastest', s: best('avg_speed'), k: 'avg_speed' },
            { label: '💎 Best Quality', s: best('avg_quality'), k: 'avg_quality' },
            { label: '🎨 Best Branding', s: best('avg_branding'), k: 'avg_branding' },
          ].map(a => (
            <Card key={a.label}><CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">{a.label}</p>
              <p className="font-bold mt-1">{a.s?.supplier_name || '—'}</p>
              <p className="text-xs text-muted-foreground">{a.s ? `${a.s[a.k].toFixed(1)}/10` : ''}</p>
            </CardContent></Card>
          ))}
        </div>
      )}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Award className="h-5 w-5" /> Performance Leaderboard</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {leaderboard.length === 0 ? <p className="text-muted-foreground">Submit feedback to populate</p> : leaderboard.map((s: any, i: number) => (
            <div key={s.supplier_name} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3"><span className="text-lg w-8">{medals[i] || `#${i + 1}`}</span><div><p className="font-medium">{s.supplier_name}</p><p className="text-xs text-muted-foreground">{s.review_count} reviews</p></div></div>
              <div className="flex items-center gap-3 text-xs">
                {['quality','speed','branding','comms'].map(k => <div key={k} className="text-center"><p className="text-muted-foreground text-[10px] capitalize">{k}</p><p className="font-medium">{s[`avg_${k}`].toFixed(1)}</p></div>)}
                <div className="text-center bg-primary/10 rounded px-2 py-1"><p className="text-muted-foreground text-[10px]">Overall</p><p className="font-bold text-primary">{s.avg_overall.toFixed(1)}</p></div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── AUTOMATION RULES ─── */
function AutomationTab({ rules, categories }: { rules: any[]; categories: any[] }) {
  const { addAutomationRule, toggleAutomationRule } = useGSCSMutations();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ rule_name: '', trigger_type: 'performance_above', action_type: 'upgrade_preferred', threshold_value: 80, category_id: '', notes: '' });

  const TRIGGER_LABELS: Record<string, string> = {
    performance_above: 'Supplier performs well →',
    performance_below: 'Supplier fails →',
    volume_increase: 'Volume increases →',
    category_growth: 'Category grows →',
    supplier_fail: 'Supplier failure →',
    reorder_trigger: 'Reorder triggered →',
  };
  const ACTION_LABELS: Record<string, string> = {
    upgrade_preferred: 'Upgrade to preferred',
    downgrade_supplier: 'Downgrade supplier',
    renegotiate_pricing: 'Renegotiate pricing',
    expand_supplier_base: 'Expand supplier base',
    send_alert: 'Send alert',
    auto_reorder: 'Auto reorder',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg flex items-center gap-2"><Zap className="h-5 w-5" /> Automation Rules Engine</h3>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Rule</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Automation Rule</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Rule Name</Label><Input value={form.rule_name} onChange={e => setForm(p => ({ ...p, rule_name: e.target.value }))} /></div>
              <div><Label>Trigger</Label><Select value={form.trigger_type} onValueChange={v => setForm(p => ({ ...p, trigger_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(TRIGGER_LABELS).map(t => <SelectItem key={t} value={t}>{TRIGGER_LABELS[t]}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Action</Label><Select value={form.action_type} onValueChange={v => setForm(p => ({ ...p, action_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(ACTION_LABELS).map(a => <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Threshold</Label><Input type="number" value={form.threshold_value} onChange={e => setForm(p => ({ ...p, threshold_value: +e.target.value }))} /></div>
              <div><Label>Category (optional)</Label><Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v }))}><SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger><SelectContent><SelectItem value="">All</SelectItem>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.category_name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              <Button className="w-full" onClick={() => { const payload = { ...form, category_id: form.category_id || null }; addAutomationRule.mutate(payload, { onSuccess: () => setShowAdd(false) }); }}>Create Rule</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {rules.length === 0 ? <Card><CardContent className="pt-6"><p className="text-muted-foreground">No automation rules</p></CardContent></Card> : rules.map((r: any) => (
          <Card key={r.id}>
            <CardContent className="pt-4 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className={`h-5 w-5 ${r.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className="font-medium text-sm">{r.rule_name}</p>
                  <p className="text-xs text-muted-foreground">{TRIGGER_LABELS[r.trigger_type] || r.trigger_type} {ACTION_LABELS[r.action_type] || r.action_type} (threshold: {Number(r.threshold_value)})</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {r.trigger_count > 0 && <Badge variant="outline" className="text-[10px]">{r.trigger_count} triggers</Badge>}
                <Switch checked={r.is_active} onCheckedChange={v => toggleAutomationRule.mutate({ id: r.id, is_active: v })} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─── APPROVALS ─── */
function ApprovalsTab() {
  const { data: approvals = [] } = useGSCSApprovals();
  const { resolveApproval, createApproval } = useGSCSMutations();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ change_type: 'upgrade_preferred', entity_name: '', change_summary: '' });

  const pending = approvals.filter((a: any) => a.status === 'pending');
  const resolved = approvals.filter((a: any) => a.status !== 'pending');

  const TYPE_COLORS: Record<string, string> = {
    upgrade_preferred: 'bg-green-500/20 text-green-400',
    downgrade: 'bg-red-500/20 text-red-400',
    new_supplier: 'bg-blue-500/20 text-blue-400',
    remove_supplier: 'bg-red-500/20 text-red-400',
    pricing_change: 'bg-amber-500/20 text-amber-400',
    exclusivity_change: 'bg-purple-500/20 text-purple-400',
    redundancy_change: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> Supplier Change Approvals</h3>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Request Change</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Request Supplier Change</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Change Type</Label><Select value={form.change_type} onValueChange={v => setForm(p => ({ ...p, change_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['upgrade_preferred','downgrade','new_supplier','remove_supplier','pricing_change','exclusivity_change','redundancy_change'].map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Supplier / Entity</Label><Input value={form.entity_name} onChange={e => setForm(p => ({ ...p, entity_name: e.target.value }))} /></div>
              <div><Label>Summary</Label><Textarea value={form.change_summary} onChange={e => setForm(p => ({ ...p, change_summary: e.target.value }))} /></div>
              <Button className="w-full" onClick={() => { if (form.entity_name && form.change_summary) createApproval.mutate(form, { onSuccess: () => setShowAdd(false) }); }}>Submit for Approval</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {pending.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Pending ({pending.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pending.map((a: any) => (
              <div key={a.id} className="p-4 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <div><Badge className={TYPE_COLORS[a.change_type] || 'bg-muted text-muted-foreground'}>{a.change_type.replace(/_/g, ' ')}</Badge><span className="ml-2 font-medium">{a.entity_name}</span></div>
                  <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-muted-foreground">{a.change_summary}</p>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => resolveApproval.mutate({ id: a.id, status: 'rejected' })}>Reject</Button>
                  <Button size="sm" onClick={() => resolveApproval.mutate({ id: a.id, status: 'approved' })}><CheckCircle2 className="h-3 w-3 mr-1" />Approve</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">History</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {resolved.length === 0 ? <p className="text-muted-foreground text-sm">No resolved approvals yet</p> : resolved.slice(0, 20).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2"><Badge className={TYPE_COLORS[a.change_type] || ''}>{a.change_type.replace(/_/g, ' ')}</Badge><span className="text-sm">{a.entity_name}</span></div>
              <Badge className={a.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>{a.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── FEEDBACK LOOP ─── */
function FeedbackTab() {
  const { data: feedback = [] } = useSupplierFeedback();
  const { addFeedback } = useGSCSMutations();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ supplier_name: '', quality_score: 7, speed_score: 7, branding_score: 7, communication_score: 7, notes: '', order_ref: '' });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div><h3 className="font-bold text-lg">Supply Chain Feedback Loop</h3><p className="text-sm text-muted-foreground">Buy → Track → Score → Improve → Repeat</p></div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Submit Review</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Supplier Review</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Supplier</Label><Input value={form.supplier_name} onChange={e => setForm(p => ({ ...p, supplier_name: e.target.value }))} /></div>
              <div><Label>Order Ref</Label><Input value={form.order_ref} onChange={e => setForm(p => ({ ...p, order_ref: e.target.value }))} placeholder="Optional" /></div>
              {(['quality_score','speed_score','branding_score','communication_score'] as const).map(k => (
                <div key={k}><Label className="capitalize">{k.replace(/_/g, ' ')} — {form[k]}/10</Label><Slider min={0} max={10} step={0.5} value={[form[k]]} onValueChange={([v]) => setForm(p => ({ ...p, [k]: v }))} /></div>
              ))}
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              <Button className="w-full" onClick={() => { if (form.supplier_name) addFeedback.mutate(form, { onSuccess: () => setShowAdd(false) }); }}>Submit</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="pt-6"><div className="flex items-center justify-center gap-2 flex-wrap">
        {['Buy','Track','Score','Improve','Volume ↑','Cost ↓','Expand'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium"><span className="text-primary">{i + 1}.</span> {s}</div>
            {i < 6 && <ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
        <RefreshCw className="h-5 w-5 text-primary ml-2" />
      </div></CardContent></Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Reviews</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {feedback.length === 0 ? <p className="text-muted-foreground text-sm">No feedback yet</p> : feedback.slice(0, 20).map((f: any) => (
            <div key={f.id} className="p-3 rounded-lg border flex items-center justify-between">
              <div><p className="font-medium text-sm">{f.supplier_name}</p><p className="text-xs text-muted-foreground">{f.order_ref ? `${f.order_ref} • ` : ''}{new Date(f.created_at).toLocaleDateString()}</p></div>
              <div className="flex items-center gap-3 text-xs">
                <span>Q:{Number(f.quality_score).toFixed(1)}</span><span>S:{Number(f.speed_score).toFixed(1)}</span>
                <span className="font-bold text-primary">{Number(f.overall_score).toFixed(1)}/10</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── SHARED CATEGORY LIST ─── */
function CategoryList({ categories, selectedCatId, onSelect }: { categories: any[]; selectedCatId: string | null; onSelect: (id: string) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Categories</CardTitle></CardHeader>
      <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
        {categories.map((c: any) => (
          <button key={c.id} onClick={() => onSelect(c.id)} className={`w-full text-left p-3 rounded-lg border transition ${selectedCatId === c.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}>
            <p className="font-medium text-sm">{c.category_name}</p>
            <p className="text-xs text-muted-foreground">Score: {Number(c.total_score).toFixed(1)} • {c.status}</p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
