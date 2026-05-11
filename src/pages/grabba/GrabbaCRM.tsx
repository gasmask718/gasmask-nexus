import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Users,
  User,
  Search,
  Phone,
  Mail,
  MapPin,
  Star,
  ExternalLink,
  MessageSquare,
  Package,
  Building2,
  Store,
  Truck,
  Award,
  DollarSign,
  FileText,
  ChevronRight,
  Filter,
  X,
  Edit,
  Trash2,
  Heart,
  Car,
  Bike,
  Eye,
  Factory,
} from "lucide-react";
import { getRelationshipScoresForStores, RelationshipScore } from "@/services/crmInsightsService";
import { useNavigate, Link, useParams } from "react-router-dom";
import { GRABBA_BRAND_IDS, GRABBA_BRAND_CONFIG, getBrandConfig, type GrabbaBrand } from "@/config/grabbaSkyscraper";
import { BrandFilterBar, BrandBadgesRow } from "@/components/grabba/BrandFilterBar";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { useGrabbaBrandActivity, useGrabbaBrandCounts } from "@/hooks/useGrabbaData";
import { AICRMInsights } from "@/components/grabba/intelligence";
import { EntityModal, ExportButton, DataTablePagination } from "@/components/crud";
import { DeleteConfirmModal } from "@/components/crud/DeleteConfirmModal";
import { GlobalAddButton } from "@/components/crud/GlobalAddButton";
import { useCrudOperations } from "@/hooks/useCrudOperations";
import { companyFields, storeFields, wholesalerFields, driverFields, bikerFields, ambassadorFields, productionWorkerFields } from "@/config/entityFieldConfigs";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useSimulationMode } from "@/contexts/SimulationModeContext";
import { EntityProfileModal, type EntityProfileType } from "@/components/grabba/EntityProfileModal";
import { useLastOrderSnapshotBatch } from "@/hooks/useLastOrderSnapshot";
import { LastOrderKPIBadge } from "@/components/store/LastOrderKPIBadge";

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 1 — CRM: All stores, wholesalers, customers, and companies for Grabba brands.
// ═══════════════════════════════════════════════════════════════════════════════

type EntityType = "all" | "store" | "wholesaler" | "direct_customer";
type ViewTab = "companies" | "stores" | "ambassadors" | "wholesalers" | "drivers" | "bikers" | "production";

export default function GrabbaCRM() {
  const navigate = useNavigate();
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  const [typeFilter, setTypeFilter] = useState<EntityType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("companies");
  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  
  // Pagination state (shared across tabs, reset on tab change)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // CRUD Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [driverDetailOpen, setDriverDetailOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  
  // New profile modal states
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedProfileEntity, setSelectedProfileEntity] = useState<any>(null);
  const [selectedProfileType, setSelectedProfileType] = useState<EntityProfileType>('driver');

  // Simulation mode context - define early so CRUD can use it
  const { simulationMode } = useSimulationMode();

  // CRUD Operations - pass simulationMode to keep data separate
  const companyCrud = useCrudOperations({
    table: "companies",
    queryKey: ["grabba-crm-companies"], // This will invalidate all queries starting with this key
    successMessages: { create: "Company created", update: "Company updated", delete: "Company deleted" },
    simulationMode,
  });

  const storeCrud = useCrudOperations({
    table: "stores",
    queryKey: ["grabba-crm-stores"],
    successMessages: { create: "Store created", update: "Store updated", delete: "Store deleted" },
    simulationMode,
  });

  const wholesalerCrud = useCrudOperations({
    table: "wholesalers",
    queryKey: ["grabba-crm-wholesalers"],
    successMessages: { create: "Wholesaler created", update: "Wholesaler updated", delete: "Wholesaler deleted" },
    simulationMode,
  });

  const ambassadorCrud = useCrudOperations({
    table: "ambassadors",
    queryKey: ["grabba-crm-ambassadors"],
    successMessages: { create: "Ambassador created", update: "Ambassador updated", delete: "Ambassador deleted" },
    simulationMode,
  });

  const driverCrud = useCrudOperations({
    table: "drivers",
    queryKey: ["grabba-crm-drivers"],
    successMessages: { create: "Driver created", update: "Driver updated", delete: "Driver deleted" },
    simulationMode,
  });

  const bikerCrud = useCrudOperations({
    table: "bikers",
    queryKey: ["grabba-crm-bikers"],
    successMessages: { create: "Biker created", update: "Biker updated", delete: "Biker deleted" },
    simulationMode,
  });

  const productionCrud = useCrudOperations({
    table: "crm_production",
    queryKey: ["grabba-crm-production"],
    successMessages: { create: "Production created", update: "Production updated", delete: "Production deleted" },
    simulationMode,
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA QUERIES
  // ═══════════════════════════════════════════════════════════════════════════════

  // Fetch companies with Grabba activity - filter by simulation mode
  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ["grabba-crm-companies", selectedBrand, simulationMode],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      const { data: ordersWithCompanies } = await supabase
        .from("wholesale_orders")
        .select("company_id, brand")
        .in("brand", brandsToQuery);

      const companyIds = [...new Set(ordersWithCompanies?.map((o) => o.company_id).filter(Boolean))];

      // Always fetch all companies, but prioritize those with orders
      // Filter by simulation mode to keep LIVE and SIMULATION data separate
      const { data: allCompanies } = await supabase
        .from("companies")
        .select("*")
        .eq("is_simulation", simulationMode)
        .order("created_at", { ascending: false })
        .limit(500);
      
      return allCompanies || [];
    },
  });

  // Fetch ALL stores - no limit, paginated in UI
  const { data: stores, isLoading: storesLoading, refetch: refetchStores } = useQuery({
    queryKey: ["grabba-crm-stores", selectedBrand, simulationMode],
    queryFn: async () => {
      // Canonical source: store_master. Aliased to the field shape the rest
      // of this page expects (name, address_street/city/state/zip, etc.).
      const selectFields =
        "id, name:store_name, phone, address_street:address, address_city:city, address_state:state, address_zip:zip, created_at, is_simulation";

      // Fetch all stores using range-based pagination to bypass 1000-row default
      const PAGE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase
          .from("store_master")
          .select(selectFields)
          .is("deleted_at", null)
          .eq("is_simulation", simulationMode)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);

        if (data && data.length > 0) {
          // store_master has no `neighborhood` or `companies` relation; fill nulls
          const normalized = data.map((s: any) => ({
            ...s,
            neighborhood: null,
            companies: null,
          }));
          allData = allData.concat(normalized);
          from += PAGE;
          hasMore = data.length === PAGE;
        } else {
          hasMore = false;
        }
      }
      return allData;
    },
  });

  // Fetch tube inventory for visible stores using batched queries to avoid URL limits
  const allStoreIds = stores?.map((s: any) => s.id) || [];
  const { data: tubeInventory } = useQuery({
    queryKey: ["grabba-crm-tube-inventory", allStoreIds.length],
    queryFn: async () => {
      if (allStoreIds.length === 0) return {};
      
      const BATCH_SIZE = 200;
      const inventoryMap: Record<string, number> = {};
      
      for (let i = 0; i < allStoreIds.length; i += BATCH_SIZE) {
        const batch = allStoreIds.slice(i, i + BATCH_SIZE);
        const { data } = await supabase
          .from("store_tube_inventory")
          .select("store_id, current_tubes_left")
          .in("store_id", batch);
        
        data?.forEach((item: any) => {
          inventoryMap[item.store_id] = (inventoryMap[item.store_id] || 0) + (item.current_tubes_left || 0);
        });
      }
      return inventoryMap;
    },
    enabled: allStoreIds.length > 0,
  });

  // Fetch wholesalers - filter by simulation mode
  const { data: wholesalers, isLoading: wholesalersLoading } = useQuery({
    queryKey: ["grabba-crm-wholesalers", simulationMode],
    queryFn: async () => {
      const { data } = await supabase
        .from("wholesalers")
        .select("*")
        .eq("is_simulation", simulationMode)
        .order("name");
      return data || [];
    },
  });

  // Fetch ambassadors
  const { data: ambassadors, isLoading: ambassadorsLoading } = useQuery({
    queryKey: ["grabba-crm-ambassadors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ambassadors")
        .select("*, profiles(name, avatar_url, email)")
        .eq("is_active", true);
      return data || [];
    },
  });

  // Fetch drivers from drivers table
  const { data: driversData, isLoading: driversLoading } = useQuery({
    queryKey: ["grabba-crm-drivers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id, full_name, phone, email, vehicle_type, home_base, status, created_at")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch bikers from bikers table
  const { data: bikersData, isLoading: bikersLoading } = useQuery({
    queryKey: ["grabba-crm-bikers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bikers")
        .select("id, full_name, phone, email, territory, status, created_at")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch production workers from people table
  const { data: productionData, isLoading: productionLoading } = useQuery({
    queryKey: ["grabba-crm-production"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("crm_production")
        .select("id, name, phone, email, phone_whatsapp, address_street, address_city, address_state, address_zip, created_at")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch brand activity per company/store
  const { data: brandActivity } = useGrabbaBrandActivity();
  const { data: brandCounts } = useGrabbaBrandCounts();

  // Fetch neighborhoods for filter - includes all neighborhoods
  const neighborhoods = useMemo(() => {
    const hoods = new Set<string>();
    companies?.forEach((c) => c.neighborhood && hoods.add(c.neighborhood));
    stores?.forEach((s: any) => s.neighborhood && hoods.add(s.neighborhood));
    return Array.from(hoods).sort();
  }, [companies, stores]);

  // Fetch cities for filter
  const cities = useMemo(() => {
    const citySet = new Set<string>();
    companies?.forEach((c) => {
      if (c.default_city) citySet.add(c.default_city);
    });
    stores?.forEach((s: any) => {
      if (s.address_city) citySet.add(s.address_city);
    });
    return Array.from(citySet).sort();
  }, [companies, stores]);

  // Fetch states for filter
  const states = useMemo(() => {
    const stateSet = new Set<string>();
    stores?.forEach((s: any) => {
      if (s.address_state) stateSet.add(s.address_state);
    });
    return Array.from(stateSet).sort();
  }, [stores]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // FILTERING LOGIC
  // ═══════════════════════════════════════════════════════════════════════════════

  const filteredCompanies = useMemo(() => {
    return companies?.filter((company) => {
      const matchesSearch =
        !searchQuery ||
        company.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.default_city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.default_phone?.includes(searchQuery) ||
        company.neighborhood?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = typeFilter === "all" || company.type === typeFilter;
      const matchesNeighborhood = neighborhoodFilter === "all" || company.neighborhood === neighborhoodFilter;
      const matchesCity = cityFilter === "all" || company.default_city === cityFilter;

      const companyBrands = brandActivity?.[company.id] || [];
      const matchesBrand = selectedBrand === "all" || companyBrands.includes(selectedBrand as GrabbaBrand);

      return matchesSearch && matchesType && matchesBrand && matchesNeighborhood && matchesCity;
    });
  }, [companies, searchQuery, typeFilter, selectedBrand, neighborhoodFilter, cityFilter, brandActivity]);

  const filteredStores = useMemo(() => {
    return stores?.filter((store: any) => {
      const matchesSearch =
        !searchQuery ||
        store.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        store.neighborhood?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        store.address_city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        store.address_street?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        store.phone?.includes(searchQuery);

      const storeBrands = brandActivity?.[store.id] || [];
      const matchesBrand = selectedBrand === "all" || storeBrands.includes(selectedBrand as GrabbaBrand);
      const matchesNeighborhood = neighborhoodFilter === "all" || store.neighborhood === neighborhoodFilter;
      const matchesCity = cityFilter === "all" || store.address_city === cityFilter;
      const matchesState = stateFilter === "all" || store.address_state === stateFilter;

      return matchesSearch && matchesBrand && matchesNeighborhood && matchesCity && matchesState;
    });
  }, [stores, searchQuery, selectedBrand, neighborhoodFilter, cityFilter, stateFilter, brandActivity]);

  const filteredWholesalers = useMemo(() => {
    return wholesalers?.filter((w) => {
      const matchesSearch =
        !searchQuery || w.name?.toLowerCase().includes(searchQuery.toLowerCase()) || w.phone?.includes(searchQuery);
      return matchesSearch;
    });
  }, [wholesalers, searchQuery]);

  const filteredAmbassadors = useMemo(() => {
    return ambassadors?.filter((a: any) => {
      const matchesSearch =
        !searchQuery ||
        a.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.tracking_code?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [ambassadors, searchQuery]);

  const filteredDrivers = useMemo(() => {
    return driversData?.filter((d: any) => {
      const matchesSearch =
        !searchQuery ||
        d.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.phone?.includes(searchQuery) ||
        d.home_base?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [driversData, searchQuery]);

  const filteredBikers = useMemo(() => {
    return bikersData?.filter((b: any) => {
      const matchesSearch =
        !searchQuery ||
        b.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.phone?.includes(searchQuery) ||
        b.territory?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [bikersData, searchQuery]);

  const filteredProduction = useMemo(() => {
    return productionData?.filter((p: any) => {
      const matchesSearch =
        !searchQuery ||
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.phone?.includes(searchQuery) ||
        p.email?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [productionData, searchQuery]);

  const clearFilters = () => {
    setSelectedBrand("all");
    setTypeFilter("all");
    setSearchQuery("");
    setNeighborhoodFilter("all");
    setCityFilter("all");
    setStateFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    selectedBrand !== "all" || typeFilter !== "all" || searchQuery || neighborhoodFilter !== "all" || cityFilter !== "all" || stateFilter !== "all";

  // Reset page on tab change
  const handleTabChange = (tab: ViewTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  // Get active filtered list for pagination
  const getActiveList = () => {
    switch (activeTab) {
      case "companies": return filteredCompanies || [];
      case "stores": return filteredStores || [];
      case "wholesalers": return filteredWholesalers || [];
      case "ambassadors": return filteredAmbassadors || [];
      case "drivers": return filteredDrivers || [];
      case "bikers": return filteredBikers || [];
      case "production": return filteredProduction || [];
      default: return [];
    }
  };

  const activeList = getActiveList();
  const totalPages = Math.ceil(activeList.length / pageSize);
  const paginatedList = activeList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ═══════════════════════════════════════════════════════════════════════════════
  // ENTITY CARD COMPONENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  const CompanyCard = ({ company }: { company: any }) => {
    const companyBrands = brandActivity?.[company.id] || [];

    return (
      <Card 
        className="bg-card/50 backdrop-blur border-border/50 hover:border-blue-500/30 transition-all hover:shadow-lg cursor-pointer"
        onClick={() => {
          setSelectedProfileEntity(company);
          setSelectedProfileType('company');
          setProfileModalOpen(true);
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  to={`/companies/${company.id}`}
                  className="text-lg font-semibold text-foreground hover:text-primary transition-colors"
                >
                  {company.name}
                </Link>
                <Badge variant="outline" className="capitalize">
                  {company.type || "store"}
                </Badge>
              </div>

              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                {company.neighborhood && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {company.neighborhood}
                    {company.boro ? `, ${company.boro}` : ""}
                  </span>
                )}
                {company.default_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {company.default_phone}
                  </span>
                )}
              </div>

              {/* Brand Pills */}
              {companyBrands.length > 0 && <BrandBadgesRow brands={companyBrands as GrabbaBrand[]} className="mt-3" />}

              {/* Entity Chain Links */}
              <div className="flex items-center gap-2 mt-3 text-xs">
                <Link
                  to={`/companies/${company.id}`}
                  className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                >
                  <Building2 className="h-3 w-3" /> Profile
                </Link>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <Link
                  to={`/grabba/inventory?company=${company.id}`}
                  className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                >
                  <Package className="h-3 w-3" /> Orders
                </Link>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <Link
                  to={`/unpaid-accounts?company=${company.id}`}
                  className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                >
                  <DollarSign className="h-3 w-3" /> Payments
                </Link>
              </div>
            </div>

            {/* Payment Reliability */}
            <div className="text-center px-3 border-l border-border shrink-0">
              <div className="flex items-center gap-0.5 text-amber-400">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${i <= (company.payment_reliability_score || 0) / 20 ? "fill-current" : "opacity-30"}`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{company.payment_reliability_tier || "Unrated"}</span>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-1 shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/companies/${company.id}`);
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open Profile</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/grabba/communication?company=${company.id}`);
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send Message</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // V9: Fetch relationship scores for all stores
  const storeIds = useMemo(() => stores?.map((s: any) => s.id) || [], [stores]);

  const { data: relationshipScores } = useQuery({
    queryKey: ["relationship-scores-batch", storeIds],
    queryFn: () => getRelationshipScoresForStores(storeIds),
    enabled: storeIds.length > 0,
  });

  const { data: losMap } = useLastOrderSnapshotBatch(storeIds);

  const StoreCard = ({ store }: { store: any }) => {
    const storeBrands = brandActivity?.[store.id] || [];
    const relScore = relationshipScores?.[store.id];

    // Build full address from correct column names
    const addressParts = [store.address_street, store.address_city, store.address_state, store.address_zip].filter(Boolean);
    const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : store.neighborhood;

    // Get inventory count from tubeInventory map
    const inventoryCount = tubeInventory?.[store.id] || 0;

    return (
      <Card 
        className="bg-card/50 backdrop-blur border-border/50 hover:border-green-500/30 transition-all hover:shadow-lg cursor-pointer"
        onClick={() => {
          setSelectedProfileEntity(store);
          setSelectedProfileType('store');
          setProfileModalOpen(true);
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <Store className="h-4 w-4 text-green-500" />
                <Link
                  to={`/stores/${store.id}`}
                  className="text-lg font-semibold text-foreground hover:text-green-500 transition-colors"
                >
                  {store.name}
                </Link>
                {/* V9: Relationship Score Badge */}
                {relScore && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${relScore.color}`}>
                    {relScore.tier} ({relScore.score})
                  </span>
                )}
                {/* Inventory Count Badge */}
                {inventoryCount > 0 && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                    <Package className="h-3 w-3 mr-1" />
                    {inventoryCount} units
                  </Badge>
                )}
              </div>

              {/* Address display */}
              {fullAddress && (
                <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {fullAddress}
                </div>
              )}

              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                {store.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {store.phone}
                  </span>
                )}
                {store.companies?.name && (
                  <Link to={`/companies/${store.companies.id}`} className="flex items-center gap-1 hover:text-primary">
                    <Building2 className="h-3 w-3" />
                    {store.companies.name}
                  </Link>
                )}
              </div>

              {storeBrands.length > 0 && <BrandBadgesRow brands={storeBrands as GrabbaBrand[]} className="mt-3" />}
              <LastOrderKPIBadge snapshots={losMap?.get(store.id)} compact className="mt-2" />
            </div>

            <div className="flex gap-1 shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/grabba/store-master/${store.id}`);
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Store Details</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const WholesalerCard = ({ wholesaler }: { wholesaler: any }) => (
    <Card 
      className="bg-card/50 backdrop-blur border-border/50 hover:border-purple-500/30 transition-all hover:shadow-lg"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <Truck className="h-4 w-4 text-purple-500" />
              <button
                onClick={() => navigate(`/wholesale/${wholesaler.id}`)}
                className="text-lg font-semibold hover:text-purple-400 hover:underline transition-colors text-left"
                title="Open Wholesaler Intelligence Profile"
              >
                {wholesaler.name}
              </button>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                Wholesaler
              </Badge>
              {wholesaler.status === 'active' ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
              ) : (
                <Badge className="bg-muted text-muted-foreground">Inactive</Badge>
              )}
            </div>

            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              {wholesaler.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {wholesaler.phone}
                </span>
              )}
              {wholesaler.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {wholesaler.email}
                </span>
              )}
              {wholesaler.neighborhood && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {wholesaler.neighborhood}
                </span>
              )}
              {wholesaler.tags && (
                <span className="flex items-center gap-1 text-xs">
                  {wholesaler.tags}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Primary CTA - View Wholesaler Profile */}
            <Button
              variant="default"
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
              onClick={() => navigate(`/wholesale/${wholesaler.id}`)}
            >
              <User className="h-4 w-4" />
              View Profile
            </Button>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => {
                      setSelectedProfileEntity(wholesaler);
                      setSelectedProfileType('wholesaler');
                      setProfileModalOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Quick Preview</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openEditModal(wholesaler)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit Wholesaler</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => openDeleteModal(wholesaler)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Wholesaler</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const AmbassadorCard = ({ ambassador }: { ambassador: any }) => (
    <Card 
      className="bg-card/50 backdrop-blur border-border/50 hover:border-amber-500/30 transition-all hover:shadow-lg cursor-pointer"
      onClick={() => navigate(`/grabba/ambassadors/${ambassador.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <Award className="h-4 w-4 text-amber-500" />
              <span className="text-lg font-semibold">{ambassador.name || ambassador.profiles?.full_name || ambassador.profiles?.name || "Unknown Ambassador"}</span>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{ambassador.tier}</Badge>
              {ambassador.is_active ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
              ) : (
                <Badge className="bg-muted text-muted-foreground">Inactive</Badge>
              )}
            </div>

            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Code: {ambassador.tracking_code}
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />${ambassador.total_earnings?.toLocaleString() || "0"} earned
              </span>
              {ambassador.state && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {ambassador.state}
                </span>
              )}
              {ambassador.tags && (
                <span className="flex items-center gap-1 text-xs">
                  {ambassador.tags}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/grabba/ambassadors/${ambassador.id}`);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Profile</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(ambassador);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit Ambassador</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteModal(ambassador);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Ambassador</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const DriverCard = ({ driver }: { driver: any }) => (
    <Card 
      className="bg-card/50 backdrop-blur border-border/50 hover:border-blue-500/30 transition-all hover:shadow-lg"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <Car className="h-4 w-4 text-blue-500" />
              <span className="text-lg font-semibold">{driver.full_name || "Driver"}</span>
              <Badge className={driver.status === 'active' 
                ? "bg-green-500/20 text-green-400 border-green-500/30" 
                : "bg-muted text-muted-foreground"}>
                {driver.status || "Unknown"}
              </Badge>
            </div>

            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              {driver.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {String(driver.phone)}
                </span>
              )}
              {driver.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {driver.email}
                </span>
              )}
              {driver.home_base && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {driver.home_base}
                </span>
              )}
              {driver.vehicle_type && (
                <Badge variant="outline" className="text-xs">
                  {driver.vehicle_type}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/delivery/drivers/${driver.id}`);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Profile</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(driver);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit Driver</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteModal(driver);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Driver</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const BikerCard = ({ biker }: { biker: any }) => (
    <Card 
      className="bg-card/50 backdrop-blur border-border/50 hover:border-green-500/30 transition-all hover:shadow-lg"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <Bike className="h-4 w-4 text-green-500" />
              <span className="text-lg font-semibold">{biker.full_name || "Biker"}</span>
              <Badge className={biker.status === 'active' 
                ? "bg-green-500/20 text-green-400 border-green-500/30" 
                : "bg-muted text-muted-foreground"}>
                {biker.status || "Unknown"}
              </Badge>
            </div>

            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              {biker.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {String(biker.phone)}
                </span>
              )}
              {biker.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {biker.email}
                </span>
              )}
              {biker.territory && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {biker.territory}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/delivery/bikers/${biker.id}`);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Profile</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(biker);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit Biker</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteModal(biker);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Biker</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ProductionCard = ({ worker }: { worker: any }) => (
    <Card 
      className="bg-card/50 backdrop-blur border-border/50 hover:border-purple-500/30 transition-all hover:shadow-lg"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <Factory className="h-4 w-4 text-purple-500" />
              <span className="text-lg font-semibold">{worker.name || "Production"}</span>
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                Production
              </Badge>
            </div>

            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              {worker.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {String(worker.phone)}
                </span>
              )}
              {worker.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {worker.email}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/portals/production/staff/${worker.user_id}`);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Profile</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(worker);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit Production Worker</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteModal(worker);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Production Worker</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ═══════════════════════════════════════════════════════════════════════════════

  const handleCreate = async (data: Record<string, unknown>) => {
    // Add business_id for drivers/bikers if needed
    const defaultBusinessId = "c3d4e5f6-a7b8-9012-cdef-123456789012";
    
    if (activeTab === "companies") {
      await companyCrud.create(data);
    } else if (activeTab === "stores") {
      await storeCrud.create(data);
      refetchStores();
    } else if (activeTab === "wholesalers") {
      await wholesalerCrud.create(data);
    } else if (activeTab === "ambassadors") {
      // Ambassadors need user_id - for now we'll use the current user
      const { data: userData } = await supabase.auth.getUser();
      await ambassadorCrud.create({
        ...data,
        user_id: userData?.user?.id || null,
        total_earnings: 0,
      });
    } else if (activeTab === "drivers") {
      await driverCrud.create({
        ...data,
        business_id: defaultBusinessId,
      });
    } else if (activeTab === "bikers") {
      await bikerCrud.create({
        ...data,
        business_id: defaultBusinessId,
      });
    } else if (activeTab === "production") {
      await productionCrud.create(data);
    }
  };

  const handleEdit = async (data: Record<string, unknown>) => {
    if (!selectedEntity) return;
    if (activeTab === "companies") {
      await companyCrud.update({ id: selectedEntity.id, ...data });
    } else if (activeTab === "stores") {
      await storeCrud.update({ id: selectedEntity.id, ...data });
    } else if (activeTab === "wholesalers") {
      await wholesalerCrud.update({ id: selectedEntity.id, ...data });
    } else if (activeTab === "ambassadors") {
      await ambassadorCrud.update({ id: selectedEntity.id, ...data });
    } else if (activeTab === "drivers") {
      await driverCrud.update({ id: selectedEntity.id, ...data });
    } else if (activeTab === "bikers") {
      await bikerCrud.update({ id: selectedEntity.id, ...data });
    } else if (activeTab === "production") {
      await productionCrud.update({ id: selectedEntity.id, ...data });
    }
  };

  const handleDelete = async () => {
    if (!selectedEntity) return;
    if (activeTab === "companies") {
      await companyCrud.remove(selectedEntity.id);
    } else if (activeTab === "stores") {
      await storeCrud.remove(selectedEntity.id);
    } else if (activeTab === "wholesalers") {
      await wholesalerCrud.remove(selectedEntity.id);
    } else if (activeTab === "ambassadors") {
      await ambassadorCrud.remove(selectedEntity.id);
    } else if (activeTab === "drivers") {
      await driverCrud.remove(selectedEntity.id);
    } else if (activeTab === "bikers") {
      await bikerCrud.remove(selectedEntity.id);
    } else if (activeTab === "production") {
      await productionCrud.remove(selectedEntity.id);
    }
  };

  const openEditModal = (entity: any) => {
    setSelectedEntity(entity);
    setEditModalOpen(true);
  };

  const openDeleteModal = (entity: any) => {
    setSelectedEntity(entity);
    setDeleteModalOpen(true);
  };

  const getActiveFields = () => {
    if (activeTab === "companies") return companyFields;
    if (activeTab === "stores") return storeFields;
    if (activeTab === "wholesalers") return wholesalerFields;
    if (activeTab === "ambassadors") return ambassadorFields;
    if (activeTab === "drivers") return driverFields;
    if (activeTab === "bikers") return bikerFields;
    if (activeTab === "production") return productionWorkerFields;
    return companyFields;
  };

  const getAddLabel = () => {
    if (activeTab === "companies") return "New Company";
    if (activeTab === "stores") return "New Store";
    if (activeTab === "wholesalers") return "New Wholesaler";
    if (activeTab === "ambassadors") return "New Ambassador";
    if (activeTab === "drivers") return "New Driver";
    if (activeTab === "bikers") return "New Biker";
    if (activeTab === "production") return "New Production";
    return "New";
  };

  const getEntityTitle = () => {
    if (activeTab === "companies") return "Company";
    if (activeTab === "stores") return "Store";
    if (activeTab === "wholesalers") return "Wholesaler";
    if (activeTab === "ambassadors") return "Ambassador";
    if (activeTab === "drivers") return "Driver";
    if (activeTab === "bikers") return "Biker";
    if (activeTab === "production") return "Production";
    return "Entity";
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              Floor 1 — CRM & Stores
            </h1>
            <p className="text-muted-foreground mt-1">
              All stores, wholesalers, customers, and companies for Grabba brands
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {GRABBA_BRAND_IDS.map((brand) => {
              const config = getBrandConfig(brand);
              return (
                <Badge key={brand} className={config.pill}>
                  {config.icon} {config.label}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Filters Card */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Row 1: Search + Brand Filter */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, phone, neighborhood..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <BrandFilterBar
                  selectedBrand={selectedBrand}
                  onBrandChange={setSelectedBrand}
                  showCounts={true}
                  counts={brandCounts || {}}
                  variant="compact"
                />
              </div>

              {/* Row 2: Additional Filters */}
              <div className="flex flex-wrap gap-3 items-center">
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as EntityType)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="store">🏪 Store</SelectItem>
                    <SelectItem value="wholesaler">🚚 Wholesaler</SelectItem>
                    <SelectItem value="direct_customer">👤 Direct Customer</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={neighborhoodFilter} onValueChange={setNeighborhoodFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Neighborhood" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Neighborhoods</SelectItem>
                    {neighborhoods.map((hood) => (
                      <SelectItem key={hood} value={hood}>
                        {hood}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="City" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    {cities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {states.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                    <X className="h-4 w-4 mr-1" /> Clear Filters
                  </Button>
                )}

                <div className="ml-auto text-sm text-muted-foreground">
                  {activeTab === "companies" && `${filteredCompanies?.length || 0} companies`}
                  {activeTab === "stores" && `${filteredStores?.length || 0} stores`}
                  {activeTab === "wholesalers" && `${filteredWholesalers?.length || 0} wholesalers`}
                  {activeTab === "ambassadors" && `${filteredAmbassadors?.length || 0} ambassadors`}
                  {activeTab === "drivers" && `${filteredDrivers?.length || 0} drivers`}
                  {activeTab === "bikers" && `${filteredBikers?.length || 0} bikers`}
                  {activeTab === "production" && `${filteredProduction?.length || 0} productions`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Insights Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {/* Tabs for Different Entity Types */}
            <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as ViewTab)}>
              <TabsList className="grid grid-cols-4 sm:grid-cols-7 w-full max-w-3xl">
                <TabsTrigger value="companies" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Companies</span>
                  <span className="sm:hidden">Co.</span>
                  {companies && companies.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs px-1">{companies.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="stores" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Store className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Stores</span>
                  <span className="sm:hidden">Str.</span>
                  {stores && stores.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs px-1">{stores.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="wholesalers" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Truck className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Wholesalers</span>
                  <span className="sm:hidden">Whl.</span>
                  {wholesalers && wholesalers.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs px-1">{wholesalers.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="ambassadors" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Award className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Ambassadors</span>
                  <span className="sm:hidden">Amb.</span>
                  {ambassadors && ambassadors.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs px-1">{ambassadors.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="drivers" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Car className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Drivers</span>
                  <span className="sm:hidden">Drv.</span>
                  {driversData && driversData.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs px-1">{driversData.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="bikers" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Bike className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Bikers</span>
                  <span className="sm:hidden">Bkr.</span>
                  {bikersData && bikersData.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs px-1">{bikersData.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="production" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Factory className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Production</span>
                  <span className="sm:hidden">Prod.</span>
                  {productionData && productionData.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs px-1">{productionData.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Add Button - Between tabs and content */}
              <div className="flex justify-end mt-4 mb-2">
                <Button 
                  onClick={() => setCreateModalOpen(true)}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  {getAddLabel()}
                </Button>
              </div>

              {/* Companies Tab */}
              <TabsContent value="companies" className="space-y-3">
                {companiesLoading ? (
                  <Card className="p-8 text-center text-muted-foreground">Loading companies...</Card>
                ) : filteredCompanies?.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">No companies found</Card>
                ) : (
                  <>
                    <DataTablePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      pageSize={pageSize}
                      totalItems={activeList.length}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                      pageSizeOptions={[25, 50, 100, 250]}
                    />
                    {paginatedList.map((company: any) => <CompanyCard key={company.id} company={company} />)}
                  </>
                )}
              </TabsContent>

              {/* Stores Tab */}
              <TabsContent value="stores" className="space-y-3">
                {storesLoading ? (
                  <Card className="p-8 text-center text-muted-foreground">Loading stores...</Card>
                ) : filteredStores?.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">No stores found</Card>
                ) : (
                  <>
                    <DataTablePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      pageSize={pageSize}
                      totalItems={activeList.length}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                      pageSizeOptions={[25, 50, 100, 250]}
                    />
                    {paginatedList.map((store: any) => <StoreCard key={store.id} store={store} />)}
                  </>
                )}
              </TabsContent>

              {/* Wholesalers Tab */}
              <TabsContent value="wholesalers" className="space-y-3">
                {wholesalersLoading ? (
                  <Card className="p-8 text-center text-muted-foreground">Loading wholesalers...</Card>
                ) : filteredWholesalers?.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">No wholesalers found</Card>
                ) : (
                  <>
                    <DataTablePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      pageSize={pageSize}
                      totalItems={activeList.length}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                      pageSizeOptions={[25, 50, 100]}
                    />
                    {paginatedList.map((wholesaler: any) => (
                      <WholesalerCard key={wholesaler.id} wholesaler={wholesaler} />
                    ))}
                  </>
                )}
              </TabsContent>

              {/* Ambassadors Tab */}
              <TabsContent value="ambassadors" className="space-y-3">
                {ambassadorsLoading ? (
                  <Card className="p-8 text-center text-muted-foreground">Loading ambassadors...</Card>
                ) : filteredAmbassadors?.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">No ambassadors found</Card>
                ) : (
                  <>
                    <DataTablePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      pageSize={pageSize}
                      totalItems={activeList.length}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                      pageSizeOptions={[25, 50, 100]}
                    />
                    {paginatedList.map((ambassador: any) => (
                      <AmbassadorCard key={ambassador.id} ambassador={ambassador} />
                    ))}
                  </>
                )}
              </TabsContent>

              {/* Drivers Tab */}
              <TabsContent value="drivers" className="space-y-3">
                {driversLoading ? (
                  <Card className="p-8 text-center text-muted-foreground">Loading drivers...</Card>
                ) : filteredDrivers?.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">No drivers found</Card>
                ) : (
                  <>
                    <DataTablePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      pageSize={pageSize}
                      totalItems={activeList.length}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                      pageSizeOptions={[25, 50, 100]}
                    />
                    {paginatedList.map((driver: any) => (
                      <DriverCard key={driver.id} driver={driver} />
                    ))}
                  </>
                )}
              </TabsContent>

              {/* Bikers Tab */}
              <TabsContent value="bikers" className="space-y-3">
                {bikersLoading ? (
                  <Card className="p-8 text-center text-muted-foreground">Loading bikers...</Card>
                ) : filteredBikers?.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">No bikers found</Card>
                ) : (
                  <>
                    <DataTablePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      pageSize={pageSize}
                      totalItems={activeList.length}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                      pageSizeOptions={[25, 50, 100]}
                    />
                    {paginatedList.map((biker: any) => (
                      <BikerCard key={biker.id} biker={biker} />
                    ))}
                  </>
                )}
              </TabsContent>

              {/* Production Tab */}
              <TabsContent value="production" className="space-y-3">
                {productionLoading ? (
                  <Card className="p-8 text-center text-muted-foreground">Loading productions...</Card>
                ) : filteredProduction?.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">No productions found</Card>
                ) : (
                  <>
                    <DataTablePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      pageSize={pageSize}
                      totalItems={activeList.length}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                      pageSizeOptions={[25, 50, 100]}
                    />
                    {paginatedList.map((worker: any) => (
                      <ProductionCard key={worker.id} worker={worker} />
                    ))}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* AI Insights Sidebar */}
          <div className="hidden lg:block">
            <AICRMInsights />
          </div>
        </div>
      </div>


      {/* Create Modal */}
      <EntityModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title={`Create ${getEntityTitle()}`}
        fields={getActiveFields()}
        onSubmit={handleCreate}
        mode="create"
      />

      {/* Edit Modal */}
      <EntityModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        title={`Edit ${getEntityTitle()}`}
        fields={getActiveFields()}
        defaultValues={selectedEntity || {}}
        onSubmit={handleEdit}
        mode="edit"
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        itemName={selectedEntity?.name || selectedEntity?.full_name || selectedEntity?.tracking_code}
        onConfirm={handleDelete}
      />

      {/* Entity Profile Modal - Unified for Wholesalers, Ambassadors, Drivers */}
      <EntityProfileModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        entity={selectedProfileEntity}
        entityType={selectedProfileType}
        onEdit={(entity) => openEditModal(entity)}
        onDelete={(entity) => openDeleteModal(entity)}
      />
    </div>
  );
}
