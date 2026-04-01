import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Package } from 'lucide-react';

const PINK = '#E91E8C';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function UTKitOrders() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ customer_name: '', customer_email: '', customer_phone: '', kit_name: '', branding_tier: 'none', total_paid: 0, notes: '' });

  const { data: orders = [] } = useQuery({
    queryKey: ['ut-kit-orders'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_kit_orders' as any).select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase.from('ut_kit_orders' as any).insert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ut-kit-orders'] });
      setAddOpen(false);
      toast.success('Order added');
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('ut_kit_orders').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ut-kit-orders'] });
      toast.success('Status updated');
    },
  });

  const now = new Date();
  const thisMonth = orders.filter(o => new Date(o.created_at).getMonth() === now.getMonth());
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_paid || 0), 0);
  const avgValue = orders.length ? totalRevenue / orders.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: PINK }}>📦 Kit Orders</h1>
          <p className="text-muted-foreground">Track all kit purchases and fulfillment</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add Order</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Kit Order</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Customer Name *</Label><Input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email *</Label><Input value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} /></div>
              </div>
              <div><Label>Kit Name *</Label><Input value={form.kit_name} onChange={e => setForm({ ...form, kit_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Branding Tier</Label>
                  <Select value={form.branding_tier} onValueChange={v => setForm({ ...form, branding_tier: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="private_label">Private Label</SelectItem>
                      <SelectItem value="full_custom">Full Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Total Paid ($)</Label><Input type="number" value={form.total_paid} onChange={e => setForm({ ...form, total_paid: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={() => addMutation.mutate(form)} disabled={!form.customer_name || !form.kit_name}>Save Order</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: orders.length },
          { label: 'This Month', value: thisMonth.length },
          { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}` },
          { label: 'Avg Value', value: `$${avgValue.toFixed(0)}` },
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
                <TableHead>Customer</TableHead>
                <TableHead>Kit</TableHead>
                <TableHead>Branding</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <p className="font-medium text-sm">{o.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{o.customer_email}</p>
                  </TableCell>
                  <TableCell>{o.kit_name}</TableCell>
                  <TableCell><Badge variant="outline">{o.branding_tier}</Badge></TableCell>
                  <TableCell>{o.total_paid ? `$${o.total_paid}` : '—'}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[o.status || 'pending']}>{o.status}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Select onValueChange={v => updateStatus.mutate({ id: o.id, status: v })}>
                      <SelectTrigger className="h-7 text-xs w-auto"><SelectValue placeholder="Status →" /></SelectTrigger>
                      <SelectContent>
                        {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No orders yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
