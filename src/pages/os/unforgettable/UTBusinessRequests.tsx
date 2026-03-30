import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ClipboardList, DollarSign, CheckCircle, Clock, Search, Eye, FileText,
  Copy, Package, ArrowRight, AlertTriangle, X, Inbox, TrendingUp
} from 'lucide-react';

interface BusinessRequest {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  selected_items: any;
  estimated_budget: number;
  status: string;
  notes: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  quoted: { label: 'Quoted', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  approved: { label: 'Approved', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground border-border' },
};

function getPriority(r: BusinessRequest): { label: string; className: string } {
  const budget = r.estimated_budget || 0;
  const itemCount = Array.isArray(r.selected_items) ? r.selected_items.length : 0;
  const score = (budget >= 5000 ? 2 : budget >= 2000 ? 1 : 0) + (itemCount >= 5 ? 2 : itemCount >= 2 ? 1 : 0);
  if (score >= 3) return { label: 'High', className: 'bg-red-500/15 text-red-400 border-red-500/30' };
  if (score >= 1) return { label: 'Medium', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  return { label: 'Low', className: 'bg-muted text-muted-foreground border-border' };
}

function renderSelectedItems(items: any) {
  if (!items) return <span className="text-muted-foreground">—</span>;
  const arr = Array.isArray(items) ? items : typeof items === 'object' ? Object.keys(items) : [String(items)];
  if (arr.length === 0) return <span className="text-muted-foreground">—</span>;
  const show = arr.slice(0, 2).map(i => typeof i === 'string' ? i : i?.name || JSON.stringify(i));
  const more = arr.length - 2;
  return (
    <div className="flex flex-wrap gap-1">
      {show.map((s, i) => <Badge key={i} variant="outline" className="text-xs font-normal">{s}</Badge>)}
      {more > 0 && <Badge variant="outline" className="text-xs font-normal text-muted-foreground">+{more}</Badge>}
    </div>
  );
}

function renderItemsFull(items: any) {
  if (!items) return <p className="text-muted-foreground text-sm">No items selected</p>;
  const arr = Array.isArray(items) ? items : typeof items === 'object' ? Object.entries(items).map(([k, v]) => ({ name: k, ...((typeof v === 'object' && v) || {}) })) : [{ name: String(items) }];
  return (
    <div className="grid gap-2">
      {arr.map((item: any, i: number) => (
        <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-border/50">
          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{typeof item === 'string' ? item : item?.name || `Item ${i + 1}`}</p>
            {item?.category && <p className="text-xs text-muted-foreground">{item.category}</p>}
          </div>
          {item?.quantity && <Badge variant="outline" className="text-xs shrink-0">×{item.quantity}</Badge>}
        </div>
      ))}
    </div>
  );
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied`);
}

export default function UTBusinessRequests() {
  const [requests, setRequests] = useState<BusinessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [drawerReq, setDrawerReq] = useState<BusinessRequest | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteTarget, setQuoteTarget] = useState<BusinessRequest | null>(null);
  const [quoteForm, setQuoteForm] = useState({ product_cost: '', shipping_cost: '', delivery_days: '14', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('ut_business_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setRequests(data as BusinessRequest[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
    const channel = supabase
      .channel('ut-biz-requests-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ut_business_requests' }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return [r.full_name, r.email, r.phone, r.location].some(f => f?.toLowerCase().includes(s));
    }
    return true;
  }), [requests, statusFilter, search]);

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    quoted: requests.filter(r => r.status === 'quoted').length,
    closed: requests.filter(r => r.status === 'closed').length,
    pipeline: requests.reduce((sum, r) => sum + (r.estimated_budget || 0), 0),
  }), [requests]);

  const handleCreateQuote = async () => {
    if (!quoteTarget) return;
    setSaving(true);
    const pc = parseFloat(quoteForm.product_cost) || 0;
    const sc = parseFloat(quoteForm.shipping_cost) || 0;
    const { error } = await supabase.from('ut_business_quotes').insert({
      request_id: quoteTarget.id,
      product_cost: pc,
      shipping_cost: sc,
      total_cost: pc + sc,
      estimated_delivery_days: parseInt(quoteForm.delivery_days) || 14,
      notes: quoteForm.notes || null,
    });
    if (!error) {
      await supabase.from('ut_business_requests').update({ status: 'quoted' }).eq('id', quoteTarget.id);
      toast.success('Quote created successfully');
      setQuoteOpen(false);
      setQuoteForm({ product_cost: '', shipping_cost: '', delivery_days: '14', notes: '' });
      setQuoteTarget(null);
      fetchRequests();
    } else {
      toast.error(error.message);
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('ut_business_requests').update({ status }).eq('id', id);
    toast.success(`Status → ${status}`);
    if (drawerReq?.id === id) setDrawerReq(prev => prev ? { ...prev, status } : null);
    fetchRequests();
  };

  const openQuoteFor = (r: BusinessRequest) => {
    setQuoteTarget(r);
    setQuoteForm({ product_cost: '', shipping_cost: '', delivery_days: '14', notes: '' });
    setQuoteOpen(true);
  };

  const totalCalc = (parseFloat(quoteForm.product_cost) || 0) + (parseFloat(quoteForm.shipping_cost) || 0);

  const KPI_CARDS = [
    { label: 'Total Requests', value: stats.total, icon: ClipboardList, accent: 'hsl(330 80% 55%)' },
    { label: 'Pending Review', value: stats.pending, icon: Clock, accent: 'hsl(var(--warning))' },
    { label: 'Quotes Sent', value: stats.quoted, icon: FileText, accent: 'hsl(var(--hud-blue))' },
    { label: 'Closed Deals', value: stats.closed, icon: CheckCircle, accent: 'hsl(var(--success))' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'hsl(330 80% 55%)' }}>Business Requests</h1>
        <p className="text-sm text-muted-foreground">Review inbound party business owner inquiries, assess opportunity, and turn requests into quotes.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CARDS.map(k => (
          <Card key={k.label} className="border-border/50 bg-card/80 backdrop-blur">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ backgroundColor: k.accent + '15' }}>
                <k.icon className="h-5 w-5" style={{ color: k.accent }} />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Value */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-3 flex items-center gap-3">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Estimated Pipeline Value:</span>
          <span className="text-sm font-bold" style={{ color: 'hsl(330 80% 55%)' }}>${stats.pipeline.toLocaleString()}</span>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, email, phone, location..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border/50" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-card border-border/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="quoted">Quoted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        {(search || statusFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
            <X className="h-3 w-3 mr-1" /> Reset
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="border-border/50 bg-card/80 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Lead</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Location</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Interested In</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Budget</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Priority</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Date</th>
                  <th className="text-right p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">Loading requests...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center">
                      <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="font-medium text-muted-foreground">No business requests yet</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Requests from /start-business will appear here once submitted.</p>
                    </td>
                  </tr>
                ) : filtered.map(r => {
                  const priority = getPriority(r);
                  return (
                    <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setDrawerReq(r)}>
                      <td className="p-3">
                        <p className="font-medium">{r.full_name}</p>
                        <p className="text-xs text-muted-foreground">{r.email || r.phone || '—'}</p>
                      </td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground">{r.location || '—'}</td>
                      <td className="p-3 hidden lg:table-cell">{renderSelectedItems(r.selected_items)}</td>
                      <td className="p-3 font-semibold">${(r.estimated_budget || 0).toLocaleString()}</td>
                      <td className="p-3"><Badge variant="outline" className={`text-xs ${priority.className}`}>{priority.label}</Badge></td>
                      <td className="p-3"><Badge variant="outline" className={`text-xs ${STATUS_CONFIG[r.status]?.className || ''}`}>{STATUS_CONFIG[r.status]?.label || r.status}</Badge></td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDrawerReq(r)}><Eye className="h-3.5 w-3.5" /></Button>
                          {r.status === 'pending' && (
                            <Button size="sm" className="h-7 text-xs px-2" style={{ backgroundColor: 'hsl(330 80% 55%)', color: 'white' }} onClick={() => openQuoteFor(r)}>
                              Quote
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <Sheet open={!!drawerReq} onOpenChange={v => { if (!v) setDrawerReq(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Request from {drawerReq?.full_name}
              {drawerReq && <Badge variant="outline" className={`text-xs ml-auto ${STATUS_CONFIG[drawerReq.status]?.className || ''}`}>{STATUS_CONFIG[drawerReq.status]?.label || drawerReq.status}</Badge>}
            </SheetTitle>
          </SheetHeader>

          {drawerReq && (
            <div className="space-y-5 mt-5">
              {/* Lead Summary */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Lead Summary</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Email', value: drawerReq.email },
                    { label: 'Phone', value: drawerReq.phone },
                    { label: 'Location', value: drawerReq.location },
                    { label: 'Submitted', value: new Date(drawerReq.created_at).toLocaleDateString() },
                  ].map(f => (
                    <div key={f.label} className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">{f.label}</p>
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium truncate">{f.value || '—'}</p>
                        {f.value && (f.label === 'Email' || f.label === 'Phone') && (
                          <button onClick={() => copyToClipboard(f.value!, f.label)} className="text-muted-foreground hover:text-foreground">
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Opportunity */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Business Goal Snapshot</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-xs text-muted-foreground">Budget</p>
                    <p className="text-lg font-bold" style={{ color: 'hsl(330 80% 55%)' }}>${(drawerReq.estimated_budget || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-xs text-muted-foreground">Priority</p>
                    <Badge variant="outline" className={`mt-1 ${getPriority(drawerReq).className}`}>{getPriority(drawerReq).label}</Badge>
                  </div>
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Selected Items */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Selected Items</h4>
                {renderItemsFull(drawerReq.selected_items)}
              </div>

              {drawerReq.notes && (
                <>
                  <Separator className="bg-border/50" />
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</h4>
                    <p className="text-sm bg-muted/30 p-3 rounded-lg border border-border/50">{drawerReq.notes}</p>
                  </div>
                </>
              )}

              <Separator className="bg-border/50" />

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {drawerReq.status === 'pending' && (
                  <Button className="flex-1" style={{ backgroundColor: 'hsl(330 80% 55%)', color: 'white' }} onClick={() => { setDrawerReq(null); openQuoteFor(drawerReq); }}>
                    <FileText className="h-4 w-4 mr-2" /> Create Quote
                  </Button>
                )}
                {drawerReq.status === 'quoted' && (
                  <Button variant="outline" className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => updateStatus(drawerReq.id, 'approved')}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Approve
                  </Button>
                )}
                {drawerReq.status !== 'closed' && (
                  <Button variant="outline" className="flex-1" onClick={() => { updateStatus(drawerReq.id, 'closed'); setDrawerReq(null); }}>
                    Close Deal
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Quote Creation Modal */}
      <Dialog open={quoteOpen} onOpenChange={v => { if (!v) { setQuoteOpen(false); setQuoteTarget(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Quote — {quoteTarget?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-sm">
              <p className="text-muted-foreground">Budget: <span className="font-semibold text-foreground">${(quoteTarget?.estimated_budget || 0).toLocaleString()}</span></p>
              <p className="text-muted-foreground">Location: <span className="text-foreground">{quoteTarget?.location || '—'}</span></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Product Cost ($)</Label>
                <Input type="number" placeholder="0.00" value={quoteForm.product_cost} onChange={e => setQuoteForm(p => ({ ...p, product_cost: e.target.value }))} className="bg-card border-border/50" />
              </div>
              <div>
                <Label className="text-xs">Shipping Cost ($)</Label>
                <Input type="number" placeholder="0.00" value={quoteForm.shipping_cost} onChange={e => setQuoteForm(p => ({ ...p, shipping_cost: e.target.value }))} className="bg-card border-border/50" />
              </div>
            </div>
            <div className="p-3 rounded-lg border border-border/50 text-center" style={{ backgroundColor: 'hsl(330 80% 55% / 0.08)' }}>
              <p className="text-xs text-muted-foreground">Total Quote</p>
              <p className="text-2xl font-bold" style={{ color: 'hsl(330 80% 55%)' }}>${totalCalc.toFixed(2)}</p>
            </div>
            {quoteTarget && totalCalc > (quoteTarget.estimated_budget || 0) * 1.2 && (
              <div className="flex items-center gap-2 text-amber-400 text-xs p-2 rounded bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Quote exceeds budget by {Math.round(((totalCalc / (quoteTarget.estimated_budget || 1)) - 1) * 100)}%
              </div>
            )}
            <div>
              <Label className="text-xs">Delivery (days)</Label>
              <Input type="number" value={quoteForm.delivery_days} onChange={e => setQuoteForm(p => ({ ...p, delivery_days: e.target.value }))} className="bg-card border-border/50" />
            </div>
            <div>
              <Label className="text-xs">Internal Notes</Label>
              <Textarea placeholder="Supplier details, margin notes..." value={quoteForm.notes} onChange={e => setQuoteForm(p => ({ ...p, notes: e.target.value }))} className="bg-card border-border/50" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setQuoteOpen(false); setQuoteTarget(null); }}>Cancel</Button>
            <Button disabled={saving || totalCalc <= 0} style={{ backgroundColor: 'hsl(330 80% 55%)', color: 'white' }} onClick={handleCreateQuote}>
              {saving ? 'Creating...' : 'Create Quote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}