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
import { StoreAccountBriefing } from '@/components/store/StoreAccountBriefing';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


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

type GroupProps = SharedStoreCoreIntelligenceProps;

export function StoreProfileInventoryGroup({ storeId, role = 'admin' }: Pick<GroupProps, 'storeId' | 'role'>) {
  return (
    <Tabs defaultValue="current" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="current">Current Inventory</TabsTrigger>
        <TabsTrigger value="sales">Sell-through</TabsTrigger>
        <TabsTrigger value="field">Field Delivery History</TabsTrigger>
        <TabsTrigger value="catalog">Product Catalog</TabsTrigger>
      </TabsList>
      <TabsContent value="current" className="mt-4"><UnifiedTubeIntelligenceCard storeId={storeId} role={role} /></TabsContent>
      <TabsContent value="sales" className="mt-4"><SellThroughIntelCard storeId={storeId} /></TabsContent>
      <TabsContent value="field" className="mt-4"><StoreVisitInventoryCard storeId={storeId} /></TabsContent>
      <TabsContent value="catalog" className="mt-4"><ProductCatalogCard storeId={storeId} /></TabsContent>
    </Tabs>
  );
}

export function StoreProfileTasksGroup({ storeId, storeName }: Pick<GroupProps, 'storeId' | 'storeName'>) {
  return (
    <Tabs defaultValue="open" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="open">Open & Scheduled</TabsTrigger>
        <TabsTrigger value="requirements">Visit Requirements</TabsTrigger>
      </TabsList>
      <TabsContent value="open" className="mt-4"><OpportunitiesSection storeId={storeId} storeName={storeName} /></TabsContent>
      <TabsContent value="requirements" className="mt-4 space-y-4"><ActionsNeededCard storeId={storeId} /><VisitSummaryCard storeId={storeId} /></TabsContent>
    </Tabs>
  );
}

export function StoreProfileFinanceGroup({ storeId, onCreateInvoice }: Pick<GroupProps, 'storeId' | 'onCreateInvoice'>) {
  return (
    <Tabs defaultValue="summary" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="summary">Summary & Last Order</TabsTrigger>
        <TabsTrigger value="invoices">Invoice History</TabsTrigger>
        <TabsTrigger value="sell-through">Sell-through</TabsTrigger>
      </TabsList>
      <TabsContent value="summary" className="mt-4 space-y-4"><StoreAccountSummaryCard storeId={storeId} /><LastOrderSnapshotPanel storeId={storeId} /></TabsContent>
      <TabsContent value="invoices" className="mt-4"><InvoiceHistoryCard storeId={storeId} onCreateInvoice={onCreateInvoice} /></TabsContent>
      <TabsContent value="sell-through" className="mt-4"><SellThroughIntelCard storeId={storeId} /></TabsContent>
    </Tabs>
  );
}

// Individual relationship panes — exported so a host page can render ONE
// navigation layer instead of nesting tabs inside tabs.
export function StoreRelationshipOverview({ storeId }: Pick<GroupProps, 'storeId'>) {
  return (
    <div className="space-y-4">
      <BrandRelationshipsPanel storeId={storeId} />
      <StoreHealthScoreCard storeId={storeId} />
    </div>
  );
}

export function StoreRelationshipCommunication({ storeId, storeName }: Pick<GroupProps, 'storeId' | 'storeName'>) {
  return <StoreCadencePanel storeId={storeId} storeName={storeName} />;
}

export function StoreRelationshipBriefing({ storeId }: Pick<GroupProps, 'storeId'>) {
  return <StoreAccountBriefing storeId={storeId} />;
}

export function StoreRelationshipCadence({ storeId, storeName }: Pick<GroupProps, 'storeId' | 'storeName'>) {
  return <StoreCadenceSettings storeId={storeId} storeName={storeName} />;
}

export function StoreProfileRelationshipGroup({ storeId, storeName }: Pick<GroupProps, 'storeId' | 'storeName'>) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="communication">Communication</TabsTrigger>
        <TabsTrigger value="briefing">AI Briefing</TabsTrigger>
        <TabsTrigger value="preferences">Cadence</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-4 space-y-4"><StoreRelationshipOverview storeId={storeId} /></TabsContent>
      <TabsContent value="communication" className="mt-4"><StoreRelationshipCommunication storeId={storeId} storeName={storeName} /></TabsContent>
      <TabsContent value="briefing" className="mt-4"><StoreRelationshipBriefing storeId={storeId} /></TabsContent>
      <TabsContent value="preferences" className="mt-4"><StoreRelationshipCadence storeId={storeId} storeName={storeName} /></TabsContent>
    </Tabs>
  );
}


export function StoreProfileFieldOpsGroup({
  storeId,
  role = 'admin',
  sellsFlowers = false,
  sellsFlowersNote = null,
  sellsFlowersFlaggedAt = null,
  sellsFlowersFlaggedBy = null,
  onSellsFlowersUpdate,
}: Pick<GroupProps, 'storeId' | 'role' | 'sellsFlowers' | 'sellsFlowersNote' | 'sellsFlowersFlaggedAt' | 'sellsFlowersFlaggedBy' | 'onSellsFlowersUpdate'>) {
  return (
    <Tabs defaultValue="compliance" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="compliance">Stickers & Compliance</TabsTrigger>
        <TabsTrigger value="activity">Field Activity</TabsTrigger>
        <TabsTrigger value="attributes">Store Intelligence</TabsTrigger>
      </TabsList>
      <TabsContent value="compliance" className="mt-4 space-y-4"><StoreBrandFlagStickers storeId={storeId} /><BrandStickersCard storeId={storeId} role={role} /></TabsContent>
      <TabsContent value="activity" className="mt-4 space-y-4"><StoreFieldActivityPanel storeId={storeId} /><StoreVisitInventoryCard storeId={storeId} /></TabsContent>
      <TabsContent value="attributes" className="mt-4"><SellsFlowersToggle storeId={storeId} initialValue={sellsFlowers} initialNote={sellsFlowersNote} flaggedAt={sellsFlowersFlaggedAt} flaggedBy={sellsFlowersFlaggedBy} readOnly={role === 'driver'} onUpdate={onSellsFlowersUpdate} /></TabsContent>
    </Tabs>
  );
}

export function StoreProfileNotesGroup({ storeId, storeName, onLogInteraction }: Pick<GroupProps, 'storeId' | 'storeName' | 'onLogInteraction'>) {
  return (
    <Tabs defaultValue="notes" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="interactions">Interactions</TabsTrigger>
        <TabsTrigger value="field">Field Activity</TabsTrigger>
      </TabsList>
      <TabsContent value="notes" className="mt-4"><BrandScopedNotesSection storeId={storeId} storeName={storeName} /></TabsContent>
      <TabsContent value="interactions" className="mt-4"><RecentStoreInteractions storeId={storeId} onLogInteraction={onLogInteraction} /></TabsContent>
      <TabsContent value="field" className="mt-4"><StoreFieldActivityPanel storeId={storeId} /></TabsContent>
    </Tabs>
  );
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

      {/* ══════════════ AI Briefing (cached, store_ai_briefing) ══════════════ */}
      <StoreAccountBriefing storeId={storeId} />

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
