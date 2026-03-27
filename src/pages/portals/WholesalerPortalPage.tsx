import React, { useState } from 'react';
import { EnhancedPortalLayout } from '@/components/portal';
import { useWholesalerFulfillments } from '@/services/wholesaler/useWholesalerFulfillments';
import { useWholesalerPayouts } from '@/services/wholesaler/useWholesalerPayouts';
import { useWholesalerProfile } from '@/services/wholesaler/useWholesalerProfile';
import { useWholesalerAnalytics } from '@/services/wholesaler/useWholesalerAnalytics';
import { useWholesalerDisputes } from '@/services/wholesaler/useWholesalerDisputes';
import { Warehouse, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ExecutiveKPIPanel,
  FulfillmentCommandGrid,
  SettlementPipelineVisualizer,
  SettlementDetail,
  PayoutLedgerAdvanced,
  LiabilityBanner,
  DisputeView,
  RevenueAnalyticsSection,
  BulkUploadModule,
} from '@/components/wholesaler-console';

type ConsoleTab = 'fulfillment' | 'settlement' | 'payouts' | 'disputes' | 'analytics' | 'bulk-upload';

export default function WholesalerPortalPage() {
  const { profile, isLoading: profileLoading } = useWholesalerProfile();
  const { fulfillments, isLoading: fulfillmentsLoading, generateLabel, isGeneratingLabel, markShipped, isMarkingShipped } = useWholesalerFulfillments();
  const { payouts, isLoading: payoutsLoading } = useWholesalerPayouts();
  const { revenueData, pipelineData, disputeTrend, trendKPIs, liabilities, isLoading: analyticsLoading } = useWholesalerAnalytics();
  const { disputes, isLoading: disputesLoading, hasDisputes } = useWholesalerDisputes();
  const [activeTab, setActiveTab] = useState<ConsoleTab>('fulfillment');

  const isLoading = profileLoading || fulfillmentsLoading || payoutsLoading;

  if (isLoading && !fulfillments.length) {
    return (
      <EnhancedPortalLayout
        title="Operations Console"
        subtitle="Wholesaler command center"
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
      subtitle={profile?.company_name || 'Wholesaler Dashboard'}
      portalIcon={<Warehouse className="h-4 w-4 text-primary-foreground" />}
      quickActions={[]}
    >
      {/* Liability Warning — always visible if present */}
      <LiabilityBanner totalLiability={liabilities.total} itemCount={liabilities.items.length} />

      {/* Financial Heartbeat — Top KPIs */}
      <div className="mt-4">
        <ExecutiveKPIPanel kpis={trendKPIs} />
      </div>

      {/* Settlement Pipeline Overview */}
      <div className="mt-4">
        <SettlementPipelineVisualizer stages={pipelineData} />
      </div>

      {/* Main Console Tabs */}
      <div className="mt-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ConsoleTab)}>
          <TabsList className="w-full grid grid-cols-6 mb-4">
            <TabsTrigger value="fulfillment" className="text-xs font-semibold">
              Orders
              {fulfillments.filter(f => f.status === 'pending').length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                  {fulfillments.filter(f => f.status === 'pending').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="settlement" className="text-xs font-semibold">
              Settlement
            </TabsTrigger>
            <TabsTrigger value="payouts" className="text-xs font-semibold">
              Payouts
            </TabsTrigger>
            <TabsTrigger value="disputes" className="text-xs font-semibold">
              Disputes
              {hasDisputes && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                  {disputes.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs font-semibold">
              Analytics
            </TabsTrigger>
            <TabsTrigger value="bulk-upload" className="text-xs font-semibold">
              Bulk Upload
            </TabsTrigger>
          </TabsList>

          {/* Fulfillment Queue */}
          <TabsContent value="fulfillment">
            <FulfillmentCommandGrid
              fulfillments={fulfillments}
              isLoading={fulfillmentsLoading}
              onGenerateLabel={generateLabel}
              onMarkShipped={markShipped}
              isGeneratingLabel={isGeneratingLabel}
              isMarkingShipped={isMarkingShipped}
              currentVendorId={profile?.id}
            />
          </TabsContent>

          {/* Settlement Detail */}
          <TabsContent value="settlement">
            <SettlementDetail payouts={payouts} />
            {payouts.filter(p => p.status === 'in_settlement').length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No funds currently in settlement.
              </div>
            )}
          </TabsContent>

          {/* Payout Ledger */}
          <TabsContent value="payouts">
            <PayoutLedgerAdvanced payouts={payouts} isLoading={payoutsLoading} />
          </TabsContent>

          {/* Disputes (Read Only) */}
          <TabsContent value="disputes">
            <DisputeView disputes={disputes} isLoading={disputesLoading} />
            {!hasDisputes && !disputesLoading && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No disputes on record.
              </div>
            )}
          </TabsContent>

          {/* Analytics */}
          <TabsContent value="analytics">
            <RevenueAnalyticsSection revenueData={revenueData} disputeTrend={disputeTrend} />
          </TabsContent>
        </Tabs>
      </div>
    </EnhancedPortalLayout>
  );
}
