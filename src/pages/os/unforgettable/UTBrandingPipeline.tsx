import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Download, CheckCircle, XCircle, Upload } from 'lucide-react';

const PINK = '#E91E8C';

const SAMPLE_STATUSES: Record<string, { label: string; color: string }> = {
  pending: { label: '⚪ Pending', color: 'bg-gray-100 text-gray-700' },
  sent_to_supplier: { label: '🔵 Sent to Supplier', color: 'bg-blue-100 text-blue-700' },
  sample_received: { label: '📦 Sample Received', color: 'bg-orange-100 text-orange-700' },
  approved: { label: '✅ Approved', color: 'bg-green-100 text-green-700' },
  rejected: { label: '❌ Rejected', color: 'bg-red-100 text-red-700' },
  revision_requested: { label: '🔄 Revision Requested', color: 'bg-yellow-100 text-yellow-700' },
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', in_production: 'In Production', completed: 'Completed', cancelled: 'Cancelled',
};

export default function UTBrandingPipeline() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', product_name: '', product_category: '', logo_placement: '', packaging_type: '', insert_type: '', branding_fee: 0, moq: 0, notes: '' });

  const { data: requests = [] } = useQuery({
    queryKey: ['ut-branding-requests'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_branding_requests' as any).select('*, ut_suppliers(name)').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['ut-suppliers-list'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_suppliers' as any).select('id, name');
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase.from('ut_branding_requests' as any).insert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ut-branding-requests'] });
      setAddOpen(false);
      toast.success('Branding request created');
    },
  });

  const updateRequest = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from('ut_branding_requests').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ut-branding-requests'] });
      toast.success('Updated');
    },
  });

  const stats = {
    draft: requests.filter(r => r.status === 'draft').length,
    sent: requests.filter(r => r.status === 'sent').length,
    samplePending: requests.filter(r => ['pending', 'sent_to_supplier', 'sample_received'].includes(r.sample_status || '')).length,
    approved: requests.filter(r => r.sample_status === 'approved').length,
    inProduction: requests.filter(r => r.status === 'in_production').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: PINK }}>📋 Branding Pipeline</h1>
          <p className="text-muted-foreground">Track every product being manufactured with UT branding</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New Branding Request</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Branding Request</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Supplier *</Label>
                  <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Product Name *</Label><Input value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} /></div>
                <div><Label>Product Category</Label><Input value={form.product_category} onChange={e => setForm({ ...form, product_category: e.target.value })} /></div>
                <div>
                  <Label>Logo Placement</Label>
                  <Select value={form.logo_placement} onValueChange={v => setForm({ ...form, logo_placement: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{['front', 'back', 'side', 'top', 'custom'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Branding Fee ($)</Label><Input type="number" value={form.branding_fee} onChange={e => setForm({ ...form, branding_fee: Number(e.target.value) })} /></div>
                  <div><Label>MOQ</Label><Input type="number" value={form.moq} onChange={e => setForm({ ...form, moq: Number(e.target.value) })} /></div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                <Button onClick={() => addMutation.mutate(form)} disabled={!form.product_name || !form.supplier_id}>Submit Request</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline"><Download className="h-4 w-4 mr-1" /> Export</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'In Draft', value: stats.draft },
          { label: 'Sent to Supplier', value: stats.sent },
          { label: 'Sample Pending', value: stats.samplePending },
          { label: 'Approved', value: stats.approved },
          { label: 'In Production', value: stats.inProduction },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Sample Status</TableHead>
                <TableHead>Branding Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.product_name}</TableCell>
                  <TableCell>{r.ut_suppliers?.name || '—'}</TableCell>
                  <TableCell>{r.product_category || '—'}</TableCell>
                  <TableCell>
                    <Badge className={SAMPLE_STATUSES[r.sample_status || 'pending']?.color || ''}>
                      {SAMPLE_STATUSES[r.sample_status || 'pending']?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.branding_fee ? `$${r.branding_fee}` : '—'}</TableCell>
                  <TableCell><Badge variant="outline">{STATUS_LABELS[r.status || 'draft']}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {r.sample_status === 'sample_received' && (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600" onClick={() => updateRequest.mutate({ id: r.id, updates: { sample_status: 'approved' } })}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => updateRequest.mutate({ id: r.id, updates: { sample_status: 'revision_requested' } })}>
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      <Select onValueChange={v => updateRequest.mutate({ id: r.id, updates: { sample_status: v } })}>
                        <SelectTrigger className="h-7 text-xs w-auto"><SelectValue placeholder="Sample →" /></SelectTrigger>
                        <SelectContent>{Object.entries(SAMPLE_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No branding requests yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
