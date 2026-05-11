import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { GeocodingService } from "@/services/geocoding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StorePerformanceTab } from "@/components/store/StorePerformanceTab";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { InventoryPredictionCard } from "@/components/map/InventoryPredictionCard";
import { CommunicationLogModal } from "@/components/CommunicationLogModal";
import { CommunicationStats } from "@/components/communication/CommunicationStats";
import { FollowUpAIRecommendation } from "@/components/store/FollowUpAIRecommendation";
import { ReplenishmentAI } from "@/components/store/ReplenishmentAI";
import { LastOrderSnapshotPanel } from "@/components/store/LastOrderSnapshotPanel";
import { AIRelationshipHealth } from "@/components/communication/AIRelationshipHealth";
import { RouteIntelligence } from "@/components/store/RouteIntelligence";
import { StoreCallIntelligenceTab } from "@/components/store/StoreCallIntelligenceTab";
import { StoreRevenueIntelligenceTab } from "@/components/revenue/StoreRevenueIntelligenceTab";
import { Activity, Headphones, Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { StorePeopleSection } from "@/components/store/StorePeopleSection";
import { StoreContactInfoCard } from "@/components/store/StoreContactInfoCard";
import { QuickStatsStickersSummary } from "@/components/store/QuickStatsStickersSummary";
import { StoreHealthBadge } from "@/components/delivery/StoreHealthBadge";
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
import { useTranslation } from "@/hooks/useTranslation";
import { CanonicalStoreProfileProvider } from "@/components/store/CanonicalStoreProfile";
import { useStoreMasterResolver } from "@/hooks/useStoreMasterResolver";
// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL SHARED SECTIONS — Drift prevention layer
// Adding a section to these components propagates to ALL store profile pages.
// ═══════════════════════════════════════════════════════════════════════════════
import { SharedStoreCoreIntelligence } from "@/components/store/SharedStoreCoreIntelligence";
import { TubesSoldHeroStrip } from "@/components/store-profile/TubesSoldHeroStrip";
import { EngagementBanner } from "@/components/store-profile/EngagementBanner";
import { BrandPaymentQuickView } from "@/components/store/BrandPaymentQuickView";
import { QuickStatsBrandPaymentMatrix } from "@/components/store/QuickStatsBrandPaymentMatrix";
import { CanonicalStoreDataProvider } from "@/components/store/CanonicalStoreDataProvider";
import { PinnedNotesSection } from "@/components/store/PinnedNotesSection";
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
  const [store, setStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<ProductInventory[]>([]);
  const [visits, setVisits] = useState<VisitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [communicationModalOpen, setCommunicationModalOpen] = useState(false);
  const [bulkCommModalOpen, setBulkCommModalOpen] = useState(false);
  const [unifiedInteractionModalOpen, setUnifiedInteractionModalOpen] = useState(false);
  const [unifiedInteractionModalType, setUnifiedInteractionModalType] = useState<string>('delivery');
  const [createInvoiceModalOpen, setCreateInvoiceModalOpen] = useState(false);
  const [resolvedStoreMasterId, setResolvedStoreMasterId] = useState<string | null>(null);
  const [timelineRefresh, setTimelineRefresh] = useState(0);
  const [geocoding, setGeocoding] = useState(false);
  const [isEditingQuickStats, setIsEditingQuickStats] = useState(false);
  const [quickStatsResponsiveness, setQuickStatsResponsiveness] = useState<"call" | "text" | "both" | "none">("none");
  const [quickStatsPaymentType, setQuickStatsPaymentType] = useState<"pays_upfront" | "bill_to_bill" | null>(null); // legacy — kept for responsiveness save
  const [savingQuickStats, setSavingQuickStats] = useState(false);

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

  const { data: routeInsight } = useQuery({
    queryKey: ["route-insight", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("route_insights").select("*").eq("store_id", id).maybeSingle();

      if (error) throw error;
      return data;
    },
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
          primary_contact_name: m?.owner_name || l?.primary_contact_name || '',
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
          owner_name: m?.owner_name || l?.primary_contact_name || null,
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
        setQuickStatsResponsiveness((unified.responsiveness as "call" | "text" | "both" | "none") || "none");
        setQuickStatsPaymentType((unified.payment_type as "pays_upfront" | "bill_to_bill") || null);

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

  const fetchInventoryAndVisits = async () => {
    if (!id) return;

    try {
      // Fetch inventory state
      const { data: inventoryData } = await supabase
        .from("store_product_state")
        .select(
          `
          id,
          last_inventory_level,
          last_inventory_check_at,
          next_estimated_reorder_date,
          urgency_score,
          velocity_boxes_per_day,
          predicted_stockout_date,
          product:products(
            name,
            brand:brands(name, color)
          )
        `,
        )
        .eq("store_id", id);

      setInventory((inventoryData as any) || []);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "inactive":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      case "prospect":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "needsFollowUp":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getInventoryLevel = (level: string) => {
    switch (level) {
      case "full":
        return { value: 100, color: "bg-green-500", label: "Full" };
      case "threeQuarters":
        return { value: 75, color: "bg-blue-500", label: "75%" };
      case "half":
        return { value: 50, color: "bg-yellow-500", label: "50%" };
      case "quarter":
        return { value: 25, color: "bg-orange-500", label: "25%" };
      case "empty":
        return { value: 0, color: "bg-red-500", label: "Empty" };
      default:
        return { value: 0, color: "bg-gray-500", label: "Unknown" };
    }
  };

  const formatVisitType = (type: string) => {
    return type.replace(/([A-Z])/g, " $1").trim();
  };

  const handleSaveQuickStats = async () => {
    if (!store || !id) return;

    setSavingQuickStats(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({ 
          responsiveness: quickStatsResponsiveness as "call" | "text" | "both" | "none",
          payment_type: quickStatsPaymentType,
        })
        .eq("id", id);

      if (error) throw error;

      setStore({ ...store, responsiveness: quickStatsResponsiveness, payment_type: quickStatsPaymentType });
      setIsEditingQuickStats(false);
      toast.success("Quick stats updated");
    } catch (error: any) {
      console.error("Error updating quick stats:", error);
      toast.error("Failed to update quick stats");
    } finally {
      setSavingQuickStats(false);
    }
  };

  const handleCancelQuickStats = () => {
    if (store) {
      setQuickStatsResponsiveness((store.responsiveness as "call" | "text" | "both" | "none") || "none");
      setQuickStatsPaymentType((store.payment_type as "pays_upfront" | "bill_to_bill") || null);
    }
    setIsEditingQuickStats(false);
  };

  const toggleResponsiveness = (type: "text" | "call") => {
    const current = quickStatsResponsiveness;
    let newValue: "call" | "text" | "both" | "none";

    if (type === "text") {
      if (current === "text" || current === "both") {
        // Remove text, keep call if it exists
        newValue = current === "both" ? "call" : "none";
      } else {
        // Add text
        newValue = current === "call" ? "both" : "text";
      }
    } else {
      // type === "call"
      if (current === "call" || current === "both") {
        // Remove call, keep text if it exists
        newValue = current === "both" ? "text" : "none";
      } else {
        // Add call
        newValue = current === "text" ? "both" : "call";
      }
    }

    setQuickStatsResponsiveness(newValue);
  };

  const getResponsivenessStatus = (type: "text" | "call") => {
    const current = isEditingQuickStats ? quickStatsResponsiveness : (store?.responsiveness as "call" | "text" | "both" | "none" | undefined) || "none";
    if (type === "text") {
      return current === "text" || current === "both";
    } else {
      return current === "call" || current === "both";
    }
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

  return (
    <CanonicalStoreDataProvider storeId={id}>
    <CanonicalStoreProfileProvider storeId={id || ''}>
    <div className="space-y-6 animate-fade-in">
      <PagePurpose 
        pageKey="page.store_profile" 
        config={storeProfileConfig}
        variant="default"
      />
      
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/stores")} className="mt-1">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-bold tracking-tight">{store.name}</h2>
                {store.nickname && <span className="text-lg text-muted-foreground">"{store.nickname}"</span>}
                <Badge className={getStatusColor(store.status)}>{store.status}</Badge>
                {id && <StoreHealthBadge storeId={id} />}
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <p className="capitalize">{store.type.replace("_", " ")}</p>
                {store.owner_name && <span>• Owner: {store.owner_name}</span>}
                {store.email && <span>• {store.email}</span>}
              </div>
              {/* Primary Responsive Contact — subtle header badge */}
              <PrimaryContactHeaderBadge storeId={id} />
              {/* Brand Payment Quick View — executive intelligence */}
              <BrandPaymentQuickView storeId={id || ''} />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-border/50"
                onClick={handleGeocodeAddress}
                disabled={geocoding || !store.address_street}
              >
                <Navigation className="h-4 w-4 mr-2" />
                {geocoding ? "Geocoding..." : "Geocode Address"}
              </Button>
              <Button className="bg-primary hover:bg-primary-hover" onClick={() => setUnifiedInteractionModalOpen(true)}>
                Log Interaction
              </Button>
            </div>
          </div>
        </div>
      </div>

      <CommunicationLogModal
        open={communicationModalOpen}
        onOpenChange={setCommunicationModalOpen}
        entityType="store"
        entityId={id || ""}
        entityName={store.name}
        onSuccess={() => setTimelineRefresh((prev) => prev + 1)}
      />

      <UnifiedInteractionModal
        open={unifiedInteractionModalOpen}
        onOpenChange={(open) => {
          setUnifiedInteractionModalOpen(open);
          if (!open) {
            setUnifiedInteractionModalType('delivery'); // Reset to default when closed
          }
        }}
        storeId={id || ""}
        storeName={store.name}
        storeContacts={storeContacts || []}
        initialInteractionType={unifiedInteractionModalType as any}
        onSuccess={() => {
          fetchInventoryAndVisits();
          setTimelineRefresh((prev) => prev + 1);
          // Order history will be refreshed automatically via query invalidation in UnifiedInteractionModal
        }}
      />

      <CreateStoreInvoiceModal
        open={createInvoiceModalOpen}
        onOpenChange={setCreateInvoiceModalOpen}
        storeId={id || ""}
        storeName={store.name}
        onSuccess={() => {
          // Order history will refresh automatically via query invalidation
        }}
      />

      <BulkCommunicationLogModal
        open={bulkCommModalOpen}
        onOpenChange={setBulkCommModalOpen}
        onSuccess={() => setTimelineRefresh((prev) => prev + 1)}
      />

      {/* 📌 Pinned Notes — Store Profile authoring surface */}
      <PinnedNotesSection storeId={id || ''} />

      {/* 🚨 Escalation Flags — Read-only derived signals */}
      <EscalationFlagsPanel storeId={id || ''} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information - With Edit Button and Clear Phone Labels */}
          <StoreContactInfoCard
            store={store}
            onUpdate={() => {
              // Refetch store data - merge legacy into current state
              supabase
                .from("stores")
                .select("*")
                .eq("id", id)
                .single()
                .then(({ data }) => {
                  if (data && store) setStore(prev => prev ? { ...prev, ...{ phone: data.phone || prev.phone, alt_phone: data.alt_phone || prev.alt_phone, responsiveness: data.responsiveness || prev.responsiveness, payment_type: data.payment_type || prev.payment_type } } : prev);
                });
            }}
          />

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* CANONICAL SHARED SECTIONS — Auto-synced with all profiles */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <StoreContactsSection storeId={id || ""} storeName={store.name} />
          <TubesSoldHeroStrip storeId={id || ""} />
          <EngagementBanner storeId={id || ""} />
          <SharedStoreCoreIntelligence
            storeId={id || ""}
            storeName={store.name}
            role="admin"
            storeGroupId={store.connected_group_id}
            storeOwnerName={store.primary_contact_name}
            sellsFlowers={store?.sells_flowers || false}
            onConnectionChange={() => {
              supabase
                .from("stores")
                .select("connected_group_id")
                .eq("id", id)
                .single()
                .then(({ data }) => {
                  if (data) setStore(prev => prev ? { ...prev, connected_group_id: data.connected_group_id } : prev);
                });
            }}
            onLogInteraction={(resolvedId) => {
              setResolvedStoreMasterId(resolvedId as string);
              setUnifiedInteractionModalOpen(true);
            }}
            onCreateInvoice={() => setCreateInvoiceModalOpen(true)}
            onSellsFlowersUpdate={() => {
              supabase
                .from("stores")
                .select("sells_flowers")
                .eq("id", id)
                .single()
                .then(({ data }) => {
                  if (data) setStore(prev => prev ? { ...prev, sells_flowers: data.sells_flowers ?? prev.sells_flowers } : prev);
                });
            }}
          />

          {/* Communication Stats & AI */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="glass-card border-border/50">
              <CardContent className="pt-6">
                <CommunicationStats entityType="store" entityId={id || ""} />
              </CardContent>
            </Card>

            <FollowUpAIRecommendation storeId={id || ""} />
          </div>

          {/* AI Relationship Health */}
          <AIRelationshipHealth entityType="store" entityId={id || ""} />

          {/* Route Intelligence */}
          <RouteIntelligence storeId={id || ""} storeName={store?.name} />

          {/* Replenishment AI */}
          <ReplenishmentAI storeId={id || ""} />

          {/* Last Order Snapshot Intelligence */}
          <LastOrderSnapshotPanel storeId={id || ""} />

          {/* Route Intelligence Insights */}
          {routeInsight && (
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Route Intelligence Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Service Time</p>
                    <p className="text-2xl font-bold">{routeInsight.average_service_time_minutes} min</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold">{routeInsight.visit_success_rate?.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Difficulty Score</span>
                    <Badge
                      variant={
                        (routeInsight as any).difficulty_score === 1
                          ? "default"
                          : (routeInsight as any).difficulty_score === 5
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {(routeInsight as any).difficulty_score}/5
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Best Time</span>
                    <Badge variant="outline" className="capitalize">
                      {routeInsight.best_time_window}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Route Group</span>
                    <Badge variant="outline" className="capitalize">
                      {(routeInsight as any).recommended_route_group}
                    </Badge>
                  </div>
                </div>

                {routeInsight.notes && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground">{routeInsight.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Communication Timeline */}
          {/* <Card className="glass-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Communication Timeline
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkCommModalOpen(true)}
                  className="border-border/50 gap-2"
                >
                  <Users className="h-4 w-4" />
                  Bulk Log
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCommunicationModalOpen(true)}
                  className="border-border/50"
                >
                  Log Communication
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <CommunicationTimelineCRM storeId={id || ""} />
            </CardContent>
          </Card> */}

          {/* Tabs for Inventory & History */}
          <Tabs defaultValue="inventory" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 gap-1">
              <TabsTrigger value="inventory" className="text-xs sm:text-sm">
                <Package className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Inventory</span>
                <span className="sm:hidden">Inv</span>
              </TabsTrigger>
              <TabsTrigger value="performance" className="text-xs sm:text-sm">
                <TrendingUp className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Performance</span>
                <span className="sm:hidden">Perf</span>
              </TabsTrigger>
              <TabsTrigger value="calls" className="text-xs sm:text-sm">
                <Headphones className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Calls</span>
                <span className="sm:hidden">Calls</span>
              </TabsTrigger>
              <TabsTrigger value="route-coverage" className="text-xs sm:text-sm">
                <MapPin className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Coverage</span>
                <span className="sm:hidden">Cov</span>
              </TabsTrigger>
              <TabsTrigger value="revenue" className="text-xs sm:text-sm">
                <Flame className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Revenue</span>
                <span className="sm:hidden">Rev</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs sm:text-sm">
                <Clock className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">History</span>
                <span className="sm:hidden">Hist</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="inventory" className="space-y-4">
              {/* AI Prediction Card */}
              {inventory.length > 0 && inventory.some((i) => i.urgency_score > 0) && (
                <InventoryPredictionCard
                  storeName={store.name}
                  urgencyScore={Math.max(...inventory.map((i) => i.urgency_score || 0))}
                  predictedStockoutDate={
                    inventory.find((i) => i.predicted_stockout_date)?.predicted_stockout_date || null
                  }
                  velocity={inventory.reduce((sum, i) => sum + (i.velocity_boxes_per_day || 0), 0) / inventory.length}
                />
              )}

              <Card className="glass-card border-border/50">
                <CardHeader>
                  <CardTitle>Product Inventory Levels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {inventory.length > 0 ? (
                    inventory.map((item) => {
                      const level = getInventoryLevel(item.last_inventory_level);
                      return (
                        <div key={item.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: item.product.brand.color }}
                              />
                              <span className="text-sm font-medium">
                                {item.product.brand.name} - {item.product.name}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {level.label}
                            </Badge>
                          </div>
                          <Progress value={level.value} className={`h-2 ${level.color}`} />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              Last checked:{" "}
                              {item.last_inventory_check_at
                                ? new Date(item.last_inventory_check_at).toLocaleDateString()
                                : "Never"}
                            </span>
                            {item.next_estimated_reorder_date && (
                              <span>
                                Next reorder: {new Date(item.next_estimated_reorder_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No inventory data available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              <StorePerformanceTab storeId={id!} storeName={store.name} />
            </TabsContent>

            <TabsContent value="calls">
              <StoreCallIntelligenceTab storeId={id!} />
            </TabsContent>

            <TabsContent value="route-coverage">
              <Card className="glass-card border-border/50">
                <CardHeader>
                  <CardTitle>Route & Coverage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {store.last_visit_date ? (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Last Visit</p>
                        <p className="font-semibold">
                          {new Date(store.last_visit_date).toLocaleDateString()} (
                          {Math.floor((Date.now() - new Date(store.last_visit_date).getTime()) / (1000 * 60 * 60 * 24))}{" "}
                          days ago)
                        </p>
                      </div>
                      {store.last_visit_driver_id && (
                        <div>
                          <p className="text-sm text-muted-foreground">Last Visit Driver</p>
                          <p className="font-semibold">Driver #{store.last_visit_driver_id.slice(0, 8)}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground">Last Visit</p>
                      <p className="font-semibold text-orange-600">Never visited</p>
                    </div>
                  )}

                  <Separator />

                  <div>
                    <p className="text-sm text-muted-foreground">Coverage Status</p>
                    <div className="mt-2">
                      {store.visit_risk_level === "critical" && (
                        <Badge variant="destructive" className="text-base">
                          Critical - Needs Immediate Visit
                        </Badge>
                      )}
                      {store.visit_risk_level === "at_risk" && (
                        <Badge className="bg-orange-500 text-base">At Risk - Schedule Visit Soon</Badge>
                      )}
                      {(!store.visit_risk_level || store.visit_risk_level === "normal") && (
                        <Badge variant="secondary" className="text-base">
                          Normal - On Schedule
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm text-muted-foreground">Visit Frequency Target</p>
                    <p className="font-semibold">Every {store.visit_frequency_target || 7} days</p>
                  </div>

                  {(store.visit_risk_level === "critical" || store.visit_risk_level === "at_risk") && (
                    <>
                      <Separator />
                      <div className="p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <p className="font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                          <AlertCircle className="h-5 w-5" />
                          Action Required
                        </p>
                        <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                          This store has not been visited recently and should be prioritized for the next route.
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card className="glass-card border-border/50">
                <CardHeader>
                  <CardTitle>Recent Visits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {visits.length > 0 ? (
                    visits.map((visit) => (
                      <div key={visit.id} className="p-4 rounded-lg bg-secondary/30 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <Badge variant="outline" className="text-xs capitalize">
                              {formatVisitType(visit.visit_type)}
                            </Badge>
                            <p className="text-sm text-muted-foreground">
                              by {visit.user.name} • {getSourceFromRole(visit.user.role)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{new Date(visit.visit_datetime).toLocaleDateString()}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(visit.visit_datetime).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        {visit.cash_collected && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="h-4 w-4 text-green-500" />
                            <span className="font-medium text-green-500">${visit.cash_collected.toFixed(2)}</span>
                            {visit.payment_method && (
                              <span className="text-muted-foreground">via {visit.payment_method}</span>
                            )}
                          </div>
                        )}
                        {visit.customer_response && (
                          <p className="text-sm text-muted-foreground italic">"{visit.customer_response}"</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No visit history available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Quick Stats & Actions */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Quick Stats
                </CardTitle>
                {!isEditingQuickStats ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingQuickStats(true)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveQuickStats}
                      disabled={savingQuickStats}
                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelQuickStats}
                      disabled={savingQuickStats}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Visits</p>
                <p className="text-2xl font-bold">{visits.length}</p>
              </div>
              <Separator />
              
              {/* Responsiveness - Editable */}
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Responsiveness</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-500" />
                      <Label className="text-xs">Text</Label>
                    </div>
                    {isEditingQuickStats ? (
                      <Switch
                        checked={getResponsivenessStatus("text")}
                        onCheckedChange={() => toggleResponsiveness("text")}
                        disabled={savingQuickStats}
                      />
                    ) : (
                      <Badge
                        variant="outline"
                        className={`ml-auto text-xs ${
                          getResponsivenessStatus("text")
                            ? "bg-green-500/10 text-green-600 border-green-500/30"
                            : "bg-red-500/10 text-red-600 border-red-500/30"
                        }`}
                      >
                        {getResponsivenessStatus("text") ? "Yes" : "No"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-purple-500" />
                      <Label className="text-xs">Call</Label>
                    </div>
                    {isEditingQuickStats ? (
                      <Switch
                        checked={getResponsivenessStatus("call")}
                        onCheckedChange={() => toggleResponsiveness("call")}
                        disabled={savingQuickStats}
                      />
                    ) : (
                      <Badge
                        variant="outline"
                        className={`ml-auto text-xs ${
                          getResponsivenessStatus("call")
                            ? "bg-green-500/10 text-green-600 border-green-500/30"
                            : "bg-red-500/10 text-red-600 border-red-500/30"
                        }`}
                      >
                        {getResponsivenessStatus("call") ? "Yes" : "No"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Separator />

              {/* Contact Responsiveness Snapshot — Quick Stats intelligence */}
              {id && <QuickStatsContactSnapshot storeId={id} />}
              <Separator />
              
              {/* Brand Stickers - Canonical Quick Stats Display */}
              {id && <QuickStatsStickersSummary storeId={id} />}
              <Separator />
              
              {/* Brand Payment Status — 4-brand matrix from store_brand_relationships */}
              <QuickStatsBrandPaymentMatrix storeId={id || ''} />
              <Separator />
              
              <MemberSinceDisplay storeId={id || ""} />
            </CardContent>
          </Card>

          {/* Danger Zone — Owner Only, GDS v1.0, inside KPI cards section */}
          {storeMasterId && (
            <StoreDangerZone storeId={storeMasterId} storeName={store.name} sourceUi="store_profile_kpi_cards" />
          )}

          {/* Notes */}
          {store.notes && (
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{store.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Additional Notes (Overview / Old / Special) */}
          {(store.notes_overview || store.notes_old || store.special_information) && (
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Additional Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {store.notes_overview && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Overview</p>
                    <p className="text-sm whitespace-pre-wrap">{store.notes_overview}</p>
                  </div>
                )}
                {store.special_information && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Special Information</p>
                    <p className="text-sm whitespace-pre-wrap">{store.special_information}</p>
                  </div>
                )}
                {store.notes_old && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Legacy Notes</p>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{store.notes_old}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Owner / CRM Intelligence */}
          {(store.nickname || store.country_of_origin || store.influence_level || store.risk_score || store.personality_notes || store.languages?.length || store.loyalty_triggers?.length || store.frustration_triggers?.length) && (
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Owner & CRM Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {store.nickname && (
                    <div>
                      <p className="text-xs text-muted-foreground">Nickname</p>
                      <p className="font-medium">{store.nickname}</p>
                    </div>
                  )}
                  {store.country_of_origin && (
                    <div>
                      <p className="text-xs text-muted-foreground">Country of Origin</p>
                      <p className="font-medium">{store.country_of_origin}</p>
                    </div>
                  )}
                  {store.influence_level && (
                    <div>
                      <p className="text-xs text-muted-foreground">Influence Level</p>
                      <Badge variant="outline" className="text-xs capitalize">{store.influence_level}</Badge>
                    </div>
                  )}
                  {store.risk_score && (
                    <div>
                      <p className="text-xs text-muted-foreground">Risk Score</p>
                      <Badge variant="outline" className="text-xs capitalize">{store.risk_score}</Badge>
                    </div>
                  )}
                </div>
                {store.languages && store.languages.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Languages</p>
                    <div className="flex flex-wrap gap-1">
                      {store.languages.map(lang => (
                        <Badge key={lang} variant="secondary" className="text-xs">{lang}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {store.loyalty_triggers && store.loyalty_triggers.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Loyalty Triggers</p>
                    <div className="flex flex-wrap gap-1">
                      {store.loyalty_triggers.map(t => (
                        <Badge key={t} className="text-xs bg-green-500/10 text-green-600 border-green-500/30">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {store.frustration_triggers && store.frustration_triggers.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Frustration Triggers</p>
                    <div className="flex flex-wrap gap-1">
                      {store.frustration_triggers.map(t => (
                        <Badge key={t} className="text-xs bg-red-500/10 text-red-600 border-red-500/30">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {store.personality_notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Personality Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{store.personality_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Communication Preferences */}
          {(store.communication_preference || store.preferred_channel || store.language_preference || store.formality_level || store.notes_for_tone) && (
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Communication Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {store.preferred_channel && (
                    <div>
                      <p className="text-xs text-muted-foreground">Preferred Channel</p>
                      <p className="font-medium capitalize">{store.preferred_channel}</p>
                    </div>
                  )}
                  {store.communication_preference && (
                    <div>
                      <p className="text-xs text-muted-foreground">Communication Style</p>
                      <p className="font-medium capitalize">{store.communication_preference}</p>
                    </div>
                  )}
                  {store.language_preference && (
                    <div>
                      <p className="text-xs text-muted-foreground">Language Preference</p>
                      <p className="font-medium">{store.language_preference}</p>
                    </div>
                  )}
                  {store.dialect_preference && (
                    <div>
                      <p className="text-xs text-muted-foreground">Dialect</p>
                      <p className="font-medium">{store.dialect_preference}</p>
                    </div>
                  )}
                  {store.formality_level && (
                    <div>
                      <p className="text-xs text-muted-foreground">Formality</p>
                      <Badge variant="outline" className="text-xs capitalize">{store.formality_level}</Badge>
                    </div>
                  )}
                </div>
                {store.notes_for_tone && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Tone Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{store.notes_for_tone}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Expansion Info */}
          {(store.has_expansion || store.expansion_notes || (store.new_store_addresses && store.new_store_addresses.length > 0)) && (
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Expansion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {store.has_expansion && (
                  <Badge className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">Has Expansion Plans</Badge>
                )}
                {store.new_store_addresses && store.new_store_addresses.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">New Store Addresses</p>
                    {store.new_store_addresses.map((addr, i) => (
                      <p key={i} className="text-sm">{addr}</p>
                    ))}
                  </div>
                )}
                {store.expected_open_dates && store.expected_open_dates.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Expected Open Dates</p>
                    <div className="flex flex-wrap gap-1">
                      {store.expected_open_dates.map((d, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {store.expansion_notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{store.expansion_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Operations & Legacy Info */}
          {(store.wholesaler_name || store.store_code || store.market_code || store.boro || store.neighborhood || store.rpa_status || store.health_status || store.last_visit_at || store.last_order_at) && (
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Operations Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {store.health_status && (
                    <div>
                      <p className="text-xs text-muted-foreground">Health Status</p>
                      <Badge variant="outline" className="text-xs capitalize">{store.health_status}</Badge>
                    </div>
                  )}
                  {store.wholesaler_name && (
                    <div>
                      <p className="text-xs text-muted-foreground">Wholesaler</p>
                      <p className="font-medium">{store.wholesaler_name}</p>
                    </div>
                  )}
                  {store.store_code && (
                    <div>
                      <p className="text-xs text-muted-foreground">Store Code</p>
                      <p className="font-medium">{store.store_code}</p>
                    </div>
                  )}
                  {store.market_code && (
                    <div>
                      <p className="text-xs text-muted-foreground">Market Code</p>
                      <p className="font-medium">{store.market_code}</p>
                    </div>
                  )}
                  {store.boro && (
                    <div>
                      <p className="text-xs text-muted-foreground">Borough</p>
                      <p className="font-medium">{store.boro}</p>
                    </div>
                  )}
                  {store.neighborhood && (
                    <div>
                      <p className="text-xs text-muted-foreground">Neighborhood</p>
                      <p className="font-medium">{store.neighborhood}</p>
                    </div>
                  )}
                  {store.rpa_status && (
                    <div>
                      <p className="text-xs text-muted-foreground">RPA Status</p>
                      <Badge variant="outline" className="text-xs">{store.rpa_status}</Badge>
                    </div>
                  )}
                  {store.last_visit_at && (
                    <div>
                      <p className="text-xs text-muted-foreground">Last Visit</p>
                      <p className="font-medium">{new Date(store.last_visit_at).toLocaleDateString()}</p>
                    </div>
                  )}
                  {store.last_order_at && (
                    <div>
                      <p className="text-xs text-muted-foreground">Last Order</p>
                      <p className="font-medium">{new Date(store.last_order_at).toLocaleDateString()}</p>
                    </div>
                  )}
                  {store.member_since && (
                    <div>
                      <p className="text-xs text-muted-foreground">Member Since</p>
                      <p className="font-medium">{new Date(store.member_since).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <StoreQuickActions
            storeId={id || ""}
            storeName={store.name}
            storePhone={store.phone}
            onInventoryUpdated={() => {
              // Trigger refetch of tube inventory
            }}
            onInvoiceCreated={(invoiceId) => {
              // Navigate to invoice or show success
            }}
          />

        </div>
      </div>

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
