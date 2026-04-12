import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pubFetch, pubPatch } from '@/lib/publicSiteApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Percent, DollarSign, TrendingUp, ArrowDown } from 'lucide-react';

const DEFAULT_RATES = [
  { category: 'luxury_transport', platform_pct: 20, partner_pct: 80, min_fee: 50, max_fee: 500, active: true },
  { category: 'exotic_rental', platform_pct: 25, partner_pct: 75, min_fee: 100, max_fee: 1000, active: true },
  { category: 'helicopter', platform_pct: 20, partner_pct: 80, min_fee: 200, max_fee: 2000, active: true },
  { category: 'private_jet', platform_pct: 15, partner_pct: 85, min_fee: 500, max_fee: 5000, active: true },
  { category: 'yacht_charter', platform_pct: 20, partner_pct: 80, min_fee: 300, max_fee: 3000, active: true },
  { category: 'private_chef', platform_pct: 25, partner_pct: 75, min_fee: 50, max_fee: 500, active: true },
  { category: 'nightlife_vip', platform_pct: 30, partner_pct: 70, min_fee: 100, max_fee: 1000, active: true },
  { category: 'wellness_massage', platform_pct: 25, partner_pct: 75, min_fee: 30, max_fee: 300, active: true },
  { category: 'beauty_services', platform_pct: 25, partner_pct: 75, min_fee: 30, max_fee: 300, active: true },
  { category: 'media_production', platform_pct: 20, partner_pct: 80, min_fee: 100, max_fee: 1000, active: true },
  { category: 'event_space', platform_pct: 20, partner_pct: 80, min_fee: 200, max_fee: 2000, active: true },
  { category: 'luxury_gifting', platform_pct: 30, partner_pct: 70, min_fee: 20, max_fee: 500, active: true },
  { category: 'roses_order', platform_pct: 35, partner_pct: 65, min_fee: 10, max_fee: 200, active: true },
];

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

export default function TTCommissions() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);
  const [editVal, setEditVal] = useState('');
  const [calcAmount, setCalcAmount] = useState('');
  const [calcCategory, setCalcCategory] = useState('luxury_transport');

  const { data: rates = [], isError } = useQuery({
    queryKey: ['pub-commission-rates'],
    queryFn: async () => {
      let data = await pubFetch('commission_rates');
      if (!data.length) data = await pubFetch('commissions');
      if (!data.length) return DEFAULT_RATES;
      return data;
    },
  });

  const isDefault = rates === DEFAULT_RATES;

  const avgPlatform = rates.length > 0 ? Math.round(rates.reduce((s: number, r: any) => s + Number(r.platform_pct || 0), 0) / rates.length) : 0;
  const highest = rates.reduce((best: any, r: any) => (!best || Number(r.platform_pct || 0) > Number(best.platform_pct || 0)) ? r : best, null);
  const lowest = rates.reduce((best: any, r: any) => (!best || Number(r.platform_pct || 0) < Number(best.platform_pct || 0)) ? r : best, null);

  const handleSave = async (row: any, field: string) => {
    if (isDefault || !row.id) { toast.error('Default rates — connect public site to edit.'); setEditing(null); return; }
    const val = parseFloat(editVal);
    if (isNaN(val)) { setEditing(null); return; }
    const updates: Record<string, any> = { [field]: val };
    if (field === 'platform_pct') updates.partner_pct = 100 - val;
    if (field === 'partner_pct') updates.platform_pct = 100 - val;
    const ok = await pubPatch('commission_rates', row.id, updates);
    if (ok) { toast.success('Commission rate updated'); qc.invalidateQueries({ queryKey: ['pub-commission-rates'] }); }
    else toast.error('Update failed. Try again.');
    setEditing(null);
  };

  const selectedRate = rates.find((r: any) => r.category === calcCategory);
  const calcResult = useMemo(() => {
    const amt = parseFloat(calcAmount) || 0;
    const pct = selectedRate ? Number(selectedRate.platform_pct || 0) : 20;
    return { platform: Math.round(amt * pct / 100), partner: Math.round(amt * (100 - pct) / 100), pct, partnerPct: 100 - pct };
  }, [calcAmount, selectedRate]);

  const renderEditable = (row: any, field: string, value: any, prefix = '', suffix = '') => {
    if (editing?.id === (row.id || row.category) && editing?.field === field) {
      return <Input className="w-20 h-7 bg-[#0A0A0A] border-[#C9A84C]/30 text-white text-sm" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => handleSave(row, field)} onKeyDown={e => e.key === 'Enter' && handleSave(row, field)} autoFocus />;
    }
    return <span className="cursor-pointer hover:underline" onClick={() => { setEditing({ id: row.id || row.category, field }); setEditVal(String(value)); }}>{prefix}{value}{suffix}</span>;
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Commission Engine</h1><p className="text-white/40 text-sm">Manage platform commission rates across all service categories</p></div>

      {isError && <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-400 text-sm">Could not load data from public site. Check Settings &gt; Public Site Connection.</div>}
      {isDefault && <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-blue-400 text-sm">Showing default commission rates. Connect public site to load live data.</div>}

      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Avg Platform %" value={`${avgPlatform}%`} icon={Percent} />
        <KPICard label="Commission Earned MTD" value="—" icon={DollarSign} />
        <KPICard label="Highest Category" value={(highest?.category || '—').replace(/_/g, ' ')} icon={TrendingUp} color="text-emerald-400" />
        <KPICard label="Lowest Category" value={(lowest?.category || '—').replace(/_/g, ' ')} icon={ArrowDown} color="text-amber-400" />
      </div>

      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-white/40">Service Category</TableHead>
              <TableHead className="text-white/40">Platform %</TableHead>
              <TableHead className="text-white/40">Partner %</TableHead>
              <TableHead className="text-white/40">Min ($)</TableHead>
              <TableHead className="text-white/40">Max ($)</TableHead>
              <TableHead className="text-white/40">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-white/5">
            {rates.map((r: any) => {
              const pct = Number(r.platform_pct || 0);
              const pctColor = pct >= 20 ? 'text-emerald-400' : pct >= 15 ? 'text-amber-400' : 'text-red-400';
              return (
                <TableRow key={r.id || r.category} className="border-white/5">
                  <TableCell className="text-white font-medium capitalize">{(r.category || '').replace(/_/g, ' ')}</TableCell>
                  <TableCell className={`font-bold ${pctColor}`}>{renderEditable(r, 'platform_pct', r.platform_pct, '', '%')}</TableCell>
                  <TableCell className="text-white/60">{renderEditable(r, 'partner_pct', r.partner_pct, '', '%')}</TableCell>
                  <TableCell className="text-white/60">{renderEditable(r, 'min_fee', r.min_fee, '$')}</TableCell>
                  <TableCell className="text-white/60">{renderEditable(r, 'max_fee', r.max_fee, '$')}</TableCell>
                  <TableCell><Badge className={r.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'}>{r.active ? 'Active' : 'Inactive'}</Badge></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Calculator */}
      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">Commission Calculator</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-white/60">Booking Amount ($)</Label>
              <Input className="bg-[#0A0A0A] border-white/10 text-white mt-1" type="number" value={calcAmount} onChange={e => setCalcAmount(e.target.value)} placeholder="Enter amount" />
            </div>
            <div>
              <Label className="text-white/60">Service Type</Label>
              <Select value={calcCategory} onValueChange={setCalcCategory}>
                <SelectTrigger className="bg-[#0A0A0A] border-white/10 text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#111111] border-white/10">{rates.map((r: any) => <SelectItem key={r.category} value={r.category}>{(r.category || '').replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-6">
              <div>
                <p className="text-white/40 text-xs">Platform earns</p>
                <p className="text-[#C9A84C] text-xl font-bold">${calcResult.platform.toLocaleString()} <span className="text-sm text-white/40">({calcResult.pct}%)</span></p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Partner receives</p>
                <p className="text-emerald-400 text-xl font-bold">${calcResult.partner.toLocaleString()} <span className="text-sm text-white/40">({calcResult.partnerPct}%)</span></p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
