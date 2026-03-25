import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function REBuyers() {
  const [buyers, setBuyers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', buyer_type: 'flipper', buy_box_min: '', buy_box_max: '' });
  const { toast } = useToast();

  useEffect(() => { fetchBuyers(); }, []);

  const fetchBuyers = async () => {
    const { data } = await supabase.from('re_buyers').select('*').order('deals_closed', { ascending: false });
    setBuyers(data || []);
  };

  const addBuyer = async () => {
    const { error } = await supabase.from('re_buyers').insert({
      name: form.name, company: form.company, phone: form.phone, email: form.email,
      buyer_type: form.buyer_type as any,
      buy_box_min: parseFloat(form.buy_box_min) || null,
      buy_box_max: parseFloat(form.buy_box_max) || null,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Buyer added' });
    setOpen(false);
    fetchBuyers();
  };

  const typeBadge = (t: string) => {
    const colors: Record<string, string> = { hedge_fund: '#3B6D11', private_equity: '#6366f1', iBuyer: '#0ea5e9', flipper: '#f59e0b', landlord: '#8b5cf6' };
    return <Badge style={{ backgroundColor: colors[t] || undefined }}>{t?.replace(/_/g, ' ')}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#3B6D11' }}>Floor 4 — Hedge Fund Buyer Network</h1>
          <p className="text-muted-foreground">Institutional & cash buyer directory — the money side</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button style={{ backgroundColor: '#3B6D11' }}><Plus className="h-4 w-4 mr-2" />Add Buyer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Buyer</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Company</Label><Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div><Label>Type</Label>
                <Select value={form.buyer_type} onValueChange={v => setForm({ ...form, buyer_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['hedge_fund','private_equity','iBuyer','flipper','landlord','developer','other'].map(t =>
                      <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Min Buy Box ($)</Label><Input value={form.buy_box_min} onChange={e => setForm({ ...form, buy_box_min: e.target.value })} /></div>
                <div><Label>Max Buy Box ($)</Label><Input value={form.buy_box_max} onChange={e => setForm({ ...form, buy_box_max: e.target.value })} /></div>
              </div>
              <Button onClick={addBuyer} className="w-full" style={{ backgroundColor: '#3B6D11' }}>Add Buyer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>States</TableHead>
                <TableHead>Buy Box</TableHead>
                <TableHead>Deals</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buyers.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.company}</TableCell>
                  <TableCell>{typeBadge(b.buyer_type)}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{(b.states || []).join(', ')}</TableCell>
                  <TableCell>${(b.buy_box_min || 0).toLocaleString()} – ${(b.buy_box_max || 0).toLocaleString()}</TableCell>
                  <TableCell>{b.deals_closed || 0} / {b.deals_total || 0}</TableCell>
                  <TableCell><Badge variant={b.status === 'active' ? 'default' : 'secondary'}>{b.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
