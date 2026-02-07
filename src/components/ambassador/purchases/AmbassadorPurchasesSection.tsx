/**
 * Ambassador Purchases Section for Admin Profile (Floor 8)
 * Shows purchase KPIs, table, create order, and export
 */
import { useState } from 'react';
import { ShoppingBag, Plus, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAmbassadorPurchaseHistory, useAmbassadorPurchaseSummary } from '@/hooks/useAmbassadorPurchases';
import { AmbassadorPurchasesTable, PurchaseSummaryKPIs, CreateAmbassadorOrderModal, PurchaseFiltersBar } from '@/components/ambassador/purchases';
import { ExportButton } from '@/components/crud/ExportButton';
import type { PurchaseFilters } from '@/hooks/useAmbassadorPurchases';

interface AmbassadorPurchasesSectionProps {
  ambassadorUserId: string;
  ambassadorId?: string;
  ambassadorName: string;
}

export function AmbassadorPurchasesSection({
  ambassadorUserId,
  ambassadorId,
  ambassadorName,
}: AmbassadorPurchasesSectionProps) {
  const [filters, setFilters] = useState<PurchaseFilters>({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: purchases = [], isLoading } = useAmbassadorPurchaseHistory(ambassadorUserId, filters);
  const { data: summary, isLoading: summaryLoading } = useAmbassadorPurchaseSummary(ambassadorUserId);

  const exportData = purchases.map(p => ({
    order_number: p.order_number,
    status: p.status,
    source: p.order_source,
    items: p.items.length,
    subtotal: p.subtotal,
    discount: p.discount_total,
    total: p.total,
    created_at: p.created_at,
    paid_at: p.paid_at || '',
  }));

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <PurchaseSummaryKPIs
        summary={summary as any}
        isLoading={summaryLoading}
      />

      {/* Actions + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Order for {ambassadorName}
        </Button>

        <ExportButton
          data={exportData}
          filename={`ambassador-purchases-${ambassadorName.replace(/\s+/g, '-').toLowerCase()}`}
          columns={[
            { key: 'order_number', label: 'Order #' },
            { key: 'status', label: 'Status' },
            { key: 'source', label: 'Source' },
            { key: 'items', label: 'Items' },
            { key: 'subtotal', label: 'Subtotal' },
            { key: 'discount', label: 'Discount' },
            { key: 'total', label: 'Total' },
            { key: 'created_at', label: 'Date' },
            { key: 'paid_at', label: 'Paid At' },
          ]}
        />

        <div className="flex-1">
          <PurchaseFiltersBar filters={filters} onChange={setFilters} />
        </div>
      </div>

      {/* Purchases Table */}
      <AmbassadorPurchasesTable
        purchases={purchases}
        isLoading={isLoading}
        showSource
      />

      {/* Create Order Modal */}
      <CreateAmbassadorOrderModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        preselectedAmbassadorUserId={ambassadorUserId}
        preselectedAmbassadorId={ambassadorId}
        preselectedAmbassadorName={ambassadorName}
      />
    </div>
  );
}
