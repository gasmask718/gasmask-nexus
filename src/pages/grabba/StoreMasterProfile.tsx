import { useParams, useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Package,
  ChevronRight,
  MessageSquare,
  ArrowLeft,
  Store,
  Truck,
  AlertCircle,
  Loader2,
  Users,
  Car,
  Bike,
  Factory,
} from "lucide-react";
import { StickerStatusCard } from "@/components/store/StickerStatusCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GRABBA_BRAND_CONFIG } from "@/config/grabbaBrands";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { StoreContactsSection } from "@/components/store/StoreContactsSection";
import { StoreRoleSection } from "@/components/store/StoreRoleSection";
import { LogInteractionModal } from "@/components/crm/LogInteractionModal";
import { CustomerMemoryCoreV2 } from "@/components/grabba/CustomerMemoryCoreV2";
import { StoreAIFuturePanel } from "@/components/grabba/StoreAIFuturePanel";
import { StorePersonalMemoryPanel } from "@/components/grabba/StorePersonalMemoryPanel";
import { PersonalIntelligencePanel } from "@/components/grabba/PersonalIntelligencePanel";
import { VoiceNotesCard } from "@/components/grabba/VoiceNotesCard";
import { useStoreMasterAutoCreate } from "@/hooks/useStoreMasterAutoCreate";
import { getExtractedProfile } from "@/services/profileExtractionService";
import { getStoreRelationshipScore, RelationshipScore } from "@/services/crmInsightsService";
import { StoreTransactionsCard } from "@/components/store/StoreTransactionsCard";
import { StoreTubeIntelCard } from "@/components/store/StoreTubeIntelCard";
import { TubeCounterCard } from "@/components/store/TubeCounterCard";
import { NeighborhoodSnapshotCard } from "@/components/store/NeighborhoodSnapshotCard";

// ═══════════════════════════════════════════════════════════════════════════════
// STORE MASTER PROFILE — Unified store view within Floor 1 CRM
// ═══════════════════════════════════════════════════════════════════════════════

export default function StoreMasterProfile() {
  const params = useParams();
  const id = params.id || params.storeId;
  const navigate = useNavigate();
  const { selectedBrand } = useGrabbaBrand();
  const [showLogModal, setShowLogModal] = useState(false);

  // Fetch store contacts for the modal
  const { data: storeContacts } = useQuery({
    queryKey: ["store-contacts-for-modal", id],
    queryFn: async () => {
      const { data } = await supabase.from("store_contacts").select("id, name").eq("store_id", id);
      return data || [];
    },
    enabled: !!id,
  });

  // Self-healing: auto-create store_master if missing
  const { storeMaster, isLoading, isCreating, legacyStore, debug } = useStoreMasterAutoCreate(id);

  // Log debug info for troubleshooting
  console.log("[StoreMasterProfile] Debug:", { id, ...debug });

  const { data: brandAccounts } = useQuery({
    queryKey: ["brand-accounts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_brand_accounts").select("*").eq("store_master_id", id);

      if (error) throw error;
      return data;
    },
  });

  // Fetch payments for this store
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
  });

  // Contacts for this store (multiple family members / managers / workers)
  const { data: contacts = [] } = useQuery({
    queryKey: ["store-contacts", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("store_contacts")
        .select("*")
        .eq("store_id", id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading store contacts", error);
        return [];
      }
      return data || [];
    },
    enabled: !!id,
  });

  // Interactions for this store (visits, new store talks, wholesale talks, etc.)
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

      if (error) {
        console.error("Error loading store interactions", error);
        return [];
      }
      return data || [];
    },
    enabled: !!id,
  });

  // Visit logs for this store (filtered from interactions where type = visit)
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

      if (error) {
        console.error("Error loading store visits", error);
        return [];
      }
      // Filter visits client-side to avoid deep type instantiation
      return (data || []).filter((d: any) => d.interaction_type === "visit" || d.type === "visit").slice(0, 50);
    },
    enabled: !!id,
  });

  // AI Extracted Profile for Personal Intelligence Panel
  const { data: aiProfile } = useQuery({
    queryKey: ["extracted-profile", id],
    queryFn: () => getExtractedProfile(id || ""),
    enabled: !!id,
  });

  // V9: Relationship Score
  const { data: relationshipScore } = useQuery({
    queryKey: ["relationship-score", id],
    queryFn: () => getStoreRelationshipScore(id || ""),
    enabled: !!id,
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════════════════
  if (isLoading || isCreating) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">
            {isCreating ? "Creating Store Master record..." : "Loading store profile..."}
          </p>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
            {isCreating
              ? "Setting up your store profile with default values..."
              : "Retrieving store data from the system..."}
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // REBUILDING STATE
  // ═══════════════════════════════════════════════════════════════════════════════
  if (!storeMaster) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">Rebuilding profile...</p>
          <p className="text-sm text-muted-foreground mt-2">This store profile is being created. Please wait...</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-4 w-full sm:w-auto">
          <Button variant="outline" onClick={() => navigate("/grabba/crm")} className="w-full sm:w-auto">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to CRM
          </Button>
          <Button onClick={() => window.location.reload()} className="w-full sm:w-auto">
            Retry
          </Button>
        </div>
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
      {/* DEBUG BANNER */}
      <div className="p-2 mb-2 rounded bg-red-600 text-white text-xs md:text-sm font-bold truncate">
        🔴 PROFILE ACTIVE — {id}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* TOP HEADER */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/grabba/crm")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Mobile Title Layout */}
          <div className="md:hidden flex-1 flex items-center gap-2 overflow-hidden">
            <Store className="h-6 w-6 text-primary shrink-0" />
            <h1 className="text-xl font-bold tracking-tight truncate">{storeMaster.store_name}</h1>
          </div>
        </div>

        <div className="flex-1 w-full pl-2 md:pl-0">
          <div className="flex items-center gap-3 flex-wrap">
            <Store className="hidden md:block h-8 w-8 text-primary" />
            <h1 className="hidden md:block text-2xl md:text-3xl font-bold tracking-tight">{storeMaster.store_name}</h1>

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
            {(storeMaster as any).owner_name && (
              <span className="ml-2">• Owner: {(storeMaster as any).owner_name}</span>
            )}
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* MAIN RESPONSIVE GRID LAYOUT */}
      {/* Mobile: 1 col, Desktop: 12 cols (3-6-3) */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        {/* LEFT PANEL - Store Identity & KPIs */}
        <div className="lg:col-span-3 space-y-4">
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
                  {storeMaster.address}
                  <br />
                  {storeMaster.city}, {storeMaster.state} {storeMaster.zip}
                </div>
              </div>
              <div className="flex items-center gap-2 overflow-hidden">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate">{storeMaster.phone || "N/A"}</span>
              </div>
              <div className="flex items-center gap-2 overflow-hidden">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate">{storeMaster.email || "N/A"}</span>
              </div>
            </CardContent>
          </Card>

          {/* KPI STATS WRAPPER */}
          {/* On mobile: Grid 3 cols to save vertical space. On Desktop: 1 col stack */}
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

          <StickerStatusCard
            storeId={id || ""}
            stickerOnDoor={(storeMaster as any).sticker_on_door}
            stickerInStore={(storeMaster as any).sticker_in_store}
            stickerWithPhone={(storeMaster as any).sticker_with_phone}
            stickerNotes={(storeMaster as any).sticker_notes}
          />

          <StoreContactsSection storeId={id || ""} storeName={storeMaster.store_name} />

          {/* ROLE TABS */}
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
                  <TabsTrigger value="ambassadors" className="text-[10px] md:text-xs px-1">
                    <Users className="h-3 w-3 mr-1 md:mr-1 hidden sm:block" />
                    Ambassadors
                  </TabsTrigger>
                  <TabsTrigger value="drivers" className="text-[10px] md:text-xs px-1">
                    <Car className="h-3 w-3 mr-1 md:mr-1 hidden sm:block" />
                    Drivers
                  </TabsTrigger>
                  <TabsTrigger value="bikers" className="text-[10px] md:text-xs px-1">
                    <Bike className="h-3 w-3 mr-1 md:mr-1 hidden sm:block" />
                    Bikers
                  </TabsTrigger>
                  <TabsTrigger value="production" className="text-[10px] md:text-xs px-1">
                    <Factory className="h-3 w-3 mr-1 md:mr-1 hidden sm:block" />
                    Production
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="ambassadors" className="mt-3">
                  <StoreRoleSection storeId={id || ""} storeName={storeMaster.store_name} role="ambassador" embedded />
                </TabsContent>

                <TabsContent value="drivers" className="mt-3">
                  <StoreRoleSection storeId={id || ""} storeName={storeMaster.store_name} role="driver" embedded />
                </TabsContent>

                <TabsContent value="bikers" className="mt-3">
                  <StoreRoleSection storeId={id || ""} storeName={storeMaster.store_name} role="biker" embedded />
                </TabsContent>

                <TabsContent value="production" className="mt-3">
                  <StoreRoleSection storeId={id || ""} storeName={storeMaster.store_name} role="production" embedded />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* CENTER PANEL - AI Future + Memory */}
        <div className="lg:col-span-6 space-y-6">
          <StoreAIFuturePanel storeId={id || ""} />

          <CustomerMemoryCoreV2 store={storeMaster} contacts={contacts} interactions={interactions} visits={visits} />

          <VoiceNotesCard storeId={id || ""} />

          <PersonalIntelligencePanel profile={aiProfile} storeId={id || ""} />

          <div id="store-memory-panel">
            <StorePersonalMemoryPanel storeId={id || ""} />
          </div>
        </div>

        {/* RIGHT PANEL - Actions & Transactions */}
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
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => navigate(`/grabba/communication?store=${id}`)}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Send Message
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => navigate(`/grabba/deliveries?store=${id}`)}
              >
                <Truck className="w-4 h-4 mr-2" />
                Schedule Delivery
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => navigate(`/grabba/inventory?store=${id}`)}
              >
                <Package className="w-4 h-4 mr-2" />
                View Inventory
              </Button>
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
                    <div
                      key={account.id}
                      className="flex flex-wrap items-center justify-between p-2 bg-muted/50 rounded gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <Badge className={`${config?.pill || ""} whitespace-nowrap`} variant="outline">
                          {config?.icon} {account.brand}
                        </Badge>
                      </div>
                      <span className="text-sm font-medium">${Number(account.total_spent || 0).toLocaleString()}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No brand accounts</p>
              )}
            </CardContent>
          </Card>

          <StoreTransactionsCard storeId={id || ""} storeName={storeMaster.store_name} />
          <TubeCounterCard storeId={id || ""} />
          <StoreTubeIntelCard storeId={id || ""} />

          <NeighborhoodSnapshotCard
            storeId={id || ""}
            neighborhood={storeMaster.city}
            borough={(storeMaster as any).borough}
          />
        </div>
      </div>

      <LogInteractionModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        storeMasterId={id}
        storeName={storeMaster.store_name}
        storeContacts={storeContacts || []}
      />
    </div>
  );
}
