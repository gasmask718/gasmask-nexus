// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA RESULTS PAGE — Universal Results Viewer
// ═══════════════════════════════════════════════════════════════════════════════

import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { ResultsPanel, PanelType } from '@/components/results';
import { decodeQueryFromUrl } from '@/hooks/useSmartQuery';
import { AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Map query slugs to panel types
const panelTypeMap: Record<string, PanelType> = {
  'unpaid-stores': 'finance',
  'inactive-10-days': 'stores',
  'inactive-30-days': 'stores',
  'low-inventory': 'inventory',
  'unassigned-stores': 'stores',
  'failed-deliveries': 'deliveries',
  'ambassador-performance': 'ambassadors',
  'slow-stores': 'stores',
  'high-debt': 'finance',
  'missing-inventory': 'inventory',
  'production': 'inventory',
  'wholesale-items': 'wholesale',
  'revenue': 'finance',
  'no-response': 'stores',
  'driver-payments': 'drivers',
};

// Map query slugs to titles
const titleMap: Record<string, string> = {
  'unpaid-stores': 'Unpaid Stores',
  'inactive-10-days': 'Stores Inactive 10+ Days',
  'inactive-30-days': 'Stores Inactive 30+ Days',
  'low-inventory': 'Low Inventory Items',
  'unassigned-stores': 'Unassigned Stores',
  'failed-deliveries': 'Failed Deliveries',
  'ambassador-performance': 'Ambassador Performance',
  'slow-stores': 'Slow/Inactive Stores',
  'high-debt': 'High Debt Stores',
  'missing-inventory': 'Missing Inventory',
  'production': 'Production Batches',
  'wholesale-items': 'Wholesale Items',
  'revenue': 'Revenue by Brand',
  'no-response': 'No Response Stores',
  'driver-payments': 'Driver Payments Due',
};

export default function ResultsPage() {
  const [searchParams] = useSearchParams();

  const queryDef = useMemo(() => decodeQueryFromUrl(searchParams), [searchParams]);
  const querySlug = searchParams.get('query') || '';
  const panelType = panelTypeMap[querySlug] || (searchParams.get('panel') as PanelType) || 'stores';
  const title = titleMap[querySlug] || querySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  if (!queryDef) {
    return (
      <GrabbaLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Card className="p-8 text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Query Specified</h2>
            <p className="text-muted-foreground">
              Click on any KPI card or statistic to view detailed results here.
            </p>
          </Card>
        </div>
      </GrabbaLayout>
    );
  }

  return (
    <GrabbaLayout>
      <div className="h-[calc(100vh-100px)] p-4">
        <ResultsPanel
          title={title}
          type={panelType}
          query={queryDef}
          autoRun={true}
          showMyStoresFilter={panelType === 'stores' || panelType === 'deliveries'}
          className="h-full"
        />
      </div>
    </GrabbaLayout>
  );
}
