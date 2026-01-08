/**
 * KPI Management Page
 * Allows admins to create, edit, and manage dynamic KPIs
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Pencil,
  ArrowLeft,
  Settings,
  LayoutGrid,
  Save,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KPICategory, KPIDefinition } from "@/hooks/useDynamicKPIs";

// Available entity types
const ENTITY_TYPES = [
  { value: "drivers", label: "Drivers" },
  { value: "vehicles", label: "Vehicles" },
  { value: "crm_partners", label: "Partners" },
  { value: "bookings", label: "Bookings" },
  { value: "crm_customers", label: "Customers" },
  { value: "crm_contacts", label: "Contacts" },
  { value: "crm_deals", label: "Deals" },
];

// Available condition types
const CONDITION_TYPES = [
  { value: "count", label: "Count All", description: "Count all entities of this type" },
  { value: "missing_relationship", label: "Missing Relationship", description: "Count entities missing a specific relationship" },
  { value: "status_match", label: "Status Match", description: "Count entities with a specific status" },
  { value: "date_based", label: "Date Based", description: "Count based on date conditions" },
  { value: "null_field", label: "Null Field", description: "Count entities where a field is empty" },
  { value: "not_null_field", label: "Not Null Field", description: "Count entities where a field has a value" },
];

// Available icons
const AVAILABLE_ICONS = ["Car", "Users", "Calendar", "Building2", "UserX", "AlertCircle", "TrendingUp", "Clock", "DollarSign", "Package", "MapPin", "Star"];

// Available colors
const AVAILABLE_COLORS = ["amber", "blue", "green", "red", "purple", "cyan", "pink", "orange", "teal", "gray"];

export default function TopTierKPIManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("kpis");
  
  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<KPICategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "LayoutGrid",
  });

  // KPI dialog state
  const [kpiDialogOpen, setKpiDialogOpen] = useState(false);
  const [editingKPI, setEditingKPI] = useState<KPIDefinition | null>(null);
  const [kpiForm, setKpiForm] = useState({
    name: "",
    slug: "",
    description: "",
    category_id: "",
    entity_type: "",
    condition_type: "count",
    condition_config: {} as Record<string, any>,
    icon: "AlertCircle",
    color: "gray",
    drilldown_path: "",
    is_active: true,
  });

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["kpi_categories_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as KPICategory[];
    },
  });

  // Fetch KPI definitions
  const { data: kpiDefinitions = [], isLoading: kpisLoading } = useQuery({
    queryKey: ["kpi_definitions_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as KPIDefinition[];
    },
  });

  // Category mutations
  const createCategory = useMutation({
    mutationFn: async (data: typeof categoryForm) => {
      const { error } = await supabase.from("kpi_categories").insert({
        name: data.name,
        slug: data.slug || data.name.toLowerCase().replace(/\s+/g, "-"),
        description: data.description || null,
        icon: data.icon,
        sort_order: categories.length + 1,
        is_system: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi_categories"] });
      queryClient.invalidateQueries({ queryKey: ["kpi_categories_admin"] });
      setCategoryDialogOpen(false);
      toast.success("Category created successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to create category: ${error.message}`);
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof categoryForm }) => {
      const { error } = await supabase
        .from("kpi_categories")
        .update({
          name: data.name,
          slug: data.slug,
          description: data.description || null,
          icon: data.icon,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi_categories"] });
      queryClient.invalidateQueries({ queryKey: ["kpi_categories_admin"] });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      toast.success("Category updated successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to update category: ${error.message}`);
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kpi_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi_categories"] });
      queryClient.invalidateQueries({ queryKey: ["kpi_categories_admin"] });
      toast.success("Category deleted successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete category: ${error.message}`);
    },
  });

  // KPI mutations
  const createKPI = useMutation({
    mutationFn: async (data: typeof kpiForm) => {
      const { error } = await supabase.from("kpi_definitions").insert({
        name: data.name,
        slug: data.slug || data.name.toLowerCase().replace(/\s+/g, "-"),
        description: data.description || null,
        category_id: data.category_id,
        entity_type: data.entity_type,
        condition_type: data.condition_type,
        condition_config: data.condition_config,
        icon: data.icon,
        color: data.color,
        drilldown_path: data.drilldown_path || null,
        is_active: data.is_active,
        sort_order: kpiDefinitions.length + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi_definitions"] });
      queryClient.invalidateQueries({ queryKey: ["kpi_definitions_admin"] });
      queryClient.invalidateQueries({ queryKey: ["all_calculated_kpis"] });
      setKpiDialogOpen(false);
      toast.success("KPI created successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to create KPI: ${error.message}`);
    },
  });

  const updateKPI = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof kpiForm }) => {
      const { error } = await supabase
        .from("kpi_definitions")
        .update({
          name: data.name,
          slug: data.slug,
          description: data.description || null,
          category_id: data.category_id,
          entity_type: data.entity_type,
          condition_type: data.condition_type,
          condition_config: data.condition_config,
          icon: data.icon,
          color: data.color,
          drilldown_path: data.drilldown_path || null,
          is_active: data.is_active,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi_definitions"] });
      queryClient.invalidateQueries({ queryKey: ["kpi_definitions_admin"] });
      queryClient.invalidateQueries({ queryKey: ["all_calculated_kpis"] });
      setKpiDialogOpen(false);
      setEditingKPI(null);
      toast.success("KPI updated successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to update KPI: ${error.message}`);
    },
  });

  const deleteKPI = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kpi_definitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi_definitions"] });
      queryClient.invalidateQueries({ queryKey: ["kpi_definitions_admin"] });
      queryClient.invalidateQueries({ queryKey: ["all_calculated_kpis"] });
      toast.success("KPI deleted successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete KPI: ${error.message}`);
    },
  });

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "", slug: "", description: "", icon: "LayoutGrid" });
    setCategoryDialogOpen(true);
  };

  const openEditCategory = (category: KPICategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      icon: category.icon,
    });
    setCategoryDialogOpen(true);
  };

  const openCreateKPI = () => {
    setEditingKPI(null);
    setKpiForm({
      name: "",
      slug: "",
      description: "",
      category_id: categories[0]?.id || "",
      entity_type: "",
      condition_type: "count",
      condition_config: {},
      icon: "AlertCircle",
      color: "gray",
      drilldown_path: "",
      is_active: true,
    });
    setKpiDialogOpen(true);
  };

  const openEditKPI = (kpi: KPIDefinition) => {
    setEditingKPI(kpi);
    setKpiForm({
      name: kpi.name,
      slug: kpi.slug,
      description: kpi.description || "",
      category_id: kpi.category_id,
      entity_type: kpi.entity_type,
      condition_type: kpi.condition_type,
      condition_config: kpi.condition_config || {},
      icon: kpi.icon,
      color: kpi.color,
      drilldown_path: kpi.drilldown_path || "",
      is_active: kpi.is_active,
    });
    setKpiDialogOpen(true);
  };

  const handleSaveCategory = () => {
    if (editingCategory) {
      updateCategory.mutate({ id: editingCategory.id, data: categoryForm });
    } else {
      createCategory.mutate(categoryForm);
    }
  };

  const handleSaveKPI = () => {
    if (editingKPI) {
      updateKPI.mutate({ id: editingKPI.id, data: kpiForm });
    } else {
      createKPI.mutate(kpiForm);
    }
  };

  const renderConditionConfig = () => {
    switch (kpiForm.condition_type) {
      case "missing_relationship":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Related Entity Table</Label>
              <Input
                placeholder="e.g., vehicles"
                value={kpiForm.condition_config.related_entity || ""}
                onChange={(e) =>
                  setKpiForm({
                    ...kpiForm,
                    condition_config: { ...kpiForm.condition_config, related_entity: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Relationship Field</Label>
              <Input
                placeholder="e.g., driver_id"
                value={kpiForm.condition_config.relationship_field || ""}
                onChange={(e) =>
                  setKpiForm({
                    ...kpiForm,
                    condition_config: { ...kpiForm.condition_config, relationship_field: e.target.value },
                  })
                }
              />
            </div>
          </div>
        );

      case "status_match":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status Field</Label>
              <Input
                placeholder="e.g., status"
                value={kpiForm.condition_config.status_field || ""}
                onChange={(e) =>
                  setKpiForm({
                    ...kpiForm,
                    condition_config: { ...kpiForm.condition_config, status_field: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Status Value</Label>
              <Input
                placeholder="e.g., active"
                value={kpiForm.condition_config.status_value || ""}
                onChange={(e) =>
                  setKpiForm({
                    ...kpiForm,
                    condition_config: { ...kpiForm.condition_config, status_value: e.target.value },
                  })
                }
              />
            </div>
          </div>
        );

      case "null_field":
      case "not_null_field":
        return (
          <div className="space-y-2">
            <Label>Field Name</Label>
            <Input
              placeholder="e.g., assigned_vehicle_id"
              value={kpiForm.condition_config.field || ""}
              onChange={(e) =>
                setKpiForm({
                  ...kpiForm,
                  condition_config: { ...kpiForm.condition_config, field: e.target.value },
                })
              }
            />
          </div>
        );

      case "date_based":
        return (
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date Field</Label>
              <Input
                placeholder="e.g., expires_at"
                value={kpiForm.condition_config.date_field || ""}
                onChange={(e) =>
                  setKpiForm({
                    ...kpiForm,
                    condition_config: { ...kpiForm.condition_config, date_field: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Operator</Label>
              <Select
                value={kpiForm.condition_config.operator || "before"}
                onValueChange={(val) =>
                  setKpiForm({
                    ...kpiForm,
                    condition_config: { ...kpiForm.condition_config, operator: val },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Before</SelectItem>
                  <SelectItem value="after">After</SelectItem>
                  <SelectItem value="on">On</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Days Offset</Label>
              <Input
                type="number"
                placeholder="0"
                value={kpiForm.condition_config.days_offset || 0}
                onChange={(e) =>
                  setKpiForm({
                    ...kpiForm,
                    condition_config: { ...kpiForm.condition_config, days_offset: parseInt(e.target.value) },
                  })
                }
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">KPI Management</h1>
            <p className="text-muted-foreground">Create and manage dynamic KPI categories and definitions</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="kpis">
            <Settings className="h-4 w-4 mr-2" />
            KPI Definitions
          </TabsTrigger>
          <TabsTrigger value="categories">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Categories
          </TabsTrigger>
        </TabsList>

        {/* KPI Definitions Tab */}
        <TabsContent value="kpis" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateKPI}>
              <Plus className="h-4 w-4 mr-2" />
              Create KPI
            </Button>
          </div>

          <div className="grid gap-4">
            {categories.map((category) => {
              const categoryKPIs = kpiDefinitions.filter((k) => k.category_id === category.id);
              if (categoryKPIs.length === 0) return null;

              return (
                <Card key={category.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                    {category.description && (
                      <CardDescription>{category.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {categoryKPIs.map((kpi) => (
                        <div
                          key={kpi.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant={kpi.is_active ? "default" : "secondary"}>
                              {kpi.is_active ? "Active" : "Inactive"}
                            </Badge>
                            <div>
                              <p className="font-medium">{kpi.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {kpi.entity_type} • {kpi.condition_type}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditKPI(kpi)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => {
                                if (confirm("Delete this KPI?")) {
                                  deleteKPI.mutate(kpi.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {kpiDefinitions.length === 0 && (
              <Card className="p-8 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No KPIs defined yet. Create your first KPI to get started.</p>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateCategory}>
              <Plus className="h-4 w-4 mr-2" />
              Create Category
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Card key={category.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{category.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      {category.is_system && (
                        <Badge variant="outline" className="text-xs">System</Badge>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEditCategory(category)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!category.is_system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Delete this category? All KPIs in this category will also be deleted.")) {
                              deleteCategory.mutate(category.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {category.description && (
                    <CardDescription>{category.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {kpiDefinitions.filter((k) => k.category_id === category.id).length} KPIs
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Create Category"}</DialogTitle>
            <DialogDescription>
              Categories group related KPIs together for easier navigation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="e.g., Drivers"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={categoryForm.slug}
                onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                placeholder="e.g., drivers"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <Select
                value={categoryForm.icon}
                onValueChange={(val) => setCategoryForm({ ...categoryForm, icon: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCategory}>
              <Save className="h-4 w-4 mr-2" />
              {editingCategory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPI Dialog */}
      <Dialog open={kpiDialogOpen} onOpenChange={setKpiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingKPI ? "Edit KPI" : "Create KPI"}</DialogTitle>
            <DialogDescription>
              Define a KPI that will be calculated and displayed on the dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={kpiForm.name}
                  onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })}
                  placeholder="e.g., Drivers with No Cars"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={kpiForm.slug}
                  onChange={(e) => setKpiForm({ ...kpiForm, slug: e.target.value })}
                  placeholder="e.g., drivers-no-cars"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={kpiForm.description}
                onChange={(e) => setKpiForm({ ...kpiForm, description: e.target.value })}
                placeholder="What does this KPI measure?"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={kpiForm.category_id}
                  onValueChange={(val) => setKpiForm({ ...kpiForm, category_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select
                  value={kpiForm.entity_type}
                  onValueChange={(val) => setKpiForm({ ...kpiForm, entity_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((entity) => (
                      <SelectItem key={entity.value} value={entity.value}>{entity.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Condition Type</Label>
              <Select
                value={kpiForm.condition_type}
                onValueChange={(val) => setKpiForm({ ...kpiForm, condition_type: val, condition_config: {} })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>
                      <div>
                        <p>{ct.label}</p>
                        <p className="text-xs text-muted-foreground">{ct.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic condition config */}
            {renderConditionConfig()}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select
                  value={kpiForm.icon}
                  onValueChange={(val) => setKpiForm({ ...kpiForm, icon: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ICONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Select
                  value={kpiForm.color}
                  onValueChange={(val) => setKpiForm({ ...kpiForm, color: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_COLORS.map((color) => (
                      <SelectItem key={color} value={color}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full bg-${color}-500`} />
                          {color}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Drilldown Path</Label>
              <Input
                value={kpiForm.drilldown_path}
                onChange={(e) => setKpiForm({ ...kpiForm, drilldown_path: e.target.value })}
                placeholder="e.g., /crm/toptier-experience/customers"
              />
              <p className="text-xs text-muted-foreground">URL to navigate when the KPI card is clicked</p>
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={kpiForm.is_active}
                onCheckedChange={(checked) => setKpiForm({ ...kpiForm, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKpiDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveKPI}>
              <Save className="h-4 w-4 mr-2" />
              {editingKPI ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
