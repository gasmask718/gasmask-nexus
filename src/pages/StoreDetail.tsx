import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { GeocodingService } from "@/services/geocoding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StorePhoneLogSection } from "@/components/phone/StorePhoneLogSection";
import { StorePerformanceTab } from "@/components/store/StorePerformanceTab";
import { CommunicationLogModal } from "@/components/CommunicationLogModal";
import { CommunicationStats } from "@/components/communication/CommunicationStats";
import { FollowUpAIRecommendation } from "@/components/store/FollowUpAIRecommendation";
import { ReplenishmentAI } from "@/components/store/ReplenishmentAI";
import { AIRelationshipHealth } from "@/components/communication/AIRelationshipHealth";
import { RouteIntelligence } from "@/components/store/RouteIntelligence";
import { isFeatureEnabled } from "@/config/featureFlags";
import { StoreCallIntelligenceTab } from "@/components/store/StoreCallIntelligenceTab";
import { StoreRevenueIntelligenceTab } from "@/components/revenue/StoreRevenueIntelligenceTab";
import { useQuery } from "@tanstack/react-query";
import { StoreContactsSection } from "@/components/store/StoreContactsSection";
import { StoreTaskRouteButtons } from "@/components/store/StoreTaskRouteButtons";
import { StoreSamplesHub } from "@/components/store/StoreSamplesHub";
import { StoreProfileJumpNav } from "@/components/store/StoreProfileJumpNav";
import { CommunicationTimeline } from "@/components/CommunicationTimeline";
import { StoreReviewControls } from "@/components/store/StoreReviewControls";
import { StoreContactInfoCard } from "@/components/store/StoreContactInfoCard";
import { StoreStreetView } from "@/components/store/StoreStreetView";

import { StoreReconCard } from "@/components/store/StoreReconCard";
import { StoreCommunicationPreferences } from "@/components/store/StoreCommunicationPreferences";
import { useUserRole } from "@/hooks/useUserRole";
import { QuickStatsStickersSummary } from "@/components/store/QuickStatsStickersSummary";
import { QuickStatsContactSnapshot } from "@/components/store/QuickStatsContactSnapshot";
import { usePrimaryResponsiveContact } from "@/hooks/usePrimaryResponsiveContact";
import { StoreContactIntelBadge } from "@/components/contact/StoreContactIntelBadge";
import { PredictiveIntelCompact } from "@/components/contact/PredictiveIntelCompact";
import { StoreQuickActions } from "@/components/store/StoreQuickActions";
import { UnifiedInteractionModal } from "@/components/store/UnifiedInteractionModal";
import { CreateStoreInvoiceModal } from "@/components/store/CreateStoreInvoiceModal";
import { MemberSinceDisplay } from "@/components/store/MemberSinceDisplay";
import { PagePurpose } from "@/components/portal/guidance/PagePurpose";
import { StoreDangerZone } from "@/components/store/StoreDangerZone";
import { StoreCadenceOverrideCard } from "@/components/store/StoreCadenceOverrideCard";
import { useTranslation } from "@/hooks/useTranslation";
import { CanonicalStoreProfileProvider } from "@/components/store/CanonicalStoreProfile";
import { useStoreMasterResolver } from "@/hooks/useStoreMasterResolver";
// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL SHARED SECTIONS — Drift prevention layer
// Adding a section to these components propagates to ALL store profile pages.
// ═══════════════════════════════════════════════════════════════════════════════
import {
  StoreProfileFieldOpsGroup,
  StoreProfileFinanceGroup,
  StoreProfileInventoryGroup,
  StoreProfileNotesGroup,
  StoreRelationshipOverview,
  StoreRelationshipCommunication,
  StoreRelationshipBriefing,
  StoreRelationshipCadence,

  StoreProfileTasksGroup,
} from "@/components/store/SharedStoreCoreIntelligence";
import { TubesSoldHeroStrip } from "@/components/store-profile/TubesSoldHeroStrip";
import { BagsSection } from "@/components/store-profile/BagsSection";
import { EngagementBanner } from "@/components/store-profile/EngagementBanner";
import { BrandPaymentQuickView } from "@/components/store/BrandPaymentQuickView";
import { RelationshipStatusInline } from "@/components/store/RelationshipStatusInline";
import { BrandInterestChips } from "@/components/store/BrandInterestChips";
import { StorePaymentBadge } from "@/components/store/StorePaymentBadge";
import { StoreBalanceBanner } from "@/components/store/StoreBalanceBanner";
import { StoreExecutiveOverview } from "@/components/store/StoreExecutiveOverview";
import { StoreProfileSection } from "@/components/store/StoreProfileSection";
import { SkuOrderHistoryPanel } from "@/components/store/SkuOrderHistoryPanel";
import { QuickStatsBrandPaymentMatrix } from "@/components/store/QuickStatsBrandPaymentMatrix";
import { CanonicalStoreDataProvider } from "@/components/store/CanonicalStoreDataProvider";
import { EscalationFlagsPanel } from "@/components/delivery/EscalationFlagsPanel";
import {
  MapPin,
  Phone,
  Mail,
  ArrowLeft,
  Package,
  Clock,
  User,
  FileText,
  TrendingUp,
  AlertCircle,
  DollarSign,
  Calendar,
  Navigation,
  Users,
  Edit2,
  Check,
  X,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { BulkCommunicationLogModal } from "@/components/communication/BulkCommunicationLogModal";

type StickerStatus = "none" | "doorOnly" | "inStoreOnly" | "doorAndInStore";

interface Store {
  id: string;
  name: string;
  type: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  phone: string;
  alt_phone: string;
  email: string;
  status: string;
  responsiveness: string;
  sticker_status: StickerStatus | null;
  notes: string;
  tags: string[];
  primary_contact_name: string;
  created_at: string;
  updated_at: string | null;
  lat: number | null;
  lng: number | null;
  last_visit_date: string | null;
  last_visit_driver_id: string | null;
  visit_frequency_target: number | null;
  visit_risk_level: string | null;
  pipeline_stage?: string;
  ai_recommendation?: string;
  // Operations fields
  sells_flowers: boolean;
  sticker_door: boolean;
  sticker_instore: boolean;
  sticker_phone: boolean;
  sticker_last_seen_at: string | null;
  sticker_taken_down: boolean;
  sticker_taken_down_at: string | null;
  sticker_notes: string | null;
  connected_group_id: string | null;
  payment_type: string | null;
  // store_master CRM fields
  nickname: string | null;
  country_of_origin: string | null;
  country: string | null;
  languages: string[] | null;
  communication_preference: string | null;
  personality_notes: string | null;
  has_expansion: boolean | null;
  new_store_addresses: string[] | null;
  expected_open_dates: string[] | null;
  expansion_notes: string | null;
  influence_level: string | null;
  loyalty_triggers: string[] | null;
  frustration_triggers: string[] | null;
  risk_score: string | null;
  language_preference: string | null;
  dialect_preference: string | null;
  formality_level: string | null;
  preferred_channel: string | null;
  notes_for_tone: string | null;
  owner_name: string | null;
  health_status: string | null;
  sourced_by_ambassador_id: string | null;
  assigned_ambassador_id: string | null;
  sourced_at: string | null;
  last_visit_at: string | null;
  last_order_at: string | null;
  borough_id: string | null;
  // Legacy-only fields
  neighborhood: string | null;
  boro: string | null;
  wholesaler_name: string | null;
  notes_overview: string | null;
  notes_old: string | null;
  special_information: string | null;
  member_since: string | null;
  store_code: string | null;
  market_code: string | null;
  rpa_status: string | null;
}

interface ProductInventory {
  id: string;
  product: {
    name: string;
    brand: {
      name: string;
      color: string;
    };
  };
  last_inventory_level: string;
  last_inventory_check_at: string;
  next_estimated_reorder_date: string;
  urgency_score: number;
  velocity_boxes_per_day: number;
  predicted_stockout_date: string;
}

interface VisitLog {
  id: string;
  visit_type: string;
  visit_datetime: string;
  cash_collected: number;
  payment_method: string;
  customer_response: string;
  user: {
    name: string;
    role?: string;
  };
}

// Helper function to determine source from role
const getSourceFromRole = (role?: string | null): string => {
  if (!role) return "System";
  const roleLower = role.toLowerCase();
  if (roleLower === 'va' || roleLower.includes('va')) return "VA";
  if (roleLower === 'biker' || roleLower === 'driver') return "Biker";
  if (roleLower === 'admin' || roleLower === 'owner') return "Admin";
  if (roleLower.includes('ai') || roleLower === 'ai') return "AI";
  return "User";
};

const StoreDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { roles } = useUserRole();
  const isAmbassador = roles?.includes('ambassador' as any);
  const [store, setStore] = useState<Store | null>(null);
  const [visits, setVisits] = useState<VisitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [communicationModalOpen, setCommunicationModalOpen] = useState(false);
  const [bulkCommModalOpen, setBulkCommModalOpen] = useState(false);
  const [unifiedInteractionModalOpen, setUnifiedInteractionModalOpen] = useState(false);
  const [unifiedInteractionModalType, setUnifiedInteractionModalType] = useState<string>('delivery');
  const [createInvoiceModalOpen, setCreateInvoiceModalOpen] = useState(false);
  const [timelineRefresh, setTimelineRefresh] = useState(0);
  const [geocoding, setGeocoding] = useState(false);

  // Resolve store_master ID for GDS operations
  const { storeMasterId } = useStoreMasterResolver(id);

  // Fetch store contacts for interaction modal
  const { data: storeContacts } = useQuery({
    queryKey: ["store-contacts-for-interaction", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase.from("store_contacts").select("id, name").eq("store_id", id);
      return data || [];
    },
    enabled: !!id,
  });

  useEffect(() => {
    const fetchStoreData = async () => {
      if (!id) return;

      try {
        // Try store_master first
        const { data: masterData } = await supabase.from("store_master").select("*").eq("id", id).maybeSingle();
        
        // Also fetch legacy stores data for enrichment
        const { data: legacyData } = await supabase.from("stores").select("*").eq("id", id).maybeSingle();

        if (!masterData && !legacyData) {
          setStore(null);
          setLoading(false);
          return;
        }

        // Build unified store object, preferring store_master, falling back to legacy
        const m = masterData;
        const l = legacyData;

        const unified: Store = {
          id: m?.id || l?.id || id,
          name: m?.store_name || l?.name || '',
          type: m?.store_type || l?.type || '',
          address_street: m?.address || l?.address_street || '',
          address_city: m?.city || l?.address_city || '',
          address_state: m?.state || l?.address_state || '',
          address_zip: m?.zip || l?.address_zip || '',
          phone: m?.phone || l?.phone || '',
          alt_phone: l?.alt_phone || '',
          email: m?.email || l?.email || '',
          status: m?.health_status || l?.status || 'active',
          responsiveness: l?.responsiveness || 'none',
          sticker_status: l?.sticker_status || null,
          notes: m?.notes || l?.notes || '',
          tags: l?.tags || [],
          // Prefer legacy mirror (auto-synced from store_contacts via trg_sync_store_primary_contact_name) over potentially stale store_master.owner_name
          primary_contact_name: l?.primary_contact_name || m?.owner_name || '',
          created_at: m?.created_at || l?.created_at || '',
          updated_at: m?.updated_at || l?.updated_at || null,
          lat: l?.lat || null,
          lng: l?.lng || null,
          last_visit_date: l?.last_visit_date || null,
          last_visit_driver_id: l?.last_visit_driver_id || null,
          visit_frequency_target: l?.visit_frequency_target || null,
          visit_risk_level: l?.visit_risk_level || null,
          sells_flowers: l?.sells_flowers || false,
          sticker_door: m?.sticker_on_door || l?.sticker_door || false,
          sticker_instore: m?.sticker_in_store || l?.sticker_instore || false,
          sticker_phone: m?.sticker_with_phone || l?.sticker_phone || false,
          sticker_last_seen_at: l?.sticker_last_seen_at || null,
          sticker_taken_down: l?.sticker_taken_down || false,
          sticker_taken_down_at: l?.sticker_taken_down_at || null,
          sticker_notes: m?.sticker_notes || null,
          connected_group_id: m?.connected_group_id || l?.connected_group_id || null,
          payment_type: l?.payment_type || null,
          // store_master CRM fields
          nickname: m?.nickname || null,
          country_of_origin: m?.country_of_origin || null,
          country: m?.country || null,
          languages: m?.languages || null,
          communication_preference: m?.communication_preference || null,
          personality_notes: m?.personality_notes || null,
          has_expansion: m?.has_expansion || null,
          new_store_addresses: m?.new_store_addresses || null,
          expected_open_dates: m?.expected_open_dates || null,
          expansion_notes: m?.expansion_notes || null,
          influence_level: m?.influence_level || null,
          loyalty_triggers: m?.loyalty_triggers || null,
          frustration_triggers: m?.frustration_triggers || null,
          risk_score: m?.risk_score || null,
          language_preference: m?.language_preference || null,
          dialect_preference: m?.dialect_preference || null,
          formality_level: m?.formality_level || null,
          preferred_channel: m?.preferred_channel || null,
          notes_for_tone: m?.notes_for_tone || null,
          // Header owner name: prefer canonical-synced legacy mirror over store_master snapshot
          owner_name: l?.primary_contact_name || m?.owner_name || null,
          health_status: m?.health_status || null,
          sourced_by_ambassador_id: m?.sourced_by_ambassador_id || null,
          assigned_ambassador_id: m?.assigned_ambassador_id || null,
          sourced_at: m?.sourced_at || null,
          last_visit_at: m?.last_visit_at || null,
          last_order_at: m?.last_order_at || null,
          borough_id: m?.borough_id || null,
          // Legacy-only fields
          neighborhood: l?.neighborhood || null,
          boro: l?.boro || null,
          wholesaler_name: l?.wholesaler_name || null,
          notes_overview: l?.notes_overview || null,
          notes_old: l?.notes_old || null,
          special_information: l?.special_information || null,
          member_since: l?.member_since || null,
          store_code: l?.store_code || null,
          market_code: l?.market_code || null,
          rpa_status: l?.rpa_status || null,
        };

        setStore(unified);
        await fetchInventoryAndVisits();
      } catch (error) {
        console.error("Error fetching store data:", error);
        toast.error("Failed to load store details");
      } finally {
        setLoading(false);
      }
    };

    fetchStoreData();
  }, [id]);

  const handleGeocodeAddress = async () => {
    if (!store) return;

    setGeocoding(true);
    try {
      const result = await GeocodingService.geocodeAddress(
        store.address_street,
        store.address_city,
        store.address_state,
        store.address_zip,
      );

      if ("error" in result) {
        toast.error(`Geocoding failed: ${result.error}`);
        return;
      }

      // Update store with new coordinates
      const { error } = await supabase.from("stores").update({ lat: result.lat, lng: result.lng }).eq("id", store.id);

      if (error) throw error;

      setStore({ ...store, lat: result.lat as any, lng: result.lng as any });
      toast.success("Address geocoded successfully! Location updated on map.");
    } catch (error) {
      console.error("Error geocoding:", error);
      toast.error("Failed to geocode address");
    } finally {
      setGeocoding(false);
    }
  };

  const handleStoreContactUpdate = () => {
    supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setStore((previous) => previous ? {
          ...previous,
          name: data.name || previous.name,
          phone: data.phone || previous.phone,
          alt_phone: data.alt_phone || previous.alt_phone,
          email: data.email || previous.email,
          address_street: data.address_street || previous.address_street,
          address_city: data.address_city || previous.address_city,
          address_state: data.address_state || previous.address_state,
          address_zip: data.address_zip || previous.address_zip,
          notes: data.notes || previous.notes,
          responsiveness: data.responsiveness || previous.responsiveness,
          payment_type: data.payment_type || previous.payment_type,
          primary_contact_name: data.primary_contact_name || previous.primary_contact_name,
          owner_name: data.primary_contact_name || previous.owner_name,
        } : previous);
      });
  };

  const fetchInventoryAndVisits = async () => {
    if (!id) return;

    try {
      // Fetch visit logs
      const { data: visitsData } = await supabase
        .from("visit_logs")
        .select(
          `
          id,
          visit_type,
          visit_datetime,
          cash_collected,
          payment_method,
          customer_response,
          user:profiles(name, role)
        `,
        )
        .eq("store_id", id)
        .order("visit_datetime", { ascending: false })
        .limit(10);

      setVisits((visitsData as any) || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Store not found</p>
          <Button onClick={() => navigate("/stores")}>Back to Stores</Button>
        </div>
      </div>
    );
  }

  const formatVisitType = (type: string) => {
    return type.replace(/([A-Z])/g, " $1").trim();
  };

  const storeProfileConfig = {
    admin: {
      title: t('page.store_profile.admin_title') || 'Store Profile',
      description: t('page.store_profile.admin_desc') || 'Full store management with inventory, orders, contacts, and governance oversight.',
      actions: [
        t('page.store_profile.action.edit_details') || 'Edit store details and contacts',
        t('page.store_profile.action.manage_inventory') || 'Manage tube inventory and orders',
        t('page.store_profile.action.review_submissions') || 'Review field submissions',
        t('page.store_profile.action.create_invoice') || 'Create invoices and log interactions',
      ],
      warnings: [
        t('page.store_profile.warning.audit') || 'All changes are tracked in audit logs',
      ],
    },
    ambassador: {
      title: t('page.store_profile.ambassador_title') || 'Store Profile',
      description: t('page.store_profile.ambassador_desc') || 'View store details and update allowed fields (notes, stickers, responsiveness).',
      actions: [
        t('page.store_profile.action.update_stickers') || 'Update sticker placement status',
        t('page.store_profile.action.add_notes') || 'Add visit notes',
        t('page.store_profile.action.view_orders') || 'View order history',
      ],
    },
    default: {
      title: t('page.store_profile.default_title') || 'Store Profile',
      description: t('page.store_profile.default_desc') || 'View store information, inventory status, and recent activity.',
      actions: [
        t('page.store_profile.action.view_info') || 'View store contact information',
        t('page.store_profile.action.check_inventory') || 'Check tube inventory status',
        t('page.store_profile.action.review_history') || 'Review interaction history',
      ],
    },
  };

  const storeId = id || '';
  const address = [store.address_street, store.address_city, store.address_state, store.address_zip]
    .filter(Boolean)
    .join(', ');

  return (
    <CanonicalStoreDataProvider storeId={id}>
      <CanonicalStoreProfileProvider storeId={storeId}>
        <div className="mx-auto max-w-[1500px] space-y-5 animate-fade-in">
          <PagePurpose pageKey="page.store_profile" config={storeProfileConfig} variant="default" />

          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/stores')} aria-label="Back to stores">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <StoreExecutiveOverview
                storeId={storeId}
                name={store.name}
                address={address}
                primaryContact={store.primary_contact_name || store.owner_name}
                phone={store.phone || store.alt_phone}
                lastOrderAt={store.last_order_at}
                paymentTerms={store.payment_type}
              />
            </div>
          </div>

          <StoreProfileJumpNav />

          <StoreQuickActions
            storeId={storeId}
            storeName={store.name}
            storePhone={store.phone}
            compact
            onCreateInvoice={() => setCreateInvoiceModalOpen(true)}
            onAddFollowUp={() => {
              setUnifiedInteractionModalType('followUp');
              setUnifiedInteractionModalOpen(true);
            }}
            onLogInteraction={() => setUnifiedInteractionModalOpen(true)}
            onInventoryUpdated={fetchInventoryAndVisits}
          />

          <CommunicationLogModal
            open={communicationModalOpen}
            onOpenChange={setCommunicationModalOpen}
            entityType="store"
            entityId={storeId}
            entityName={store.name}
            entityPhone={store.phone || store.alt_phone || undefined}
            onSuccess={() => setTimelineRefresh((prev) => prev + 1)}
          />
          <UnifiedInteractionModal
            open={unifiedInteractionModalOpen}
            onOpenChange={(open) => {
              setUnifiedInteractionModalOpen(open);
              if (!open) setUnifiedInteractionModalType('delivery');
            }}
            storeId={storeId}
            storeName={store.name}
            storeContacts={storeContacts || []}
            initialInteractionType={unifiedInteractionModalType as any}
            onSuccess={() => {
              fetchInventoryAndVisits();
              setTimelineRefresh((prev) => prev + 1);
            }}
          />
          <CreateStoreInvoiceModal
            open={createInvoiceModalOpen}
            onOpenChange={setCreateInvoiceModalOpen}
            storeId={storeId}
            storeName={store.name}
          />
          <BulkCommunicationLogModal
            open={bulkCommModalOpen}
            onOpenChange={setBulkCommModalOpen}
            onSuccess={() => setTimelineRefresh((prev) => prev + 1)}
          />

          <EscalationFlagsPanel storeId={storeId} />

          <StoreProfileSection
            id="inventory-sales"
            title="Inventory & Sales"
            description="Current inventory is canonical; sales and field-delivery history remain separately labeled."
          >
            <div className="space-y-4">
              <TubesSoldHeroStrip storeId={storeId} />
              <StoreProfileInventoryGroup storeId={storeId} role="admin" />
              <ReplenishmentAI storeId={storeId} />
              <details className="rounded-md border border-border/50 p-4">
                <summary className="cursor-pointer text-sm font-medium">Bag history & velocity</summary>

                <div className="mt-4"><BagsSection storeId={storeId} /></div>
              </details>
            </div>
          </StoreProfileSection>

          <StoreProfileSection
            id="contacts"
            title="Contacts"
            description="People, roles, verified numbers, responsiveness, and contact actions."
          >
            <StoreContactsSection storeId={storeId} storeName={store.name} />
          </StoreProfileSection>

          <StoreProfileSection
            id="tasks-follow-ups"
            title="Tasks & Follow-ups"
            description="Open follow-ups and route-backed field requirements stay in their original workflows."
          >
            <div className="space-y-4">
              <StoreTaskRouteButtons storeId={storeId} storeName={store.name} />
              <StoreProfileTasksGroup storeId={storeId} storeName={store.name} />
            </div>
          </StoreProfileSection>

          <StoreProfileSection
            id="orders-finance"
            title="Orders & Finance"
            description="Balance, invoices, last order, line items, and sell-through in one place."
            action={<Button size="sm" onClick={() => setCreateInvoiceModalOpen(true)}><FileText className="mr-2 h-4 w-4" />Create Invoice</Button>}
          >
            <div className="space-y-4">
              <StoreBalanceBanner storeId={storeId} storeName={store.name} />
              <StoreProfileFinanceGroup storeId={storeId} onCreateInvoice={() => setCreateInvoiceModalOpen(true)} />
              <details className="rounded-md border border-border/50 p-4">
                <summary className="cursor-pointer text-sm font-medium">Per-product order history</summary>
                <div className="mt-4"><SkuOrderHistoryPanel storeId={storeId} /></div>
              </details>
            </div>
          </StoreProfileSection>

          <StoreProfileSection
            id="relationship-communication"
            title="Relationship & Communication"
            description="Overall store health and brand relationships are intentionally distinct measures."
          >
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="communication">Communication</TabsTrigger>
                <TabsTrigger value="ai">AI Insights</TabsTrigger>
                <TabsTrigger value="preferences">Preferences & Cadence</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4"><StoreRelationshipOverview storeId={storeId} /></TabsContent>
              <TabsContent value="communication" className="mt-4 space-y-4"><StoreRelationshipCommunication storeId={storeId} storeName={store.name} /><CommunicationStats entityType="store" entityId={storeId} /></TabsContent>
              <TabsContent value="ai" className="mt-4 space-y-4"><StoreRelationshipBriefing storeId={storeId} /><FollowUpAIRecommendation storeId={storeId} /><AIRelationshipHealth entityType="store" entityId={storeId} /></TabsContent>
              <TabsContent value="preferences" className="mt-4 space-y-4"><StoreRelationshipCadence storeId={storeId} storeName={store.name} /><StoreCommunicationPreferences storeId={storeId} />{storeMasterId && <StoreCadenceOverrideCard storeId={storeMasterId} relationshipStatus={(store as any).relationship_status ?? null} />}</TabsContent>
            </Tabs>

          </StoreProfileSection>

          <StoreProfileSection
            id="field-ops"
            title="Field Ops & Compliance"
            description="Visit execution, field evidence, route intelligence, and compliance controls."
          >
            <div className="space-y-4">
              <StoreProfileFieldOpsGroup
                storeId={storeId}
                role="admin"
                sellsFlowers={store.sells_flowers}
                onSellsFlowersUpdate={() => undefined}
              />
              <Tabs defaultValue="visits" className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto">
                  <TabsTrigger value="visits">Visit History</TabsTrigger>
                  <TabsTrigger value="review">Review & Sign-off</TabsTrigger>
                  <TabsTrigger value="recon">Recon</TabsTrigger>
                  <TabsTrigger value="location">Location</TabsTrigger>
                </TabsList>
                <TabsContent value="visits" className="mt-4 space-y-3">
                  {visits.length ? visits.map((visit) => (
                    <div key={visit.id} className="rounded-md border border-border/50 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{formatVisitType(visit.visit_type)}</span>
                        <span className="text-muted-foreground">{new Date(visit.visit_datetime).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{visit.user.name} · {getSourceFromRole(visit.user.role)}</p>
                    </div>
                  )) : <p className="py-6 text-center text-sm text-muted-foreground">No visit history available</p>}
                </TabsContent>
                <TabsContent value="review" className="mt-4"><StoreReviewControls storeId={storeId} /></TabsContent>
                <TabsContent value="recon" className="mt-4"><StoreReconCard storeId={storeId} /></TabsContent>
                <TabsContent value="location" className="mt-4 space-y-4">
                  <StoreStreetView lat={store.lat} lng={store.lng} storeName={store.name} address={address} />
                  <Button variant="outline" onClick={handleGeocodeAddress} disabled={geocoding || !store.address_street}>
                    <Navigation className="mr-2 h-4 w-4" />{geocoding ? 'Geocoding…' : 'Geocode Address'}
                  </Button>
                </TabsContent>
              </Tabs>
              {isFeatureEnabled('routeCheckinsPanel') && <RouteIntelligence storeId={storeId} storeName={store.name} />}
              
            </div>
          </StoreProfileSection>

          <StoreProfileSection
            id="notes-activity"
            title="Notes & Activity"
            description="One primary area for authored notes, interactions, field activity, and legacy context."
          >
            <div className="space-y-4">
              <StoreProfileNotesGroup
                storeId={storeId}
                storeName={store.name}
                onLogInteraction={() => {
                  setUnifiedInteractionModalOpen(true);
                }}
              />
              {(store.notes || store.notes_overview || store.notes_old || store.special_information) && (
                <details className="rounded-md border border-border/50 p-4">
                  <summary className="cursor-pointer text-sm font-medium">Legacy & system context</summary>
                  <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                    {store.notes && <p className="whitespace-pre-wrap">{store.notes}</p>}
                    {store.notes_overview && <p className="whitespace-pre-wrap">{store.notes_overview}</p>}
                    {store.special_information && <p className="whitespace-pre-wrap">{store.special_information}</p>}
                    {store.notes_old && <p className="whitespace-pre-wrap">{store.notes_old}</p>}
                  </div>
                </details>
              )}
            </div>
          </StoreProfileSection>

          <details className="border-t border-border/60 pt-5">
            <summary className="cursor-pointer text-lg font-semibold">Advanced & legacy information</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <StoreContactInfoCard
                store={store}
                onUpdate={handleStoreContactUpdate}
              />
              <SamplesGivenSection storeId={storeId} variant="full" />
              <EngagementBanner storeId={storeId} />
              {storeMasterId && <StoreDangerZone storeId={storeMasterId} storeName={store.name} sourceUi="store_profile_advanced" />}
              <StorePerformanceTab storeId={storeId} storeName={store.name} />
              <StoreCallIntelligenceTab storeId={storeId} />
              <StorePhoneLogSection storeId={storeId} />
              <StoreRevenueIntelligenceTab storeId={storeId} />
            </div>
          </details>
        </div>
      </CanonicalStoreProfileProvider>
    </CanonicalStoreDataProvider>
  );

};

export default StoreDetail;

/** Compact primary contact badge + predictive intel for the store header */
function PrimaryContactHeaderBadge({ storeId }: { storeId: string | undefined }) {
  const { primary } = usePrimaryResponsiveContact(storeId);
  if (!primary) return null;
  return (
    <div className="space-y-1">
      <StoreContactIntelBadge contact={primary} compact className="mt-1" />
      {storeId && <PredictiveIntelCompact storeId={storeId} className="mt-0.5" />}
    </div>
  );
}
