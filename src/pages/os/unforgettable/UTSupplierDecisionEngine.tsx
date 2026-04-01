import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trophy, DollarSign, Zap, Shield, Award, ThumbsUp, BarChart3 } from 'lucide-react';

interface SupplierScore {
  id: string;
  name: string;
  country: string;
  cost_score: number;
  speed_score: number;
  reliability_score: number;
  branding_capability: number;
  communication: number;
  overall: number;
  status: string;
  preferred: boolean;
  product_categories: string[];
}

const calcOverall = (s: any): number => {
  const cost = (s.cost_score || 5) / 10;
  const speed = (s.speed_score || 5) / 10;
  const reliability = (s.reliability_score || 5) / 10;
  const branding = (s.supports_private_label ? 8 : 4) / 10;
  return Math.round((cost * 0.35 + speed * 0.25 + reliability * 0.2 + branding * 0.2) * 100);
};

export default function UTSupplierDecisionEngine() {
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { data: suppliers = [] } = useQuery({
    queryKey: ['ut-suppliers-decision'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_suppliers' as any).select('*').order('name');
      return (data || []).map((s: any) => ({
        ...s,
        overall: calcOverall(s),
        branding_capability: s.supports_private_label ? 8 : 4,
        communication: Math.round(((s.cost_score || 5) + (s.speed_score || 5)) / 2),
      })) as SupplierScore[];
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

  const allCategories = [...new Set(suppliers.flatMap((s: any) => s.product_categories || []))];

  const filtered = categoryFilter === 'all'
    ? suppliers
    : suppliers.filter((s: any) => s.product_categories?.includes(categoryFilter));

  const sorted = [...filtered].sort((a: any, b: any) => b.overall - a.overall);
  const recommended = sorted[0];
  const cheapest = [...filtered].sort((a: any, b: any) => (b.cost_score || 0) - (a.cost_score || 0))[0];
  const fastest = [...filtered].sort((a: any, b: any) => (b.speed_score || 0) - (a.speed_score || 0))[0];

  const approveSupplier = async (supplierId: string) => {
    await supabase.from('ut_suppliers' as any).update({ preferred: true, status: 'active' }).eq('id', supplierId);
    toast.success('Supplier approved and set as preferred!');
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="h-8 w-8" /> Supplier Decision Engine</h1>
        <p className="text-muted-foreground">Auto-ranked suppliers based on price, speed, reliability & branding capability</p>
      </div>

      {/* Top Picks */}
      {sorted.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          {recommended && (
            <Card className="border-yellow-500/50 bg-yellow-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-400" /> 🏆 Recommended</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{recommended.name}</p>
                <p className="text-sm text-muted-foreground">📍 {recommended.country}</p>
                <p className={`text-2xl font-bold mt-2 ${scoreColor(recommended.overall)}`}>{recommended.overall}/100</p>
                <Button size="sm" className="mt-3 w-full" onClick={() => approveSupplier(recommended.id)}>
                  <ThumbsUp className="h-4 w-4 mr-1" /> Approve & Proceed
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
                <p className="text-xl font-bold">{cheapest.name}</p>
                <p className="text-sm text-muted-foreground">📍 {cheapest.country}</p>
                <p className="text-lg mt-2">Cost Score: <span className="font-bold">{cheapest.cost_score || 5}/10</span></p>
              </CardContent>
            </Card>
          )}
          {fastest && (
            <Card className="border-blue-500/50 bg-blue-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-blue-400" /> ⚡ Fastest</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{fastest.name}</p>
                <p className="text-sm text-muted-foreground">📍 {fastest.country}</p>
                <p className="text-lg mt-2">Speed Score: <span className="font-bold">{fastest.speed_score || 5}/10</span></p>
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
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Shipping Quote Comparison</CardTitle></CardHeader>
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
                        <Badge variant="outline">{s.status}</Badge>
                      </p>
                      <p className="text-sm text-muted-foreground">📍 {s.country} · {(s.product_categories || []).join(', ')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${scoreColor(s.overall)}`}>{s.overall}</p>
                    <p className="text-xs text-muted-foreground">/100 overall</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
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
                </div>
                <div className="mt-3 flex gap-2">
                  {!s.preferred && (
                    <Button size="sm" onClick={() => approveSupplier(s.id)}>
                      <ThumbsUp className="h-3 w-3 mr-1" /> Approve & Set Preferred
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {sorted.length === 0 && <p className="text-center py-8 text-muted-foreground">No suppliers found. Add suppliers in the Supplier Manager.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
