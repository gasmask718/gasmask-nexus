import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Copy, Check, Send, Calculator, FileText, BarChart3 } from 'lucide-react';

const PRODUCT_CATEGORIES = ['LED & Lighting', 'Balloons & Decor', 'Inflatables', 'Furniture', 'Linens', 'Photo Booth', 'Party Favors', 'Drinkware', 'Wearables', 'Other'];
const LOGO_METHODS = ['Print', 'Emboss', 'Engraving', 'Sticker'];
const SHIPPING_METHODS = ['Express DHL', 'Air Economy', 'Sea FCL', 'Sea LCL', 'Local Delivery'];
const DUTY_RATES: Record<string, number> = {
  'Furniture': 7, 'LED & Lighting': 3.9, 'Inflatables': 4.8, 'Linens': 20, 'Balloons & Decor': 5, 'Photo Booth': 3, 'Party Favors': 5, 'Drinkware': 6, 'Wearables': 12, 'Other': 5
};

export default function UTRFQEngine() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('rfqs');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<any>(null);
  const [newRfq, setNewRfq] = useState({ product_name: '', product_category: '', target_quantity: 50, target_unit_price: 20, needs_branding: true, logo_method: 'Print', packaging_required: true, sample_required: true, destination_zip: '', urgency: 'standard', notes: '' });
  const [newResponse, setNewResponse] = useState({ supplier_name: '', unit_price: 0, moq: 0, branding_cost: 0, production_days: 0, shipping_method: '', shipping_cost: 0, shipping_days: 0, notes: '' });
  const [customsInputs, setCustomsInputs] = useState({ productType: 'Other', country: 'China', productValue: 1100, shippingCost: 180, quantity: 50, rentalPrice: 75 });

  const { data: rfqs = [] } = useQuery({
    queryKey: ['ut-rfqs'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_rfq_requests' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    }
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['ut-rfq-responses', selectedRfq?.id],
    queryFn: async () => {
      if (!selectedRfq) return [];
      const { data } = await supabase.from('ut_rfq_supplier_responses' as any).select('*').eq('rfq_id', selectedRfq.id).order('total_landed_cost', { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!selectedRfq
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['ut-suppliers-list'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_suppliers' as any).select('id, name').order('name');
      return (data || []) as any[];
    }
  });

  const createRfq = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ut_rfq_requests' as any).insert(newRfq);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ut-rfqs'] }); setShowCreateModal(false); toast.success('RFQ created'); }
  });

  const addResponse = useMutation({
    mutationFn: async () => {
      const qty = selectedRfq?.target_quantity || 1;
      const totalLanded = (newResponse.unit_price * qty) + (newResponse.branding_cost * qty) + newResponse.shipping_cost;
      const { error } = await supabase.from('ut_rfq_supplier_responses' as any).insert({ ...newResponse, rfq_id: selectedRfq.id, total_landed_cost: totalLanded });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ut-rfq-responses'] }); setShowResponseModal(false); toast.success('Response added'); setNewResponse({ supplier_name: '', unit_price: 0, moq: 0, branding_cost: 0, production_days: 0, shipping_method: '', shipping_cost: 0, shipping_days: 0, notes: '' }); }
  });

  const generateRfqMessage = (rfq: any, supplierName: string) => {
    return `Hi ${supplierName},\n\nWe're looking for a supplier for: ${rfq.product_name}\n\nDetails:\n- Quantity: ${rfq.target_quantity} units\n- Target price: $${rfq.target_unit_price}/unit\n- Branding: ${rfq.needs_branding ? `Yes (${rfq.logo_method})` : 'No'}\n- Packaging: ${rfq.packaging_required ? 'Custom required' : 'Standard OK'}\n- Sample: ${rfq.sample_required ? 'Required before bulk' : 'Not required'}\n- Ship to: ${rfq.destination_zip || 'USA'}\n- Urgency: ${rfq.urgency}\n\nPlease provide:\n1. Unit price at ${rfq.target_quantity} qty\n2. MOQ\n3. Branding cost per unit\n4. Production time\n5. Shipping cost + method to USA\n\nBest regards,\nUnforgettable Times`;
  };

  const customsCalc = useMemo(() => {
    const { productType, productValue, shippingCost, quantity, rentalPrice } = customsInputs;
    const dutyRate = DUTY_RATES[productType] || 5;
    const dutyAmount = productValue * (dutyRate / 100);
    const mpf = productValue * 0.003464;
    const totalLanded = productValue + shippingCost + dutyAmount + mpf;
    const perUnit = totalLanded / (quantity || 1);
    const breakEvenRentals = Math.ceil(totalLanded / rentalPrice);
    const annualProfit = (rentalPrice * quantity * 12) - totalLanded;
    return { dutyRate, dutyAmount, mpf, totalLanded, perUnit, breakEvenRentals, annualProfit };
  }, [customsInputs]);

  const bestResponse = responses.length >= 2 ? responses.reduce((a: any, b: any) => (a.total_landed_cost || Infinity) < (b.total_landed_cost || Infinity) ? a : b) : null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🚀 RFQ Engine</h1>
          <p className="text-muted-foreground">Auto-generate and send Request For Quote to 3-5 suppliers at once</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}><Plus className="mr-2 h-4 w-4" />New RFQ</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total RFQs', value: rfqs.length },
          { label: 'Active', value: rfqs.filter((r: any) => r.status === 'sent').length },
          { label: 'Responses', value: responses.length },
          { label: 'Awarded', value: rfqs.filter((r: any) => r.status === 'awarded').length },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{s.value}</p><p className="text-sm text-muted-foreground">{s.label}</p></CardContent></Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="rfqs"><FileText className="mr-1 h-4 w-4" />RFQ List</TabsTrigger>
          <TabsTrigger value="compare"><BarChart3 className="mr-1 h-4 w-4" />Compare Responses</TabsTrigger>
          <TabsTrigger value="customs"><Calculator className="mr-1 h-4 w-4" />Landed Cost Calculator</TabsTrigger>
        </TabsList>

        <TabsContent value="rfqs">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>Qty</TableHead><TableHead>Target $/unit</TableHead><TableHead>Urgency</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rfqs.map((rfq: any) => (
                    <TableRow key={rfq.id}>
                      <TableCell className="font-medium">{rfq.product_name}</TableCell>
                      <TableCell>{rfq.product_category}</TableCell>
                      <TableCell>{rfq.target_quantity}</TableCell>
                      <TableCell>${rfq.target_unit_price}</TableCell>
                      <TableCell><Badge variant={rfq.urgency === 'express' ? 'destructive' : 'secondary'}>{rfq.urgency}</Badge></TableCell>
                      <TableCell><Badge variant={rfq.status === 'sent' ? 'default' : 'outline'}>{rfq.status}</Badge></TableCell>
                      <TableCell className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setSelectedRfq(rfq); setActiveTab('compare'); }}>View</Button>
                        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(generateRfqMessage(rfq, '[Supplier]')); toast.success('RFQ message copied'); }}><Copy className="h-3 w-3" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rfqs.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No RFQs yet. Create your first one!</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compare">
          {selectedRfq ? (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>📋 {selectedRfq.product_name} — Supplier Responses</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4">
                    <Button onClick={() => setShowResponseModal(true)}><Plus className="mr-1 h-4 w-4" />Add Response</Button>
                    {suppliers.map((s: any) => (
                      <Button key={s.id} size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(generateRfqMessage(selectedRfq, s.name)); toast.success(`Message for ${s.name} copied`); }}>
                        <Copy className="mr-1 h-3 w-3" />{s.name}
                      </Button>
                    ))}
                  </div>
                  {responses.length >= 2 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Metric</TableHead>
                          {responses.map((r: any) => <TableHead key={r.id} className={r.id === bestResponse?.id ? 'bg-green-500/10' : ''}>{r.supplier_name} {r.id === bestResponse?.id && '✅ BEST'}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          { label: 'Unit Price', key: 'unit_price', fmt: (v: number) => `$${v}` },
                          { label: 'MOQ', key: 'moq', fmt: (v: number) => `${v}` },
                          { label: 'Branding/unit', key: 'branding_cost', fmt: (v: number) => `$${v}` },
                          { label: 'Production Days', key: 'production_days', fmt: (v: number) => `${v} days` },
                          { label: 'Shipping Method', key: 'shipping_method', fmt: (v: string) => v },
                          { label: 'Shipping Cost', key: 'shipping_cost', fmt: (v: number) => `$${v}` },
                          { label: 'Shipping Days', key: 'shipping_days', fmt: (v: number) => `${v} days` },
                          { label: 'Total Landed', key: 'total_landed_cost', fmt: (v: number) => `$${v?.toLocaleString()}` },
                          { label: 'Per Unit Landed', key: '_perUnit', fmt: (_: any, r: any) => `$${((r.total_landed_cost || 0) / (selectedRfq.target_quantity || 1)).toFixed(2)}` },
                        ].map(metric => (
                          <TableRow key={metric.label}>
                            <TableCell className="font-medium">{metric.label}</TableCell>
                            {responses.map((r: any) => {
                              const val = metric.key === '_perUnit' ? metric.fmt(null, r) : metric.fmt(r[metric.key]);
                              const isBest = metric.key === 'total_landed_cost' && r.id === bestResponse?.id;
                              return <TableCell key={r.id} className={isBest ? 'bg-green-500/10 font-bold' : ''}>{val}</TableCell>;
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : responses.length === 1 ? (
                    <div className="space-y-2">
                      <p className="text-muted-foreground">1 response received. Add more for comparison.</p>
                      {responses.map((r: any) => (
                        <Card key={r.id}><CardContent className="pt-4 grid grid-cols-4 gap-4">
                          <div><p className="text-sm text-muted-foreground">Supplier</p><p className="font-bold">{r.supplier_name}</p></div>
                          <div><p className="text-sm text-muted-foreground">Unit Price</p><p className="font-bold">${r.unit_price}</p></div>
                          <div><p className="text-sm text-muted-foreground">Total Landed</p><p className="font-bold">${r.total_landed_cost?.toLocaleString()}</p></div>
                          <div><p className="text-sm text-muted-foreground">Production</p><p className="font-bold">{r.production_days} days</p></div>
                        </CardContent></Card>
                      ))}
                    </div>
                  ) : <p className="text-center text-muted-foreground py-8">No responses yet. Send RFQ messages and add supplier quotes.</p>}
                </CardContent>
              </Card>
            </div>
          ) : <Card><CardContent className="py-12 text-center text-muted-foreground">Select an RFQ from the list to view and compare responses</CardContent></Card>}
        </TabsContent>

        <TabsContent value="customs">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>🛃 Landed Cost Calculator</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Product Type</label>
                  <Select value={customsInputs.productType} onValueChange={v => setCustomsInputs(p => ({ ...p, productType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(DUTY_RATES).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Country of Origin</label>
                  <Select value={customsInputs.country} onValueChange={v => setCustomsInputs(p => ({ ...p, country: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="China">China</SelectItem><SelectItem value="India">India</SelectItem><SelectItem value="USA">USA</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><label className="text-sm font-medium">Product Value ($)</label><Input type="number" value={customsInputs.productValue} onChange={e => setCustomsInputs(p => ({ ...p, productValue: Number(e.target.value) }))} /></div>
                <div><label className="text-sm font-medium">Shipping Cost ($)</label><Input type="number" value={customsInputs.shippingCost} onChange={e => setCustomsInputs(p => ({ ...p, shippingCost: Number(e.target.value) }))} /></div>
                <div><label className="text-sm font-medium">Quantity</label><Input type="number" value={customsInputs.quantity} onChange={e => setCustomsInputs(p => ({ ...p, quantity: Number(e.target.value) }))} /></div>
                <div><label className="text-sm font-medium">Rental Price ($)</label><Input type="number" value={customsInputs.rentalPrice} onChange={e => setCustomsInputs(p => ({ ...p, rentalPrice: Number(e.target.value) }))} /></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>💰 Landed Cost Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between py-2 border-b"><span>Product Cost:</span><span className="font-bold">${customsInputs.productValue.toLocaleString()}</span></div>
                <div className="flex justify-between py-2 border-b"><span>Shipping:</span><span className="font-bold">${customsInputs.shippingCost.toLocaleString()}</span></div>
                <div className="flex justify-between py-2 border-b"><span>Import Duty ({customsCalc.dutyRate}%):</span><span className="font-bold text-destructive">${customsCalc.dutyAmount.toFixed(0)}</span></div>
                <div className="flex justify-between py-2 border-b"><span>MPF (0.35%):</span><span className="font-bold text-destructive">${customsCalc.mpf.toFixed(0)}</span></div>
                <div className="flex justify-between py-3 border-t-2 border-primary"><span className="text-lg font-bold">TOTAL LANDED:</span><span className="text-lg font-bold">${customsCalc.totalLanded.toFixed(0)}</span></div>
                <div className="flex justify-between py-2"><span>Per Unit ({customsInputs.quantity}pc):</span><span className="font-bold">${customsCalc.perUnit.toFixed(2)}</span></div>
                <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="font-medium">At ${customsInputs.rentalPrice} rental price:</p>
                  <p>Break even: {customsCalc.breakEvenRentals} rental{customsCalc.breakEvenRentals !== 1 ? 's' : ''} ✅</p>
                  <p className="text-lg font-bold text-green-400">Annual profit: ${customsCalc.annualProfit.toLocaleString()} 🔥</p>
                </div>
                {customsInputs.country === 'China' && (
                  <p className="text-xs text-muted-foreground mt-4">⚠️ Section 301 tariffs may add 7.5-25% for Chinese goods. Always verify at usitc.gov</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create RFQ Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create New RFQ</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Product Name *</label><Input value={newRfq.product_name} onChange={e => setNewRfq(p => ({ ...p, product_name: e.target.value }))} /></div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select value={newRfq.product_category} onValueChange={v => setNewRfq(p => ({ ...p, product_category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{PRODUCT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Target Quantity</label><Input type="number" value={newRfq.target_quantity} onChange={e => setNewRfq(p => ({ ...p, target_quantity: Number(e.target.value) }))} /></div>
              <div><label className="text-sm font-medium">Target Unit Price ($)</label><Input type="number" value={newRfq.target_unit_price} onChange={e => setNewRfq(p => ({ ...p, target_unit_price: Number(e.target.value) }))} /></div>
            </div>
            <div>
              <label className="text-sm font-medium">Logo Method</label>
              <Select value={newRfq.logo_method} onValueChange={v => setNewRfq(p => ({ ...p, logo_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOGO_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <label className="flex items-center gap-2"><input type="checkbox" checked={newRfq.needs_branding} onChange={e => setNewRfq(p => ({ ...p, needs_branding: e.target.checked }))} />UT Branding</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={newRfq.packaging_required} onChange={e => setNewRfq(p => ({ ...p, packaging_required: e.target.checked }))} />Custom Packaging</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={newRfq.sample_required} onChange={e => setNewRfq(p => ({ ...p, sample_required: e.target.checked }))} />Sample Required</label>
            </div>
            <div><label className="text-sm font-medium">Destination ZIP</label><Input value={newRfq.destination_zip} onChange={e => setNewRfq(p => ({ ...p, destination_zip: e.target.value }))} /></div>
            <div>
              <label className="text-sm font-medium">Urgency</label>
              <Select value={newRfq.urgency} onValueChange={v => setNewRfq(p => ({ ...p, urgency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard — 2-4 weeks</SelectItem>
                  <SelectItem value="express">Express — Under 7 days</SelectItem>
                  <SelectItem value="economy">Economy — Sea freight OK</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={() => createRfq.mutate()} disabled={!newRfq.product_name}><Send className="mr-2 h-4 w-4" />Create RFQ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Response Modal */}
      <Dialog open={showResponseModal} onOpenChange={setShowResponseModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Supplier Response</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Supplier Name</label><Input value={newResponse.supplier_name} onChange={e => setNewResponse(p => ({ ...p, supplier_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Unit Price ($)</label><Input type="number" value={newResponse.unit_price} onChange={e => setNewResponse(p => ({ ...p, unit_price: Number(e.target.value) }))} /></div>
              <div><label className="text-sm font-medium">MOQ</label><Input type="number" value={newResponse.moq} onChange={e => setNewResponse(p => ({ ...p, moq: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Branding $/unit</label><Input type="number" value={newResponse.branding_cost} onChange={e => setNewResponse(p => ({ ...p, branding_cost: Number(e.target.value) }))} /></div>
              <div><label className="text-sm font-medium">Production Days</label><Input type="number" value={newResponse.production_days} onChange={e => setNewResponse(p => ({ ...p, production_days: Number(e.target.value) }))} /></div>
            </div>
            <div>
              <label className="text-sm font-medium">Shipping Method</label>
              <Select value={newResponse.shipping_method} onValueChange={v => setNewResponse(p => ({ ...p, shipping_method: v }))}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>{SHIPPING_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Shipping Cost ($)</label><Input type="number" value={newResponse.shipping_cost} onChange={e => setNewResponse(p => ({ ...p, shipping_cost: Number(e.target.value) }))} /></div>
              <div><label className="text-sm font-medium">Shipping Days</label><Input type="number" value={newResponse.shipping_days} onChange={e => setNewResponse(p => ({ ...p, shipping_days: Number(e.target.value) }))} /></div>
            </div>
            <div className="p-3 rounded bg-muted">
              <p className="text-sm">Auto-calculated Total Landed Cost:</p>
              <p className="text-lg font-bold">${((newResponse.unit_price * (selectedRfq?.target_quantity || 1)) + (newResponse.branding_cost * (selectedRfq?.target_quantity || 1)) + newResponse.shipping_cost).toLocaleString()}</p>
            </div>
          </div>
          <DialogFooter><Button onClick={() => addResponse.mutate()} disabled={!newResponse.supplier_name}><Check className="mr-2 h-4 w-4" />Save Response</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
