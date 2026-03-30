import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ClipboardList, DollarSign, CheckCircle, Clock, Search, Eye, FileText } from 'lucide-react';

const PINK = '#E91E8C';

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

const statusColor: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  quoted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

export default function UTBusinessRequests() {
  const [requests, setRequests] = useState<BusinessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReq, setSelectedReq] = useState<BusinessRequest | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
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

  const filtered = requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return r.full_name?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.location?.toLowerCase().includes(s);
    }
    return true;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    quoted: requests.filter(r => r.status === 'quoted').length,
    closed: requests.filter(r => r.status === 'closed').length,
  };

  const handleCreateQuote = async () => {
    if (!selectedReq) return;
    setSaving(true);
    const pc = parseFloat(quoteForm.product_cost) || 0;
    const sc = parseFloat(quoteForm.shipping_cost) || 0;
    const { error } = await supabase.from('ut_business_quotes').insert({
      request_id: selectedReq.id,
      product_cost: pc,
      shipping_cost: sc,
      total_cost: pc + sc,
      estimated_delivery_days: parseInt(quoteForm.delivery_days) || 14,
      notes: quoteForm.notes || null,
    });
    if (!error) {
      await supabase.from('ut_business_requests').update({ status: 'quoted' }).eq('id', selectedReq.id);
      toast.success('Quote created & request updated to "quoted"');
      setQuoteOpen(false);
      setQuoteForm({ product_cost: '', shipping_cost: '', delivery_days: '14', notes: '' });
      fetchRequests();
    } else {
      toast.error(error.message);
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('ut_business_requests').update({ status }).eq('id', id);
    toast.success(`Status updated to "${status}"`);
    fetchRequests();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: PINK }}>Floor 5 — Business Requests</h1>
        <p className="text-sm text-muted-foreground">Incoming business owner requests from /start-business</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', value: stats.total, icon: ClipboardList, color: PINK },
          { label: 'Pending', value: stats.pending, icon: Clock, color: '#F59E0B' },
          { label: 'Quoted', value: stats.quoted, icon: FileText, color: '#3B82F6' },
          { label: 'Closed Deals', value: stats.closed, icon: CheckCircle, color: '#10B981' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: s.color + '20' }}>
                <s.icon className="h-5 w-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, email, location..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="quoted">Quoted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Location</th>
                  <th className="text-left p-3 font-medium">Budget</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No requests found</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedReq(r)}>
                    <td className="p-3 font-medium">{r.full_name}</td>
                    <td className="p-3 text-muted-foreground">{r.email || '—'}</td>
                    <td className="p-3">{r.location || '—'}</td>
                    <td className="p-3">${r.estimated_budget?.toLocaleString() || '0'}</td>
                    <td className="p-3"><Badge className={statusColor[r.status] || ''}>{r.status}</Badge></td>
                    <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSelectedReq(r)}><Eye className="h-3 w-3" /></Button>
                        {r.status === 'pending' && (
                          <Button size="sm" style={{ backgroundColor: PINK, color: 'white' }} onClick={() => { setSelectedReq(r); setQuoteOpen(true); }}>
                            Quote
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

      {/* Detail Modal */}
      <Dialog open={!!selectedReq && !quoteOpen} onOpenChange={v => { if (!v) setSelectedReq(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request from {selectedReq?.full_name}</DialogTitle>
          </DialogHeader>
          {selectedReq && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Email:</span> {selectedReq.email || '—'}</div>
                <div><span className="text-muted-foreground">Phone:</span> {selectedReq.phone || '—'}</div>
                <div><span className="text-muted-foreground">Location:</span> {selectedReq.location || '—'}</div>
                <div><span className="text-muted-foreground">Budget:</span> ${selectedReq.estimated_budget?.toLocaleString()}</div>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Selected Items:</p>
                <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(selectedReq.selected_items, null, 2)}
                </pre>
              </div>
              {selectedReq.notes && <div><span className="text-muted-foreground">Notes:</span> {selectedReq.notes}</div>}
              <Badge className={statusColor[selectedReq.status] || ''}>{selectedReq.status}</Badge>
            </div>
          )}
          <DialogFooter className="gap-2">
            {selectedReq?.status === 'pending' && (
              <Button style={{ backgroundColor: PINK, color: 'white' }} onClick={() => setQuoteOpen(true)}>Create Quote</Button>
            )}
            {selectedReq?.status === 'quoted' && (
              <Button variant="outline" onClick={() => updateStatus(selectedReq.id, 'approved')}>Mark Approved</Button>
            )}
            {selectedReq?.status !== 'closed' && (
              <Button variant="secondary" onClick={() => { updateStatus(selectedReq!.id, 'closed'); setSelectedReq(null); }}>Close Deal</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quote Creation Modal */}
      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Quote for {selectedReq?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Product Cost ($)</Label>
                <Input type="number" value={quoteForm.product_cost} onChange={e => setQuoteForm(p => ({ ...p, product_cost: e.target.value }))} />
              </div>
              <div>
                <Label>Shipping Cost ($)</Label>
                <Input type="number" value={quoteForm.shipping_cost} onChange={e => setQuoteForm(p => ({ ...p, shipping_cost: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Total: ${((parseFloat(quoteForm.product_cost) || 0) + (parseFloat(quoteForm.shipping_cost) || 0)).toFixed(2)}</Label>
            </div>
            <div>
              <Label>Estimated Delivery (days)</Label>
              <Input type="number" value={quoteForm.delivery_days} onChange={e => setQuoteForm(p => ({ ...p, delivery_days: e.target.value }))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={quoteForm.notes} onChange={e => setQuoteForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteOpen(false)}>Cancel</Button>
            <Button disabled={saving} style={{ backgroundColor: PINK, color: 'white' }} onClick={handleCreateQuote}>
              {saving ? 'Saving...' : 'Create Quote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
