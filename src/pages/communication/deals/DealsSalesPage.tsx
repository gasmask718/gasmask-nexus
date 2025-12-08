import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  AlertTriangle,
  Truck,
  Plus,
  RefreshCw
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DealsPipelinePanel from '@/components/communication/deals/DealsPipelinePanel';
import LiveNegotiationsPanel from '@/components/communication/deals/LiveNegotiationsPanel';
import ApprovalsPanel from '@/components/communication/deals/ApprovalsPanel';
import RefundsPanel from '@/components/communication/deals/RefundsPanel';
import DispatchPanel from '@/components/communication/deals/DispatchPanel';

export default function DealsSalesPage() {
  const { data: dealStats } = useQuery({
    queryKey: ['deal-stats'],
    queryFn: async () => {
      const [deals, pendingApprovals, refunds, dispatches] = await Promise.all([
        supabase.from('deals').select('id, status, expected_value').eq('status', 'open'),
        supabase.from('deals').select('id').eq('status', 'pending_approval'),
        supabase.from('refund_tickets').select('id').eq('status', 'pending_approval'),
        supabase.from('dispatch_triggers').select('id').eq('status', 'pending'),
      ]);
      
      const totalValue = (deals.data || []).reduce((sum, d) => sum + (Number(d.expected_value) || 0), 0);
      
      return {
        openDeals: deals.data?.length || 0,
        totalValue,
        pendingApprovals: (pendingApprovals.data?.length || 0) + (refunds.data?.length || 0),
        pendingDispatches: dispatches.data?.length || 0,
      };
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-500" />
            Deals & Sales
          </h1>
          <p className="text-muted-foreground">
            AI-powered sales pipeline, negotiations, approvals, and dispatch
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Deal
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Deals</p>
                <p className="text-3xl font-bold">{dealStats?.openDeals || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <p className="text-3xl font-bold">
                  ${(dealStats?.totalValue || 0).toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
                <p className="text-3xl font-bold">{dealStats?.pendingApprovals || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ready to Dispatch</p>
                <p className="text-3xl font-bold">{dealStats?.pendingDispatches || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Truck className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="pipeline" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="negotiations" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Live Negotiations
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Approvals
            {dealStats?.pendingApprovals ? (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                {dealStats.pendingApprovals}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="refunds" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Issues & Refunds
          </TabsTrigger>
          <TabsTrigger value="dispatch" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Dispatch
            {dealStats?.pendingDispatches ? (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {dealStats.pendingDispatches}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <DealsPipelinePanel />
        </TabsContent>

        <TabsContent value="negotiations">
          <LiveNegotiationsPanel />
        </TabsContent>

        <TabsContent value="approvals">
          <ApprovalsPanel />
        </TabsContent>

        <TabsContent value="refunds">
          <RefundsPanel />
        </TabsContent>

        <TabsContent value="dispatch">
          <DispatchPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
