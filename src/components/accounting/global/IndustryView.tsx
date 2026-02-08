import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Factory, Loader2, AlertTriangle, AlertCircle } from 'lucide-react';
import {
  useBusinessEntities,
  useIndustryCatalog,
  useFinancialSnapshots,
  type IndustryCatalogEntry,
} from '@/hooks/useGlobalFinancialData';

interface IndustryGroup {
  industry: string;
  industryGroup: string;
  marginExpLow: number;
  marginExpHigh: number;
  businesses: { name: string; confidence: number }[];
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  margin: number;
  avgConfidence: number;
  connectedCount: number;
  totalCount: number;
}

export default function IndustryView() {
  const { data: businesses, isLoading: bizLoading } = useBusinessEntities();
  const { data: catalog, isLoading: catLoading } = useIndustryCatalog();
  const { data: snapshots, isLoading: snapLoading } = useFinancialSnapshots(1);

  const isLoading = bizLoading || catLoading || snapLoading;

  // Build catalog lookup
  const catalogMap = useMemo(() => {
    const map = new Map<string, IndustryCatalogEntry>();
    (catalog || []).forEach(c => map.set(c.id, c));
    return map;
  }, [catalog]);

  // Build snapshot aggregation per business
  const snapshotByBiz = useMemo(() => {
    const map = new Map<string, { revenue: number; expenses: number }>();
    (snapshots || []).forEach(s => {
      const existing = map.get(s.business_id) || { revenue: 0, expenses: 0 };
      existing.revenue += s.total_revenue;
      existing.expenses += s.total_expenses;
      map.set(s.business_id, existing);
    });
    return map;
  }, [snapshots]);

  const industries: IndustryGroup[] = useMemo(() => {
    const industryMap = new Map<string, {
      catalogEntry: IndustryCatalogEntry | null;
      businesses: { name: string; confidence: number }[];
      revenue: number;
      expenses: number;
      confidences: number[];
      connected: number;
      total: number;
    }>();

    (businesses || []).filter(b => b.is_active).forEach(b => {
      const catEntry = b.industry_catalog_id ? catalogMap.get(b.industry_catalog_id) : null;
      const key = catEntry?.industry_name || b.industry?.replace(/_/g, ' ') || 'Unclassified';

      const snap = snapshotByBiz.get(b.id);
      const hasSnapshot = snap && (snap.revenue > 0 || snap.expenses > 0);

      const existing = industryMap.get(key) || {
        catalogEntry: catEntry || null,
        businesses: [],
        revenue: 0,
        expenses: 0,
        confidences: [],
        connected: 0,
        total: 0,
      };

      existing.businesses.push({ name: b.name, confidence: b.data_confidence_pct });
      existing.revenue += hasSnapshot ? snap!.revenue : b.monthly_revenue_estimate;
      existing.expenses += hasSnapshot ? snap!.expenses : b.monthly_expense_estimate;
      existing.confidences.push(b.data_confidence_pct);
      if (b.connection_status !== 'not_connected') existing.connected++;
      existing.total++;

      industryMap.set(key, existing);
    });

    return Array.from(industryMap.entries())
      .map(([industry, data]) => {
        const profit = data.revenue - data.expenses;
        return {
          industry,
          industryGroup: data.catalogEntry?.industry_group || 'other',
          marginExpLow: data.catalogEntry?.margin_expectation_low || 0,
          marginExpHigh: data.catalogEntry?.margin_expectation_high || 0,
          businesses: data.businesses,
          totalRevenue: data.revenue,
          totalExpenses: data.expenses,
          profit,
          margin: data.revenue > 0 ? (profit / data.revenue) * 100 : 0,
          avgConfidence: data.confidences.length > 0
            ? Math.round(data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length)
            : 0,
          connectedCount: data.connected,
          totalCount: data.total,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [businesses, catalogMap, snapshotByBiz]);

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
        <p className="text-sm text-muted-foreground">
          Financial performance grouped by industry sector — {industries.length} industries tracked
        </p>
      </div>

      {industries.length === 0 && (
        <Card className="border-amber-500/20 bg-amber-950/10">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-amber-300">
                No industry data available yet. Industries will appear as businesses are classified in the registry.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {industries.map(ind => {
          const isHealthy = ind.margin >= ind.marginExpLow && ind.marginExpLow > 0;
          const isRisk = ind.margin < 0;
          const isBelowExpectation = ind.margin > 0 && ind.marginExpLow > 0 && ind.margin < ind.marginExpLow;
          const noData = ind.totalRevenue === 0 && ind.totalExpenses === 0;

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
                {noData ? (
                  <div className="py-3 text-center">
                    <p className="text-sm text-muted-foreground">Awaiting financial data</p>
                    <p className="text-xs text-muted-foreground mt-1">Businesses registered but no snapshots submitted</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                        <p className="text-lg font-bold text-emerald-400">
                          ${ind.totalRevenue.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Expenses</p>
                        <p className="text-lg font-bold text-red-400">
                          ${ind.totalExpenses.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Margin</p>
                        <p className={`text-lg font-bold ${isHealthy ? 'text-emerald-400' : isRisk ? 'text-red-400' : 'text-amber-400'}`}>
                          {ind.margin.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </>
                )}

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
                  {ind.businesses.map(biz => (
                    <Badge key={biz.name} variant="outline" className={`text-[10px] py-0 ${biz.confidence === 0 ? 'opacity-50' : ''}`}>
                      {biz.name}
                    </Badge>
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
