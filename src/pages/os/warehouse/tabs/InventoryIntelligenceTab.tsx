import { StoreInventoryOnHand } from '@/components/inventory/StoreInventoryOnHand';
import { ReorderAlerts } from '@/components/inventory/ReorderAlerts';
import { TubeBagRatioCard } from '@/components/inventory/TubeBagRatioCard';
import { InvoiceRepairStatus } from '@/components/inventory/InvoiceRepairStatus';
import { HistoricalRepairPanel } from '@/components/inventory/HistoricalRepairPanel';
import { GrossMarginSummaryCard, ProductMarginRankingCard, BrandMarginCard, MarginAlertsCard } from '@/components/inventory/MarginIntelligenceCards';

export function InventoryIntelligenceTab() {
  return (
    <div className="space-y-6">
      {/* Margin Intelligence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GrossMarginSummaryCard />
        <MarginAlertsCard />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProductMarginRankingCard />
        <BrandMarginCard />
      </div>

      {/* On-Hand Inventory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StoreInventoryOnHand type="tubes" />
        <StoreInventoryOnHand type="bags" />
      </div>

      {/* Reorder Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ReorderAlerts type="tubes" />
        <ReorderAlerts type="bags" />
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TubeBagRatioCard />
        <InvoiceRepairStatus />
      </div>

      {/* Historical Invoice Repair */}
      <HistoricalRepairPanel />
    </div>
  );
}
