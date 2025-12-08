import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ShoppingCart, 
  RefreshCw, 
  AlertTriangle, 
  Package,
  Building2,
  FileText,
  Plus,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  calculateReorderSuggestions, 
  generateDraftPOsFromSuggestions,
  ReorderSuggestion 
} from "@/lib/inventory/calculateReorderSuggestions";
import { ReorderPolicyModal } from "@/components/inventory/ReorderPolicyModal";

const ProcurementPage = () => {
  const queryClient = useQueryClient();
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [showOnlyWithSupplier, setShowOnlyWithSupplier] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);

  // Fetch warehouses
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data } = await supabase
        .from('warehouses')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      return (data || []) as { id: string; name: string }[];
    },
  });

  // Fetch reorder suggestions
  const { data: suggestions = [], isLoading, refetch } = useQuery({
    queryKey: ['reorder-suggestions', selectedWarehouse],
    queryFn: async () => {
      return calculateReorderSuggestions({
        warehouseId: selectedWarehouse !== 'all' ? selectedWarehouse : undefined,
      });
    },
  });

  // Fetch policies
  const { data: policies = [] } = useQuery({
    queryKey: ['reorder-policies'],
    queryFn: async () => {
      const { data } = await supabase
        .from('reorder_policies')
        .select(`
          *,
          products:product_id (name, sku),
          warehouses:warehouse_id (name)
        `)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Filter suggestions
  const filteredSuggestions = suggestions.filter(s => {
    if (selectedSupplier !== 'all' && s.supplier_id !== selectedSupplier) return false;
    if (showOnlyWithSupplier && !s.supplier_id) return false;
    return true;
  });

  const getItemKey = (s: ReorderSuggestion) => `${s.product_id}|${s.warehouse_id}`;

  const toggleItem = (suggestion: ReorderSuggestion) => {
    const key = getItemKey(suggestion);
    const newSelected = new Set(selectedItems);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedItems(newSelected);
  };

  const toggleAll = () => {
    if (selectedItems.size === filteredSuggestions.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredSuggestions.map(getItemKey)));
    }
  };

  const handleGeneratePOs = async () => {
    const selected = filteredSuggestions.filter(s => selectedItems.has(getItemKey(s)));
    const withoutSupplier = selected.filter(s => !s.supplier_id);
    
    if (withoutSupplier.length > 0) {
      toast.error(`${withoutSupplier.length} items have no supplier assigned. Please assign suppliers first.`);
      return;
    }

    if (selected.length === 0) {
      toast.error("No items selected");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateDraftPOsFromSuggestions(selected);
      if (result.success) {
        toast.success(`Created ${result.poCount} draft purchase order(s)`);
        setSelectedItems(new Set());
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
        refetch();
      } else {
        toast.error("Failed to generate purchase orders");
      }
    } catch (error) {
      console.error('Error generating POs:', error);
      toast.error("An error occurred while generating POs");
    } finally {
      setIsGenerating(false);
    }
  };

  const totalSuggestedValue = filteredSuggestions.reduce((sum, s) => sum + (s.line_total || 0), 0);
  const selectedCount = selectedItems.size;
  const selectedValue = filteredSuggestions
    .filter(s => selectedItems.has(getItemKey(s)))
    .reduce((sum, s) => sum + (s.line_total || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Procurement & Reorder</h1>
          <p className="text-muted-foreground">
            Review low-stock products and generate draft purchase orders.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button 
            onClick={handleGeneratePOs} 
            disabled={selectedCount === 0 || isGenerating}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Generate Draft POs ({selectedCount})
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items Need Reorder</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSuggestions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Suggested Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalSuggestedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Selected Items</CardTitle>
            <Checkbox checked={selectedCount > 0} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Selected Value</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${selectedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="suggestions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="suggestions">Reorder Suggestions</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4">
                <div className="w-48">
                  <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                    <SelectTrigger>
                      <Building2 className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="All Warehouses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Warehouses</SelectItem>
                      {warehouses?.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-48">
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Suppliers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Suppliers</SelectItem>
                      {suppliers?.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="with-supplier" 
                    checked={showOnlyWithSupplier}
                    onCheckedChange={(checked) => setShowOnlyWithSupplier(!!checked)}
                  />
                  <label htmlFor="with-supplier" className="text-sm">
                    Only items with supplier
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Suggestions Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSuggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium">No reorder suggestions</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    All products are above their reorder points, or no reorder points are configured.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={selectedItems.size === filteredSuggestions.length && filteredSuggestions.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Reorder Pt</TableHead>
                      <TableHead className="text-right">Suggested Qty</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuggestions.map((suggestion) => {
                      const key = getItemKey(suggestion);
                      const isCritical = suggestion.available <= 0;
                      const noSupplier = !suggestion.supplier_id;
                      
                      return (
                        <TableRow 
                          key={key}
                          className={isCritical ? "bg-destructive/5" : noSupplier ? "bg-warning/5" : ""}
                        >
                          <TableCell>
                            <Checkbox 
                              checked={selectedItems.has(key)}
                              onCheckedChange={() => toggleItem(suggestion)}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{suggestion.product_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {suggestion.sku}
                                {suggestion.brand_name && ` • ${suggestion.brand_name}`}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{suggestion.warehouse_name}</TableCell>
                          <TableCell>
                            {suggestion.supplier_name ? (
                              suggestion.supplier_name
                            ) : (
                              <div className="flex items-center gap-1 text-destructive">
                                <AlertCircle className="h-4 w-4" />
                                <span>Unassigned</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={isCritical ? "destructive" : "secondary"}>
                              {suggestion.available}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{suggestion.reorder_point ?? '—'}</TableCell>
                          <TableCell className="text-right font-medium">{suggestion.suggested_qty}</TableCell>
                          <TableCell className="text-right">
                            {suggestion.unit_cost 
                              ? `$${suggestion.unit_cost.toFixed(2)}` 
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {suggestion.line_total 
                              ? `$${suggestion.line_total.toFixed(2)}` 
                              : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Reorder Policies</CardTitle>
              <Button onClick={() => setPolicyModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Policy
              </Button>
            </CardHeader>
            <CardContent>
              {policies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium">No policies configured</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add policies to customize reorder behavior per product.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-right">Min Qty</TableHead>
                      <TableHead className="text-right">Max Qty</TableHead>
                      <TableHead className="text-right">Multiple</TableHead>
                      <TableHead className="text-right">Days of Cover</TableHead>
                      <TableHead>Auto Calc</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policies.map((policy: any) => (
                      <TableRow key={policy.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{policy.products?.name || '—'}</div>
                            <div className="text-sm text-muted-foreground">{policy.products?.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell>{policy.warehouses?.name || 'All'}</TableCell>
                        <TableCell className="text-right">{policy.min_reorder_qty ?? '—'}</TableCell>
                        <TableCell className="text-right">{policy.max_reorder_qty ?? '—'}</TableCell>
                        <TableCell className="text-right">{policy.reorder_multiple ?? '—'}</TableCell>
                        <TableCell className="text-right">{policy.days_of_cover ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={policy.use_auto_calculation ? "default" : "secondary"}>
                            {policy.use_auto_calculation ? 'Yes' : 'No'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ReorderPolicyModal 
        open={policyModalOpen} 
        onClose={() => setPolicyModalOpen(false)} 
      />
    </div>
  );
};

export default ProcurementPage;
