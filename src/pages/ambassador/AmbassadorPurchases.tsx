/**
 * Ambassador Portal — My Purchases Page
 * Shows ambassador's own purchase history with filters and detail drawer
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, ArrowRight, RefreshCw, Plus } from 'lucide-react';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { Button } from '@/components/ui/button';
import { useMyPurchases, useAmbassadorPurchaseSummary } from '@/hooks/useAmbassadorPurchases';
import { useAuth } from '@/contexts/AuthContext';
import { AmbassadorPurchasesTable, PurchaseSummaryKPIs, PurchaseFiltersBar } from '@/components/ambassador/purchases';
import type { PurchaseFilters } from '@/hooks/useAmbassadorPurchases';
import { format } from 'date-fns';

function PurchasesContent() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<PurchaseFilters>({});
  const { data: purchases = [], isLoading, dataUpdatedAt, refetch } = useMyPurchases(filters);
  const { data: summary, isLoading: summaryLoading } = useAmbassadorPurchaseSummary(user?.id);

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <PurchaseSummaryKPIs
        summary={summary as any}
        isLoading={summaryLoading}
      />

      {/* Filters + Refresh */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <PurchaseFiltersBar filters={filters} onChange={setFilters} />
        </div>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground">
              Updated {format(new Date(dataUpdatedAt), 'h:mm:ss a')}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Purchases Table */}
      <AmbassadorPurchasesTable
        purchases={purchases}
        isLoading={isLoading}
        showSource
      />
    </div>
  );
}

export default function AmbassadorPurchases() {
  return (
    <PortalRBACGate allowedRoles={['ambassador', 'admin']} portalName="Ambassador Portal">
      <AmbassadorLayout
        title="My Purchases"
        subtitle="Your purchase history"
        backPath="/ambassador/dashboard"
        portalIcon={<ShoppingBag className="h-4 w-4 text-primary-foreground" />}
      >
        <PurchasesContent />
      </AmbassadorLayout>
    </PortalRBACGate>
  );
}
