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
import { ArrowLeft, Save, Loader2, Package } from "lucide-react";

export default function WholesalerProductForm() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const isEditing = !!productId;

  const { createProduct, updateProduct, isCreating } = useWholesalerProducts();
  const { data: existingProduct, isLoading: productLoading } = useWholesalerProduct(productId || '');
  const { data: brands } = useBrands();

  const [formData, setFormData] = useState<CreateProductData>({
    product_name: '',
    description: '',
    brand_id: '',
    retail_price: 0,
    store_price: 0,
    wholesale_price: 0,
    inventory_qty: 0,
    weight_oz: 0,
    processing_time: '1-3 days',
    shipping_from_city: '',
    shipping_from_state: '',
  });

  useEffect(() => {
    if (existingProduct && isEditing) {
      setFormData({
        product_name: existingProduct.product_name,
        description: existingProduct.description || '',
        brand_id: existingProduct.brand_id || '',
        retail_price: existingProduct.retail_price || 0,
        store_price: existingProduct.store_price || 0,
        wholesale_price: existingProduct.wholesale_price || 0,
        inventory_qty: existingProduct.inventory_qty || 0,
        weight_oz: existingProduct.weight_oz || 0,
        processing_time: existingProduct.processing_time || '1-3 days',
        shipping_from_city: existingProduct.shipping_from_city || '',
        shipping_from_state: existingProduct.shipping_from_state || '',
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
            {isEditing ? 'Edit Product' : 'Add New Product'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Update product details' : 'Create a new product listing'}
          </p>
        </div>
      </div>

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
                <CardTitle>Pricing Tiers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Retail Price ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.retail_price}
                      onChange={(e) => handleChange('retail_price', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">For D2C customers</p>
                  </div>
                  <div>
                    <Label>Store Price ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.store_price}
                      onChange={(e) => handleChange('store_price', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">For B2B stores</p>
                  </div>
                  <div>
                    <Label>Wholesale Price ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.wholesale_price}
                      onChange={(e) => handleChange('wholesale_price', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">For bulk buyers</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Shipping</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Weight (oz)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.weight_oz}
                      onChange={(e) => handleChange('weight_oz', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
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
                <p className="text-2xl font-bold text-primary mt-2">
                  ${(formData.retail_price || 0).toFixed(2)}
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
    </div>
  );
}
