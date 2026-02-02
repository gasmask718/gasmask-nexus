import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  Search, 
  Package, 
  MapPin, 
  Truck, 
  Merge, 
  Split, 
  Send,
  Filter,
  Building2
} from "lucide-react";
import { toast } from "sonner";

const BRANDS = ["GasMask", "Hot Mama", "Hot Scalati", "Grabba R Us"];

interface DeliveryItem {
  id: string;
  store_id: string;
  store_name: string;
  store_city?: string;
  brand: string;
  quantity: number;
  priority: string;
  status: string;
}

export default function MultiBrandDeliveryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Fetch pending delivery items (simulated with store_product_state)
  const { data: deliveryItems = [], isLoading } = useQuery({
    queryKey: ["multi-brand-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_product_state")
        .select(`
          id,
          store_id,
          brand,
          stock_level,
          urgency_score,
          stores(name, address_city)
        `)
        .gt("urgency_score", 0)
        .order("urgency_score", { ascending: false })
        .limit(100);

      if (error) throw error;

      return data.map((item: any) => ({
        id: item.id,
        store_id: item.store_id,
        store_name: item.stores?.name || "Unknown Store",
        store_city: item.stores?.address_city,
        brand: item.brand || "GasMask",
        quantity: Math.max(1, 10 - (item.stock_level || 0)),
        priority: item.urgency_score > 7 ? "urgent" : item.urgency_score > 4 ? "high" : "normal",
        status: "pending",
      })) as DeliveryItem[];
    },
  });

  // Group by store
  const groupedByStore = useMemo(() => {
    const groups: Record<string, DeliveryItem[]> = {};
    deliveryItems.forEach((item) => {
      if (!groups[item.store_id]) {
        groups[item.store_id] = [];
      }
      groups[item.store_id].push(item);
    });
    return groups;
  }, [deliveryItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    return deliveryItems.filter((item) => {
      const matchesSearch = 
        item.store_name.toLowerCase().includes(search.toLowerCase()) ||
        item.brand.toLowerCase().includes(search.toLowerCase());
      const matchesBrand = brandFilter === "all" || item.brand === brandFilter;
      return matchesSearch && matchesBrand;
    });
  }, [deliveryItems, search, brandFilter]);

  // Get unique stores from filtered items
  const filteredStores = useMemo(() => {
    const storeMap = new Map<string, { store_id: string; store_name: string; store_city?: string; items: DeliveryItem[] }>();
    
    filteredItems.forEach((item) => {
      if (!storeMap.has(item.store_id)) {
        storeMap.set(item.store_id, {
          store_id: item.store_id,
          store_name: item.store_name,
          store_city: item.store_city,
          items: [],
        });
      }
      storeMap.get(item.store_id)!.items.push(item);
    });

    return Array.from(storeMap.values());
  }, [filteredItems]);

  const toggleItem = (itemId: string) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleStore = (storeId: string) => {
    const storeItems = filteredItems.filter((i) => i.store_id === storeId).map((i) => i.id);
    const allSelected = storeItems.every((id) => selectedItems.includes(id));
    
    if (allSelected) {
      setSelectedItems((prev) => prev.filter((id) => !storeItems.includes(id)));
    } else {
      setSelectedItems((prev) => [...new Set([...prev, ...storeItems])]);
    }
  };

  const selectAll = () => {
    setSelectedItems(filteredItems.map((i) => i.id));
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  const handleSendToRouter = () => {
    if (selectedItems.length === 0) {
      toast.error("Please select at least one delivery item");
      return;
    }
    
    // Get unique stores from selected items
    const selectedStores = [...new Set(
      deliveryItems
        .filter((i) => selectedItems.includes(i.id))
        .map((i) => i.store_id)
    )];
    
    toast.success(`Sending ${selectedStores.length} stores to Route Optimizer`);
    navigate("/delivery/route-optimizer");
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent": return <Badge variant="destructive">Urgent</Badge>;
      case "high": return <Badge className="bg-orange-500">High</Badge>;
      default: return <Badge variant="secondary">Normal</Badge>;
    }
  };

  const getBrandColor = (brand: string) => {
    switch (brand) {
      case "GasMask": return "bg-purple-500/10 text-purple-600 border-purple-500/30";
      case "Hot Mama": return "bg-red-500/10 text-red-600 border-red-500/30";
      case "Hot Scalati": return "bg-orange-500/10 text-orange-600 border-orange-500/30";
      case "Grabba R Us": return "bg-green-500/10 text-green-600 border-green-500/30";
      default: return "bg-gray-500/10 text-gray-600";
    }
  };

  // Stats
  const stats = {
    totalItems: filteredItems.length,
    totalStores: filteredStores.length,
    selectedItems: selectedItems.length,
    selectedStores: [...new Set(deliveryItems.filter((i) => selectedItems.includes(i.id)).map((i) => i.store_id))].length,
    byBrand: BRANDS.reduce((acc, brand) => {
      acc[brand] = filteredItems.filter((i) => i.brand === brand).length;
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/delivery")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Multi-Brand Delivery
            </h1>
            <p className="text-muted-foreground">Consolidate deliveries across brands for optimal routing</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={selectedItems.length === 0}>
            <Split className="h-4 w-4 mr-2" />
            Split by Brand
          </Button>
          <Button variant="outline" disabled={selectedItems.length === 0}>
            <Merge className="h-4 w-4 mr-2" />
            Merge Deliveries
          </Button>
          <Button onClick={handleSendToRouter} disabled={selectedItems.length === 0}>
            <Send className="h-4 w-4 mr-2" />
            Send to Router
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.totalStores}</div>
            <p className="text-xs text-muted-foreground">Total Stores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.totalItems}</div>
            <p className="text-xs text-muted-foreground">Delivery Items</p>
          </CardContent>
        </Card>
        <Card className="border-primary/50">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">{stats.selectedStores}</div>
            <p className="text-xs text-muted-foreground">Selected Stores</p>
          </CardContent>
        </Card>
        <Card className="border-primary/50">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">{stats.selectedItems}</div>
            <p className="text-xs text-muted-foreground">Selected Items</p>
          </CardContent>
        </Card>
        {BRANDS.slice(0, 2).map((brand) => (
          <Card key={brand}>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.byBrand[brand] || 0}</div>
              <p className="text-xs text-muted-foreground">{brand}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search stores or brands..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {BRANDS.map((brand) => (
              <SelectItem key={brand} value={brand}>{brand}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      </div>

      {/* Stores List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading deliveries...</div>
      ) : filteredStores.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No pending deliveries found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredStores.map((store) => {
            const storeItemIds = store.items.map((i) => i.id);
            const allSelected = storeItemIds.every((id) => selectedItems.includes(id));
            const someSelected = storeItemIds.some((id) => selectedItems.includes(id));
            
            return (
              <Card key={store.store_id} className={someSelected ? "border-primary/50" : ""}>
                <CardHeader className="py-3">
                  <div className="flex items-center gap-3">
                    <Checkbox 
                      checked={allSelected}
                      onCheckedChange={() => toggleStore(store.store_id)}
                    />
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        {store.store_name}
                        <span className="text-sm font-normal text-muted-foreground">
                          {store.store_city && `• ${store.store_city}`}
                        </span>
                      </CardTitle>
                    </div>
                    <div className="flex gap-1">
                      {[...new Set(store.items.map((i) => i.brand))].map((brand) => (
                        <Badge key={brand} variant="outline" className={getBrandColor(brand)}>
                          {brand}
                        </Badge>
                      ))}
                    </div>
                    <Badge variant="secondary">{store.items.length} items</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {store.items.map((item) => (
                      <div 
                        key={item.id}
                        className={`flex items-center gap-3 p-2 rounded-lg border ${
                          selectedItems.includes(item.id) ? "bg-primary/5 border-primary/30" : "bg-muted/30"
                        }`}
                      >
                        <Checkbox 
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => toggleItem(item.id)}
                        />
                        <Badge variant="outline" className={getBrandColor(item.brand)}>
                          {item.brand}
                        </Badge>
                        <span className="text-sm">Qty: {item.quantity}</span>
                        {getPriorityBadge(item.priority)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
