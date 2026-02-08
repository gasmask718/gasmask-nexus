import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Factory, Loader2, AlertTriangle } from 'lucide-react';

interface IndustryGroup {
  industry: string;
  industryGroup: string;
  marginExpLow: number;
  marginExpHigh: number;
  businesses: string[];
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  margin: number;
  avgConfidence: number;
  connectedCount: number;
  totalCount: number;
}

function useIndustryView() {
  return useQuery({
    queryKey: ['industry-financial-view'],
    queryFn: async (): Promise<IndustryGroup[]> => {
      const [{ data: businesses }, { data: profiles }, { data: catalog }] = await Promise.all([
        supabase.from('businesses').select('id, name, industry, industry_catalog_id').eq('is_active', true),
        supabase.from('business_financial_profiles').select('*'),
        supabase.from('industry_catalog').select('*'),
      ]);

      const profileMap = new Map((profiles || []).map(p => [p.business_id, p]));
      const catalogMap = new Map((catalog || []).map(c => [c.id, c]));

      const industryMap = new Map<string, {
        industryGroup: string;
        marginExpLow: number;
        marginExpHigh: number;
        businesses: string[];
        revenue: number;
        expenses: number;
        confidences: number[];
        connected: number;
        total: number;
      }>();

      (businesses || []).forEach(b => {
        const catalogEntry = b.industry_catalog_id ? catalogMap.get(b.industry_catalog_id) : null;
        const key = catalogEntry?.industry_name || b.industry || 'Unclassified';
        const fp = profileMap.get(b.id);
        const existing = industryMap.get(key) || {
          industryGroup: catalogEntry?.industry_group || 'other',
          marginExpLow: Number(catalogEntry?.margin_expectation_low || 0),
          marginExpHigh: Number(catalogEntry?.margin_expectation_high || 0),
          businesses: [], revenue: 0, expenses: 0, confidences: [], connected: 0, total: 0,
        };

        existing.businesses.push(b.name);
        existing.revenue += Number(fp?.monthly_revenue_estimate || 0);
        existing.expenses += Number(fp?.monthly_expense_estimate || 0);
        existing.confidences.push(fp?.data_confidence_pct || 0);
        if (fp?.connection_status && fp.connection_status !== 'not_connected') existing.connected++;
        existing.total++;

        industryMap.set(key, existing);
      });

      return Array.from(industryMap.entries())
        .map(([industry, data]) => {
          const profit = data.revenue - data.expenses;
          return {
            industry,
            industryGroup: data.industryGroup,
            marginExpLow: data.marginExpLow,
            marginExpHigh: data.marginExpHigh,
            businesses: data.businesses,
            totalRevenue: data.revenue,
            totalExpenses: data.expenses,
            profit,
            margin: data.revenue > 0 ? (profit / data.revenue) * 100 : 0,
            avgConfidence: data.confidences.length > 0 ? Math.round(data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length) : 0,
            connectedCount: data.connected,
            totalCount: data.total,
          };
        })
        .sort((a, b) => b.totalRevenue - a.totalRevenue);
    },
  });
}


export default function IndustryView() {
  const { data: industries, isLoading } = useIndustryView();

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Factory className="h-5 w-5 text-primary" />
          Industry View
        </h2>
        <p className="text-sm text-muted-foreground">Financial performance grouped by industry sector</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(industries || []).map(ind => {
          const isHealthy = ind.margin >= ind.marginExpLow;
          const isRisk = ind.margin < 0;
          const isBelowExpectation = ind.margin > 0 && ind.margin < ind.marginExpLow;
          return (
            <Card key={ind.industry} className={`${isRisk ? 'border-destructive/20' : isBelowExpectation ? 'border-yellow-500/20' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{ind.industry}</CardTitle>
                    <span className="text-[10px] text-muted-foreground capitalize">{ind.industryGroup}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {ind.marginExpHigh > 0 && (
                      <Badge variant="outline" className="text-[10px] py-0">
                        {ind.marginExpLow}–{ind.marginExpHigh}% expected
                      </Badge>
                    )}
                    {isRisk && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
                <CardDescription className="text-xs">
                  {ind.totalCount} business{ind.totalCount !== 1 ? 'es' : ''} • {ind.connectedCount} connected
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {ind.totalRevenue > 0 ? `$${ind.totalRevenue.toLocaleString()}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expenses</p>
                    <p className="text-lg font-bold text-red-400">
                      {ind.totalExpenses > 0 ? `$${ind.totalExpenses.toLocaleString()}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Margin</p>
                    <p className={`text-lg font-bold ${isHealthy ? 'text-emerald-400' : isRisk ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {ind.totalRevenue > 0 ? `${ind.margin.toFixed(1)}%` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Confidence */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground">Data confidence:</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${ind.avgConfidence >= 70 ? 'bg-emerald-500' : ind.avgConfidence >= 40 ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}
                      style={{ width: `${ind.avgConfidence}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{ind.avgConfidence}%</span>
                </div>

                {/* Business List */}
                <div className="flex flex-wrap gap-1">
                  {ind.businesses.map(name => (
                    <Badge key={name} variant="outline" className="text-[10px] py-0">{name}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
