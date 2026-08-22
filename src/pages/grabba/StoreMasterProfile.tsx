import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Package,
  MessageSquare,
  ArrowLeft,
  Store,
  Truck,
  Loader2,
  Users,
  Car,
  Bike,
  Factory,
  TrendingUp,
  Headphones,
  Flame,
  Clock,
  FileText,
  Navigation,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GRABBA_BRAND_CONFIG } from "@/config/grabbaBrands";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL STORE DATA ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
import { CanonicalStoreDataProvider } from "@/components/store/CanonicalStoreDataProvider";
import { useCanonicalStoreData } from "@/hooks/useCanonicalStoreData";
import { CanonicalStoreProfileProvider } from "@/components/store/CanonicalStoreProfile";

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS (Same ones StoreDetail uses — CANONICAL)
// ═══════════════════════════════════════════════════════════════════════════════

// Contacts & People
import { StoreContactsSection } from "@/components/store/StoreContactsSection";
import { StoreQuickNotes } from "@/components/store/StoreQuickNotes";
import { SamplesGivenSection } from "@/components/store/SamplesGivenSection";
import { StoreReviewControls } from "@/components/store/StoreReviewControls";
import { StoreRoleSection } from "@/components/store/StoreRoleSection";

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL SHARED SECTIONS — Drift prevention layer
// Adding a section to these components propagates to ALL store profile pages.
// ═══════════════════════════════════════════════════════════════════════════════
import { SharedStoreCoreIntelligence } from "@/components/store/SharedStoreCoreIntelligence";
import { StoreAccountSummaryCard } from "@/components/store/StoreAccountSummaryCard";
import { TubesSoldHeroStrip } from "@/components/store-profile/TubesSoldHeroStrip";
import { EngagementBanner } from "@/components/store-profile/EngagementBanner";
import { BrandPaymentQuickView } from "@/components/store/BrandPaymentQuickView";
import { SharedStorePerformanceTabs } from "@/components/store/SharedStorePerformanceTabs";

// Components still used directly in page-specific layout
import { StoreHealthBadge } from "@/components/delivery/StoreHealthBadge";
import { StickerStatusPanel } from "@/components/store/StickerStatusPanel";
import { StoreTransactionsCard } from "@/components/store/StoreTransactionsCard";

// CRM-specific components (unique to StoreMaster)
import { LogInteractionModal } from "@/components/crm/LogInteractionModal";
import { CustomerMemoryCoreV2 } from "@/components/grabba/CustomerMemoryCoreV2";
import { StoreAIFuturePanel } from "@/components/grabba/StoreAIFuturePanel";
import { StorePersonalMemoryPanel } from "@/components/grabba/StorePersonalMemoryPanel";
import { PersonalIntelligencePanel } from "@/components/grabba/PersonalIntelligencePanel";
import { VoiceNotesCard } from "@/components/grabba/VoiceNotesCard";
import { NeighborhoodSnapshotCard } from "@/components/store/NeighborhoodSnapshotCard";
import { MemberSinceDisplay } from "@/components/store/MemberSinceDisplay";
import { StoreDangerZone } from "@/components/store/StoreDangerZone";
import { PublicSiteToggleCard } from "@/components/store/PublicSiteToggleCard";

import { getExtractedProfile } from "@/services/profileExtractionService";
import { getStoreRelationshipScore, RelationshipScore } from "@/services/crmInsightsService";
import { UnifiedInteractionModal } from "@/components/store/UnifiedInteractionModal";
import { CreateStoreInvoiceModal } from "@/components/store/CreateStoreInvoiceModal";
import { RouteIntelligence } from "@/components/store/RouteIntelligence";
import { RouteAssignmentDialog } from "@/components/delivery/RouteAssignmentDialog";
import { StoreCallHistoryPanel } from "@/components/store/StoreCallHistoryPanel";


// ═══════════════════════════════════════════════════════════════════════════════
// STORE MASTER PROFILE — Unified store view within Floor 1 CRM
// Now powered by Canonical Store Data Engine
// ═══════════════════════════════════════════════════════════════════════════════

export default function StoreMasterProfile() {
  const params = useParams();
  const id = params.id || params.storeId;

  return (
    <CanonicalStoreDataProvider storeId={id}>
      <CanonicalStoreProfileProvider storeId={id || ''}>
        <StoreMasterProfileInner storeId={id} />
      </CanonicalStoreProfileProvider>
    </CanonicalStoreDataProvider>
  );
}

function StoreMasterProfileInner({ storeId }: { storeId: string | undefined }) {
  const navigate = useNavigate();
  const { selectedBrand } = useGrabbaBrand();
  const { store, isLoading, isCreating, error } = useCanonicalStoreData();

  const [showLogModal, setShowLogModal] = useState(false);
  const [unifiedInteractionModalOpen, setUnifiedInteractionModalOpen] = useState(false);
  const [createInvoiceModalOpen, setCreateInvoiceModalOpen] = useState(false);
  const [dispatchStore, setDispatchStore] = useState<string | null>(null);

  const id = storeId || '';

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY QUERIES (CRM-specific data not in engine)
  // ═══════════════════════════════════════════════════════════════════════════

  const { data: storeContacts } = useQuery({
    queryKey: ["store-contacts-for-modal", id],
    queryFn: async () => {
      const { data } = await supabase.from("store_contacts").select("id, name").eq("store_id", id);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: brandAccounts } = useQuery({
    queryKey: ["brand-accounts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_brand_accounts").select("*").eq("store_master_id", id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: payments } = useQuery({
    queryKey: ["store-payments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_payments")
        .select("*")
        .eq("store_id", id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["store-contacts", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("store_contacts")
        .select("*")
        .eq("store_id", id)
        .order("created_at", { ascending: true });
      if (error) return [];
      return data || [];
    },
    enabled: !!id,
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ["store-interactions", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("contact_interactions")
        .select("*")
        .eq("store_id", id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return [];
      return data || [];
    },
    enabled: !!id,
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["store-visits", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("contact_interactions")
        .select("*")
        .eq("store_id", id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return [];
      return (data || []).filter((d: any) => d.interaction_type === "visit" || d.type === "visit").slice(0, 50);
    },
    enabled: !!id,
  });

  const { data: aiProfile } = useQuery({
    queryKey: ["extracted-profile", id],
    queryFn: () => getExtractedProfile(id),
    enabled: !!id,
  });

  const { data: relationshipScore } = useQuery({
    queryKey: ["relationship-score", id],
    queryFn: () => getStoreRelationshipScore(id),
    enabled: !!id,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════════════
  if (isLoading || isCreating) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">
            {isCreating ? "Creating Store Master record..." : "Loading store profile..."}
          </p>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">Rebuilding profile...</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/grabba/crm")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to CRM
        </Button>
      </div>
    );
  }

  const totalSpent = brandAccounts?.reduce((sum, acc) => sum + Number(acc.total_spent || 0), 0) || 0;
  const activeBrands = brandAccounts?.filter((a) => a.active_status).map((a) => a.brand as string) || [];
  const unpaidBalance =
    payments
      ?.filter((p: any) => p.payment_status !== "paid")
      .reduce((sum: number, p: any) => sum + ((p.owed_amount || 0) - (p.paid_amount || 0)), 0) || 0;

  return (
    <div className="space-y-4 md:space-y-6 p-2 md:p-0 pb-20">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TOP HEADER */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/grabba/crm")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="md:hidden flex-1 flex items-center gap-2 overflow-hidden">
            <Store className="h-6 w-6 text-primary shrink-0" />
            <h1 className="text-xl font-bold tracking-tight truncate">{store.store_name}</h1>
          </div>
        </div>

        <div className="flex-1 w-full pl-2 md:pl-0">
          <div className="flex items-center gap-3 flex-wrap">
            <Store className="hidden md:block h-8 w-8 text-primary" />
            <h1 className="hidden md:block text-2xl md:text-3xl font-bold tracking-tight">{store.store_name}</h1>
            {id && <StoreHealthBadge storeId={id} />}

            {activeBrands.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {activeBrands.map((brand) => {
                  const config =
                    GRABBA_BRAND_CONFIG[brand.toLowerCase().replace(" ", "_") as keyof typeof GRABBA_BRAND_CONFIG];
                  return config ? (
                    <Badge key={brand} className={`${config.pill} text-[10px] md:text-xs`}>
                      {config.icon}
                    </Badge>
                  ) : null;
                })}
              </div>
            )}

            {relationshipScore && (
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${relationshipScore.color}`}>
                {relationshipScore.tier} ({relationshipScore.score})
              </span>
            )}
          </div>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 break-words">
            Floor 1 CRM
            {store.owner_name && <span className="ml-2">• Owner: {store.owner_name}</span>}
          </p>
          {/* Brand Payment Quick View — executive intelligence */}
          <BrandPaymentQuickView storeId={id} />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowLogModal(true)}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Log Interaction
          </Button>
          <Button size="sm" onClick={() => setUnifiedInteractionModalOpen(true)}>
            <Package className="w-4 h-4 mr-2" />
            New Interaction
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MAIN 3-COLUMN LAYOUT */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* LEFT PANEL — Identity, KPIs, Contacts */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-3 space-y-4">
          {/* Store Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Store Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs mb-1">Address</div>
                <div className="font-medium leading-snug">
                  {store.address}
                  <br />
                  {store.city}, {store.state} {store.zip}
                </div>
              </div>
              <div className="flex items-center gap-2 overflow-hidden">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate">{store.phone || "N/A"}</span>
              </div>
              <div className="flex items-center gap-2 overflow-hidden">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate">{store.email || "N/A"}</span>
              </div>
              <MemberSinceDisplay storeId={id} />
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-500">${totalSpent.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total Spent</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{brandAccounts?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Brand Accounts</div>
              </CardContent>
            </Card>
            <Card className={`border-l-4 ${unpaidBalance > 0 ? "border-l-red-500" : "border-l-green-500"}`}>
              <CardContent className="pt-4">
                <div className={`text-2xl font-bold ${unpaidBalance > 0 ? "text-red-500" : "text-green-500"}`}>
                  ${unpaidBalance.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Unpaid Balance</div>
              </CardContent>
            </Card>
          </div>

          {/* Brand Stickers — CANONICAL */}
          <StickerStatusPanel storeId={id} mode="view" role="admin" />

          {/* Store Contacts — CANONICAL */}
          <StoreContactsSection storeId={id} storeName={store.store_name} />

          {/* Quick notes — shared account_notes surface */}
          <Card>
            <CardContent className="pt-6">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Review / Sign-Off
              </div>
              <StoreReviewControls storeId={id} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <StoreQuickNotes storeId={id} />
            </CardContent>
          </Card>


          {/* Samples Given — physical samples handed to this store */}
          <Card>
            <CardContent className="pt-6">
              <SamplesGivenSection storeId={id} variant="full" />
            </CardContent>
          </Card>




          {/* Role Tabs — Ambassadors / Drivers / Bikers / Production */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Store People
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Tabs defaultValue="ambassadors" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="ambassadors" className="text-[10px] md:text-xs px-1">Ambassadors</TabsTrigger>
                  <TabsTrigger value="drivers" className="text-[10px] md:text-xs px-1">Drivers</TabsTrigger>
                  <TabsTrigger value="bikers" className="text-[10px] md:text-xs px-1">Bikers</TabsTrigger>
                  <TabsTrigger value="production" className="text-[10px] md:text-xs px-1">Production</TabsTrigger>
                </TabsList>
                <TabsContent value="ambassadors" className="mt-3">
                  <StoreRoleSection storeId={id} storeName={store.store_name} role="ambassador" embedded />
                </TabsContent>
                <TabsContent value="drivers" className="mt-3">
                  <StoreRoleSection storeId={id} storeName={store.store_name} role="driver" embedded />
                </TabsContent>
                <TabsContent value="bikers" className="mt-3">
                  <StoreRoleSection storeId={id} storeName={store.store_name} role="biker" embedded />
                </TabsContent>
                <TabsContent value="production" className="mt-3">
                  <StoreRoleSection storeId={id} storeName={store.store_name} role="production" embedded />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Brand Accounts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Brand Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {brandAccounts && brandAccounts.length > 0 ? (
                brandAccounts.map((account) => {
                  const brandKey = account.brand?.toLowerCase().replace(" ", "_") as keyof typeof GRABBA_BRAND_CONFIG;
                  const config = GRABBA_BRAND_CONFIG[brandKey];
                  return (
                    <div key={account.id} className="flex flex-wrap items-center justify-between p-2 bg-muted/50 rounded gap-2">
                      <Badge className={`${config?.pill || ""} whitespace-nowrap`} variant="outline">
                        {config?.icon} {account.brand}
                      </Badge>
                      <span className="text-sm font-medium">${Number(account.total_spent || 0).toLocaleString()}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No brand accounts</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* CENTER PANEL — Intelligence + Analytics */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-6 space-y-6">
          {/* ═══════════════════════════════════════════════════════════ */}
          {/* CANONICAL SHARED SECTIONS — Auto-synced with all profiles */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <StoreAccountSummaryCard storeId={id} />
          <TubesSoldHeroStrip storeId={id} />
          <EngagementBanner storeId={id} />
          <SharedStoreCoreIntelligence
            storeId={id}
            storeName={store.store_name}
            role="admin"
            storeGroupId={store.connected_group_id}
            storeOwnerName={store.owner_name}
            sellsFlowers={(store as any).sells_flowers ?? false}
            sellsFlowersNote={(store as any).sells_flowers_note ?? null}
            sellsFlowersFlaggedAt={(store as any).sells_flowers_flagged_at ?? null}
            sellsFlowersFlaggedBy={(store as any).sells_flowers_flagged_by ?? null}
            onLogInteraction={() => setUnifiedInteractionModalOpen(true)}
            onCreateInvoice={() => setCreateInvoiceModalOpen(true)}
          />

          {/* CRM-SPECIFIC: AI & Memory Panels (unique to Floor 1 CRM) */}
          <StoreAIFuturePanel storeId={id} />
          <CustomerMemoryCoreV2 store={{ id: store.id, store_name: store.store_name } as any} contacts={contacts} interactions={interactions} visits={visits} />
          <VoiceNotesCard storeId={id} />
          <PersonalIntelligencePanel profile={aiProfile} storeId={id} />
          <div id="store-memory-panel">
            <StorePersonalMemoryPanel storeId={id} />
          </div>

          {/* Unified call + text history (AI and human, newest first) */}
          <StoreCallHistoryPanel storeId={id} />

          {/* Route Intelligence — Add to Route wired to RouteAssignmentDialog */}
          <RouteIntelligence
            storeId={id}
            storeName={store.store_name}
            onAddToRoute={() => setDispatchStore(id)}
          />


          {/* CANONICAL PERFORMANCE TABS — Auto-synced with all profiles */}
          <SharedStorePerformanceTabs storeId={id} storeName={store.store_name} />
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* RIGHT PANEL — Actions & Context */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-3 space-y-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" size="sm" onClick={() => setShowLogModal(true)}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Log Interaction
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate(`/grabba/communication?store=${id}`)}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Send Message
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate(`/grabba/deliveries?store=${id}`)}>
                <Truck className="w-4 h-4 mr-2" />
                Schedule Delivery
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate(`/grabba/inventory?store=${id}`)}>
                <Package className="w-4 h-4 mr-2" />
                View Inventory
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => setCreateInvoiceModalOpen(true)}>
                <FileText className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => setDispatchStore(id)}>
                <Navigation className="w-4 h-4 mr-2" />
                Add to Route
              </Button>
            </CardContent>
          </Card>

          {/* Transactions (CRM-specific) */}
          <StoreTransactionsCard storeId={id} storeName={store.store_name} />

          {/* Neighborhood Snapshot */}
          <NeighborhoodSnapshotCard
            storeId={id}
            neighborhood={store.city}
            borough={undefined}
          />
          {/* Public "Where to Buy" opt-in */}
          <PublicSiteToggleCard storeId={id} />
          {/* Danger Zone — Owner Only */}
          <StoreDangerZone storeId={id} storeName={store.store_name} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <LogInteractionModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        storeMasterId={id}
        storeName={store.store_name}
        storeContacts={storeContacts || []}
      />

      <UnifiedInteractionModal
        open={unifiedInteractionModalOpen}
        onOpenChange={setUnifiedInteractionModalOpen}
        storeId={id}
        storeName={store.store_name}
        storeContacts={storeContacts || []}
        onSuccess={() => {}}
      />

      <CreateStoreInvoiceModal
        open={createInvoiceModalOpen}
        onOpenChange={setCreateInvoiceModalOpen}
        storeId={id}
        storeName={store.store_name}
        onSuccess={() => {}}
      />

      {/* Dispatch — RouteAssignmentDialog with single store preselected */}
      {dispatchStore && (
        <RouteAssignmentDialog
          open={!!dispatchStore}
          onOpenChange={(open) => {
            if (!open) setDispatchStore(null);
          }}
          assigneeId=""
          assigneeName=""
          assigneeType="driver"
          assigneeUserId={null}
          bulkMode={false}
          preselectedStores={[dispatchStore]}
        />
      )}
    </div>
  );
}
