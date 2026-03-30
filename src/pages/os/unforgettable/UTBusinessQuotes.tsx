import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { FileText } from 'lucide-react';

const PINK = '#E91E8C';

interface Quote {
  id: string;
  request_id: string;
  product_cost: number;
  shipping_cost: number;
  total_cost: number;
  estimated_delivery_days: number;
  notes: string | null;
  status: string;
  created_at: string;
  request_name?: string;
}

export default function UTBusinessQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Quote | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: quotesData } = await supabase.from('ut_business_quotes').select('*').order('created_at', { ascending: false });
      if (quotesData) {
        const requestIds = [...new Set(quotesData.map((q: any) => q.request_id))];
        const { data: reqs } = await supabase.from('ut_business_requests').select('id, full_name').in('id', requestIds);
        const nameMap: Record<string, string> = {};
        reqs?.forEach((r: any) => { nameMap[r.id] = r.full_name; });
        setQuotes(quotesData.map((q: any) => ({ ...q, request_name: nameMap[q.request_id] || 'Unknown' })));
      }
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: PINK }}>Floor 5 — Quotes Manager</h1>
        <p className="text-sm text-muted-foreground">Track and manage all business quotes</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Client</th>
                  <th className="text-left p-3 font-medium">Product Cost</th>
                  <th className="text-left p-3 font-medium">Shipping</th>
                  <th className="text-left p-3 font-medium">Total</th>
                  <th className="text-left p-3 font-medium">Delivery</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : quotes.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No quotes yet</td></tr>
                ) : quotes.map(q => (
                  <tr key={q.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(q)}>
                    <td className="p-3 font-medium">{q.request_name}</td>
                    <td className="p-3">${q.product_cost?.toLocaleString()}</td>
                    <td className="p-3">${q.shipping_cost?.toLocaleString()}</td>
                    <td className="p-3 font-bold">${q.total_cost?.toLocaleString()}</td>
                    <td className="p-3">{q.estimated_delivery_days} days</td>
                    <td className="p-3"><Badge variant="outline">{q.status}</Badge></td>
                    <td className="p-3 text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={v => { if (!v) setSelected(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Quote for {selected?.request_name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>Product Cost: <strong>${selected.product_cost}</strong></div>
                <div>Shipping: <strong>${selected.shipping_cost}</strong></div>
                <div>Total: <strong>${selected.total_cost}</strong></div>
                <div>Delivery: <strong>{selected.estimated_delivery_days} days</strong></div>
              </div>
              {selected.notes && <div className="bg-muted p-2 rounded">{selected.notes}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
