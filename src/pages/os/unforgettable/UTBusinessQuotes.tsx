import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  FileText, DollarSign, CheckCircle, Clock, Search, Truck,
  X, Inbox, Copy, Edit, TrendingUp
} from 'lucide-react';

interface Quote {
  id: string;
  request_id: string;
  product_cost: number;
  shipping_cost: number;
  total_cost: number;
  estimated_delivery_days: number;
  notes: string | null;
  status: string;
  created_at: string;
  request_name?: string;
  request_location?: string;
  request_email?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  quoted: { label: 'Quoted', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  approved: { label: 'Approved', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground border-border' },
};

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied`);
}

export default function UTBusinessQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Quote | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ product_cost: '', shipping_cost: '', delivery_days: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchQuotes = async () => {
    const { data: quotesData } = await supabase.from('ut_business_quotes').select('*').order('created_at', { ascending: false });
    if (quotesData) {
      const requestIds = [...new Set(quotesData.map((q: any) => q.request_id).filter(Boolean))];
      let nameMap: Record<string, { name: string; location: string; email: string }> = {};
      if (requestIds.length > 0) {
        const { data: reqs } = await supabase.from('ut_business_requests').select('id, full_name, location, email').in('id', requestIds);
        reqs?.forEach((r: any) => { nameMap[r.id] = { name: r.full_name, location: r.location, email: r.email }; });
      }
      setQuotes(quotesData.map((q: any) => ({
        ...q,
        request_name: nameMap[q.request_id]?.name || 'Unknown',
        request_location: nameMap[q.request_id]?.location || '—',
        request_email: nameMap[q.request_id]?.email || '',
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
    const channel = supabase
      .channel('ut-biz-quotes-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ut_business_quotes' }, () => fetchQuotes())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => quotes.filter(q => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return [q.request_name, q.request_email, q.id].some(f => f?.toLowerCase().includes(s));
    }
    return true;
  }), [quotes, statusFilter, search]);

  const stats = useMemo(() => ({
    total: quotes.length,
    awaiting: quotes.filter(q => q.status === 'quoted').length,
    approved: quotes.filter(q => q.status === 'approved').length,
    avgValue: quotes.length ? Math.round(quotes.reduce((s, q) => s + (q.total_cost || 0), 0) / quotes.length) : 0,
    pipeline: quotes.filter(q => q.status !== 'closed').reduce((s, q) => s + (q.total_cost || 0), 0),
    avgDays: quotes.length ? Math.round(quotes.reduce((s, q) => s + (q.estimated_delivery_days || 0), 0) / quotes.length) : 0,
  }), [quotes]);

  const updateQuoteStatus = async (id: string, status: string) => {
    await supabase.from('ut_business_quotes').update({ status }).eq('id', id);
    // also update the linked request
    const quote = quotes.find(q => q.id === id);
    if (quote?.request_id) {
      await supabase.from('ut_business_requests').update({ status }).eq('id', quote.request_id);
    }
    toast.success(`Status → ${status}`);
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
    fetchQuotes();
  };

  const openEdit = (q: Quote) => {
    setEditForm({
      product_cost: String(q.product_cost || 0),
      shipping_cost: String(q.shipping_cost || 0),
      delivery_days: String(q.estimated_delivery_days || 14),
      notes: q.notes || '',
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!selected) return;
    setSaving(true);
    const pc = parseFloat(editForm.product_cost) || 0;
    const sc = parseFloat(editForm.shipping_cost) || 0;
    const { error } = await supabase.from('ut_business_quotes').update({
      product_cost: pc,
      shipping_cost: sc,
      total_cost: pc + sc,
      estimated_delivery_days: parseInt(editForm.delivery_days) || 14,
      notes: editForm.notes || null,
    }).eq('id', selected.id);
    if (!error) {
      toast.success('Quote updated');
      setEditOpen(false);
      fetchQuotes();
    } else {
      toast.error(error.message);
    }
    setSaving(false);
  };

  const editTotal = (parseFloat(editForm.product_cost) || 0) + (parseFloat(editForm.shipping_cost) || 0);

  const KPI_CARDS = [
    { label: 'Total Quotes', value: stats.total, icon: FileText, accent: 'hsl(330 80% 55%)' },
    { label: 'Awaiting Approval', value: stats.awaiting, icon: Clock, accent: 'hsl(var(--hud-blue))' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, accent: 'hsl(var(--success))' },
    { label: 'Avg Quote Value', value: `$${stats.avgValue.toLocaleString()}`, icon: DollarSign, accent: 'hsl(var(--hud-amber))' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'hsl(330 80% 55%)' }}>Quotes Manager</h1>
        <p className="text-sm text-muted-foreground">Build landed-cost quotes, review delivery timelines, and manage quote-ready business deals.</p>
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
                <p className="text-2xl font-bold tracking-tight">{typeof k.value === 'number' ? k.value : k.value}</p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Banner */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Revenue Pipeline:</span>
            <span className="text-sm font-bold" style={{ color: 'hsl(330 80% 55%)' }}>${stats.pipeline.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Avg Delivery:</span>
            <span className="text-sm font-semibold">{stats.avgDays} days</span>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search client, email, quote ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border/50" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-card border-border/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
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
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Client</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Location</th>
                  <th className="text-right p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Product</th>
                  <th className="text-right p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Shipping</th>
                  <th className="text-right p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Total</th>
                  <th className="text-center p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Delivery</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Date</th>
                  <th className="text-right p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="p-12 text-center text-muted-foreground">Loading quotes...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center">
                      <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="font-medium text-muted-foreground">No quotes yet</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Create quotes from Business Requests to see them here.</p>
                    </td>
                  </tr>
                ) : filtered.map(q => (
                  <tr key={q.id} className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setSelected(q)}>
                    <td className="p-3">
                      <p className="font-medium">{q.request_name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[140px]">{q.id.slice(0, 8)}…</p>
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{q.request_location}</td>
                    <td className="p-3 text-right">${(q.product_cost || 0).toLocaleString()}</td>
                    <td className="p-3 text-right hidden sm:table-cell text-muted-foreground">${(q.shipping_cost || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-bold" style={{ color: 'hsl(330 80% 55%)' }}>${(q.total_cost || 0).toLocaleString()}</td>
                    <td className="p-3 text-center hidden lg:table-cell">{q.estimated_delivery_days}d</td>
                    <td className="p-3"><Badge variant="outline" className={`text-xs ${STATUS_CONFIG[q.status]?.className || ''}`}>{STATUS_CONFIG[q.status]?.label || q.status}</Badge></td>
                    <td className="p-3 hidden sm:table-cell text-muted-foreground text-xs">{new Date(q.created_at).toLocaleDateString()}</td>
                    <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        {q.status === 'quoted' && (
                          <Button size="sm" className="h-7 text-xs px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" variant="outline" onClick={() => updateQuoteStatus(q.id, 'approved')}>
                            Approve
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <Sheet open={!!selected && !editOpen} onOpenChange={v => { if (!v) setSelected(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Quote for {selected?.request_name}
              {selected && <Badge variant="outline" className={`text-xs ml-auto ${STATUS_CONFIG[selected.status]?.className || ''}`}>{STATUS_CONFIG[selected.status]?.label || selected.status}</Badge>}
            </SheetTitle>
          </SheetHeader>

          {selected && (
            <div className="space-y-5 mt-5">
              {/* Quote Summary */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Quote Summary</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Quote ID</p>
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-mono">{selected.id.slice(0, 12)}…</p>
                      <button onClick={() => copyToClipboard(selected.id, 'Quote ID')} className="text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm">{new Date(selected.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Client</p>
                    <p className="text-sm font-medium">{selected.request_name}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm">{selected.request_location}</p>
                  </div>
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Cost Breakdown */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Cost Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Product Cost</span>
                    <span>${(selected.product_cost || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping Cost</span>
                    <span>${(selected.shipping_cost || 0).toLocaleString()}</span>
                  </div>
                  <Separator className="bg-border/50" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total</span>
                    <span className="text-xl font-bold" style={{ color: 'hsl(330 80% 55%)' }}>${(selected.total_cost || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Estimated delivery: <strong>{selected.estimated_delivery_days} days</strong></span>
                </div>
              </div>

              {selected.notes && (
                <>
                  <Separator className="bg-border/50" />
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Internal Notes</h4>
                    <p className="text-sm bg-muted/30 p-3 rounded-lg border border-border/50">{selected.notes}</p>
                  </div>
                </>
              )}

              <Separator className="bg-border/50" />

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="flex-1" onClick={() => openEdit(selected)}>
                  <Edit className="h-4 w-4 mr-2" /> Edit Quote
                </Button>
                {selected.status === 'quoted' && (
                  <Button className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" variant="outline" onClick={() => updateQuoteStatus(selected.id, 'approved')}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Approve
                  </Button>
                )}
                {selected.status !== 'closed' && (
                  <Button variant="outline" className="flex-1" onClick={() => { updateQuoteStatus(selected.id, 'closed'); setSelected(null); }}>
                    Close Deal
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Quote Modal */}
      <Dialog open={editOpen} onOpenChange={v => { if (!v) setEditOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Quote — {selected?.request_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Product Cost ($)</Label>
                <Input type="number" value={editForm.product_cost} onChange={e => setEditForm(p => ({ ...p, product_cost: e.target.value }))} className="bg-card border-border/50" />
              </div>
              <div>
                <Label className="text-xs">Shipping Cost ($)</Label>
                <Input type="number" value={editForm.shipping_cost} onChange={e => setEditForm(p => ({ ...p, shipping_cost: e.target.value }))} className="bg-card border-border/50" />
              </div>
            </div>
            <div className="p-3 rounded-lg border border-border/50 text-center" style={{ backgroundColor: 'hsl(330 80% 55% / 0.08)' }}>
              <p className="text-xs text-muted-foreground">Updated Total</p>
              <p className="text-2xl font-bold" style={{ color: 'hsl(330 80% 55%)' }}>${editTotal.toFixed(2)}</p>
            </div>
            <div>
              <Label className="text-xs">Delivery (days)</Label>
              <Input type="number" value={editForm.delivery_days} onChange={e => setEditForm(p => ({ ...p, delivery_days: e.target.value }))} className="bg-card border-border/50" />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} className="bg-card border-border/50" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button disabled={saving} style={{ backgroundColor: 'hsl(330 80% 55%)', color: 'white' }} onClick={handleEditSave}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}