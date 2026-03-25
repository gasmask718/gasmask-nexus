import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const DEAL_STATUSES = ['under_contract','buyer_searching','buyer_found','assignment_signed','title_opened','closing_scheduled','closed'];

export default function REDeals() {
  const [deals, setDeals] = useState<any[]>([]);
  const [tab, setTab] = useState('all');

  useEffect(() => { fetchDeals(); }, []);

  const fetchDeals = async () => {
    const { data } = await supabase.from('re_deals').select('*').order('created_at', { ascending: false });
    setDeals(data || []);
  };

  const filtered = tab === 'all' ? deals : deals.filter(d => d.status === tab);

  const statusColor = (s: string) => {
    if (s === 'closed') return 'default';
    if (s === 'under_contract' || s === 'buyer_searching') return 'destructive';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: '#3B6D11' }}>Floor 3 — Active Deals Pipeline</h1>
        <p className="text-muted-foreground">Where money is made — every deal from contract to close</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={tab === 'all' ? 'default' : 'outline'} onClick={() => setTab('all')}
          style={tab === 'all' ? { backgroundColor: '#3B6D11' } : undefined}>All</Button>
        {DEAL_STATUSES.map(s => (
          <Button key={s} size="sm" variant={tab === s ? 'default' : 'outline'} onClick={() => setTab(s)}
            style={tab === s ? { backgroundColor: '#3B6D11' } : undefined}>
            {s.replace(/_/g, ' ')}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No deals found</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(d => (
            <Card key={d.id} className="border-l-4" style={{ borderLeftColor: d.buyer_name ? '#3B6D11' : '#ef4444' }}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{d.property_address}</CardTitle>
                  <Badge variant={statusColor(d.status)}>{d.status?.replace(/_/g, ' ')}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{d.city}, {d.state} {d.zip}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">ARV:</span> ${(d.arv || 0).toLocaleString()}</div>
                  <div><span className="text-muted-foreground">Purchase:</span> ${(d.purchase_price || 0).toLocaleString()}</div>
                  <div><span className="text-muted-foreground">Fee Target:</span> ${(d.assignment_fee_target || 0).toLocaleString()}</div>
                  <div><span className="text-muted-foreground">Earnest:</span> ${(d.earnest_money || 0).toLocaleString()}</div>
                </div>
                {d.buyer_name ? (
                  <div className="text-sm"><span className="text-muted-foreground">Buyer:</span> {d.buyer_name}</div>
                ) : (
                  <Badge variant="destructive" className="w-full justify-center">NEEDS BUYER</Badge>
                )}
                {d.close_date_target && (
                  <div className="text-xs text-muted-foreground">Close by: {d.close_date_target}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
