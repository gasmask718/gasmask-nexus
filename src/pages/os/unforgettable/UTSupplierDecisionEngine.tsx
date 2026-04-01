import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trophy, DollarSign, Zap, Shield, Award, ThumbsUp, BarChart3, CheckCircle, AlertTriangle } from 'lucide-react';

const calcOverall = (s: any): number => {
  const cost = (s.cost_score || 5) / 10;
  const speed = (s.speed_score || 5) / 10;
  const reliability = (s.reliability_score || 5) / 10;
  const branding = (s.supports_private_label ? 8 : 4) / 10;
  const base = (cost * 0.35 + speed * 0.25 + reliability * 0.2 + branding * 0.2) * 100;
  // Risk penalty: reduce score by risk_score/2 percentage points
  const riskPenalty = ((s.risk_score || 50) - 50) * 0.3;
  return Math.max(0, Math.min(100, Math.round(base - riskPenalty)));
};

export default function UTSupplierDecisionEngine() {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showApproval, setShowApproval] = useState(false);
  const [approvalSupplier, setApprovalSupplier] = useState<any>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalChecks, setApprovalChecks] = useState({ risk: false, shipping: false, branding: false, sample: false });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['ut-suppliers-decision'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_suppliers' as any).select('*').order('name');
      return (data || []).map((s: any) => ({
        ...s,
        overall: calcOverall(s),
        branding_capability: s.supports_private_label ? 8 : 4,
        communication: s.communication_score || Math.round(((s.cost_score || 5) + (s.speed_score || 5)) / 2),
      })) as any[];
    },
  });

  const { data: rfqResponses = [] } = useQuery({
    queryKey: ['ut-rfq-responses-decision'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_rfq_supplier_responses' as any).select('*').order('total_landed_cost', { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: shippingQuotes = [] } = useQuery({
    queryKey: ['ut-shipping-quotes'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_shipping_quotes' as any).select('*').order('cost', { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: rfqs = [] } = useQuery({
    queryKey: ['ut-rfqs-decision'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_rfq_requests' as any).select('*');
      return (data || []) as any[];
    },
  });

  const allCategories = [...new Set(suppliers.flatMap((s: any) => s.product_categories || []))];

  const filtered = categoryFilter === 'all'
    ? suppliers
    : suppliers.filter((s: any) => s.product_categories?.includes(categoryFilter));

  const sorted = [...filtered].sort((a: any, b: any) => b.overall - a.overall);
  const recommended = sorted[0];
  const cheapest = [...filtered].sort((a: any, b: any) => (b.cost_score || 0) - (a.cost_score || 0))[0];
  const fastest = [...filtered].sort((a: any, b: any) => (b.speed_score || 0) - (a.speed_score || 0))[0];
  const lowestRisk = [...filtered].sort((a: any, b: any) => (a.risk_score || 50) - (b.risk_score || 50))[0];

  const openApproval = (supplier: any) => {
    setApprovalSupplier(supplier);
    setApprovalNotes('');
    setApprovalChecks({ risk: false, shipping: false, branding: false, sample: false });
    setShowApproval(true);
  };

  const submitApproval = async () => {
    if (!approvalSupplier) return;
    // Find linked RFQ
    const linkedRFQ = rfqs[0]; // Use first available or could match by supplier

    await supabase.from('ut_procurement_approvals' as any).insert({
      rfq_id: linkedRFQ?.id || null,
      supplier_id: approvalSupplier.id,
      approved_by: 'admin',
      approval_status: 'approved',
      risk_checked: approvalChecks.risk,
      shipping_reviewed: approvalChecks.shipping,
      branding_reviewed: approvalChecks.branding,
      sample_approved: approvalChecks.sample,
      notes: approvalNotes,
    });

    await supabase.from('ut_suppliers' as any).update({
      preferred: true,
      is_active: true,
      verification_status: 'verified',
    }).eq('id', approvalSupplier.id);

    // Auto-create order record
    if (linkedRFQ) {
      await supabase.from('ut_orders' as any).insert({
        supplier_id: approvalSupplier.id,
        rfq_id: linkedRFQ.id,
        product_name: linkedRFQ.product_name,
        quantity: linkedRFQ.target_quantity,
        status: 'pending',
        notes: `Auto-created from procurement approval`,
      });

      // Auto-create shipment entry
      await supabase.from('ut_shipments' as any).insert({
        supplier_id: approvalSupplier.id,
        supplier_name: approvalSupplier.name,
        product_name: linkedRFQ.product_name,
        quantity: linkedRFQ.target_quantity,
        status: 'in_transit',
        notes: `Auto-created from approval`,
      });
    }

    queryClient.invalidateQueries({ queryKey: ['ut-suppliers-decision'] });
    setShowApproval(false);
    toast.success('Supplier approved! Order & shipment created.');
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const riskBadge = (risk: number) => {
    if (risk <= 30) return <Badge className="bg-green-500/20 text-green-400 text-[10px]">Low Risk</Badge>;
    if (risk <= 60) return <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">Medium</Badge>;
    return <Badge className="bg-red-500/20 text-red-400 text-[10px]">High Risk</Badge>;
  };

  const scoreBar = (score: number, max: number = 10) => {
    const pct = (score / max) * 100;
    return (
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={`h-2 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : pct >= 40 ? 'bg-orange-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  };

  const allChecked = Object.values(approvalChecks).every(Boolean);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="h-8 w-8" /> Supplier Decision Engine</h1>
        <p className="text-muted-foreground">Auto-ranked with risk penalty — approve suppliers before ordering</p>
      </div>

      {/* Top Picks - 4 cards */}
      {sorted.length > 0 && (
        <div className="grid md:grid-cols-4 gap-4">
          {recommended && (
            <Card className="border-yellow-500/50 bg-yellow-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-400" /> 🏆 Recommended</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{recommended.name}</p>
                <p className={`text-2xl font-bold mt-1 ${scoreColor(recommended.overall)}`}>{recommended.overall}/100</p>
                {riskBadge(recommended.risk_score || 50)}
                <Button size="sm" className="mt-2 w-full" onClick={() => openApproval(recommended)}>
                  <ThumbsUp className="h-3 w-3 mr-1" /> Approve & Proceed
                </Button>
              </CardContent>
            </Card>
          )}
          {cheapest && (
            <Card className="border-green-500/50 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-400" /> 💰 Cheapest</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{cheapest.name}</p>
                <p className="text-sm mt-1">Cost Score: <span className="font-bold">{cheapest.cost_score || 5}/10</span></p>
                {riskBadge(cheapest.risk_score || 50)}
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => openApproval(cheapest)}>
                  <ThumbsUp className="h-3 w-3 mr-1" /> Approve
                </Button>
              </CardContent>
            </Card>
          )}
          {fastest && (
            <Card className="border-blue-500/50 bg-blue-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-blue-400" /> ⚡ Fastest</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{fastest.name}</p>
                <p className="text-sm mt-1">Speed Score: <span className="font-bold">{fastest.speed_score || 5}/10</span></p>
                {riskBadge(fastest.risk_score || 50)}
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => openApproval(fastest)}>
                  <ThumbsUp className="h-3 w-3 mr-1" /> Approve
                </Button>
              </CardContent>
            </Card>
          )}
          {lowestRisk && (
            <Card className="border-emerald-500/50 bg-emerald-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-400" /> 🛡️ Lowest Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{lowestRisk.name}</p>
                <p className="text-sm mt-1">Risk: <span className="font-bold">{lowestRisk.risk_score || 50}/100</span></p>
                {riskBadge(lowestRisk.risk_score || 50)}
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => openApproval(lowestRisk)}>
                  <ThumbsUp className="h-3 w-3 mr-1" /> Approve
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{sorted.length} suppliers ranked</p>
      </div>

      {/* Shipping Quote Comparison */}
      {shippingQuotes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Shipping Comparison</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Method</th>
                    <th className="text-left p-2">Forwarder</th>
                    <th className="text-right p-2">Cost</th>
                    <th className="text-right p-2">Days</th>
                    <th className="text-left p-2">Best For</th>
                  </tr>
                </thead>
                <tbody>
                  {shippingQuotes.map((q: any) => (
                    <tr key={q.id} className="border-b">
                      <td className="p-2">
                        <Badge variant="outline">
                          {q.method === 'air' ? '✈️' : q.method === 'sea' ? '🚢' : '⚡'} {q.method}
                        </Badge>
                      </td>
                      <td className="p-2">{q.forwarder_name || '—'}</td>
                      <td className="p-2 text-right font-mono">${q.cost?.toFixed(2) || '—'}</td>
                      <td className="p-2 text-right">{q.days || '—'} days</td>
                      <td className="p-2">
                        {q.method === 'express' ? '⚡ Speed' : q.method === 'sea' ? '💰 Cost' : '⚖️ Balance'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Leaderboard */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" /> Supplier Rankings</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sorted.map((s: any, idx: number) => (
              <div key={s.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-muted-foreground w-8">#{idx + 1}</span>
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        {s.name}
                        {s.preferred && <Badge className="bg-yellow-500/20 text-yellow-400">⭐ Preferred</Badge>}
                        {riskBadge(s.risk_score || 50)}
                        <Badge variant="outline">{s.verification_status || 'unverified'}</Badge>
                      </p>
                      <p className="text-sm text-muted-foreground">{(s.product_categories || []).join(', ')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${scoreColor(s.overall)}`}>{s.overall}</p>
                    <p className="text-xs text-muted-foreground">/100 overall</p>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">💰 Price (35%)</p>
                    {scoreBar(s.cost_score || 5)}
                    <p className="text-xs mt-1">{s.cost_score || 5}/10</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">⚡ Speed (25%)</p>
                    {scoreBar(s.speed_score || 5)}
                    <p className="text-xs mt-1">{s.speed_score || 5}/10</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">🛡️ Reliability (20%)</p>
                    {scoreBar(s.reliability_score || 5)}
                    <p className="text-xs mt-1">{s.reliability_score || 5}/10</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">🏷️ Branding (20%)</p>
                    {scoreBar(s.branding_capability || 4)}
                    <p className="text-xs mt-1">{s.branding_capability || 4}/10</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">⚠️ Risk</p>
                    {scoreBar(Math.max(0, 10 - (s.risk_score || 50) / 10))}
                    <p className="text-xs mt-1">{s.risk_score || 50}/100</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => openApproval(s)}>
                    <ThumbsUp className="h-3 w-3 mr-1" /> Approve & Proceed
                  </Button>
                </div>
              </div>
            ))}
            {sorted.length === 0 && <p className="text-center py-8 text-muted-foreground">No suppliers found.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={showApproval} onOpenChange={setShowApproval}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              Final Approval Required
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Approving <strong>{approvalSupplier?.name}</strong> — this will create an order and shipment entry.</p>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={approvalChecks.risk} onCheckedChange={(v) => setApprovalChecks(p => ({ ...p, risk: !!v }))} />
                <span className="text-sm">✅ Risk score reviewed ({approvalSupplier?.risk_score || 50}/100)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={approvalChecks.shipping} onCheckedChange={(v) => setApprovalChecks(p => ({ ...p, shipping: !!v }))} />
                <span className="text-sm">✅ Shipping costs reviewed</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={approvalChecks.branding} onCheckedChange={(v) => setApprovalChecks(p => ({ ...p, branding: !!v }))} />
                <span className="text-sm">✅ Branding requirements reviewed</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={approvalChecks.sample} onCheckedChange={(v) => setApprovalChecks(p => ({ ...p, sample: !!v }))} />
                <span className="text-sm">✅ Sample approved (if applicable)</span>
              </label>
            </div>

            <Textarea placeholder="Approval notes..." value={approvalNotes} onChange={e => setApprovalNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproval(false)}>Cancel</Button>
            <Button onClick={submitApproval} disabled={!allChecked}>
              <CheckCircle className="h-4 w-4 mr-1" /> Approve Supplier & Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
