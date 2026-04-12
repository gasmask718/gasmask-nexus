import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, patchTopTierData, postTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DollarSign, Plus, Calculator, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function TTPricing() {
  const queryClient = useQueryClient();
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [calcDistance, setCalcDistance] = useState('10');
  const [calcCategory, setCalcCategory] = useState('Sedan');
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [newRule, setNewRule] = useState({ vehicle_category: '', base_rate: '', per_mile_rate: '', minimum_fare: '', per_hour_rate: '', surge_multiplier: '1.0' });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['tt-pricing-rules'],
    queryFn: () => fetchTopTierData('tt_pricing_rules', { select: '*', order: 'vehicle_category.asc' }),
  });

  const { data: bookings } = useQuery({
    queryKey: ['tt-pricing-kpis'],
    queryFn: () => fetchTopTierData('tt_bookings', { select: 'total_price', filters: { 'payment_status': 'eq.paid' } }),
  });

  const kpis = useMemo(() => {
    if (!bookings?.length) return { avg: 0, total: 0, count: 0 };
    const total = bookings.reduce((s: number, b: any) => s + Number(b.total_price), 0);
    return { avg: Math.round(total / bookings.length), total, count: bookings.length };
  }, [bookings]);

  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      await patchTopTierData('tt_pricing_rules', { 'id': `eq.${id}` }, { [field]: value });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tt-pricing-rules'] }); toast.success('Updated'); },
  });

  const createRule = useMutation({
    mutationFn: async () => {
      await postTopTierData('tt_pricing_rules', {
        vehicle_category: newRule.vehicle_category,
        base_rate: parseFloat(newRule.base_rate),
        per_mile_rate: parseFloat(newRule.per_mile_rate),
        minimum_fare: parseFloat(newRule.minimum_fare),
        per_hour_rate: newRule.per_hour_rate ? parseFloat(newRule.per_hour_rate) : null,
        surge_multiplier: parseFloat(newRule.surge_multiplier),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-pricing-rules'] });
      setNewRuleOpen(false);
      setNewRule({ vehicle_category: '', base_rate: '', per_mile_rate: '', minimum_fare: '', per_hour_rate: '', surge_multiplier: '1.0' });
      toast.success('Rule created');
    },
  });

  const handleCellClick = (id: string, field: string, value: any) => {
    setEditingCell({ id, field });
    setEditValue(String(value ?? ''));
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    updateField.mutate({ id: editingCell.id, field: editingCell.field, value: parseFloat(editValue) || editValue });
    setEditingCell(null);
  };

  const calculatePrice = async () => {
    setCalcLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tt-calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ vehicle_category: calcCategory, distance_miles: parseFloat(calcDistance), pickup_datetime: new Date().toISOString() }),
      });
      setCalcResult(await res.json());
    } catch { toast.error('Calculation failed'); }
    setCalcLoading(false);
  };

  const EditableCell = ({ id, field, value, prefix = '' }: { id: string; field: string; value: any; prefix?: string }) => {
    const isEditing = editingCell?.id === id && editingCell?.field === field;
    if (isEditing) {
      return (
        <Input value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={handleCellSave} onKeyDown={e => e.key === 'Enter' && handleCellSave()}
          autoFocus className="w-24 h-7 text-sm bg-white/10 border-[#C9A84C]/30 text-white" />
      );
    }
    return (
      <span className="cursor-pointer hover:text-[#C9A84C] transition-colors" onClick={() => handleCellClick(id, field, value)}>
        {prefix}{Number(value).toFixed(2)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white/90">Pricing Engine</h1>
        <Dialog open={newRuleOpen} onOpenChange={setNewRuleOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#C9A84C] text-black hover:bg-[#B8973B]"><Plus className="h-4 w-4 mr-2" />Add Rule</Button>
          </DialogTrigger>
          <DialogContent className="bg-[#111111] border-[#C9A84C]/20 text-white">
            <DialogHeader><DialogTitle>New Pricing Rule</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Vehicle Category</Label><Input value={newRule.vehicle_category} onChange={e => setNewRule(p => ({ ...p, vehicle_category: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Base Rate ($)</Label><Input value={newRule.base_rate} onChange={e => setNewRule(p => ({ ...p, base_rate: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
                <div><Label>Per Mile ($)</Label><Input value={newRule.per_mile_rate} onChange={e => setNewRule(p => ({ ...p, per_mile_rate: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
                <div><Label>Minimum ($)</Label><Input value={newRule.minimum_fare} onChange={e => setNewRule(p => ({ ...p, minimum_fare: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
                <div><Label>Hourly ($)</Label><Input value={newRule.per_hour_rate} onChange={e => setNewRule(p => ({ ...p, per_hour_rate: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
              </div>
              <div><Label>Surge Multiplier</Label><Input value={newRule.surge_multiplier} onChange={e => setNewRule(p => ({ ...p, surge_multiplier: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
              <Button onClick={() => createRule.mutate()} className="w-full bg-[#C9A84C] text-black">Create Rule</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-5">
          <DollarSign className="h-5 w-5 text-[#C9A84C] mb-2" />
          <p className="text-2xl font-bold text-[#C9A84C]">${kpis.avg.toLocaleString()}</p>
          <p className="text-xs text-white/40">Avg Booking Value</p>
        </CardContent></Card>
        <Card className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-5">
          <TrendingUp className="h-5 w-5 text-[#C9A84C] mb-2" />
          <p className="text-2xl font-bold text-[#C9A84C]">${kpis.total.toLocaleString()}</p>
          <p className="text-xs text-white/40">Total Revenue (Paid)</p>
        </CardContent></Card>
        <Card className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-5">
          <Calculator className="h-5 w-5 text-[#C9A84C] mb-2" />
          <p className="text-2xl font-bold text-white/90">{rules?.length || 0}</p>
          <p className="text-xs text-white/40">Active Rules</p>
        </CardContent></Card>
      </div>

      <Card className="bg-[#111111] border-[#C9A84C]/10 overflow-hidden">
        <CardHeader><CardTitle className="text-base text-white/70">Pricing Rules — Click any value to edit</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/5">
                <tr>
                  {['Category', 'Base Rate', 'Per Mile', 'Min Fare', 'Hourly', 'Surge', 'Active'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? Array(3).fill(0).map((_, i) => <tr key={i}><td colSpan={7} className="p-4"><Skeleton className="h-8 bg-white/5" /></td></tr>) :
                  (rules || []).map((r: any) => (
                    <tr key={r.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-sm font-medium text-white/80">{r.vehicle_category}</td>
                      <td className="px-4 py-3 text-sm text-[#C9A84C]"><EditableCell id={r.id} field="base_rate" value={r.base_rate} prefix="$" /></td>
                      <td className="px-4 py-3 text-sm text-white/70"><EditableCell id={r.id} field="per_mile_rate" value={r.per_mile_rate} prefix="$" /></td>
                      <td className="px-4 py-3 text-sm text-white/70"><EditableCell id={r.id} field="minimum_fare" value={r.minimum_fare} prefix="$" /></td>
                      <td className="px-4 py-3 text-sm text-white/70"><EditableCell id={r.id} field="per_hour_rate" value={r.per_hour_rate} prefix="$" /></td>
                      <td className="px-4 py-3 text-sm text-white/70"><EditableCell id={r.id} field="surge_multiplier" value={r.surge_multiplier} /></td>
                      <td className="px-4 py-3">
                        <Switch checked={r.is_active} onCheckedChange={(v) => updateField.mutate({ id: r.id, field: 'is_active', value: v })} />
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <CardHeader><CardTitle className="text-base text-white/70 flex items-center gap-2"><Calculator className="h-4 w-4 text-[#C9A84C]" />Price Calculator</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-white/50">Distance (miles)</Label>
              <Input value={calcDistance} onChange={e => setCalcDistance(e.target.value)} className="w-32 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/50">Vehicle</Label>
              <select value={calcCategory} onChange={e => setCalcCategory(e.target.value)} className="h-10 rounded-md border border-white/10 bg-white/5 text-white px-3">
                {(rules || []).map((r: any) => <option key={r.id} value={r.vehicle_category}>{r.vehicle_category}</option>)}
              </select>
            </div>
            <Button onClick={calculatePrice} disabled={calcLoading} className="bg-[#C9A84C] text-black hover:bg-[#B8973B]">Calculate</Button>
          </div>
          {calcResult && (
            <div className="mt-4 grid grid-cols-4 gap-3">
              {[
                { label: 'Base Rate', value: `$${calcResult.base_rate}` },
                { label: 'Distance Cost', value: `$${(calcResult.distance_miles * calcResult.per_mile_rate).toFixed(2)}` },
                { label: 'Surge', value: `${calcResult.surge_multiplier}x` },
                { label: 'Estimated Total', value: `$${calcResult.estimated_total}`, gold: true },
              ].map(m => (
                <div key={m.label} className="bg-white/5 rounded-lg p-3">
                  <p className="text-[10px] text-white/40 uppercase">{m.label}</p>
                  <p className={`text-lg font-bold ${m.gold ? 'text-[#C9A84C]' : 'text-white/80'}`}>{m.value}</p>
                </div>
              ))}
              {calcResult.minimum_applied && <Badge className="bg-amber-500/20 text-amber-400 w-fit">Minimum fare applied</Badge>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
