import { useState } from 'react';
import { StoreInventoryOnHand } from '@/components/inventory/StoreInventoryOnHand';
import { ReorderAlerts } from '@/components/inventory/ReorderAlerts';
import { TubeBagRatioCard } from '@/components/inventory/TubeBagRatioCard';
import { InvoiceRepairStatus } from '@/components/inventory/InvoiceRepairStatus';
import { HistoricalRepairPanel } from '@/components/inventory/HistoricalRepairPanel';
import { GrossMarginSummaryCard, ProductMarginRankingCard, BrandMarginCard, MarginAlertsCard } from '@/components/inventory/MarginIntelligenceCards';
import { SupplierLeaderboardCard } from '@/components/suppliers/SupplierLeaderboardCard';
import { SupplierOverviewCard } from '@/components/suppliers/SupplierOverviewCard';
import { SupplierRankingsTable } from '@/components/suppliers/SupplierRankingsTable';
import { SupplierProductRiskTable } from '@/components/suppliers/SupplierProductRiskTable';
import { SupplierActionQueue } from '@/components/suppliers/SupplierActionQueue';
import { SupplierPriceAlertsPanel } from '@/components/suppliers/SupplierPriceAlertsPanel';
import { SupplierProductBreakdown } from '@/components/suppliers/SupplierProductBreakdown';

export function InventoryIntelligenceTab() {
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Supplier Intelligence */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Supplier Intelligence</h2>
      </div>

      {/* Overview Cards */}
      <SupplierOverviewCard />

      {/* Rankings & Action Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SupplierRankingsTable />
        </div>
        <SupplierActionQueue />
      </div>

      {/* Drill-down Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SupplierPriceAlertsPanel />
        <SupplierLeaderboardCard onSelect={setSelectedSupplier} />
      </div>

      {selectedSupplier && (
        <div className="space-y-4">
          <SupplierProductRiskTable supplier={selectedSupplier} />
          <SupplierProductBreakdown supplier={selectedSupplier} />
        </div>
      )}

      {/* Margin Intelligence */}
      <div className="space-y-4 border-t pt-6">
        <h2 className="text-2xl font-bold">Margin Intelligence</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GrossMarginSummaryCard />
          <MarginAlertsCard />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ProductMarginRankingCard />
          <BrandMarginCard />
        </div>
      </div>

      {/* On-Hand Inventory */}
      <div className="space-y-4 border-t pt-6">
        <h2 className="text-2xl font-bold">On-Hand Inventory</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StoreInventoryOnHand type="tubes" />
          <StoreInventoryOnHand type="bags" />
        </div>
      </div>

      {/* Reorder Alerts */}
      <div className="space-y-4 border-t pt-6">
        <h2 className="text-2xl font-bold">Reorder Alerts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ReorderAlerts type="tubes" />
          <ReorderAlerts type="bags" />
        </div>
      </div>

      {/* Analytics */}
      <div className="space-y-4 border-t pt-6">
        <h2 className="text-2xl font-bold">Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TubeBagRatioCard />
          <InvoiceRepairStatus />
        </div>
      </div>

      {/* Historical Invoice Repair */}
      <div className="border-t pt-6">
        <HistoricalRepairPanel />
      </div>
    </div>
  );
}
