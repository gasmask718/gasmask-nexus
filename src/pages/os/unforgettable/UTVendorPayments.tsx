
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { DollarSign } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  held: 'bg-red-500', ready: 'bg-yellow-500', released: 'bg-green-500', cancelled: 'bg-gray-500',
};

export default function UTVendorPayments() {
  const qc = useQueryClient();
  const { data: payments } = useQuery({
    queryKey: ['ut-vendor-payments'],
    queryFn: async () => {
      const { data } = await (supabase.from('ut_vendor_payments' as any).select('*').order('created_at', { ascending: false }) as any);
      return (data || []) as any[];
    },
  });

  const releaseMut = useMutation({
    mutationFn: async (id: string) => {
      await (supabase.from('ut_vendor_payments' as any).update({ status: 'released', released_at: new Date().toISOString() }).eq('id', id) as any);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-vendor-payments'] }); toast.success('Payment released'); },
  });

  const held = (payments || []).filter((p: any) => p.status === 'held');
  const ready = (payments || []).filter((p: any) => p.status === 'ready');
  const released = (payments || []).filter((p: any) => p.status === 'released');

  const totalHeld = held.reduce((s: number, p: any) => s + Number(p.amount_owed || 0), 0);
  const totalReady = ready.reduce((s: number, p: any) => s + Number(p.amount_owed || 0), 0);
  const totalReleased = released.reduce((s: number, p: any) => s + Number(p.amount_owed || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">💰 Vendor Payment Control</h1>
        <p className="text-muted-foreground">All vendor payments are HELD until event completion</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-500">${totalHeld.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Held</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-yellow-500">${totalReady.toLocaleString()}</p><p className="text-xs text-muted-foreground">Ready to Release</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-500">${totalReleased.toLocaleString()}</p><p className="text-xs text-muted-foreground">Released This Month</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">${(totalReleased * 0.43).toLocaleString()}</p><p className="text-xs text-muted-foreground">Margin Retained</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Payment Ledger</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Vendor</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead>
              <TableHead>Event Date</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(payments || []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No vendor payments yet</TableCell></TableRow>
              ) : (payments || []).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.vendor_name}</TableCell>
                  <TableCell>{p.vendor_type}</TableCell>
                  <TableCell>${Number(p.amount_owed || 0).toLocaleString()}</TableCell>
                  <TableCell>{p.event_date}</TableCell>
                  <TableCell><Badge className={`${STATUS_COLORS[p.status] || ''} text-white`}>{p.status}</Badge></TableCell>
                  <TableCell>
                    {p.status === 'ready' && <Button size="sm" onClick={() => releaseMut.mutate(p.id)}>Release</Button>}
                    {p.status === 'held' && <span className="text-xs text-muted-foreground">Awaiting completion</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
