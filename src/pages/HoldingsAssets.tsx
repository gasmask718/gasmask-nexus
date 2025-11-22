import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Home, MapPin, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function HoldingsAssets() {
  const [assets, setAssets] = useState<any[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    asset_type: "single_family",
    purchase_price: 0,
    closing_costs: 0,
    rehab_costs: 0,
    current_value: 0,
    hold_strategy: "long_term_rental",
    market: "",
  });

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase
        .from("holdings_assets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error("Error fetching assets:", error);
      toast.error("Failed to fetch assets");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("holdings_assets").insert([formData]);

      if (error) throw error;

      toast.success("Asset added successfully");
      setOpenDialog(false);
      fetchAssets();
      // Reset form
      setFormData({
        name: "",
        address: "",
        city: "",
        state: "",
        zip_code: "",
        asset_type: "single_family",
        purchase_price: 0,
        closing_costs: 0,
        rehab_costs: 0,
        current_value: 0,
        hold_strategy: "long_term_rental",
        market: "",
      });
    } catch (error) {
      console.error("Error adding asset:", error);
      toast.error("Failed to add asset");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      owned: "bg-green-500",
      under_contract: "bg-blue-500",
      selling: "bg-orange-500",
      sold: "bg-gray-500",
    };
    return colors[status] || "bg-gray-500";
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Assets & Portfolio</h1>
          <p className="text-muted-foreground">Manage your real estate holdings</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add New Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Asset</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Property Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="zip_code">Zip Code</Label>
                  <Input
                    id="zip_code"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="asset_type">Asset Type</Label>
                  <Select
                    value={formData.asset_type}
                    onValueChange={(value) => setFormData({ ...formData, asset_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_family">Single Family</SelectItem>
                      <SelectItem value="multi_family">Multi Family</SelectItem>
                      <SelectItem value="warehouse">Warehouse</SelectItem>
                      <SelectItem value="strip_mall">Strip Mall</SelectItem>
                      <SelectItem value="land">Land</SelectItem>
                      <SelectItem value="office">Office</SelectItem>
                      <SelectItem value="mixed_use">Mixed Use</SelectItem>
                      <SelectItem value="airbnb_unit">Airbnb Unit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="purchase_price">Purchase Price</Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="closing_costs">Closing Costs</Label>
                  <Input
                    id="closing_costs"
                    type="number"
                    value={formData.closing_costs}
                    onChange={(e) => setFormData({ ...formData, closing_costs: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="rehab_costs">Rehab Costs</Label>
                  <Input
                    id="rehab_costs"
                    type="number"
                    value={formData.rehab_costs}
                    onChange={(e) => setFormData({ ...formData, rehab_costs: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="current_value">Current Value</Label>
                  <Input
                    id="current_value"
                    type="number"
                    value={formData.current_value}
                    onChange={(e) => setFormData({ ...formData, current_value: parseFloat(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="hold_strategy">Hold Strategy</Label>
                  <Select
                    value={formData.hold_strategy}
                    onValueChange={(value) => setFormData({ ...formData, hold_strategy: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wholesale">Wholesale</SelectItem>
                      <SelectItem value="flip">Flip</SelectItem>
                      <SelectItem value="long_term_rental">Long-term Rental</SelectItem>
                      <SelectItem value="airbnb">Airbnb</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="market">Market</Label>
                  <Input
                    id="market"
                    value={formData.market}
                    onChange={(e) => setFormData({ ...formData, market: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Asset</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {assets.map((asset) => (
          <Card key={asset.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{asset.name}</CardTitle>
                </div>
                <Badge className={getStatusColor(asset.status)}>{asset.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>
                  {asset.city}, {asset.state} {asset.zip_code}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-muted-foreground">Type</div>
                  <div className="font-medium capitalize">{asset.asset_type.replace(/_/g, " ")}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Strategy</div>
                  <div className="font-medium capitalize">{asset.hold_strategy.replace(/_/g, " ")}</div>
                </div>
              </div>

              <div className="pt-3 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Value</span>
                  <span className="font-bold">{formatCurrency(asset.current_value)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Basis</span>
                  <span>{formatCurrency(asset.total_basis)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Equity</span>
                  <span className="font-bold text-green-600">{formatCurrency(asset.equity)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {assets.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Home className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No assets yet. Add your first property to get started.</p>
            <Button onClick={() => setOpenDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Asset
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
