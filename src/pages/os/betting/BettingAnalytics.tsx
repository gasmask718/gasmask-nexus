import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnalyticsData, DEFAULT_FILTERS, AnalyticsFilters as FilterType } from '@/hooks/useAnalyticsData';
import { AnalyticsKPIHeader } from '@/components/betting/analytics/AnalyticsKPIHeader';
import { AnalyticsFilters } from '@/components/betting/analytics/AnalyticsFilters';
import { BreakdownTable } from '@/components/betting/analytics/BreakdownTable';
import { ConfidenceBandsChart } from '@/components/betting/analytics/ConfidenceBandsChart';
import { DailyPerformanceChart } from '@/components/betting/analytics/DailyPerformanceChart';
import { EntryLedger } from '@/components/betting/analytics/EntryLedger';
import { PerformanceInsights } from '@/components/betting/analytics/PerformanceInsights';
import { ComplianceBanner } from '@/components/betting/analytics/ComplianceBanner';

export default function BettingAnalytics() {
  const [filters, setFilters] = useState<FilterType>(DEFAULT_FILTERS);
  
  const {
    entries,
    isLoading,
    globalMetrics,
    breakdownByState,
    breakdownByPlatform,
    breakdownByFormat,
    breakdownByMarket,
    breakdownBySelection,
    confidenceBands,
    dailyPerformance,
    insights,
    calculatePL,
  } = useAnalyticsData(filters);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Performance Analytics</h1>
          <p className="text-muted-foreground text-sm">Track ROI across states, platforms, and formats</p>
        </div>
      </div>

      {/* Compliance Banner */}
      <ComplianceBanner />

      {/* Filters */}
      <AnalyticsFilters filters={filters} onChange={setFilters} />

      {/* KPI Header */}
      <AnalyticsKPIHeader metrics={globalMetrics} />

      {/* Insights */}
      <PerformanceInsights insights={insights} />

      {/* Charts & Breakdowns */}
      <Tabs defaultValue="curve" className="space-y-4">
        <TabsList>
          <TabsTrigger value="curve">P/L Curve</TabsTrigger>
          <TabsTrigger value="confidence">Confidence Bands</TabsTrigger>
          <TabsTrigger value="breakdowns">Breakdowns</TabsTrigger>
          <TabsTrigger value="ledger">Entry Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="curve">
          <DailyPerformanceChart data={dailyPerformance} />
        </TabsContent>

        <TabsContent value="confidence">
          <ConfidenceBandsChart data={confidenceBands} />
        </TabsContent>

        <TabsContent value="breakdowns" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownTable title="ROI by State" data={breakdownByState} />
            <BreakdownTable title="ROI by Platform" data={breakdownByPlatform} />
            <BreakdownTable title="ROI by Format" data={breakdownByFormat} />
            <BreakdownTable title="ROI by Market" data={breakdownByMarket} />
            <BreakdownTable 
              title="ROI by Selection" 
              data={breakdownBySelection} 
              nameFormatter={(name) => {
                if (name === 'MORE') return '▲ MORE';
                if (name === 'LESS') return '▼ LESS';
                return name;
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="ledger">
          <EntryLedger entries={entries || []} calculatePL={calculatePL} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
