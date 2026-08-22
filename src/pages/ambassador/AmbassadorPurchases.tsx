/**
 * Ambassador Portal — My Purchases Page
 * Shows ambassador's own purchase history with filters and detail drawer
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, ArrowRight, RefreshCw, Plus, Package } from 'lucide-react';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { Button } from '@/components/ui/button';
import { useMyPurchases, useAmbassadorPurchaseSummary } from '@/hooks/useAmbassadorPurchases';
import { useAuth } from '@/contexts/AuthContext';
import { AmbassadorPurchasesTable, PurchaseSummaryKPIs, PurchaseFiltersBar } from '@/components/ambassador/purchases';
import { RequestBoxesModal } from '@/components/ambassador/purchases/RequestBoxesModal';
import { MyBoxRequests } from '@/components/ambassador/purchases/MyBoxRequests';
import type { PurchaseFilters } from '@/hooks/useAmbassadorPurchases';
import { format } from 'date-fns';

function PurchasesContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<PurchaseFilters>({});
  const [showRequestModal, setShowRequestModal] = useState(false);
  const { data: purchases = [], isLoading, dataUpdatedAt, refetch } = useMyPurchases(filters);
  const { data: summary, isLoading: summaryLoading } = useAmbassadorPurchaseSummary(user?.id);

  return (
    <div className="space-y-6">
      {/* Header CTA */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Browse the product catalog, or request boxes for admin approval.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowRequestModal(true)}>
            <Package className="h-4 w-4 mr-1" />
            Request Boxes
          </Button>
          <Button onClick={() => navigate('/ambassador/catalog')}>
            <Plus className="h-4 w-4 mr-1" />
            New Purchase
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <PurchaseSummaryKPIs
        summary={summary as any}
        isLoading={summaryLoading}
      />

      {/* My box requests */}
      <MyBoxRequests />

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

      {/* Request Boxes Modal */}
      <RequestBoxesModal open={showRequestModal} onOpenChange={setShowRequestModal} />
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
