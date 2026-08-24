import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useWholesalerProducts, useWholesalerProduct, CreateProductData } from "@/services/wholesaler/useWholesalerProducts";
import { useBrands } from "@/services/marketplace/useProducts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Loader2, Package, Upload } from "lucide-react";
import { useWholesalerProfile } from "@/services/wholesaler/useWholesalerProfile";
import { BulkUploadModule } from "@/components/wholesaler-console";
import { ProductDimensionsPanel, ProductDimensions } from "@/components/products/ProductDimensionsPanel";

export default function WholesalerProductForm() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const isEditing = !!productId;
  const { profile } = useWholesalerProfile();

  const { createProduct, updateProduct, isCreating } = useWholesalerProducts();
  const { data: existingProduct, isLoading: productLoading } = useWholesalerProduct(productId || '');
  const { data: brands } = useBrands();

  const [formData, setFormData] = useState<CreateProductData>({
    product_name: '',
    description: '',
    brand_id: '',
    supplier_cost: 0,
    inventory_qty: 0,
    weight_oz: null,
    processing_time: '1-3 days',
    shipping_from_city: '',
    shipping_from_state: '',
    length_in: null,
    width_in: null,
    height_in: null,
    is_fragile: false,
    stackable: true,
    units_per_case: null,
    case_length_in: null,
    case_width_in: null,
    case_height_in: null,
    case_weight_oz: null,
  });

  useEffect(() => {
    if (existingProduct && isEditing) {
      const ep = existingProduct as any;
      setFormData({
        product_name: existingProduct.product_name,
        description: existingProduct.description || '',
        brand_id: existingProduct.brand_id || '',
        supplier_cost: (existingProduct as any).supplier_cost || 0,
        inventory_qty: existingProduct.inventory_qty || 0,
        weight_oz: existingProduct.weight_oz ?? null,
        processing_time: existingProduct.processing_time || '1-3 days',
        shipping_from_city: existingProduct.shipping_from_city || '',
        shipping_from_state: existingProduct.shipping_from_state || '',
        length_in: ep.length_in ?? null,
        width_in: ep.width_in ?? null,
        height_in: ep.height_in ?? null,
        is_fragile: !!ep.is_fragile,
        stackable: ep.stackable !== false,
        units_per_case: ep.units_per_case ?? null,
        case_length_in: ep.case_length_in ?? null,
        case_width_in: ep.case_width_in ?? null,
        case_height_in: ep.case_height_in ?? null,
        case_weight_oz: ep.case_weight_oz ?? null,
      });
    }
  }, [existingProduct, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEditing && productId) {
        await updateProduct({ id: productId, ...formData });
      } else {
        await createProduct(formData);
      }
      navigate('/portal/wholesaler/products');
    } catch (error) {
      console.error('Form submit error:', error);
    }
  };

  const handleChange = (field: keyof CreateProductData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isEditing && productLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const singleProductForm = (
    <form onSubmit={handleSubmit}>
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Product Name *</Label>
                <Input
                  value={formData.product_name}
                  onChange={(e) => handleChange('product_name', e.target.value)}
                  placeholder="Enter product name"
                  required
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Describe your product..."
                  rows={4}
                />
              </div>

              <div>
                <Label>Brand</Label>
                <Select
                  value={formData.brand_id || 'none'}
                  onValueChange={(v) => handleChange('brand_id', v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No brand</SelectItem>
                    {brands?.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-xs">
                <Label>Supplier Cost ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.supplier_cost}
                  onChange={(e) => handleChange('supplier_cost', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  What you charge Dynasty Direct per unit. Retail pricing is set by Dynasty
                  during catalog review — it is never shown or editable here.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Processing Time</Label>
                <Select
                  value={formData.processing_time}
                  onValueChange={(v) => handleChange('processing_time', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Same day">Same day</SelectItem>
                    <SelectItem value="1-3 days">1-3 days</SelectItem>
                    <SelectItem value="3-5 days">3-5 days</SelectItem>
                    <SelectItem value="1-2 weeks">1-2 weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Ship From City</Label>
                  <Input
                    value={formData.shipping_from_city}
                    onChange={(e) => handleChange('shipping_from_city', e.target.value)}
                    placeholder="Miami"
                  />
                </div>
                <div>
                  <Label>Ship From State</Label>
                  <Input
                    value={formData.shipping_from_state}
                    onChange={(e) => handleChange('shipping_from_state', e.target.value)}
                    placeholder="FL"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <ProductDimensionsPanel
            value={{
              length_in: formData.length_in ?? null,
              width_in: formData.width_in ?? null,
              height_in: formData.height_in ?? null,
              weight_oz: formData.weight_oz ?? null,
              is_fragile: !!formData.is_fragile,
              stackable: formData.stackable !== false,
              units_per_case: formData.units_per_case ?? null,
              case_length_in: formData.case_length_in ?? null,
              case_width_in: formData.case_width_in ?? null,
              case_height_in: formData.case_height_in ?? null,
              case_weight_oz: formData.case_weight_oz ?? null,
            }}
            onChange={(next: ProductDimensions) => setFormData((prev) => ({ ...prev, ...next }))}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label>Stock Quantity</Label>
                <Input
                  type="number"
                  value={formData.inventory_qty}
                  onChange={(e) => handleChange('inventory_qty', parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center mb-4">
                <Package className="h-16 w-16 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">{formData.product_name || 'Product Name'}</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Your cost: ${(formData.supplier_cost || 0).toFixed(2)} · retail set by Dynasty on review
              </p>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/portal/wholesaler/products">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Edit Product' : 'Add Products'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Update product details' : 'Add a single product or bulk upload your catalog'}
          </p>
        </div>
      </div>

      {isEditing ? (
        singleProductForm
      ) : (
        <Tabs defaultValue="single" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="single" className="gap-2">
              <Package className="h-4 w-4" />
              Single Product
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2">
              <Upload className="h-4 w-4" />
              Bulk Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single">
            {singleProductForm}
          </TabsContent>

          <TabsContent value="bulk">
            <BulkUploadModule wholesalerId={profile?.id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
