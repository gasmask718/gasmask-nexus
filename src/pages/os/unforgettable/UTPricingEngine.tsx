import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DollarSign, Package, FileText, TrendingUp, Plus, Copy, Send, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const VENDOR_TYPES = ['venue', 'dj', 'photographer', 'caterer', 'decorator', 'coordinator', 'security', 'other'] as const;
const UNITS = ['per_event', 'per_hour', 'per_person', 'per_day'] as const;
const VENDOR_COLORS: Record<string, string> = {
  venue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  dj: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  photographer: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  caterer: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  decorator: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  coordinator: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  security: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};
const TIER_RATES = { starter: 10, silver: 12, gold: 15, platinum: 17, legend: 20 };
const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Vendor Pricing Tab ───
function VendorPricingTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ vendor_type: 'venue', vendor_name: '', service_name: '', base_cost: '', unit: 'per_event', city: '', state: '', notes: '' });

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['ut_vendor_pricing'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('ut_vendor_pricing').select('*').eq('is_active', true).order('vendor_type');
      return (data || []) as any[];
    }
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const markup = form.vendor_type === 'venue' ? 40 : 50;
      const { error } = await supabase.from('ut_vendor_pricing').insert({
        vendor_type: form.vendor_type, vendor_name: form.vendor_name, service_name: form.service_name,
        base_cost: Number(form.base_cost), markup_percent: markup, unit: form.unit,
        city: form.city || null, state: form.state || null, notes: form.notes || null
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Vendor added'); qc.invalidateQueries({ queryKey: ['ut_vendor_pricing'] }); setForm({ vendor_type: 'venue', vendor_name: '', service_name: '', base_cost: '', unit: 'per_event', city: '', state: '', notes: '' }); },
    onError: (e: any) => toast.error(e.message)
  });

  const cost = Number(form.base_cost) || 0;
  const markupPct = form.vendor_type === 'venue' ? 40 : 50;
  const customerPrice = cost * (1 + markupPct / 100);
  const profit = customerPrice - cost;

  const totalVendor = vendors.reduce((s, v) => s + Number(v.base_cost || 0), 0);
  const totalCustomer = vendors.reduce((s, v) => s + Number(v.customer_price || 0), 0);
  const totalProfit = vendors.reduce((s, v) => s + Number(v.our_profit || 0), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add Vendor Service</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Vendor Type</label>
              <Select value={form.vendor_type} onValueChange={v => setForm(p => ({ ...p, vendor_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VENDOR_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium text-muted-foreground">Vendor Name</label><Input value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))} placeholder="DJ Pharaoh" /></div>
            <div><label className="text-sm font-medium text-muted-foreground">Service Name</label><Input value={form.service_name} onChange={e => setForm(p => ({ ...p, service_name: e.target.value }))} placeholder="DJ Services 4hr" /></div>
            <div><label className="text-sm font-medium text-muted-foreground">Their Price ($)</label><Input type="number" value={form.base_cost} onChange={e => setForm(p => ({ ...p, base_cost: e.target.value }))} placeholder="400" /></div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Unit</label>
              <Select value={form.unit} onValueChange={v => setForm(p => ({ ...p, unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium text-muted-foreground">City</label><Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Brooklyn" /></div>
          </div>

          {cost > 0 && (
            <Card className="mt-4 border-primary/30 bg-primary/5">
              <CardContent className="pt-4 space-y-1 text-sm">
                <p className="font-semibold text-base">💰 Pricing Preview</p>
                <p>Vendor charges you: <span className="font-bold">{fmt(cost)}</span></p>
                <p>Your markup ({markupPct}%): <span className="font-bold text-green-600">{fmt(profit)}</span></p>
                <p>Customer pays: <span className="font-bold">{fmt(customerPrice)}</span></p>
                <p className="pt-2 font-semibold">If ambassador refers this:</p>
                <p>Starter (10%): you keep {fmt(profit - customerPrice * 0.1)}</p>
                <p>Legend (20%): you keep {fmt(profit - customerPrice * 0.2)}</p>
              </CardContent>
            </Card>
          )}

          <Button className="mt-4" onClick={() => addMutation.mutate()} disabled={!form.vendor_name || !form.service_name || !cost || addMutation.isPending}>
            {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Vendor
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vendor Price List</CardTitle><CardDescription>What vendors charge you vs what customers pay</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
            <>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Vendor</TableHead><TableHead>Type</TableHead><TableHead>Service</TableHead>
                  <TableHead className="text-right">Their Price</TableHead><TableHead className="text-right">Markup</TableHead>
                  <TableHead className="text-right">Customer Price</TableHead><TableHead className="text-right">Your Profit</TableHead><TableHead>City</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {vendors.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.vendor_name}</TableCell>
                      <TableCell><Badge className={VENDOR_COLORS[v.vendor_type] || ''}>{v.vendor_type}</Badge></TableCell>
                      <TableCell>{v.service_name}</TableCell>
                      <TableCell className="text-right">{fmt(Number(v.base_cost))}</TableCell>
                      <TableCell className="text-right">{v.markup_percent}%</TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(v.customer_price))}</TableCell>
                      <TableCell className="text-right text-green-600 font-bold">{fmt(Number(v.our_profit))}</TableCell>
                      <TableCell>{v.city}{v.state ? `, ${v.state}` : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {vendors.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-muted text-sm">
                  <p className="font-semibold">If you sold all services in one event:</p>
                  <p>Vendor costs: <span className="font-bold">{fmt(totalVendor)}</span></p>
                  <p>Customer pays: <span className="font-bold">{fmt(totalCustomer)}</span></p>
                  <p>Your profit: <span className="font-bold text-green-600">{fmt(totalProfit)}</span></p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Package Builder Tab ───
function PackageBuilderTab() {
  const qc = useQueryClient();
  const [pkgForm, setPkgForm] = useState({ package_name: '', event_type: 'birthday', city: '', state: '', description: '' });
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: vendors = [] } = useQuery({
    queryKey: ['ut_vendor_pricing'],
    queryFn: async () => { const { data } = await supabase.from('ut_vendor_pricing').select('*').eq('is_active', true).order('vendor_type'); return data || []; }
  });

  const { data: packages = [], isLoading: pkgLoading } = useQuery({
    queryKey: ['ut_event_packages'],
    queryFn: async () => { const { data } = await supabase.from('ut_event_packages').select('*').eq('is_active', true).order('created_at', { ascending: false }); return data || []; }
  });

  const addItem = (vendor: any) => {
    if (selectedItems.find(i => i.id === vendor.id)) return;
    setSelectedItems(prev => [...prev, { ...vendor, quantity: 1 }]);
  };

  const removeItem = (id: string) => setSelectedItems(prev => prev.filter(i => i.id !== id));
  const updateQty = (id: string, qty: number) => setSelectedItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));

  const totals = useMemo(() => {
    let vendorCost = 0, customerPrice = 0, profit = 0;
    selectedItems.forEach(item => {
      const vc = Number(item.base_cost) * (item.quantity || 1);
      const mp = item.vendor_type === 'venue' ? 40 : 50;
      const cp = vc * (1 + mp / 100);
      vendorCost += vc; customerPrice += cp; profit += cp - vc;
    });
    const margin = customerPrice > 0 ? (profit / customerPrice) * 100 : 0;
    return { vendorCost, customerPrice, profit, margin };
  }, [selectedItems]);

  const savePackage = async () => {
    setSaving(true);
    try {
      const items = selectedItems.map(item => ({
        vendor_pricing_id: item.id, vendor_name: item.vendor_name, service_name: item.service_name,
        vendor_type: item.vendor_type, base_cost: Number(item.base_cost), quantity: item.quantity || 1,
        unit: item.unit
      }));
      const res = await supabase.functions.invoke('ut-pricing-engine', {
        body: { action: 'build_package', items, package_name: pkgForm.package_name, event_type: pkgForm.event_type, city: pkgForm.city, state: pkgForm.state, description: pkgForm.description }
      });
      if (res.error) throw res.error;
      toast.success('Package saved!');
      qc.invalidateQueries({ queryKey: ['ut_event_packages'] });
      setPkgForm({ package_name: '', event_type: 'birthday', city: '', state: '', description: '' });
      setSelectedItems([]);
    } catch (e: any) { toast.error(e.message || 'Failed to save'); }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Build Event Package</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div><label className="text-sm font-medium text-muted-foreground">Package Name</label><Input value={pkgForm.package_name} onChange={e => setPkgForm(p => ({ ...p, package_name: e.target.value }))} placeholder="Royal Birthday Experience" /></div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Event Type</label>
              <Select value={pkgForm.event_type} onValueChange={v => setPkgForm(p => ({ ...p, event_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['birthday', 'wedding', 'corporate', 'sweet_sixteen', 'baby_shower', 'graduation', 'custom'].map(t => (
                    <SelectItem key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium text-muted-foreground">City</label><Input value={pkgForm.city} onChange={e => setPkgForm(p => ({ ...p, city: e.target.value }))} placeholder="Brooklyn" /></div>
          </div>

          <p className="text-sm font-semibold mb-2 text-muted-foreground">Add services to this package:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {vendors.map(v => (
              <Button key={v.id} variant={selectedItems.find(i => i.id === v.id) ? 'default' : 'outline'} size="sm" onClick={() => addItem(v)}>
                {v.vendor_name} — {v.service_name}
              </Button>
            ))}
          </div>

          {selectedItems.length > 0 && (
            <>
              <Table>
                <TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Vendor Cost</TableHead><TableHead className="text-center">Qty</TableHead><TableHead className="text-right">Customer Price</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {selectedItems.map(item => {
                    const vc = Number(item.base_cost) * (item.quantity || 1);
                    const mp = item.vendor_type === 'venue' ? 40 : 50;
                    const cp = vc * (1 + mp / 100);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.vendor_name} — {item.service_name}</TableCell>
                        <TableCell><Badge className={VENDOR_COLORS[item.vendor_type] || ''}>{item.vendor_type}</Badge></TableCell>
                        <TableCell className="text-right">{fmt(vc)}</TableCell>
                        <TableCell className="text-center"><Input type="number" className="w-16 text-center" min={1} value={item.quantity} onChange={e => updateQty(item.id, Number(e.target.value) || 1)} /></TableCell>
                        <TableCell className="text-right font-medium">{fmt(cp)}</TableCell>
                        <TableCell><Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>✕</Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Card className="mt-4 border-primary/30 bg-primary/5">
                <CardContent className="pt-4 space-y-1 text-sm">
                  <p className="font-bold text-lg">📦 {pkgForm.package_name || 'Package'}</p>
                  <p>Customer Pays: <span className="font-bold text-lg">{fmt(totals.customerPrice)}</span></p>
                  <p>Your Costs: <span className="font-bold">{fmt(totals.vendorCost)}</span></p>
                  <p>Gross Profit: <span className="font-bold text-green-600">{fmt(totals.profit)} ({totals.margin.toFixed(1)}%)</span></p>
                  <hr className="my-2 border-border" />
                  <p className="font-semibold">After Ambassador Commission:</p>
                  {Object.entries(TIER_RATES).map(([tier, rate]) => {
                    const comm = totals.customerPrice * (rate / 100);
                    const net = totals.profit - comm;
                    return <p key={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)} ({rate}%={fmt(comm)}): keep <span className={net > 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{fmt(net)}</span> {net > 0 ? '✅' : '❌'}</p>;
                  })}
                  <p className="mt-2 font-bold">{totals.profit - totals.customerPrice * 0.2 > 0 ? '✅ PROFITABLE AT ALL TIERS' : '⚠️ Not profitable at Legend tier'}</p>
                </CardContent>
              </Card>

              <Button className="mt-4" onClick={savePackage} disabled={!pkgForm.package_name || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />} Save Package
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Saved Packages</CardTitle></CardHeader>
        <CardContent>
          {pkgLoading ? <p className="text-muted-foreground">Loading...</p> : packages.length === 0 ? <p className="text-muted-foreground">No packages yet</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packages.map(p => (
                <Card key={p.id} className="border">
                  <CardContent className="pt-4 text-sm space-y-1">
                    <p className="font-bold text-base">{p.package_name}</p>
                    <Badge variant="outline">{(p.event_type || '').replace('_', ' ')}</Badge>
                    {p.city && <span className="text-muted-foreground ml-2">{p.city}{p.state ? `, ${p.state}` : ''}</span>}
                    <p>Customer Price: <span className="font-bold">{fmt(Number(p.total_customer_price))}</span></p>
                    <p>Our Profit: <span className="font-bold text-green-600">{fmt(Number(p.total_our_profit))} ({Number(p.our_margin_percent).toFixed(1)}%)</span></p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Quote Generator Tab ───
function QuoteGeneratorTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ package_id: '', customer_name: '', customer_email: '', customer_phone: '', event_date: '', guest_count: '', referral_code: '', discount_percent: '0' });
  const [generating, setGenerating] = useState(false);

  const { data: packages = [] } = useQuery({
    queryKey: ['ut_event_packages'],
    queryFn: async () => { const { data } = await supabase.from('ut_event_packages').select('*').eq('is_active', true).order('package_name'); return data || []; }
  });

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['ut_quotes'],
    queryFn: async () => { const { data } = await supabase.from('ut_quotes').select('*').order('created_at', { ascending: false }).limit(50); return data || []; }
  });

  const selectedPkg = packages.find(p => p.id === form.package_id);

  const generateQuote = async () => {
    setGenerating(true);
    try {
      const res = await supabase.functions.invoke('ut-pricing-engine', {
        body: {
          action: 'generate_quote', package_id: form.package_id,
          customer_name: form.customer_name, customer_email: form.customer_email,
          customer_phone: form.customer_phone, event_type: selectedPkg?.event_type,
          event_date: form.event_date || null, city: selectedPkg?.city,
          state: selectedPkg?.state, guest_count: Number(form.guest_count) || null,
          referral_code: form.referral_code || null, discount_percent: Number(form.discount_percent) || 0
        }
      });
      if (res.error) throw res.error;
      toast.success(`Quote ${res.data.quote.quote_number} generated!`);
      qc.invalidateQueries({ queryKey: ['ut_quotes'] });
      setForm({ package_id: '', customer_name: '', customer_email: '', customer_phone: '', event_date: '', guest_count: '', referral_code: '', discount_percent: '0' });
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    setGenerating(false);
  };

  const statusColors: Record<string, string> = { draft: 'bg-muted text-muted-foreground', sent: 'bg-blue-100 text-blue-800', viewed: 'bg-yellow-100 text-yellow-800', accepted: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800' };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Generate Customer Quote</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Select Package</label>
              <Select value={form.package_id} onValueChange={v => setForm(p => ({ ...p, package_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose package..." /></SelectTrigger>
                <SelectContent>{packages.map(p => <SelectItem key={p.id} value={p.id}>{p.package_name} — {fmt(Number(p.total_customer_price))}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium text-muted-foreground">Customer Name</label><Input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-muted-foreground">Email</label><Input type="email" value={form.customer_email} onChange={e => setForm(p => ({ ...p, customer_email: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-muted-foreground">Phone</label><Input value={form.customer_phone} onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-muted-foreground">Event Date</label><Input type="date" value={form.event_date} onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-muted-foreground">Guest Count</label><Input type="number" value={form.guest_count} onChange={e => setForm(p => ({ ...p, guest_count: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-muted-foreground">Referral Code</label><Input value={form.referral_code} onChange={e => setForm(p => ({ ...p, referral_code: e.target.value }))} placeholder="UT-DAVID-1234" /></div>
            <div><label className="text-sm font-medium text-muted-foreground">Discount %</label><Input type="number" min={0} max={10} value={form.discount_percent} onChange={e => setForm(p => ({ ...p, discount_percent: e.target.value }))} /></div>
          </div>

          {selectedPkg && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Card className="border-2">
                <CardContent className="pt-4 text-sm space-y-2">
                  <p className="font-bold text-lg text-center">UNFORGETTABLE TIMES</p>
                  <p className="text-center text-muted-foreground">Customer Quote Preview</p>
                  <hr className="border-border" />
                  <p>Prepared for: <strong>{form.customer_name || '—'}</strong></p>
                  <p>Package: <strong>{selectedPkg.package_name}</strong></p>
                  {form.event_date && <p>Date: {new Date(form.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>}
                  {form.guest_count && <p>Guests: {form.guest_count}</p>}
                  <hr className="border-border" />
                  <p>Package Price: <span className="font-bold text-lg">{fmt(Number(selectedPkg.total_customer_price))}</span></p>
                  {Number(form.discount_percent) > 0 && <p className="text-green-600">Discount ({form.discount_percent}%): -{fmt(Number(selectedPkg.total_customer_price) * Number(form.discount_percent) / 100)}</p>}
                  <p>Deposit Required (25%): <strong>{fmt(Number(selectedPkg.total_customer_price) * 0.25)}</strong></p>
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
                <CardContent className="pt-4 text-sm space-y-1">
                  <p className="font-bold text-lg">🔒 Profit Analysis (Admin Only)</p>
                  <p>Customer Pays: <strong>{fmt(Number(selectedPkg.total_customer_price))}</strong></p>
                  <p>Vendor Costs: <strong>{fmt(Number(selectedPkg.total_vendor_cost))}</strong></p>
                  <p>Gross Profit: <span className="font-bold text-green-600">{fmt(Number(selectedPkg.total_our_profit))} ({Number(selectedPkg.our_margin_percent).toFixed(1)}%)</span></p>
                  {form.referral_code && <>
                    <hr className="border-border" />
                    <p>Referral Code: {form.referral_code}</p>
                    <p>Ambassador Commission: ~{fmt(Number(selectedPkg.total_customer_price) * 0.1)}</p>
                  </>}
                </CardContent>
              </Card>
            </div>
          )}

          <Button className="mt-4" onClick={generateQuote} disabled={!form.package_id || !form.customer_name || generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Generate Quote
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Quotes</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Loading...</p> : quotes.length === 0 ? <p className="text-muted-foreground">No quotes yet</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Quote #</TableHead><TableHead>Customer</TableHead><TableHead>Event Date</TableHead>
                <TableHead className="text-right">Customer Price</TableHead><TableHead className="text-right">Net Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {quotes.map(q => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.quote_number}</TableCell>
                    <TableCell className="font-medium">{q.customer_name}</TableCell>
                    <TableCell>{q.event_date ? new Date(q.event_date).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(Number(q.total_customer_price))}</TableCell>
                    <TableCell className={`text-right font-bold ${Number(q.net_profit) > 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(Number(q.net_profit))}</TableCell>
                    <TableCell className="text-right">{Number(q.our_margin_percent).toFixed(1)}%</TableCell>
                    <TableCell><Badge className={statusColors[q.status || 'draft'] || ''}>{q.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Profit Analyzer Tab ───
function ProfitAnalyzerTab() {
  const { data: quotes = [] } = useQuery({
    queryKey: ['ut_quotes'],
    queryFn: async () => { const { data } = await supabase.from('ut_quotes').select('*').order('created_at', { ascending: false }); return data || []; }
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['ut_event_packages'],
    queryFn: async () => { const { data } = await supabase.from('ut_event_packages').select('*'); return data || []; }
  });

  const totalRevenue = quotes.reduce((s, q) => s + Number(q.total_customer_price || 0), 0);
  const totalVendor = quotes.reduce((s, q) => s + Number(q.total_vendor_cost || 0), 0);
  const grossProfit = totalRevenue - totalVendor;
  const totalCommissions = quotes.reduce((s, q) => s + Number(q.ambassador_commission_amount || 0), 0);
  const netProfit = grossProfit - totalCommissions;
  const avgMargin = quotes.length > 0 ? quotes.reduce((s, q) => s + Number(q.our_margin_percent || 0), 0) / quotes.length : 0;

  const byType = useMemo(() => {
    const map: Record<string, { revenue: number; cost: number; profit: number; count: number }> = {};
    quotes.forEach(q => {
      const t = q.event_type || 'unknown';
      if (!map[t]) map[t] = { revenue: 0, cost: 0, profit: 0, count: 0 };
      map[t].revenue += Number(q.total_customer_price || 0);
      map[t].cost += Number(q.total_vendor_cost || 0);
      map[t].profit += Number(q.net_profit || 0);
      map[t].count++;
    });
    return Object.entries(map).map(([type, d]) => ({ type, ...d, margin: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue * 100) : 0 }));
  }, [quotes]);

  const lowMarginQuotes = quotes.filter(q => Number(q.our_margin_percent) < 10 && Number(q.our_margin_percent) > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: fmt(totalRevenue), icon: DollarSign },
          { label: 'Total Vendor Costs', value: fmt(totalVendor), icon: DollarSign },
          { label: 'Gross Profit', value: fmt(grossProfit), icon: TrendingUp },
          { label: 'Ambassador Commissions', value: fmt(totalCommissions), icon: DollarSign },
          { label: 'Net Profit', value: fmt(netProfit), icon: TrendingUp },
          { label: 'Avg Margin', value: `${avgMargin.toFixed(1)}%`, icon: TrendingUp },
          { label: 'Total Quotes', value: String(quotes.length), icon: FileText },
          { label: 'Packages Built', value: String(packages.length), icon: Package },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><kpi.icon className="h-3 w-3" />{kpi.label}</div>
              <p className="text-xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {byType.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Margin by Event Type</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Event Type</TableHead><TableHead className="text-right">Avg Revenue</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead><TableHead className="text-right">Avg Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead><TableHead className="text-right"># Quotes</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {byType.map(row => (
                  <TableRow key={row.type}>
                    <TableCell className="font-medium capitalize">{row.type.replace('_', ' ')}</TableCell>
                    <TableCell className="text-right">{fmt(row.revenue / row.count)}</TableCell>
                    <TableCell className="text-right">{fmt(row.cost / row.count)}</TableCell>
                    <TableCell className="text-right text-green-600 font-bold">{fmt(row.profit / row.count)}</TableCell>
                    <TableCell className={`text-right font-bold ${row.margin > 40 ? 'text-green-600' : row.margin > 20 ? 'text-yellow-600' : 'text-red-600'}`}>{row.margin.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {lowMarginQuotes.length > 0 && (
        <Card className="border-red-300">
          <CardHeader><CardTitle className="text-red-600">⚠️ Low Margin Alerts</CardTitle></CardHeader>
          <CardContent>
            {lowMarginQuotes.map(q => (
              <div key={q.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <span className="font-mono text-sm">{q.quote_number}</span>
                <span>{q.customer_name}</span>
                <Badge variant="destructive">{Number(q.our_margin_percent).toFixed(1)}% margin</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ───
export default function UTPricingEngine() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">💰 Pricing Engine</h1>
        <p className="text-muted-foreground">Markup: 40% venues, 50% staff — Full margin visibility</p>
      </div>

      <Tabs defaultValue="vendors" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="vendors" className="flex items-center gap-1"><DollarSign className="h-4 w-4" /> Vendor Pricing</TabsTrigger>
          <TabsTrigger value="packages" className="flex items-center gap-1"><Package className="h-4 w-4" /> Package Builder</TabsTrigger>
          <TabsTrigger value="quotes" className="flex items-center gap-1"><FileText className="h-4 w-4" /> Quote Generator</TabsTrigger>
          <TabsTrigger value="analyzer" className="flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Profit Analyzer</TabsTrigger>
        </TabsList>
        <TabsContent value="vendors"><VendorPricingTab /></TabsContent>
        <TabsContent value="packages"><PackageBuilderTab /></TabsContent>
        <TabsContent value="quotes"><QuoteGeneratorTab /></TabsContent>
        <TabsContent value="analyzer"><ProfitAnalyzerTab /></TabsContent>
      </Tabs>
    </div>
  );
}
