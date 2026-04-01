import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Package, Truck, ShieldCheck, CheckCircle, Copy, ExternalLink, AlertTriangle, DollarSign, Calculator } from 'lucide-react';

const CARRIERS = ['DHL', 'FedEx', 'UPS', 'Alibaba', 'Sea Freight', 'Air Freight', 'Local Delivery'];
const STATUS_COLS = [
  { key: 'in_transit', label: '📦 In Transit', icon: Package, color: 'bg-blue-500/10 border-blue-500/20' },
  { key: 'at_customs', label: '🛃 At Customs', icon: ShieldCheck, color: 'bg-yellow-500/10 border-yellow-500/20' },
  { key: 'out_for_delivery', label: '🚚 Out for Delivery', icon: Truck, color: 'bg-orange-500/10 border-orange-500/20' },
  { key: 'delivered', label: '✅ Delivered', icon: CheckCircle, color: 'bg-green-500/10 border-green-500/20' },
];

const CHECKLIST = [
  'Count items matches invoice?',
  'No damage to packaging?',
  'Logo applied correctly?',
  'Color matches brand kit?',
  'Insert cards included?',
  'Quality acceptable?',
];

// Duty rates by category (Section 301 included for China)
const DUTY_RATES: Record<string, number> = {
  'Textiles': 0.20, 'Furniture': 0.07, 'Electronics': 0.05,
  'Lighting': 0.10, 'Decorations': 0.12, 'Tableware': 0.08,
  'General': 0.10,
};

export default function UTShippingTracker() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showLandedCost, setShowLandedCost] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [checklistState, setChecklistState] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [newShipment, setNewShipment] = useState({ supplier_name: '', product_name: '', quantity: 0, tracking_number: '', carrier: '', shipping_method: '', ship_date: '', estimated_arrival: '', freight_forwarder: '', total_cost: 0, notes: '' });

  // Landed cost calculator state
  const [lcProductCost, setLcProductCost] = useState(0);
  const [lcQuantity, setLcQuantity] = useState(100);
  const [lcShippingCost, setLcShippingCost] = useState(0);
  const [lcCategory, setLcCategory] = useState('General');
  const [lcFromChina, setLcFromChina] = useState(true);

  const { data: shipments = [] } = useQuery({
    queryKey: ['ut-shipments'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_shipments' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    }
  });

  const { data: shippingQuotes = [] } = useQuery({
    queryKey: ['ut-shipping-quotes-tracker'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_shipping_quotes' as any).select('*').order('cost', { ascending: true });
      return (data || []) as any[];
    }
  });

  const addShipment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ut_shipments' as any).insert(newShipment);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ut-shipments'] }); setShowAddModal(false); toast.success('Shipment added'); }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, actual_arrival }: { id: string; status: string; actual_arrival?: string }) => {
      const update: any = { status };
      if (actual_arrival) update.actual_arrival = actual_arrival;
      const { error } = await supabase.from('ut_shipments' as any).update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ut-shipments'] }); toast.success('Status updated'); }
  });

  // Landed Cost Calculations
  const dutyRate = DUTY_RATES[lcCategory] || 0.10;
  const section301 = lcFromChina ? 0.25 : 0;
  const totalProductCost = lcProductCost * lcQuantity;
  const dutyAmount = totalProductCost * dutyRate;
  const tariffAmount = totalProductCost * section301;
  const mpfRaw = totalProductCost * 0.003464;
  const mpfAmount = Math.min(Math.max(mpfRaw, 31.67), 614.35);
  const totalLandedCost = totalProductCost + lcShippingCost + dutyAmount + tariffAmount + mpfAmount;
  const perUnitLanded = lcQuantity > 0 ? totalLandedCost / lcQuantity : 0;

  const getDaysInfo = (s: any) => {
    if (s.status === 'delivered') return { text: 'Delivered', color: 'text-green-400' };
    if (!s.estimated_arrival) return { text: 'No ETA', color: 'text-muted-foreground' };
    const diff = Math.ceil((new Date(s.estimated_arrival).getTime() - Date.now()) / 86400000);
    if (diff > 0) return { text: `${diff}d left`, color: 'text-green-400' };
    if (diff === 0) return { text: 'Due today', color: 'text-yellow-400' };
    return { text: `⚠️ ${Math.abs(diff)}d overdue`, color: 'text-red-400' };
  };

  const getTrackingUrl = (carrier: string, tracking: string) => {
    const urls: Record<string, string> = { DHL: `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}`, FedEx: `https://www.fedex.com/fedextrack/?trknbr=${tracking}`, UPS: `https://www.ups.com/track?tracknum=${tracking}` };
    return urls[carrier] || `https://www.google.com/search?q=${tracking}+tracking`;
  };

  const handleChecklistComplete = (allGood: boolean) => {
    if (allGood) {
      updateStatus.mutate({ id: selectedShipment.id, status: 'delivered', actual_arrival: new Date().toISOString().split('T')[0] });
      toast.success('Shipment marked as delivered ✅');
    } else {
      toast.error('Issue flagged — review required 🚩');
    }
    setShowChecklist(false);
    setChecklistState(CHECKLIST.map(() => false));
  };

  const upcoming = shipments.filter((s: any) => {
    if (s.status === 'delivered') return false;
    if (!s.estimated_arrival) return false;
    const diff = (new Date(s.estimated_arrival).getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= 14;
  }).sort((a: any, b: any) => new Date(a.estimated_arrival).getTime() - new Date(b.estimated_arrival).getTime());

  // Group quotes by method for comparison
  const airQuotes = shippingQuotes.filter((q: any) => q.method === 'air');
  const seaQuotes = shippingQuotes.filter((q: any) => q.method === 'sea');
  const expressQuotes = shippingQuotes.filter((q: any) => q.method === 'express');

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📦 Shipping Tracker</h1>
          <p className="text-muted-foreground">Track shipments & calculate landed costs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowLandedCost(true)}>
            <Calculator className="mr-2 h-4 w-4" /> Landed Cost Calculator
          </Button>
          <Button onClick={() => setShowAddModal(true)}><Plus className="mr-2 h-4 w-4" />Add Shipment</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {STATUS_COLS.map(col => (
          <Card key={col.key}><CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{shipments.filter((s: any) => s.status === col.key).length}</p>
            <p className="text-sm text-muted-foreground">{col.label}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Shipping Method Comparison */}
      {shippingQuotes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Shipping Method Comparison</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-blue-500/30">
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl mb-1">✈️</p>
                  <p className="font-bold">Air Freight</p>
                  {airQuotes.length > 0 ? (
                    <>
                      <p className="text-xl font-bold mt-2">${Math.min(...airQuotes.map((q: any) => q.cost || 0)).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">cheapest · {Math.min(...airQuotes.map((q: any) => q.days || 99))} days</p>
                      <Badge className="mt-2 bg-blue-500/20 text-blue-400">⚖️ Balanced</Badge>
                    </>
                  ) : <p className="text-xs text-muted-foreground mt-2">No quotes</p>}
                </CardContent>
              </Card>
              <Card className="border-green-500/30">
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl mb-1">🚢</p>
                  <p className="font-bold">Sea Freight</p>
                  {seaQuotes.length > 0 ? (
                    <>
                      <p className="text-xl font-bold mt-2">${Math.min(...seaQuotes.map((q: any) => q.cost || 0)).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">cheapest · {Math.min(...seaQuotes.map((q: any) => q.days || 99))} days</p>
                      <Badge className="mt-2 bg-green-500/20 text-green-400">💰 Best Value</Badge>
                    </>
                  ) : <p className="text-xs text-muted-foreground mt-2">No quotes</p>}
                </CardContent>
              </Card>
              <Card className="border-orange-500/30">
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl mb-1">⚡</p>
                  <p className="font-bold">Express</p>
                  {expressQuotes.length > 0 ? (
                    <>
                      <p className="text-xl font-bold mt-2">${Math.min(...expressQuotes.map((q: any) => q.cost || 0)).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">cheapest · {Math.min(...expressQuotes.map((q: any) => q.days || 99))} days</p>
                      <Badge className="mt-2 bg-orange-500/20 text-orange-400">⚡ Fastest</Badge>
                    </>
                  ) : <p className="text-xs text-muted-foreground mt-2">No quotes</p>}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-4 gap-4">
        {STATUS_COLS.map(col => (
          <div key={col.key} className="space-y-3">
            <h3 className="font-bold text-sm">{col.label}</h3>
            {shipments.filter((s: any) => s.status === col.key).map((s: any) => {
              const days = getDaysInfo(s);
              return (
                <Card key={s.id} className={`border ${col.color}`}>
                  <CardContent className="pt-4 space-y-2">
                    <p className="font-bold text-sm">{s.product_name}</p>
                    <p className="text-xs text-muted-foreground">{s.supplier_name}</p>
                    {s.tracking_number && (
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-muted px-1 rounded truncate flex-1">{s.tracking_number}</code>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(s.tracking_number); toast.success('Copied'); }}><Copy className="h-3 w-3" /></Button>
                      </div>
                    )}
                    <p className="text-xs">{s.carrier} • {s.quantity} units</p>
                    {s.total_cost && s.quantity && (
                      <p className="text-xs text-muted-foreground">${(s.total_cost / s.quantity).toFixed(2)}/unit landed</p>
                    )}
                    <p className={`text-xs font-medium ${days.color}`}>{days.text}</p>
                    <div className="flex gap-1 mt-2">
                      {s.tracking_number && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open(getTrackingUrl(s.carrier, s.tracking_number), '_blank')}><ExternalLink className="mr-1 h-3 w-3" />Track</Button>}
                      {col.key !== 'delivered' && (
                        <Select onValueChange={v => {
                          if (v === 'delivered') { setSelectedShipment(s); setShowChecklist(true); }
                          else updateStatus.mutate({ id: s.id, status: v });
                        }}>
                          <SelectTrigger className="h-7 text-xs w-24"><SelectValue placeholder="Move →" /></SelectTrigger>
                          <SelectContent>{STATUS_COLS.filter(c => c.key !== col.key).map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {shipments.filter((s: any) => s.status === col.key).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Empty</p>}
          </div>
        ))}
      </div>

      {/* Upcoming Arrivals */}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader><CardTitle>📅 Upcoming Arrivals (Next 14 Days)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcoming.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded bg-muted/50">
                  <div>
                    <p className="font-medium">{s.product_name}</p>
                    <p className="text-sm text-muted-foreground">{s.supplier_name} • {s.quantity} units</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{s.estimated_arrival}</p>
                    <p className={`text-sm ${getDaysInfo(s).color}`}>{getDaysInfo(s).text}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Shipment Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Shipment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Supplier Name</label><Input value={newShipment.supplier_name} onChange={e => setNewShipment(p => ({ ...p, supplier_name: e.target.value }))} /></div>
            <div><label className="text-sm font-medium">Product Name</label><Input value={newShipment.product_name} onChange={e => setNewShipment(p => ({ ...p, product_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Quantity</label><Input type="number" value={newShipment.quantity} onChange={e => setNewShipment(p => ({ ...p, quantity: Number(e.target.value) }))} /></div>
              <div><label className="text-sm font-medium">Total Cost ($)</label><Input type="number" value={newShipment.total_cost} onChange={e => setNewShipment(p => ({ ...p, total_cost: Number(e.target.value) }))} /></div>
            </div>
            <div><label className="text-sm font-medium">Tracking Number</label><Input value={newShipment.tracking_number} onChange={e => setNewShipment(p => ({ ...p, tracking_number: e.target.value }))} /></div>
            <div>
              <label className="text-sm font-medium">Carrier</label>
              <Select value={newShipment.carrier} onValueChange={v => setNewShipment(p => ({ ...p, carrier: v }))}>
                <SelectTrigger><SelectValue placeholder="Select carrier" /></SelectTrigger>
                <SelectContent>{CARRIERS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Ship Date</label><Input type="date" value={newShipment.ship_date} onChange={e => setNewShipment(p => ({ ...p, ship_date: e.target.value }))} /></div>
              <div><label className="text-sm font-medium">Est. Arrival</label><Input type="date" value={newShipment.estimated_arrival} onChange={e => setNewShipment(p => ({ ...p, estimated_arrival: e.target.value }))} /></div>
            </div>
            <div><label className="text-sm font-medium">Freight Forwarder</label><Input value={newShipment.freight_forwarder} onChange={e => setNewShipment(p => ({ ...p, freight_forwarder: e.target.value }))} placeholder="If sea freight" /></div>
          </div>
          <DialogFooter><Button onClick={() => addShipment.mutate()} disabled={!newShipment.product_name}><Plus className="mr-2 h-4 w-4" />Add Shipment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Arrival Checklist Modal */}
      <Dialog open={showChecklist} onOpenChange={setShowChecklist}>
        <DialogContent>
          <DialogHeader><DialogTitle>📋 Arrival Quality Checklist</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {CHECKLIST.map((item, i) => (
              <label key={i} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                <input type="checkbox" checked={checklistState[i]} onChange={e => { const next = [...checklistState]; next[i] = e.target.checked; setChecklistState(next); }} className="h-5 w-5" />
                <span>{item}</span>
              </label>
            ))}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="destructive" onClick={() => handleChecklistComplete(false)}><AlertTriangle className="mr-2 h-4 w-4" />Issue Found 🚩</Button>
            <Button onClick={() => handleChecklistComplete(true)} disabled={!checklistState.every(Boolean)}><CheckCircle className="mr-2 h-4 w-4" />All Good ✅</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Landed Cost Calculator Modal */}
      <Dialog open={showLandedCost} onOpenChange={setShowLandedCost}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Landed Cost Calculator</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Unit Cost ($)</label>
                <Input type="number" value={lcProductCost} onChange={e => setLcProductCost(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-sm font-medium">Quantity</label>
                <Input type="number" value={lcQuantity} onChange={e => setLcQuantity(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Shipping Cost ($)</label>
              <Input type="number" value={lcShippingCost} onChange={e => setLcShippingCost(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-sm font-medium">Product Category</label>
              <Select value={lcCategory} onValueChange={setLcCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(DUTY_RATES).map(c => <SelectItem key={c} value={c}>{c} ({(DUTY_RATES[c] * 100).toFixed(0)}% duty)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={lcFromChina} onChange={e => setLcFromChina(e.target.checked)} className="h-4 w-4" />
              <span className="text-sm">Origin: China (adds 25% Section 301 tariff)</span>
            </label>

            {/* Results */}
            <div className="border rounded-lg p-4 space-y-2 bg-muted/50">
              <h4 className="font-semibold text-sm">Cost Breakdown</h4>
              <div className="flex justify-between text-sm">
                <span>Product Cost ({lcQuantity} × ${lcProductCost})</span>
                <span className="font-mono">${totalProductCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span className="font-mono">${lcShippingCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Duty ({(dutyRate * 100).toFixed(0)}%)</span>
                <span className="font-mono">${dutyAmount.toFixed(2)}</span>
              </div>
              {lcFromChina && (
                <div className="flex justify-between text-sm text-red-400">
                  <span>Section 301 Tariff (25%)</span>
                  <span className="font-mono">${tariffAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>MPF</span>
                <span className="font-mono">${mpfAmount.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total Landed Cost</span>
                <span className="font-mono text-primary">${totalLandedCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Per Unit Landed</span>
                <span className="font-mono text-primary">${perUnitLanded.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
