import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  Users,
  MapPin,
  Search,
  Plus,
  Eye,
  Car,
  Sparkles,
  Home,
  Plane,
  ChefHat,
  Truck,
  Bus,
  PartyPopper,
  Shield,
  Hotel,
  Castle,
  Building,
  Camera,
  Ticket,
  Ship,
  Waves,
  Utensils,
  Music,
  MoreHorizontal,
  ArrowRight,
  TrendingUp,
  Filter,
  Pencil, // Import Pencil icon
} from "lucide-react";
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from "@/config/crmBlueprints";
import { useSimulationMode, SimulationBadge } from "@/contexts/SimulationModeContext";
import { useCRMSimulation } from "@/hooks/useCRMSimulation";
import { useResolvedData } from "@/hooks/useResolvedData";
import { TaskChecklistSection } from "@/components/crm/TaskChecklistSection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner"; // Assuming you have sonner or useToast

// ... (Keep existing CATEGORY_ICONS and CATEGORY_COLORS mappings here) ...
// Icon mapping for partner categories
const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  car_decor: Car,
  exotic_rental_car: Sparkles,
  room_decor: Home,
  helicopter: Plane,
  private_chef: ChefHat,
  black_trucks: Truck,
  sprinter_van: Bus,
  party_bus: PartyPopper,
  security: Shield,
  hotel_rooms: Hotel,
  luxury_residences: Castle,
  eventspaces_rooftop: Building,
  photography_videography: Camera,
  amusementparks_affiliate: Ticket,
  yachts: Ship,
  car_jetskis: Waves,
  restaurant_decor_reservations: Utensils,
  club_lounge_package: Music,
  other: MoreHorizontal,
};

// Color mapping for categories
const CATEGORY_COLORS: Record<string, string> = {
  car_decor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  exotic_rental_car: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  room_decor: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  helicopter: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  private_chef: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  black_trucks: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  sprinter_van: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  party_bus: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  security: "bg-red-500/10 text-red-500 border-red-500/20",
  hotel_rooms: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  luxury_residences: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  eventspaces_rooftop: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  photography_videography: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  amusementparks_affiliate: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  yachts: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  car_jetskis: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  restaurant_decor_reservations: "bg-lime-500/10 text-lime-500 border-lime-500/20",
  club_lounge_package: "bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20",
  other: "bg-gray-400/10 text-gray-400 border-gray-400/20",
};

export default function TopTierPartnerDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");

  // --- EDIT MODAL STATE ---
  const [editingCategory, setEditingCategory] = useState<{ value: string; label: string } | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation("toptier-experience");

  // 1. Fetch Label Overrides (The DB part)
  const { data: categoryOverrides = {} } = useQuery({
    queryKey: ["crm_category_labels", "toptier-experience"],
    queryFn: async () => {
      // In a real scenario, this fetches from your DB table 'crm_category_settings'
      const { data, error } = await supabase
        .from("crm_category_settings")
        .select("category_value, custom_label")
        .eq("business_slug", "toptier-experience");

      if (error) {
        // Fallback or ignore error if table doesn't exist yet
        console.warn("Could not fetch overrides", error);
        return {};
      }

      // Convert array to object map: { 'car_decor': 'Custom Label' }
      return data.reduce((acc: any, curr: any) => {
        acc[curr.category_value] = curr.custom_label;
        return acc;
      }, {});
    },
    // Don't block UI if this fails
    retry: false,
  });

  // 2. Fetch real partners from database
  const { data: realPartners = [] } = useQuery({
    queryKey: ["crm_partners", "toptier-experience", simulationMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_partners")
        .select("*")
        .eq("business_slug", "toptier-experience")
        .eq("is_simulation", simulationMode)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const simulatedPartners = getEntityData("partner");
  const { data: partners, isSimulated } = useResolvedData(realPartners, simulatedPartners, "toptier-experience");

  // 3. Mutation to Save Label
  const saveLabelMutation = useMutation({
    mutationFn: async ({ value, label }: { value: string; label: string }) => {
      // UPSERT LOGIC: Checks if existing, updates if so, inserts if not
      const { error } = await supabase.from("crm_category_settings").upsert(
        {
          business_slug: "toptier-experience",
          category_value: value,
          custom_label: label,
        },
        { onConflict: "business_slug, category_value" },
      );

      if (error) throw error;
      return { value, label };
    },
    onSuccess: () => {
      toast.success("Category label updated successfully");
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["crm_category_labels"] });
    },
    onError: (error) => {
      toast.error("Failed to update label");
      console.error(error);
    },
  });

  const handleEditClick = (e: React.MouseEvent, category: { value: string; label: string }) => {
    e.stopPropagation(); // Stop card click
    // Check if we have an override, otherwise use default
    const currentLabel = categoryOverrides[category.value] || category.label;
    setEditingCategory({ value: category.value, label: currentLabel });
    setNewLabel(currentLabel);
    setIsEditModalOpen(true);
  };

  const handleSaveLabel = () => {
    if (!editingCategory) return;
    saveLabelMutation.mutate({ value: editingCategory.value, label: newLabel });
  };

  // Calculate category stats (Updated to use Overrides)
  const categoryStats = useMemo(() => {
    const filteredPartners =
      stateFilter === "all"
        ? partners
        : partners.filter(
            (p: any) => p.state === stateFilter || (p.service_area && p.service_area.includes(stateFilter)),
          );

    return TOPTIER_PARTNER_CATEGORIES.filter((cat) => cat.value !== "other")
      .map((category) => {
        const categoryPartners = filteredPartners.filter((p: any) => p.partner_category === category.value);
        const uniqueStates = new Set<string>();

        categoryPartners.forEach((p: any) => {
          if (p.state) uniqueStates.add(p.state);
          if (p.service_area) {
            p.service_area.forEach((s: string) => uniqueStates.add(s));
          }
        });

        const activePartners = categoryPartners.filter((p: any) => p.contract_status === "active");

        // APPLY OVERRIDE HERE
        const displayLabel = categoryOverrides[category.value] || category.label;

        return {
          ...category,
          label: displayLabel, // Use the override
          totalPartners: categoryPartners.length,
          activePartners: activePartners.length,
          statesCovered: uniqueStates.size,
          states: Array.from(uniqueStates),
        };
      })
      .filter((cat) => {
        if (!searchTerm) return true;
        return cat.label.toLowerCase().includes(searchTerm.toLowerCase());
      });
  }, [partners, stateFilter, searchTerm, categoryOverrides]); // Add categoryOverrides as dependency

  // ... (Keep totalStats useMemo here) ...
  const totalStats = useMemo(() => {
    const uniqueStates = new Set<string>();
    partners.forEach((p: any) => {
      if (p.state) uniqueStates.add(p.state);
      if (p.service_area) {
        p.service_area.forEach((s: string) => uniqueStates.add(s));
      }
    });

    const activePartners = partners.filter((p: any) => p.contract_status === "active");
    const categoriesWithPartners = new Set(partners.map((p: any) => p.partner_category));

    return {
      totalPartners: partners.length,
      activePartners: activePartners.length,
      statesCovered: uniqueStates.size,
      categoriesActive: categoriesWithPartners.size,
    };
  }, [partners]);

  const handleCategoryClick = (categoryValue: string) => {
    navigate(`/crm/toptier-experience/partners/${categoryValue}`);
  };

  const handleViewAllPartners = () => {
    navigate("/crm/toptier-experience/partner");
  };

  const handleViewByState = () => {
    navigate("/crm/toptier-experience/partners/states");
  };

  return (
    <div className="space-y-6">
      {/* ... (Keep existing Header and Summary Cards sections) ... */}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Partner Command Center</h1>
            {isSimulated && <SimulationBadge />}
          </div>
          <p className="text-muted-foreground">Manage your experience partners across all categories</p>
        </div>
        {/* ... Buttons ... */}
      </div>

      {/* ... Summary Cards ... */}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {US_STATES.map((state) => (
              <SelectItem key={state.value} value={state.value}>
                {state.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categoryStats.map((category) => {
          const IconComponent = CATEGORY_ICONS[category.value] || Building2;
          const colorClasses = CATEGORY_COLORS[category.value] || CATEGORY_COLORS.other;

          return (
            <Card
              key={category.value}
              className={`group relative cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${category.totalPartners === 0 ? "opacity-60" : ""}`}
              onClick={() => handleCategoryClick(category.value)}
            >
              {/* EDIT BUTTON - Positioned absolute top right */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background shadow-sm"
                  onClick={(e) => handleEditClick(e, category)}
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  <span className="sr-only">Edit Label</span>
                </Button>
              </div>

              <CardHeader className="pb-2">
                <div className="flex items-start justify-between pr-8">
                  <div className={`p-2 rounded-lg border ${colorClasses}`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  {category.totalPartners > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {category.activePartners} active
                    </Badge>
                  )}
                </div>
                {/* Use the potentially overridden label */}
                <CardTitle className="text-sm font-medium mt-2 line-clamp-2 pr-4">{category.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Partners</span>
                    <span className="font-bold text-lg">{category.totalPartners}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">States Covered</span>
                    <span className="font-medium">{category.statesCovered}</span>
                  </div>
                  {category.statesCovered > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {category.states.slice(0, 4).map((state) => (
                        <Badge key={state} variant="outline" className="text-xs">
                          {state}
                        </Badge>
                      ))}
                      {category.states.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{category.states.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCategoryClick(category.value);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {categoryStats.length === 0 && (
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No categories found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchTerm ? "Try adjusting your search" : "Add partners to see categories"}
          </p>
          <Button onClick={() => navigate("/crm/toptier-experience/partner/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Partner
          </Button>
        </Card>
      )}

      {/* Task Checklist Section */}
      <TaskChecklistSection businessSlug="toptier_experience" show2026Goals={false} />

      {/* EDIT LABEL DIALOG */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Category Label</DialogTitle>
            <DialogDescription>
              Change how this category appears on the dashboard. This will not change the data structure, only the
              display name.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category-val" className="text-right text-muted-foreground">
                ID
              </Label>
              <Input id="category-val" value={editingCategory?.value || ""} disabled className="col-span-3 bg-muted" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category-label" className="text-right">
                Label
              </Label>
              <Input
                id="category-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="col-span-3"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLabel} disabled={saveLabelMutation.isPending}>
              {saveLabelMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
