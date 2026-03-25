import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

const TIERS = {
  'Tier 1': { states: ['FL','TX','GA','NC','OH','TN'], label: 'Launch First', color: '#3B6D11' },
  'Tier 2': { states: ['IN','MO','MI','PA','AZ','MD','NJ'], label: 'Scale Into', color: '#f59e0b' },
  'Tier 3': { states: ['AL','AR','CA','CO','CT','DE','HI','IA','ID','IL','KS','KY','LA','MA','ME','MN','MS','MT','NE','NV','NH','NM','NY','ND','OK','OR','RI','SC','SD','UT','VA','VT','WA','WI','WV','WY'], label: 'Expand When Ready', color: '#6b7280' },
};

export default function REMarkets() {
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [dealCounts, setDealCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.from('re_leads').select('state').then(({ data }) => {
      const counts: Record<string, number> = {};
      (data || []).forEach(l => { if (l.state) counts[l.state] = (counts[l.state] || 0) + 1; });
      setLeadCounts(counts);
    });
    supabase.from('re_deals').select('state').eq('status', 'closed').then(({ data }) => {
      const counts: Record<string, number> = {};
      (data || []).forEach(d => { if (d.state) counts[d.state] = (counts[d.state] || 0) + 1; });
      setDealCounts(counts);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: '#3B6D11' }}>Market Intelligence</h1>
        <p className="text-muted-foreground">State-by-state acquisition strategy</p>
      </div>

      {Object.entries(TIERS).map(([tier, { states, label, color }]) => (
        <Card key={tier}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle>{tier}</CardTitle>
              <Badge style={{ backgroundColor: color }}>{label}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {states.map(s => (
                <div key={s} className="p-3 rounded-lg border border-border text-center">
                  <div className="text-xl font-bold">{s}</div>
                  <div className="text-xs text-muted-foreground">{leadCounts[s] || 0} leads</div>
                  <div className="text-xs" style={{ color }}>{dealCounts[s] || 0} closed</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
