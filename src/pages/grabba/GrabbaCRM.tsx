import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Users, Search, Phone, Mail, MapPin, Star, ExternalLink, MessageSquare, 
  Package, Building2, Store, Truck, Award, DollarSign, FileText, ChevronRight,
  Filter, X, Edit, Trash2
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { GRABBA_BRAND_IDS, GRABBA_BRAND_CONFIG, getBrandConfig, type GrabbaBrand } from "@/config/grabbaSkyscraper";
import { BrandFilterBar, BrandBadgesRow } from "@/components/grabba/BrandFilterBar";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { useGrabbaBrandActivity, useGrabbaBrandCounts } from "@/hooks/useGrabbaData";
import { EntityModal } from "@/components/crud/EntityModal";
import { DeleteConfirmModal } from "@/components/crud/DeleteConfirmModal";
import { GlobalAddButton } from "@/components/crud/GlobalAddButton";
import { useCrudOperations } from "@/hooks/useCrudOperations";
import { companyFields, storeFields, wholesalerFields } from "@/config/entityFieldConfigs";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 1 — CRM: All stores, wholesalers, customers, and companies for Grabba brands.
// ═══════════════════════════════════════════════════════════════════════════════

type EntityType = 'all' | 'store' | 'wholesaler' | 'direct_customer';
type ViewTab = 'companies' | 'stores' | 'ambassadors' | 'wholesalers';

export default function GrabbaCRM() {
  const navigate = useNavigate();
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  const [typeFilter, setTypeFilter] = useState<EntityType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("companies");
  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string>("all");
  
  // CRUD Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  
  // CRUD Operations
  const companyCrud = useCrudOperations({
    table: "companies",
    queryKey: ["grabba-crm-companies"],
    successMessages: { create: "Company created", update: "Company updated", delete: "Company deleted" }
  });
  
  const storeCrud = useCrudOperations({
    table: "stores",
    queryKey: ["grabba-crm-stores"],
    successMessages: { create: "Store created", update: "Store updated", delete: "Store deleted" }
  });
  
  const wholesalerCrud = useCrudOperations({
    table: "wholesalers",
    queryKey: ["grabba-crm-wholesalers"],
    successMessages: { create: "Wholesaler created", update: "Wholesaler updated", delete: "Wholesaler deleted" }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA QUERIES
  // ═══════════════════════════════════════════════════════════════════════════════

  // Fetch companies with Grabba activity
  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ["grabba-crm-companies", selectedBrand],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      const { data: ordersWithCompanies } = await supabase
        .from("wholesale_orders")
        .select("company_id, brand")
        .in("brand", brandsToQuery);

      const companyIds = [...new Set(ordersWithCompanies?.map(o => o.company_id).filter(Boolean))];
      
      if (companyIds.length === 0) {
        const { data } = await supabase.from("companies").select("*").limit(100);
        return data || [];
      }

      const { data } = await supabase
        .from("companies")
        .select("*")
        .in("id", companyIds);

      return data || [];
    },
  });

  // Fetch stores
  const { data: stores, isLoading: storesLoading } = useQuery({
    queryKey: ["grabba-crm-stores", selectedBrand],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      const { data: ordersWithStores } = await supabase
        .from("wholesale_orders")
        .select("store_id, brand")
        .in("brand", brandsToQuery);

      const storeIds = [...new Set(ordersWithStores?.map(o => o.store_id).filter(Boolean))];
      
      if (storeIds.length === 0) {
        const { data } = await supabase.from("stores").select("*, companies(id, name)").limit(100);
        return data || [];
      }

      const { data } = await supabase
        .from("stores")
        .select("*, companies(id, name)")
        .in("id", storeIds);

      return data || [];
    },
  });

  // Fetch wholesalers
  const { data: wholesalers, isLoading: wholesalersLoading } = useQuery({
    queryKey: ["grabba-crm-wholesalers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wholesalers")
        .select("*")
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
        .select("*, profiles(full_name, avatar_url, email)")
        .eq("is_active", true);
      return data || [];
    },
  });

  // Fetch brand activity per company/store
  const { data: brandActivity } = useGrabbaBrandActivity();
  const { data: brandCounts } = useGrabbaBrandCounts();

  // Fetch neighborhoods for filter
  const neighborhoods = useMemo(() => {
    const hoods = new Set<string>();
    companies?.forEach(c => c.neighborhood && hoods.add(c.neighborhood));
    stores?.forEach((s: any) => s.neighborhood && hoods.add(s.neighborhood));
    return Array.from(hoods).sort();
  }, [companies, stores]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // FILTERING LOGIC
  // ═══════════════════════════════════════════════════════════════════════════════

  const filteredCompanies = useMemo(() => {
    return companies?.filter(company => {
      const matchesSearch = !searchQuery || 
        company.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.default_city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.default_phone?.includes(searchQuery) ||
        company.neighborhood?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = typeFilter === "all" || company.type === typeFilter;
      const matchesNeighborhood = neighborhoodFilter === "all" || company.neighborhood === neighborhoodFilter;
      
      const companyBrands = brandActivity?.[company.id] || [];
      const matchesBrand = selectedBrand === "all" || companyBrands.includes(selectedBrand as GrabbaBrand);
      
      return matchesSearch && matchesType && matchesBrand && matchesNeighborhood;
    });
  }, [companies, searchQuery, typeFilter, selectedBrand, neighborhoodFilter, brandActivity]);

  const filteredStores = useMemo(() => {
    return stores?.filter((store: any) => {
      const matchesSearch = !searchQuery || 
        store.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        store.neighborhood?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        store.phone?.includes(searchQuery);
      
      const storeBrands = brandActivity?.[store.id] || [];
      const matchesBrand = selectedBrand === "all" || storeBrands.includes(selectedBrand as GrabbaBrand);
      const matchesNeighborhood = neighborhoodFilter === "all" || store.neighborhood === neighborhoodFilter;
      
      return matchesSearch && matchesBrand && matchesNeighborhood;
    });
  }, [stores, searchQuery, selectedBrand, neighborhoodFilter, brandActivity]);

  const filteredWholesalers = useMemo(() => {
    return wholesalers?.filter(w => {
      const matchesSearch = !searchQuery || 
        w.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.phone?.includes(searchQuery);
      return matchesSearch;
    });
  }, [wholesalers, searchQuery]);

  const filteredAmbassadors = useMemo(() => {
    return ambassadors?.filter((a: any) => {
      const matchesSearch = !searchQuery || 
        a.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.tracking_code?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [ambassadors, searchQuery]);

  const clearFilters = () => {
    setSelectedBrand("all");
    setTypeFilter("all");
    setSearchQuery("");
    setNeighborhoodFilter("all");
  };

  const hasActiveFilters = selectedBrand !== "all" || typeFilter !== "all" || searchQuery || neighborhoodFilter !== "all";

  // ═══════════════════════════════════════════════════════════════════════════════
  // ENTITY CARD COMPONENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  const CompanyCard = ({ company }: { company: any }) => {
    const companyBrands = brandActivity?.[company.id] || [];
    
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-all hover:shadow-lg">
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
                <Badge variant="outline" className="capitalize">{company.type || 'store'}</Badge>
              </div>
              
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                {company.neighborhood && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {company.neighborhood}{company.boro ? `, ${company.boro}` : ''}
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
              {companyBrands.length > 0 && (
                <BrandBadgesRow brands={companyBrands as GrabbaBrand[]} className="mt-3" />
              )}

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
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className={`h-3 w-3 ${i <= (company.payment_reliability_score || 0) / 20 ? 'fill-current' : 'opacity-30'}`} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {company.payment_reliability_tier || 'Unrated'}
              </span>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-1 shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(`/companies/${company.id}`)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open Profile</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(`/grabba/communication?company=${company.id}`)}>
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

  const StoreCard = ({ store }: { store: any }) => {
    const storeBrands = brandActivity?.[store.id] || [];
    
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50 hover:border-green-500/30 transition-all hover:shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <Store className="h-4 w-4 text-green-500" />
                <Link 
                  to={`/stores/${store.id}`}
                  className="text-lg font-semibold text-foreground hover:text-green-500 transition-colors"
                >
                  {store.name}
                </Link>
              </div>
              
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                {store.neighborhood && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {store.neighborhood}
                  </span>
                )}
                {store.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {store.phone}
                  </span>
                )}
                {store.companies?.name && (
                  <Link 
                    to={`/companies/${store.companies.id}`}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <Building2 className="h-3 w-3" />
                    {store.companies.name}
                  </Link>
                )}
              </div>

              {storeBrands.length > 0 && (
                <BrandBadgesRow brands={storeBrands as GrabbaBrand[]} className="mt-3" />
              )}
            </div>

            <div className="flex gap-1 shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(`/stores/${store.id}`)}>
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
    <Card className="bg-card/50 backdrop-blur border-border/50 hover:border-purple-500/30 transition-all hover:shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <Truck className="h-4 w-4 text-purple-500" />
              <span className="text-lg font-semibold">{wholesaler.name}</span>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                Wholesaler
              </Badge>
            </div>
            
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
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
            </div>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(`/wholesaler/${wholesaler.id}`)}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Wholesaler</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );

  const AmbassadorCard = ({ ambassador }: { ambassador: any }) => (
    <Card className="bg-card/50 backdrop-blur border-border/50 hover:border-amber-500/30 transition-all hover:shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <Award className="h-4 w-4 text-amber-500" />
              <span className="text-lg font-semibold">{ambassador.profiles?.full_name || 'Ambassador'}</span>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                {ambassador.tier}
              </Badge>
            </div>
            
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Code: {ambassador.tracking_code}
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                ${ambassador.total_earnings?.toLocaleString() || '0'} earned
              </span>
            </div>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(`/grabba/ambassadors`)}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Ambassador</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // CRUD HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  const handleCreate = async (data: Record<string, unknown>) => {
    if (activeTab === 'companies') {
      await companyCrud.create(data);
    } else if (activeTab === 'stores') {
      await storeCrud.create(data);
    } else if (activeTab === 'wholesalers') {
      await wholesalerCrud.create(data);
    }
  };
  
  const handleEdit = async (data: Record<string, unknown>) => {
    if (!selectedEntity) return;
    if (activeTab === 'companies') {
      await companyCrud.update({ id: selectedEntity.id, ...data });
    } else if (activeTab === 'stores') {
      await storeCrud.update({ id: selectedEntity.id, ...data });
    } else if (activeTab === 'wholesalers') {
      await wholesalerCrud.update({ id: selectedEntity.id, ...data });
    }
  };
  
  const handleDelete = async () => {
    if (!selectedEntity) return;
    if (activeTab === 'companies') {
      await companyCrud.remove(selectedEntity.id);
    } else if (activeTab === 'stores') {
      await storeCrud.remove(selectedEntity.id);
    } else if (activeTab === 'wholesalers') {
      await wholesalerCrud.remove(selectedEntity.id);
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
    if (activeTab === 'companies') return companyFields;
    if (activeTab === 'stores') return storeFields;
    if (activeTab === 'wholesalers') return wholesalerFields;
    return companyFields;
  };
  
  const getAddLabel = () => {
    if (activeTab === 'companies') return '+New Company';
    if (activeTab === 'stores') return '+New Store';
    if (activeTab === 'wholesalers') return '+New Wholesaler';
    return '+New';
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
            {GRABBA_BRAND_IDS.map(brand => {
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
                    {neighborhoods.map(hood => (
                      <SelectItem key={hood} value={hood}>{hood}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                    <X className="h-4 w-4 mr-1" /> Clear Filters
                  </Button>
                )}

                <div className="ml-auto text-sm text-muted-foreground">
                  {activeTab === 'companies' && `${filteredCompanies?.length || 0} companies`}
                  {activeTab === 'stores' && `${filteredStores?.length || 0} stores`}
                  {activeTab === 'wholesalers' && `${filteredWholesalers?.length || 0} wholesalers`}
                  {activeTab === 'ambassadors' && `${filteredAmbassadors?.length || 0} ambassadors`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Different Entity Types */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ViewTab)}>
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="companies" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Companies
            </TabsTrigger>
            <TabsTrigger value="stores" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Stores
            </TabsTrigger>
            <TabsTrigger value="wholesalers" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Wholesalers
            </TabsTrigger>
            <TabsTrigger value="ambassadors" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Ambassadors
            </TabsTrigger>
          </TabsList>

          {/* Companies Tab */}
          <TabsContent value="companies" className="space-y-3 mt-4">
            {companiesLoading ? (
              <Card className="p-8 text-center text-muted-foreground">Loading companies...</Card>
            ) : filteredCompanies?.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">No companies found</Card>
            ) : (
              filteredCompanies?.map(company => (
                <CompanyCard key={company.id} company={company} />
              ))
            )}
          </TabsContent>

          {/* Stores Tab */}
          <TabsContent value="stores" className="space-y-3 mt-4">
            {storesLoading ? (
              <Card className="p-8 text-center text-muted-foreground">Loading stores...</Card>
            ) : filteredStores?.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">No stores found</Card>
            ) : (
              filteredStores?.map((store: any) => (
                <StoreCard key={store.id} store={store} />
              ))
            )}
          </TabsContent>

          {/* Wholesalers Tab */}
          <TabsContent value="wholesalers" className="space-y-3 mt-4">
            {wholesalersLoading ? (
              <Card className="p-8 text-center text-muted-foreground">Loading wholesalers...</Card>
            ) : filteredWholesalers?.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">No wholesalers found</Card>
            ) : (
              filteredWholesalers?.map(wholesaler => (
                <WholesalerCard key={wholesaler.id} wholesaler={wholesaler} />
              ))
            )}
          </TabsContent>

          {/* Ambassadors Tab */}
          <TabsContent value="ambassadors" className="space-y-3 mt-4">
            {ambassadorsLoading ? (
              <Card className="p-8 text-center text-muted-foreground">Loading ambassadors...</Card>
            ) : filteredAmbassadors?.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">No ambassadors found</Card>
            ) : (
              filteredAmbassadors?.map((ambassador: any) => (
                <AmbassadorCard key={ambassador.id} ambassador={ambassador} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Floating Add Button */}
      {activeTab !== 'ambassadors' && (
        <GlobalAddButton
          label={getAddLabel()}
          onClick={() => setCreateModalOpen(true)}
          variant="floating"
        />
      )}
      
      {/* Create Modal */}
      <EntityModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title={`Create ${activeTab === 'companies' ? 'Company' : activeTab === 'stores' ? 'Store' : 'Wholesaler'}`}
        fields={getActiveFields()}
        onSubmit={handleCreate}
        mode="create"
      />
      
      {/* Edit Modal */}
      <EntityModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        title={`Edit ${activeTab === 'companies' ? 'Company' : activeTab === 'stores' ? 'Store' : 'Wholesaler'}`}
        fields={getActiveFields()}
        defaultValues={selectedEntity || {}}
        onSubmit={handleEdit}
        mode="edit"
      />
      
      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        itemName={selectedEntity?.name}
        onConfirm={handleDelete}
      />
    </div>
  );
}