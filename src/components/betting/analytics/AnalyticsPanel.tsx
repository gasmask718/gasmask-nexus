import { useState } from 'react';
import { BarChart3, Loader2, FileX } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useAnalyticsData, DEFAULT_FILTERS, AnalyticsFilters as FilterType } from '@/hooks/useAnalyticsData';
import { AnalyticsKPIHeader } from '@/components/betting/analytics/AnalyticsKPIHeader';
import { AnalyticsFilters } from '@/components/betting/analytics/AnalyticsFilters';
import { BreakdownTable } from '@/components/betting/analytics/BreakdownTable';
import { ConfidenceBandsChart } from '@/components/betting/analytics/ConfidenceBandsChart';
import { DailyPerformanceChart } from '@/components/betting/analytics/DailyPerformanceChart';
import { EntryLedger } from '@/components/betting/analytics/EntryLedger';
import { PerformanceInsights } from '@/components/betting/analytics/PerformanceInsights';
import { ComplianceBanner } from '@/components/betting/analytics/ComplianceBanner';

/**
 * AnalyticsPanel - Embeddable analytics component for the Sports Betting OS
 * Can be used as a standalone section/tab within the main OS page
 */
export function AnalyticsPanel() {
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

  const hasNoData = !isLoading && (!entries || entries.length === 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Performance & ROI Analytics</h2>
          <p className="text-muted-foreground text-sm">State-aware performance tracking for settled entries</p>
        </div>
      </div>

      {/* Compliance Banner */}
      <ComplianceBanner />

      {/* Filters */}
      <AnalyticsFilters filters={filters} onChange={setFilters} />

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading analytics data...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {hasNoData && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileX className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Settled Entries Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Analytics will populate after you settle your first entries. 
              Go to the Entries tab to log and settle picks.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Content - Only show when data exists */}
      {!isLoading && entries && entries.length > 0 && (
        <>
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
        </>
      )}
    </div>
  );
}
