// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT FORM MODAL — Create/Edit Product with Full Fields + Image Upload
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProduct, useCreateProduct, useUpdateProduct, Product } from '@/services/inventory';
import { supabase } from '@/integrations/supabase/client';
import { ImageUpload } from './ImageUpload';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  productId?: string;
}

export default function ProductFormModal({ open, onClose, productId }: ProductFormModalProps) {
  const { data: existingProduct, isLoading: isLoadingProduct } = useProduct(productId || '');
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  
  const isEditMode = !!productId;
  const isSubmitting = createProduct.isPending || updateProduct.isPending;
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch brands for dropdown
  const { data: brands = [] } = useQuery({
    queryKey: ['brands-dropdown'],
    queryFn: async () => {
      const { data } = await supabase
        .from('brands')
        .select('id, name')
        .order('name');
      return data || [];
    },
  });

  // Fetch businesses for dropdown
  const { data: businesses = [] } = useQuery({
    queryKey: ['businesses-dropdown'],
    queryFn: async () => {
      const { data } = await supabase
        .from('businesses')
        .select('id, name')
        .order('name');
      return data || [];
    },
  });

  const [form, setForm] = useState<Partial<Product>>({
    name: '',
    sku: '',
    barcode: '',
    type: 'standard',
    category: '',
    variant: '',
    description: '',
    unit_type: 'unit',
    cost: 0,
    wholesale_price: 0,
    suggested_retail_price: 0,
    case_size: 1,
    moq: 1,
    reorder_point: 0,
    reorder_qty: 0,
    safety_stock: 0,
    is_active: true,
    image_url: null,
    brand_id: null,
    business_id: null,
  });

  // Reset form when modal opens with existing product data
  useEffect(() => {
    if (open && existingProduct && isEditMode) {
      setForm({
        name: existingProduct.name || '',
        sku: existingProduct.sku || '',
        barcode: existingProduct.barcode || '',
        type: existingProduct.type || 'standard',
        category: existingProduct.category || '',
        variant: existingProduct.variant || '',
        description: existingProduct.description || '',
        unit_type: existingProduct.unit_type || 'unit',
        cost: existingProduct.cost || 0,
        wholesale_price: existingProduct.wholesale_price || 0,
        suggested_retail_price: existingProduct.suggested_retail_price || 0,
        case_size: existingProduct.case_size || 1,
        moq: existingProduct.moq || 1,
        reorder_point: existingProduct.reorder_point || 0,
        reorder_qty: existingProduct.reorder_qty || 0,
        safety_stock: existingProduct.safety_stock || 0,
        is_active: existingProduct.is_active ?? true,
        image_url: existingProduct.image_url || null,
        business_id: existingProduct.business_id,
        vertical_id: existingProduct.vertical_id,
        brand_id: existingProduct.brand_id,
      });
    } else if (open && !isEditMode) {
      // Reset to defaults for new product
      setForm({
        name: '',
        sku: '',
        barcode: '',
        type: 'standard',
        category: '',
        variant: '',
        description: '',
        unit_type: 'unit',
        cost: 0,
        wholesale_price: 0,
        suggested_retail_price: 0,
        case_size: 1,
        moq: 1,
        reorder_point: 0,
        reorder_qty: 0,
        safety_stock: 0,
        is_active: true,
        image_url: null,
        brand_id: null,
        business_id: null,
      });
    }
  }, [open, existingProduct, isEditMode]);

  const handleSubmit = async () => {
    try {
      if (isEditMode && productId) {
        await updateProduct.mutateAsync({ id: productId, ...form });
      } else {
        await createProduct.mutateAsync(form);
      }
      onClose();
    } catch (error) {
      // Error handled by hooks
    }
  };

  const handleDelete = async () => {
    if (!productId) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productId);
      
      if (error) throw error;
      toast.success('Product deleted');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

  const updateField = (field: keyof Product, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const generateSKU = () => {
    const prefix = form.name?.slice(0, 3).toUpperCase() || 'PRD';
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    updateField('sku', `${prefix}-${random}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Product' : 'Add New Product'}
          </DialogTitle>
        </DialogHeader>

        {isEditMode && isLoadingProduct ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {/* Image Upload */}
            <ImageUpload 
              value={form.image_url} 
              onChange={(url) => updateField('image_url', url)} 
            />

            {/* Basic Info Section */}
            <div className="space-y-1 pt-2">
              <h3 className="text-sm font-medium text-muted-foreground">Basic Information</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Grabba Leaf 2oz"
                />
              </div>
              <div className="space-y-2">
                <Label>SKU *</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.sku || ''}
                    onChange={(e) => updateField('sku', e.target.value)}
                    placeholder="GRB-2OZ-001"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={generateSKU}>
                    Auto
                  </Button>
                </div>
              </div>
            </div>

            {/* Business & Brand Assignment */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business</Label>
                <Select
                  value={form.business_id || 'none'}
                  onValueChange={(v) => updateField('business_id', v === 'none' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Business" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Business</SelectItem>
                    {businesses.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Brand</Label>
                <Select
                  value={form.brand_id || 'none'}
                  onValueChange={(v) => updateField('brand_id', v === 'none' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Brand</SelectItem>
                    {brands.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Barcode</Label>
                <Input
                  value={form.barcode || ''}
                  onChange={(e) => updateField('barcode', e.target.value)}
                  placeholder="123456789012"
                />
              </div>
              <div className="space-y-2">
                <Label>Variant (Size/Flavor)</Label>
                <Input
                  value={form.variant || ''}
                  onChange={(e) => updateField('variant', e.target.value)}
                  placeholder="2oz, Original, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={form.category || ''}
                  onChange={(e) => updateField('category', e.target.value)}
                  placeholder="Tobacco"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.is_active ? 'active' : 'inactive'}
                  onValueChange={(v) => updateField('is_active', v === 'active')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Product description..."
                rows={3}
              />
            </div>

            {/* Pricing & Units Section */}
            <div className="space-y-1 pt-2">
              <h3 className="text-sm font-medium text-muted-foreground">Pricing & Units</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Cost per Unit *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.cost || 0}
                  onChange={(e) => updateField('cost', parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Wholesale Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.wholesale_price || 0}
                  onChange={(e) => updateField('wholesale_price', parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Retail Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.suggested_retail_price || 0}
                  onChange={(e) => updateField('suggested_retail_price', parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type || 'standard'} onValueChange={(v) => updateField('type', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="bundle">Bundle</SelectItem>
                    <SelectItem value="variant">Variant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit of Measure</Label>
                <Select value={form.unit_type || 'unit'} onValueChange={(v) => updateField('unit_type', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unit">Unit</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="case">Case</SelectItem>
                    <SelectItem value="pack">Pack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Case Size</Label>
                <Input
                  type="number"
                  value={form.case_size || 1}
                  onChange={(e) => updateField('case_size', parseInt(e.target.value))}
                />
              </div>
            </div>

            {/* Inventory Rules Section */}
            <div className="space-y-1 pt-2">
              <h3 className="text-sm font-medium text-muted-foreground">Inventory Rules</h3>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Reorder Point</Label>
                <Input
                  type="number"
                  value={form.reorder_point || 0}
                  onChange={(e) => updateField('reorder_point', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Reorder Qty</Label>
                <Input
                  type="number"
                  value={form.reorder_qty || 0}
                  onChange={(e) => updateField('reorder_qty', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Safety Stock</Label>
                <Input
                  type="number"
                  value={form.safety_stock || 0}
                  onChange={(e) => updateField('safety_stock', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>MOQ (Supplier)</Label>
                <Input
                  type="number"
                  value={form.moq || 1}
                  onChange={(e) => updateField('moq', parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between gap-2 pt-4 border-t">
          <div>
            {isEditMode && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isDeleting}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Product?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will deactivate the product. It can be reactivated later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!form.name || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditMode ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                isEditMode ? 'Save Changes' : 'Create Product'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}