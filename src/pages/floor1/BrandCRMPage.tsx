/**
 * Brand CRM — Production-ready brand-scoped operating cockpit.
 * Shows brand-level sell-through, health, execution priorities, and store table.
 * Uses canonical brand registry + v_global_sell_through_analytics + store_master.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { CANONICAL_BRANDS, type CanonicalBrandId, CANONICAL_BRAND_IDS, getBrandDisplayName } from '@/config/brands';
import { useBrandCRMAnalytics } from '@/hooks/useBrandCRMAnalytics';
import { BrandCRMSelector } from '@/components/brand-crm/BrandSelector';
import { BrandKpiStrip } from '@/components/brand-crm/BrandKpiStrip';
import { BrandExecutionPanel } from '@/components/brand-crm/BrandExecutionPanel';
import { BrandStoresTable } from '@/components/brand-crm/BrandStoresTable';

const STORAGE_KEY = 'dynasty-brand-crm-last-brand';

function getPersistedBrand(): CanonicalBrandId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && CANONICAL_BRAND_IDS.includes(saved as CanonicalBrandId)) {
      return saved as CanonicalBrandId;
    }
  } catch {}
  return 'gasmask';
}

export default function BrandCRMPage() {
  const [selectedBrand, setSelectedBrand] = useState<CanonicalBrandId>(getPersistedBrand);
  const brand = CANONICAL_BRANDS[selectedBrand];
  const { storeRows, kpis, isLoading, refetch } = useBrandCRMAnalytics(selectedBrand);

  // Persist brand selection
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, selectedBrand);
    } catch {}
  }, [selectedBrand]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6" style={{ color: brand.primaryColor }} />
              <h1 className="text-2xl font-bold">Brand CRM</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Brand-scoped sell-through intelligence for {getBrandDisplayName(selectedBrand)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <BrandCRMSelector value={selectedBrand} onChange={setSelectedBrand} />
          <Button onClick={refetch} variant="outline" size="icon" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <BrandKpiStrip kpis={kpis} isLoading={isLoading} brandColor={brand.primaryColor} />

      {/* Execution Priority Panel */}
      <BrandExecutionPanel stores={storeRows} isLoading={isLoading} brandColor={brand.primaryColor} />

      {/* Main Stores Table */}
      <BrandStoresTable
        stores={storeRows}
        isLoading={isLoading}
        brandColor={brand.primaryColor}
        brandId={selectedBrand}
      />
    </div>
  );
}
