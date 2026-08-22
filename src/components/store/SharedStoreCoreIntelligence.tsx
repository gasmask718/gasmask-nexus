/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SHARED STORE CORE INTELLIGENCE — Canonical Section Registry
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * RULE: Every store profile page (Store Directory, Grabba CRM, Store Master)
 * MUST render this component. Adding a section here automatically propagates
 * to ALL store profiles. Sections may never be removed per-page — they can
 * only transition to read-only via the CanonicalStoreProfileProvider.
 *
 * If a section does not appear on ALL pages, it does NOT belong here.
 */

import { ActionsNeededCard } from '@/components/delivery/ActionsNeededCard';
import { StoreAccountSummaryCard } from '@/components/store/StoreAccountSummaryCard';
import { LastOrderSnapshotPanel } from '@/components/store/LastOrderSnapshotPanel';
import { StoreHealthScoreCard } from '@/components/delivery/StoreHealthScoreCard';
import { VisitSummaryCard } from '@/components/delivery/VisitSummaryCard';
import { StoreCadencePanel } from '@/components/store/StoreCadencePanel';
import { BrandScopedNotesSection } from '@/components/store/BrandScopedNotesSection';
import { OpportunitiesSection } from '@/components/store/OpportunitiesSection';
import { ConnectedStoresCard } from '@/components/store/ConnectedStoresCard';
import { UnifiedTubeIntelligenceCard } from '@/components/store/UnifiedTubeIntelligenceCard';
import { StoreBrandFlagStickers } from '@/components/store/StoreBrandFlagStickers';
import { SellThroughIntelCard } from '@/components/store/SellThroughIntelCard';
import { BrandStickersCard } from '@/components/store/BrandStickersCard';
import { StoreVisitInventoryCard } from '@/components/store/StoreVisitInventoryCard';
import { ProductCatalogCard } from '@/components/store/ProductCatalogCard';
import { SellsFlowersToggle } from '@/components/store/SellsFlowersToggle';
import { RecentStoreInteractions } from '@/components/crm/RecentStoreInteractions';
import { StoreFieldActivityPanel } from '@/components/store/StoreFieldActivityPanel';
import { InvoiceHistoryCard } from '@/components/store/InvoiceHistoryCard';
import { StoreCadenceSettings } from '@/components/store/StoreCadenceSettings';
import { BrandRelationshipsPanel } from '@/components/store/BrandRelationshipsPanel';


export interface SharedStoreCoreIntelligenceProps {
  storeId: string;
  storeName: string;
  /** Role for tube/sticker editability */
  role?: 'admin' | 'ambassador' | 'driver' | 'biker';
  /** Connected stores context */
  storeGroupId?: string | null;
  storeOwnerName?: string | null;
  /** Callbacks — page-specific handlers */
  onConnectionChange?: () => void;
  onLogInteraction?: (storeMasterId?: string) => void;
  onCreateInvoice?: () => void;
  /** Sells-flowers prospecting attribute (store_master) */
  sellsFlowers?: boolean;
  sellsFlowersNote?: string | null;
  sellsFlowersFlaggedAt?: string | null;
  sellsFlowersFlaggedBy?: string | null;
  onSellsFlowersUpdate?: () => void;
}

export function SharedStoreCoreIntelligence({
  storeId,
  storeName,
  role = 'admin',
  storeGroupId,
  storeOwnerName,
  onConnectionChange,
  onLogInteraction,
  onCreateInvoice,
  sellsFlowers = false,
  sellsFlowersNote = null,
  sellsFlowersFlaggedAt = null,
  sellsFlowersFlaggedBy = null,
  onSellsFlowersUpdate,
}: SharedStoreCoreIntelligenceProps) {
  return (
    <>
      {/* ══════════════ Account Summary (v_store_summary) ══════════════ */}
      <StoreAccountSummaryCard storeId={storeId} />

      {/* ══════════════ Health & Governance ══════════════ */}
      <ActionsNeededCard storeId={storeId} />
      <StoreHealthScoreCard storeId={storeId} />
      <VisitSummaryCard storeId={storeId} />

      {/* ══════════════ Communication & Notes ══════════════ */}
      <StoreCadencePanel storeId={storeId} storeName={storeName} />
      <BrandScopedNotesSection storeId={storeId} storeName={storeName} />

      {/* ══════════════ Brand Relationships ══════════════ */}
      <BrandRelationshipsPanel storeId={storeId} />

      {/* ══════════════ Pipeline & Connections ══════════════ */}
      <OpportunitiesSection storeId={storeId} storeName={storeName} />
      <ConnectedStoresCard
        storeId={storeId}
        currentStoreName={storeName}
        currentStoreGroupId={storeGroupId}
        currentStoreOwnerName={storeOwnerName}
        onConnectionChange={onConnectionChange}
      />

      {/* ══════════════ Last Order Snapshot Intelligence ══════════════ */}
      <LastOrderSnapshotPanel storeId={storeId} />

      {/* ══════════════ Per-brand flags (same control as quick-view) ══════════════ */}
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <StoreBrandFlagStickers storeId={storeId} className="border-t-0 pt-0" />
      </div>

      {/* ══════════════ Inventory Intelligence ══════════════ */}
      <UnifiedTubeIntelligenceCard storeId={storeId} role={role} />
      <SellThroughIntelCard storeId={storeId} />
      <BrandStickersCard storeId={storeId} role={role} />
      <StoreVisitInventoryCard storeId={storeId} />
      <ProductCatalogCard storeId={storeId} />

      {/* ══════════════ Store Attributes ══════════════ */}
      <SellsFlowersToggle
        storeId={storeId}
        initialValue={sellsFlowers}
        initialNote={sellsFlowersNote}
        flaggedAt={sellsFlowersFlaggedAt}
        flaggedBy={sellsFlowersFlaggedBy}
        readOnly={role === 'driver'}
        onUpdate={onSellsFlowersUpdate}
      />

      {/* ══════════════ Activity & History ══════════════ */}
      <RecentStoreInteractions
        storeId={storeId}
        onLogInteraction={onLogInteraction}
      />
      <StoreFieldActivityPanel storeId={storeId} />

      {/* ══════════════ Financial ══════════════ */}
      <InvoiceHistoryCard
        storeId={storeId}
        onCreateInvoice={onCreateInvoice}
      />
      <StoreCadenceSettings storeId={storeId} storeName={storeName} />
    </>
  );
}
