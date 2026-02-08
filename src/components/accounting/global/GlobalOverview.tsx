import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Globe, DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Loader2, Building2, Wifi, WifiOff, Activity,
} from 'lucide-react';

interface BusinessFinancialSummary {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  is_active: boolean;
  business_type: string | null;
  connection_status: string;
  revenue_source: string;
  reporting_mode: string;
  data_confidence_pct: number;
  monthly_revenue_estimate: number;
  monthly_expense_estimate: number;
  last_data_sync_at: string | null;
}

function useGlobalOverview() {
  return useQuery({
    queryKey: ['global-financial-overview'],
    queryFn: async (): Promise<{
      businesses: BusinessFinancialSummary[];
      totalRevenueMTD: number;
      totalExpensesMTD: number;
      totalOutstanding: number;
    }> => {
      const [{ data: profiles }, { data: businesses }, { data: ledgerIn }, { data: ledgerOut }, { data: collections }] = await Promise.all([
        supabase.from('business_financial_profiles').select('*'),
        supabase.from('businesses').select('id, name, slug, industry, is_active, business_type').eq('is_active', true),
        supabase.from('accounting_ledger').select('amount').eq('direction', 'in').gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from('accounting_ledger').select('amount').eq('direction', 'out').gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from('collection_accounts').select('total_outstanding').neq('status', 'closed'),
      ]);

      const profileMap = new Map((profiles || []).map(p => [p.business_id, p]));

      const enriched: BusinessFinancialSummary[] = (businesses || []).map(b => {
        const fp = profileMap.get(b.id);
        return {
          id: b.id,
          name: b.name,
          slug: b.slug,
          industry: b.industry,
          is_active: b.is_active,
          business_type: b.business_type,
          connection_status: fp?.connection_status || 'not_connected',
          revenue_source: fp?.revenue_source || 'offline',
          reporting_mode: fp?.reporting_mode || 'placeholder',
          data_confidence_pct: fp?.data_confidence_pct || 0,
          monthly_revenue_estimate: Number(fp?.monthly_revenue_estimate || 0),
          monthly_expense_estimate: Number(fp?.monthly_expense_estimate || 0),
          last_data_sync_at: fp?.last_data_sync_at || null,
        };
      });

      const totalRevenueMTD = (ledgerIn || []).reduce((s, r) => s + Number(r.amount), 0);
      const totalExpensesMTD = (ledgerOut || []).reduce((s, r) => s + Number(r.amount), 0);
      const totalOutstanding = (collections || []).reduce((s, c) => s + Number(c.total_outstanding || 0), 0);

      return { businesses: enriched, totalRevenueMTD, totalExpensesMTD, totalOutstanding };
    },
    refetchInterval: 120000,
  });
}

function connectionBadge(status: string) {
  switch (status) {
    case 'api_connected': return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]"><Wifi className="h-3 w-3 mr-1" />Live</Badge>;
    case 'partial': return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]"><Activity className="h-3 w-3 mr-1" />Partial</Badge>;
    case 'manual': return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px]">Manual</Badge>;
    case 'external_pending': return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px]">Pending</Badge>;
    default: return <Badge className="bg-muted/50 text-muted-foreground border-muted text-[10px]"><WifiOff className="h-3 w-3 mr-1" />Not Connected</Badge>;
  }
}

function confidenceBar(pct: number) {
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : pct > 0 ? 'bg-orange-500' : 'bg-muted';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground">{pct}%</span>
    </div>
  );
}

export default function GlobalOverview() {
  const { data, isLoading } = useGlobalOverview();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const { businesses, totalRevenueMTD, totalExpensesMTD, totalOutstanding } = data;
  const netProfit = totalRevenueMTD - totalExpensesMTD;
  const connected = businesses.filter(b => b.connection_status !== 'not_connected').length;
  const totalBusinesses = businesses.length;

  return (
    <div className="space-y-6">
      {/* Dynasty KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-emerald-950/40 to-card border-emerald-500/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Revenue MTD</span>
            </div>
            <p className="text-xl font-bold text-emerald-400">${totalRevenueMTD.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Expenses MTD</span>
            </div>
            <p className="text-xl font-bold text-red-400">${totalExpensesMTD.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className={`h-4 w-4 ${netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
              <span className="text-xs text-muted-foreground">Net Profit</span>
            </div>
            <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${netProfit.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Outstanding</span>
            </div>
            <p className="text-xl font-bold text-orange-400">${totalOutstanding.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Connected</span>
            </div>
            <p className="text-xl font-bold">{connected} <span className="text-sm text-muted-foreground font-normal">/ {totalBusinesses}</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Business Registry */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Dynasty Business Registry
          </CardTitle>
          <CardDescription className="text-xs">
            All entities in the dynasty ecosystem — connection status & data confidence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {businesses.map(biz => (
              <div key={biz.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{biz.name}</p>
                    {connectionBadge(biz.connection_status)}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground capitalize">{biz.industry?.replace(/_/g, ' ') || 'Unclassified'}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground capitalize">{biz.reporting_mode.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  {confidenceBar(biz.data_confidence_pct)}
                  {biz.monthly_revenue_estimate > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">~${biz.monthly_revenue_estimate.toLocaleString()}/mo</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
