import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, postTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Building2, Plus, DollarSign, Users } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function TTCorporate() {
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [form, setForm] = useState({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', billing_email: '', credit_limit: '10000', payment_terms: 'net_30' });

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['tt-corporate-accounts'],
    queryFn: () => fetchTopTierData('tt_corporate_accounts', { select: '*', order: 'created_at.desc' }),
  });

  // Get bookings for selected corporate (by matching company name in notes for now)
  const { data: corpBookings } = useQuery({
    queryKey: ['tt-corp-bookings', selectedAccount?.id],
    enabled: !!selectedAccount,
    queryFn: () => fetchTopTierData('tt_bookings', {
      select: '*',
      filters: { 'client_name': `ilike.*${selectedAccount?.company_name}*` },
      order: 'created_at.desc',
      limit: 20,
    }),
  });

  const createAccount = useMutation({
    mutationFn: async () => {
      await postTopTierData('tt_corporate_accounts', {
        ...form,
        credit_limit: parseFloat(form.credit_limit),
        current_balance: 0,
        account_status: 'active',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-corporate-accounts'] });
      setNewOpen(false);
      setForm({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', billing_email: '', credit_limit: '10000', payment_terms: 'net_30' });
      toast.success('Corporate account created');
    },
  });

  const statusColor = (s: string) => s === 'active' ? 'bg-emerald-500/20 text-emerald-400' : s === 'suspended' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white/90 flex items-center gap-2"><Building2 className="h-6 w-6 text-[#C9A84C]" />Corporate Accounts</h1>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#C9A84C] text-black hover:bg-[#B8973B]"><Plus className="h-4 w-4 mr-2" />New Account</Button>
          </DialogTrigger>
          <DialogContent className="bg-[#111111] border-[#C9A84C]/20 text-white">
            <DialogHeader><DialogTitle>New Corporate Account</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Company Name</Label><Input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contact Name</Label><Input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
                <div><Label>Contact Email</Label><Input value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
                <div><Label>Contact Phone</Label><Input value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
                <div><Label>Billing Email</Label><Input value={form.billing_email} onChange={e => setForm(p => ({ ...p, billing_email: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Credit Limit ($)</Label><Input value={form.credit_limit} onChange={e => setForm(p => ({ ...p, credit_limit: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
                <div><Label>Payment Terms</Label>
                  <select value={form.payment_terms} onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))} className="w-full h-10 rounded-md border border-white/10 bg-white/5 text-white px-3">
                    <option value="net_15">Net 15</option>
                    <option value="net_30">Net 30</option>
                    <option value="net_45">Net 45</option>
                    <option value="net_60">Net 60</option>
                  </select>
                </div>
              </div>
              <Button onClick={() => createAccount.mutate()} className="w-full bg-[#C9A84C] text-black" disabled={!form.company_name || !form.contact_name || !form.contact_email}>Create Account</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-5">
          <Building2 className="h-5 w-5 text-[#C9A84C] mb-2" />
          <p className="text-2xl font-bold text-white/90">{accounts?.length || 0}</p>
          <p className="text-xs text-white/40">Total Accounts</p>
        </CardContent></Card>
        <Card className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-5">
          <Users className="h-5 w-5 text-emerald-400 mb-2" />
          <p className="text-2xl font-bold text-emerald-400">{accounts?.filter((a: any) => a.account_status === 'active').length || 0}</p>
          <p className="text-xs text-white/40">Active</p>
        </CardContent></Card>
        <Card className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-5">
          <DollarSign className="h-5 w-5 text-amber-400 mb-2" />
          <p className="text-2xl font-bold text-amber-400">${(accounts || []).reduce((s: number, a: any) => s + Number(a.current_balance || 0), 0).toLocaleString()}</p>
          <p className="text-xs text-white/40">Outstanding Balance</p>
        </CardContent></Card>
      </div>

      <Card className="bg-[#111111] border-[#C9A84C]/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/5"><tr>
              {['Company', 'Contact', 'Credit Limit', 'Balance', 'Terms', 'Status', 'Created'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs text-white/40 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? Array(3).fill(0).map((_, i) => <tr key={i}><td colSpan={7} className="p-3"><Skeleton className="h-8 bg-white/5" /></td></tr>) :
                (accounts || []).map((a: any) => (
                  <tr key={a.id} className="hover:bg-white/[0.02] cursor-pointer" onClick={() => setSelectedAccount(a)}>
                    <td className="px-4 py-3 text-sm font-medium text-white/80">{a.company_name}</td>
                    <td className="px-4 py-3 text-xs text-white/60">{a.contact_name}<br /><span className="text-white/40">{a.contact_email}</span></td>
                    <td className="px-4 py-3 text-sm text-[#C9A84C]">${Number(a.credit_limit).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-white/70">${Number(a.current_balance).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-white/60">{a.payment_terms?.replace('_', ' ')}</td>
                    <td className="px-4 py-3"><Badge className={`text-[10px] ${statusColor(a.account_status)}`}>{a.account_status}</Badge></td>
                    <td className="px-4 py-3 text-xs text-white/40">{format(new Date(a.created_at), 'MMM d, yyyy')}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </Card>

      <Sheet open={!!selectedAccount} onOpenChange={(o) => !o && setSelectedAccount(null)}>
        <SheetContent className="bg-[#111111] border-l border-[#C9A84C]/10 text-white w-[500px] sm:max-w-[500px]">
          {selectedAccount && (
            <>
              <SheetHeader><SheetTitle className="text-[#C9A84C]">{selectedAccount.company_name}</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Contact', value: selectedAccount.contact_name },
                    { label: 'Email', value: selectedAccount.contact_email },
                    { label: 'Phone', value: selectedAccount.contact_phone || '—' },
                    { label: 'Credit Limit', value: `$${Number(selectedAccount.credit_limit).toLocaleString()}` },
                    { label: 'Balance', value: `$${Number(selectedAccount.current_balance).toLocaleString()}` },
                    { label: 'Terms', value: selectedAccount.payment_terms?.replace('_', ' ') },
                  ].map(f => (
                    <div key={f.label} className="bg-white/5 rounded-lg p-3">
                      <p className="text-[10px] text-white/40 uppercase">{f.label}</p>
                      <p className="text-sm text-white/80">{f.value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#C9A84C] mb-3">Recent Bookings</h3>
                  {!corpBookings?.length ? <p className="text-sm text-white/30">No bookings found</p> :
                    corpBookings.map((b: any) => (
                      <div key={b.id} className="bg-white/5 rounded-lg p-3 mb-2 flex justify-between">
                        <div>
                          <p className="text-sm text-white/80">{b.service_name}</p>
                          <p className="text-xs text-white/40">{format(new Date(b.created_at), 'MMM d, yyyy')}</p>
                        </div>
                        <p className="text-sm font-semibold text-[#C9A84C]">${Number(b.total_price).toLocaleString()}</p>
                      </div>
                    ))
                  }
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
