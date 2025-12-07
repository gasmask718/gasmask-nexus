import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Store, Users, Plus, Search, MapPin, Phone, 
  CheckCircle2, XCircle, ArrowLeft, Building2, 
  BarChart3, Eye, ClipboardList, Calculator, RefreshCw,
  LayoutDashboard, ChevronDown
} from "lucide-react";
import { useBoroughs } from "@/hooks/useBoroughs";
import { useCustomerRoles } from "@/hooks/useCustomerRoles";
import { FullContactForm } from "@/components/crm/FullContactForm";
import { AddStoreModal } from "@/components/crm/AddStoreModal";
import { useBrandCRMV3 } from "@/hooks/useBrandCRMV3";
import { BrandTasksPanel } from "@/components/crm/BrandTasksPanel";
import { SuggestedVisitsWidget } from "@/components/crm/SuggestedVisitsWidget";
import { BrandDashboard } from "@/components/crm/BrandDashboard";
import { BrandSwitcher } from "@/components/crm/BrandSwitcher";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

// Left navigation items
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "stores", label: "Stores", icon: Store },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "tasks", label: "Tasks", icon: ClipboardList },
  { id: "insights", label: "Insights", icon: BarChart3 },
];

export default function BrandCRM() {
  const { brandId } = useParams<{ brandId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [storeSearch, setStoreSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [boroFilter, setBoroFilter] = useState<string>("all");
  const [showAddStore, setShowAddStore] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);

  const { data: boroughs = [] } = useBoroughs();
  const { data: roles = [] } = useCustomerRoles();

  // V3: AI Insights, Scores, and Tasks - MUST use route.params.businessId
  const {
    storeScores,
    tasks,
    insight,
    openTasksCount,
    getStoreScore,
    calculateScores,
    isCalculating,
    addTask,
    isAddingTask,
    updateTaskStatus,
    generateInsights,
    isGeneratingInsights,
    generateSmartTasks,
    isGeneratingTasks,
  } = useBrandCRMV3(brandId);

  // PHASE D: Stability - Guard clause for missing brandId
  useEffect(() => {
    if (!brandId) {
      navigate('/crm');
    }
  }, [brandId, navigate]);

  // Fetch brand/business details - ONLY by route param brandId
  const { data: brand, isLoading: brandLoading } = useQuery({
    queryKey: ["brand", brandId],
    queryFn: async () => {
      if (!brandId) throw new Error("No brand ID");
      
      // Try businesses table first
      const { data: businessData, error: businessError } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", brandId)
        .single();
      
      if (businessData) {
        return {
          id: businessData.id,
          name: businessData.name,
          color: businessData.primary_color,
          logo_url: businessData.logo_url,
          active: businessData.is_active
        };
      }
      
      // Fallback to brands table
      const { data: brandData, error: brandError } = await supabase
        .from("brands")
        .select("*")
        .eq("id", brandId)
        .single();
      
      if (brandError) throw brandError;
      return brandData;
    },
    enabled: !!brandId,
  });

  // Fetch stores - ONLY for this brandId
  const { data: stores = [], refetch: refetchStores } = useQuery({
    queryKey: ["brand-stores", brandId],
    queryFn: async () => {
      if (!brandId) return [];
      
      const { data, error } = await supabase
        .from("store_master")
        .select(`
          *,
          borough:boroughs(id, boro_name)
        `)
        .or(`brand_id.eq.${brandId},business_id.eq.${brandId}`)
        .is("deleted_at", null)
        .order("store_name");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!brandId,
  });

  // Fetch contacts - ONLY for this brandId
  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ["brand-contacts", brandId],
    queryFn: async () => {
      if (!brandId) return [];
      
      const { data, error } = await supabase
        .from("crm_contacts")
        .select(`
          *,
          borough:boroughs(id, boro_name),
          role:customer_roles(id, role_name)
        `)
        .eq("business_id", brandId)
        .is("deleted_at", null)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  // Filter stores
  const filteredStores = stores.filter((store: any) => {
    const matchesSearch = !storeSearch || 
      store.store_name?.toLowerCase().includes(storeSearch.toLowerCase()) ||
      store.owner_name?.toLowerCase().includes(storeSearch.toLowerCase()) ||
      store.address?.toLowerCase().includes(storeSearch.toLowerCase());
    const matchesBoro = boroFilter === "all" || store.borough_id === boroFilter;
    return matchesSearch && matchesBoro;
  });

  // Filter contacts
  const filteredContacts = contacts.filter((contact: any) => {
    const matchesSearch = !contactSearch ||
      contact.full_name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
      contact.phone?.toLowerCase().includes(contactSearch.toLowerCase());
    return matchesSearch;
  });

  // Calculate insights
  const stickerCompliance = stores.length > 0
    ? Math.round((stores.filter((s: any) => s.sticker_on_door).length / stores.length) * 100)
    : 0;

  const storesByBoro = boroughs.map(b => ({
    boro: b.name,
    count: stores.filter((s: any) => s.borough_id === b.id).length,
  })).filter(b => b.count > 0);

  if (brandLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Brand not found</p>
            <Button variant="outline" onClick={() => navigate("/crm")} className="mt-4">
              Back to Global CRM
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const brandColor = brand.color || "#6366f1";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Premium Brand Header */}
      <div 
        className="px-6 py-4 text-white shadow-lg"
        style={{ backgroundColor: brandColor }}
      >
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/20"
              onClick={() => navigate("/crm")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {brand.logo_url ? (
              <img src={brand.logo_url} alt={brand.name} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">{brand.name}</h1>
              <p className="text-sm text-white/80">Brand CRM</p>
            </div>
          </div>

          {/* Header KPIs */}
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold">{stores.length}</div>
              <div className="text-xs text-white/80">Stores</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{contacts.length}</div>
              <div className="text-xs text-white/80">Contacts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stickerCompliance}%</div>
              <div className="text-xs text-white/80">Stickers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{openTasksCount}</div>
              <div className="text-xs text-white/80">Tasks</div>
            </div>

            {/* Switch Brand Dropdown (Phase C) */}
            <BrandSwitcher currentBrandId={brandId!} />

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => setShowAddStore(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Store
              </Button>
              <Button 
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => setShowAddContact(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Contact
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Left Nav */}
      <div className="flex flex-1">
        {/* Left Navigation (Phase B) */}
        <nav className="w-56 shrink-0 border-r bg-card p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const count = item.id === "stores" ? stores.length 
              : item.id === "contacts" ? contacts.length 
              : item.id === "tasks" ? openTasksCount 
              : null;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === item.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {count !== null && count > 0 && (
                  <span 
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-semibold",
                      activeTab === item.id
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted-foreground/10 text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <BrandDashboard
              brand={brand}
              stores={stores}
              contacts={contacts}
              openTasksCount={openTasksCount}
              stickerCompliance={stickerCompliance}
              storesByBoro={storesByBoro}
              storeScores={storeScores}
              insight={insight}
              onGenerateInsights={() => generateInsights({
                brandName: brand.name,
                totalStores: stores.length,
                stickerCompliance,
                doorStickers: stores.filter((s: any) => s.sticker_on_door).length,
                insideStickers: stores.filter((s: any) => s.sticker_inside_store).length,
                openTasks: openTasksCount,
                totalContacts: contacts.length,
                storesByBoro: storesByBoro.reduce((acc, b) => ({ ...acc, [b.boro]: b.count }), {}),
              })}
              isGeneratingInsights={isGeneratingInsights}
            />
          )}

          {/* Stores Tab */}
          {activeTab === "stores" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Brand Stores</CardTitle>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => calculateScores(stores)}
                      disabled={isCalculating}
                    >
                      {isCalculating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
                      Score Stores
                    </Button>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search stores..."
                        value={storeSearch}
                        onChange={(e) => setStoreSearch(e.target.value)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Select value={boroFilter} onValueChange={setBoroFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All Boros" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Boros</SelectItem>
                        {boroughs.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredStores.length === 0 ? (
                  <div className="text-center py-12">
                    <Store className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No stores found</p>
                    <Button className="mt-4" onClick={() => setShowAddStore(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Store
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Store Name</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Borough</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Stickers</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStores.map((store: any) => {
                        const score = getStoreScore(store.id);
                        return (
                          <TableRow key={store.id}>
                            <TableCell className="font-medium">{store.store_name}</TableCell>
                            <TableCell>{store.owner_name || "-"}</TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {store.address || "-"}
                            </TableCell>
                            <TableCell>
                              {store.borough?.boro_name || "-"}
                            </TableCell>
                            <TableCell>
                              {score ? (
                                <Badge 
                                  variant="secondary" 
                                  className={cn(
                                    score.score >= 75 ? "bg-green-100 text-green-800" :
                                    score.score >= 50 ? "bg-amber-100 text-amber-800" :
                                    "bg-red-100 text-red-800"
                                  )}
                                >
                                  {score.score}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {store.sticker_on_door ? (
                                  <Badge variant="outline" className="text-green-600 border-green-600">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Door
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Door
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => navigate(`/crm/brand/${brandId}/store/${store.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Contacts Tab */}
          {activeTab === "contacts" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Brand Contacts</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search contacts..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredContacts.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No contacts found</p>
                    <Button className="mt-4" onClick={() => setShowAddContact(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Contact
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Borough</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContacts.map((contact: any) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">{contact.full_name}</TableCell>
                          <TableCell>
                            {contact.role?.role_name && (
                              <Badge variant="secondary">{contact.role.role_name}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {contact.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {contact.phone}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{contact.borough?.boro_name || "-"}</TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {contact.notes || "-"}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tasks Tab */}
          {activeTab === "tasks" && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <BrandTasksPanel
                  tasks={tasks}
                  stores={stores.map((s: any) => ({ id: s.id, store_name: s.store_name }))}
                  contacts={contacts.map((c: any) => ({ id: c.id, full_name: c.full_name }))}
                  onAddTask={addTask}
                  onUpdateStatus={updateTaskStatus}
                  onGenerateSmartTasks={() => generateSmartTasks({
                    brandName: brand.name,
                    lowScoreStores: storeScores.filter(s => s.score < 50).slice(0, 5),
                    missingStickerStores: stores.filter((s: any) => !s.sticker_on_door).slice(0, 5),
                    contactsNeedingFollowUp: contacts.filter((c: any) => c.notes?.toLowerCase().includes('follow')).slice(0, 5),
                  })}
                  isGenerating={isGeneratingTasks}
                  isAdding={isAddingTask}
                />
              </div>
              <div>
                <SuggestedVisitsWidget stores={stores} storeScores={storeScores} />
              </div>
            </div>
          )}

          {/* Insights Tab */}
          {activeTab === "insights" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Sticker Compliance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stickerCompliance}%</div>
                    <Progress value={stickerCompliance} className="mt-2 h-2" />
                    <p className="text-sm text-muted-foreground mt-1">
                      {stores.filter((s: any) => s.sticker_on_door).length} of {stores.length} stores
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Contacts per Store
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {stores.length > 0 ? (contacts.length / stores.length).toFixed(1) : 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Average ratio</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Coverage
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{storesByBoro.length}</div>
                    <p className="text-sm text-muted-foreground">Boroughs covered</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Stores by Borough
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {storesByBoro.length === 0 ? (
                    <p className="text-muted-foreground">No store data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {storesByBoro.map((item) => {
                        const percentage = stores.length > 0 
                          ? Math.round((item.count / stores.length) * 100) 
                          : 0;
                        return (
                          <div key={item.boro} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{item.boro}</span>
                              <span className="text-muted-foreground">{item.count} stores</span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Phase D: Debug Footer (temporary) */}
      <div className="border-t bg-muted/50 px-6 py-2 text-xs text-muted-foreground">
        Current Business ID: {brandId}
      </div>

      {/* Add Store Modal */}
      <AddStoreModal
        open={showAddStore}
        onOpenChange={setShowAddStore}
        brandId={brandId!}
        onSuccess={() => {
          refetchStores();
          setShowAddStore(false);
        }}
      />

      {/* Add Contact Modal */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Contact to {brand.name}</DialogTitle>
          </DialogHeader>
          <FullContactForm
            onSuccess={() => {
              refetchContacts();
              setShowAddContact(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
