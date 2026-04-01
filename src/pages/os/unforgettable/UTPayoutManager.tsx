
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function UTPayoutManager() {
  const qc = useQueryClient();

  const { data: vendorPayments } = useQuery({
    queryKey: ['ut-payouts-vendors'],
    queryFn: async () => {
      const { data } = await (supabase.from('ut_vendor_payments' as any).select('*').in('status', ['ready', 'held']).order('created_at', { ascending: false }) as any);
      return (data || []) as any[];
    },
  });

  const releaseVendor = useMutation({
    mutationFn: async (id: string) => {
      await (supabase.from('ut_vendor_payments' as any).update({ status: 'released', released_at: new Date().toISOString() }).eq('id', id) as any);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-payouts-vendors'] }); toast.success('Payment released'); },
  });

  const pendingAmbassador = 0;
  const pendingVendor = (vendorPayments || []).filter((v: any) => v.status === 'ready').reduce((s: number, v: any) => s + Number(v.amount_owed || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">💸 Payout Manager</h1>
        <p className="text-muted-foreground">All money going out — manage every payment</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-500">${(pendingAmbassador + pendingVendor).toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Pending Payouts</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">${pendingAmbassador.toLocaleString()}</p><p className="text-xs text-muted-foreground">Ambassador Payouts</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">${pendingVendor.toLocaleString()}</p><p className="text-xs text-muted-foreground">Vendor Payouts</p></CardContent></Card>
      </div>

      <Tabs defaultValue="vendors">
        <TabsList><TabsTrigger value="ambassadors">Ambassador Payouts</TabsTrigger><TabsTrigger value="vendors">Vendor Payouts</TabsTrigger></TabsList>

        <TabsContent value="ambassadors">
          <Card>
            <CardHeader><CardTitle>Ambassador Commission Payouts</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Ambassador</TableHead><TableHead>Amount</TableHead><TableHead>Booking</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No ambassador payouts pending</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendors">
          <Card>
            <CardHeader><CardTitle>Vendor Payment Queue</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Vendor</TableHead><TableHead>Amount</TableHead><TableHead>Event Date</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(vendorPayments || []).length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No vendor payouts pending</TableCell></TableRow>
                  ) : (vendorPayments || []).map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.vendor_name}</TableCell>
                      <TableCell>${Number(v.amount_owed || 0).toLocaleString()}</TableCell>
                      <TableCell>{v.event_date}</TableCell>
                      <TableCell><Badge variant={v.status === 'ready' ? 'default' : 'outline'}>{v.status}</Badge></TableCell>
                      <TableCell>{v.status === 'ready' && <Button size="sm" onClick={() => releaseVendor.mutate(v.id)}>Release</Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
