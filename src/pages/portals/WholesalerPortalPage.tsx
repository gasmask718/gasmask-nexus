import React, { useState } from 'react';
import { EnhancedPortalLayout } from '@/components/portal';
import { useWholesalerFulfillments } from '@/services/wholesaler/useWholesalerFulfillments';
import { useWholesalerPayouts } from '@/services/wholesaler/useWholesalerPayouts';
import { useWholesalerProfile } from '@/services/wholesaler/useWholesalerProfile';
import { useWholesalerAnalytics } from '@/services/wholesaler/useWholesalerAnalytics';
import { Warehouse, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ExecutiveKPIPanel,
  RevenueAnalyticsSection,
  FulfillmentCommandGrid,
  SettlementPipelineVisualizer,
  PayoutLedgerAdvanced,
  PerformanceScorecard,
  LiabilityBanner,
} from '@/components/wholesaler-console';

type ConsoleTab = 'operations' | 'finance' | 'analytics';

export default function WholesalerPortalPage() {
  const { profile, isLoading: profileLoading } = useWholesalerProfile();
  const { fulfillments, isLoading: fulfillmentsLoading, generateLabel, isGeneratingLabel, markShipped, isMarkingShipped } = useWholesalerFulfillments();
  const { payouts, financialSummary, isLoading: payoutsLoading } = useWholesalerPayouts();
  const { revenueData, pipelineData, disputeTrend, performance, trendKPIs, liabilities, isLoading: analyticsLoading } = useWholesalerAnalytics();
  const [activeTab, setActiveTab] = useState<ConsoleTab>('operations');

  const isLoading = profileLoading || fulfillmentsLoading || payoutsLoading;

  if (isLoading && !fulfillments.length) {
    return (
      <EnhancedPortalLayout
        title="Operations Console"
        subtitle="Enterprise wholesaler command center"
        portalIcon={<Warehouse className="h-4 w-4 text-primary-foreground" />}
        quickActions={[]}
      >
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </EnhancedPortalLayout>
    );
  }

  return (
    <EnhancedPortalLayout
      title="Operations Console"
      subtitle={profile?.company_name ? `${profile.company_name} · Enterprise Dashboard` : 'Enterprise wholesaler command center'}
      portalIcon={<Warehouse className="h-4 w-4 text-primary-foreground" />}
      quickActions={[]}
    >
      {/* Liability Warning */}
      <LiabilityBanner totalLiability={liabilities.total} itemCount={liabilities.items.length} />

      {/* Executive KPIs */}
      <div className="mt-4">
        <ExecutiveKPIPanel kpis={trendKPIs} />
      </div>

      {/* Settlement Pipeline */}
      <div className="mt-4">
        <SettlementPipelineVisualizer stages={pipelineData} />
      </div>

      {/* Console Tabs */}
      <div className="mt-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ConsoleTab)}>
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="operations" className="text-xs font-semibold">
              Fulfillment Queue
            </TabsTrigger>
            <TabsTrigger value="finance" className="text-xs font-semibold">
              Payout Ledger
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs font-semibold">
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="operations">
            <FulfillmentCommandGrid
              fulfillments={fulfillments}
              isLoading={fulfillmentsLoading}
              onGenerateLabel={generateLabel}
              onMarkShipped={markShipped}
              isGeneratingLabel={isGeneratingLabel}
              isMarkingShipped={isMarkingShipped}
            />
          </TabsContent>

          <TabsContent value="finance">
            <PayoutLedgerAdvanced payouts={payouts} isLoading={payoutsLoading} />
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <RevenueAnalyticsSection revenueData={revenueData} disputeTrend={disputeTrend} />
              </div>
              <div className="space-y-4">
                <PerformanceScorecard metrics={performance} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </EnhancedPortalLayout>
  );
}
