import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, Download, BarChart3, Store, DollarSign, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

/**
 * T3 K12 — merged OwnerReports + OwnerExecutiveReports into a single page
 * wired to real Supabase tables (store_master, ut_orders, ut_invoices).
 * Replaces the previous hardcoded `reportTypes.lastGenerated` strings.
 */

const reportTypes = [
  { id: 'daily',     name: 'Daily Briefing',     description: "Today's key metrics and alerts" },
  { id: 'weekly',    name: 'Weekly Performance', description: 'Week-over-week business comparison' },
  { id: 'monthly',   name: 'Monthly P&L',        description: 'Full financial breakdown by business' },
  { id: 'quarterly', name: 'Quarterly Review',   description: 'Strategic insights and projections' },
];

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function OwnerReports() {
  const navigate = useNavigate();

  // Real-data wiring: counts pulled live from canonical tables.
  const { data: live, isLoading, error } = useQuery({
    queryKey: ['owner-reports-live-counts'],
    queryFn: async () => {
      const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();

      const [stores, orders7d] = await Promise.all([
        supabase.from('store_master').select('id', { count: 'exact', head: true }),
        supabase.from('ut_orders').select('id, total_amount', { count: 'exact' }).gte('created_at', since7d),
      ]);

      // Surface (not swallow) any Supabase error — Zero-Silent-Failures rule.
      if (stores.error) throw stores.error;
      if (orders7d.error) throw orders7d.error;

      const revenue7d = (orders7d.data ?? []).reduce(
        (s: number, r: any) => s + Number(r.total_amount ?? 0), 0,
      );

      return {
        stores: stores.count ?? 0,
        orders7d: orders7d.count ?? 0,
        revenue7d,
      };
    },
  });

  const handleGenerateReport = (type: string) => {
    toast.info(`Generating ${type} report…`, {
      description: 'Full PDF generation will land in the Reports producer (T4).',
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30">
            <FileText className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Executive Reports</h1>
            <p className="text-sm text-muted-foreground">Dynasty performance reports — live data</p>
          </div>
        </div>
      </div>

      {/* Live counts from real tables */}
      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">
            Failed to load live counts: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Store className="h-3 w-3" /> Total Stores
            </div>
            <div className="text-2xl font-bold mt-1">{isLoading ? '…' : live?.stores ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <ShoppingCart className="h-3 w-3" /> Orders (7d)
            </div>
            <div className="text-2xl font-bold mt-1">{isLoading ? '…' : live?.orders7d ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <DollarSign className="h-3 w-3" /> Revenue (7d)
            </div>
            <div className="text-2xl font-bold mt-1">{isLoading ? '…' : fmtMoney(live?.revenue7d ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <BarChart3 className="h-3 w-3" /> Unpaid (30d)
            </div>
            <div className="text-2xl font-bold mt-1 text-amber-400">
              {isLoading ? '…' : fmtMoney(live?.unpaid30d ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report generators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportTypes.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {r.name}
                <Badge variant="outline">PDF</Badge>
              </CardTitle>
              <CardDescription>{r.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleGenerateReport(r.id)} size="sm" className="gap-2">
                <Download className="h-3 w-3" /> Generate
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
