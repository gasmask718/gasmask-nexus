/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SHARED STORE PERFORMANCE TABS — Canonical Analytics Tabs
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * RULE: Performance, Calls, and Revenue tabs MUST appear identically on every
 * store profile page. Adding a tab here propagates to ALL store profiles.
 * Pages MAY wrap this in a larger Tabs group with additional page-specific tabs.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StorePerformanceTab } from '@/components/store/StorePerformanceTab';
import { StoreCallIntelligenceTab } from '@/components/store/StoreCallIntelligenceTab';
import { StoreRevenueIntelligenceTab } from '@/components/revenue/StoreRevenueIntelligenceTab';
import { TrendingUp, Headphones, Flame } from 'lucide-react';

interface SharedStorePerformanceTabsProps {
  storeId: string;
  storeName: string;
}

export function SharedStorePerformanceTabs({ storeId, storeName }: SharedStorePerformanceTabsProps) {
  return (
    <Tabs defaultValue="performance" className="w-full">
      <TabsList className="grid w-full grid-cols-3 gap-1">
        <TabsTrigger value="performance" className="text-xs sm:text-sm">
          <TrendingUp className="h-4 w-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Performance</span>
          <span className="sm:hidden">Perf</span>
        </TabsTrigger>
        <TabsTrigger value="calls" className="text-xs sm:text-sm">
          <Headphones className="h-4 w-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Calls</span>
          <span className="sm:hidden">Calls</span>
        </TabsTrigger>
        <TabsTrigger value="revenue" className="text-xs sm:text-sm">
          <Flame className="h-4 w-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Revenue</span>
          <span className="sm:hidden">Rev</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="performance">
        <StorePerformanceTab storeId={storeId} storeName={storeName} />
      </TabsContent>
      <TabsContent value="calls">
        <StoreCallIntelligenceTab storeId={storeId} />
      </TabsContent>
      <TabsContent value="revenue">
        <StoreRevenueIntelligenceTab storeId={storeId} />
      </TabsContent>
    </Tabs>
  );
}
