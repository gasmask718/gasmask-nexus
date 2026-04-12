import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pubFetch, pubPatch, pubPost, pubDelete } from '@/lib/publicSiteApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Tag, Plus, Copy, Check, Trash2 } from 'lucide-react';

function KPICard({ label, value, icon: Icon, color = 'text-[#C9A84C]' }: any) {
  return (
    <Card className="bg-[#111111] border-[#C9A84C]/10">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center"><Icon className={`h-5 w-5 ${color}`} /></div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-[#C9A84C]" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast.success('Copied!'); setTimeout(() => setCopied(false), 2000); }}>{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}</Button>;
}

const SERVICE_SCOPES = ['All Services', 'Transportation', 'Aviation', 'Water', 'Chef', 'Nightlife', 'Wellness'];

export default function TTPromoCodes() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newCode, setNewCode] = useState({ code: '', discount_type: 'percentage', discount_value: '', max_uses: '', min_booking_value: '', applicable_to: 'All Services', expires_at: '', description: '' });

  const { data: codes = [], isError } = useQuery({
    queryKey: ['pub-promo-codes'],
    queryFn: () => pubFetch('promo_codes', { order: 'created_at.desc' }),
  });

  const activeCodes = codes.filter((c: any) => c.active !== false && (!c.expires_at || new Date(c.expires_at) > new Date()));
  const totalUses = codes.reduce((s: number, c: any) => s + Number(c.current_uses || 0), 0);
  const now = new Date();
  const expiringSoon = codes.filter((c: any) => c.expires_at && new Date(c.expires_at) > now && (new Date(c.expires_at).getTime() - now.getTime()) < 7 * 86400000).length;

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setNewCode({ ...newCode, code });
  };

  const handleCreate = async () => {
    const data: any = { code: newCode.code.toUpperCase(), discount_type: newCode.discount_type, discount_value: parseFloat(newCode.discount_value) || 0, applicable_to: newCode.applicable_to, active: true, current_uses: 0 };
    if (newCode.max_uses) data.max_uses = parseInt(newCode.max_uses);
    if (newCode.min_booking_value) data.min_booking_value = parseFloat(newCode.min_booking_value);
    if (newCode.expires_at) data.expires_at = newCode.expires_at;
    if (newCode.description) data.description = newCode.description;
    const result = await pubPost('promo_codes', data);
    if (result) { toast.success(`Code ${data.code} created!`); setAddOpen(false); setNewCode({ code: '', discount_type: 'percentage', discount_value: '', max_uses: '', min_booking_value: '', applicable_to: 'All Services', expires_at: '', description: '' }); qc.invalidateQueries({ queryKey: ['pub-promo-codes'] }); }
    else toast.error('Failed to create code.');
  };

  const handleToggle = async (id: string, current: boolean) => {
    const ok = await pubPatch('promo_codes', id, { active: !current });
    if (ok) { toast.success(!current ? 'Activated' : 'Deactivated'); qc.invalidateQueries({ queryKey: ['pub-promo-codes'] }); }
    else toast.error('Update failed.');
  };

  const handleDelete = async (id: string) => {
    const ok = await pubDelete('promo_codes', id);
    if (ok) { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['pub-promo-codes'] }); }
    else toast.error('Delete failed.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Promo Codes</h1><p className="text-white/40 text-sm">Create and manage promotional discount codes</p></div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"><Plus className="h-4 w-4 mr-2" />New Code</Button></DialogTrigger>
          <DialogContent className="bg-[#111111] border-[#C9A84C]/20 text-white max-w-lg">
            <DialogHeader><DialogTitle className="text-[#C9A84C]">Create Promo Code</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-white/60">Code *</Label>
                <div className="flex gap-2"><Input className="bg-[#0A0A0A] border-white/10 text-white uppercase font-mono" value={newCode.code} onChange={e => setNewCode({...newCode, code: e.target.value.toUpperCase()})} /><Button variant="ghost" className="text-[#C9A84C] shrink-0" onClick={generateCode}>Generate</Button></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-white/60">Discount Type *</Label>
                  <Select value={newCode.discount_type} onValueChange={v => setNewCode({...newCode, discount_type: v})}>
                    <SelectTrigger className="bg-[#0A0A0A] border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111111] border-white/10"><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="fixed_amount">Fixed Amount</SelectItem></SelectContent>
                  </Select></div>
                <div><Label className="text-white/60">Value *</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" type="number" value={newCode.discount_value} onChange={e => setNewCode({...newCode, discount_value: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-white/60">Max Uses (0 = unlimited)</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" type="number" value={newCode.max_uses} onChange={e => setNewCode({...newCode, max_uses: e.target.value})} /></div>
                <div><Label className="text-white/60">Min Booking Value</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" type="number" value={newCode.min_booking_value} onChange={e => setNewCode({...newCode, min_booking_value: e.target.value})} /></div>
              </div>
              <div><Label className="text-white/60">Applicable To</Label>
                <Select value={newCode.applicable_to} onValueChange={v => setNewCode({...newCode, applicable_to: v})}>
                  <SelectTrigger className="bg-[#0A0A0A] border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#111111] border-white/10">{SERVICE_SCOPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-white/60">Expires At</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" type="date" value={newCode.expires_at} onChange={e => setNewCode({...newCode, expires_at: e.target.value})} /></div>
              <div><Label className="text-white/60">Internal Note</Label><Textarea className="bg-[#0A0A0A] border-white/10 text-white" value={newCode.description} onChange={e => setNewCode({...newCode, description: e.target.value})} /></div>
              <Button className="w-full bg-[#C9A84C] text-black" onClick={handleCreate}>Create Code</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isError && <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-400 text-sm">Could not load data from public site. Check Settings &gt; Public Site Connection.</div>}

      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Active Codes" value={activeCodes.length} icon={Tag} color="text-emerald-400" />
        <KPICard label="Total Uses" value={totalUses} icon={Tag} />
        <KPICard label="Revenue Discounted" value="—" icon={Tag} />
        <KPICard label="Expiring Soon" value={expiringSoon} icon={Tag} color={expiringSoon > 0 ? 'text-amber-400' : 'text-white/40'} />
      </div>

      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <Table>
          <TableHeader><TableRow className="border-white/5 hover:bg-transparent">
            <TableHead className="text-white/40">Code</TableHead><TableHead className="text-white/40">Discount</TableHead><TableHead className="text-white/40">Type</TableHead><TableHead className="text-white/40">Uses</TableHead><TableHead className="text-white/40">Expires</TableHead><TableHead className="text-white/40">Status</TableHead><TableHead className="text-white/40">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody className="divide-y divide-white/5">
            {codes.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-white/40 py-12">No promo codes found. Click + New Code to create one.</TableCell></TableRow> : codes.map((c: any) => {
              const isExpired = c.expires_at && new Date(c.expires_at) < now;
              const isExpiringSoon = c.expires_at && !isExpired && (new Date(c.expires_at).getTime() - now.getTime()) < 7 * 86400000;
              const isActive = c.active !== false && !isExpired;
              return (
                <TableRow key={c.id} className="border-white/5">
                  <TableCell><div className="flex items-center gap-1"><span className="font-mono text-[#C9A84C] font-bold">{c.code}</span><CopyBtn text={c.code} /></div></TableCell>
                  <TableCell className="text-white font-bold">{c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `$${c.discount_value} OFF`}</TableCell>
                  <TableCell><Badge className="bg-white/5 text-white/60 text-xs">{c.discount_type}</Badge></TableCell>
                  <TableCell className="text-white/60">{c.current_uses || 0}{c.max_uses ? ` / ${c.max_uses}` : ' / ∞'}</TableCell>
                  <TableCell className={`text-sm ${isExpired ? 'text-red-400' : isExpiringSoon ? 'text-amber-400' : 'text-white/40'}`}>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell><Badge className={isActive ? 'bg-emerald-500/20 text-emerald-400' : isExpired ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/40'}>{isExpired ? 'expired' : isActive ? 'active' : 'inactive'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <CopyBtn text={c.code} />
                      <Button size="sm" variant="ghost" className={`h-7 text-xs ${isActive ? 'text-amber-400' : 'text-emerald-400'}`} onClick={() => handleToggle(c.id, c.active !== false)}>{isActive ? 'Deactivate' : 'Activate'}</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-red-400 h-7 text-xs"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                        <AlertDialogContent className="bg-[#111111] border-white/10 text-white">
                          <AlertDialogHeader><AlertDialogTitle>Delete this code?</AlertDialogTitle><AlertDialogDescription className="text-white/40">This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel className="bg-white/5 text-white border-white/10">Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-500 text-white" onClick={() => handleDelete(c.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
