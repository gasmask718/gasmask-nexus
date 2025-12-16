import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { ImageUpload } from '@/components/inventory/ImageUpload';
import { 
  Loader2, 
  Package, 
  DollarSign, 
  Boxes, 
  Store, 
  FileText, 
  Brain, 
  Shield,
  Sparkles,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';

interface ProductFormSheetProps {
  open: boolean;
  onClose: () => void;
  productId?: string;
  onSuccess?: () => void;
}

const BRANDS = [
  'Grabba R Us',
  'Hot Mama Grabba', 
  'Gas Mask',
  'Hot Scalati'
];

const CATEGORIES = [
  'Grabba Leaf',
  'Tubes',
  'Bags',
  'Boxes',
  'Merch',
  'Accessories'
];

const PRODUCT_TYPES = ['Unit', 'Pack', 'Box', 'Bundle'];
const UNIT_TYPES = ['Tube', 'Bag', 'Box', 'Item'];
const STATUSES = ['active', 'paused', 'discontinued'];
const STORE_TYPES = ['Smoke Shop', 'Convenience Store', 'Gas Station', 'Bodega', 'Distributor'];

interface ProductForm {
  name: string;
  brand_id: string | null;
  category: string;
  type: string;
  sku: string;
  status: string;
  // Pricing
  suggested_retail_price: number;
  wholesale_price: number;
  cost: number;
  min_order_qty: number;
  bulk_discount_rules: any[];
  taxable: boolean;
  // Inventory
  unit_type: string;
  units_per_box: number;
  units_per_pack: number;
  track_inventory: boolean;
  low_stock_threshold: number;
  // Sales Channels
  available_to_stores: boolean;
  available_to_wholesalers: boolean;
  available_to_ambassadors: boolean;
  available_direct: boolean;
  available_for_promotions: boolean;
  // Descriptions
  short_description: string;
  description: string;
  strength_level: string;
  flavor_notes: string;
  image_url: string | null;
  documents: string[];
  // AI
  suggested_upsell_product_id: string | null;
  suggested_crosssell_product_id: string | null;
  target_store_type: string;
  ai_notes: string;
  // Compliance
  age_restricted: boolean;
  requires_license: boolean;
  internal_notes: string;
}

const defaultForm: ProductForm = {
  name: '',
  brand_id: null,
  category: '',
  type: 'Unit',
  sku: '',
  status: 'active',
  suggested_retail_price: 0,
  wholesale_price: 0,
  cost: 0,
  min_order_qty: 1,
  bulk_discount_rules: [],
  taxable: true,
  unit_type: 'Item',
  units_per_box: 1,
  units_per_pack: 1,
  track_inventory: true,
  low_stock_threshold: 10,
  available_to_stores: true,
  available_to_wholesalers: true,
  available_to_ambassadors: false,
  available_direct: false,
  available_for_promotions: true,
  short_description: '',
  description: '',
  strength_level: '',
  flavor_notes: '',
  image_url: null,
  documents: [],
  suggested_upsell_product_id: null,
  suggested_crosssell_product_id: null,
  target_store_type: '',
  ai_notes: '',
  age_restricted: true,
  requires_license: true,
  internal_notes: '',
};

export function ProductFormSheet({ open, onClose, productId, onSuccess }: ProductFormSheetProps) {
  const [form, setForm] = useState<ProductForm>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!productId;

  // Fetch brands
  const { data: brands = [] } = useQuery({
    queryKey: ['brands-list'],
    queryFn: async () => {
      const { data } = await supabase.from('brands').select('id, name').order('name');
      return data || [];
    },
  });

  // Fetch existing products for AI suggestions
  const { data: existingProducts = [] } = useQuery({
    queryKey: ['products-for-suggestions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  // Fetch product if editing
  const { data: existingProduct, isLoading } = useQuery({
    queryKey: ['product-edit', productId],
    queryFn: async () => {
      if (!productId) return null;
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  // Populate form when editing
  useEffect(() => {
    if (existingProduct && isEditMode) {
      setForm({
        name: existingProduct.name || '',
        brand_id: existingProduct.brand_id || null,
        category: existingProduct.category || '',
        type: existingProduct.type || 'Unit',
        sku: existingProduct.sku || '',
        status: existingProduct.status || 'active',
        suggested_retail_price: existingProduct.suggested_retail_price || 0,
        wholesale_price: existingProduct.wholesale_price || 0,
        cost: existingProduct.cost || 0,
        min_order_qty: existingProduct.min_order_qty || 1,
        bulk_discount_rules: Array.isArray(existingProduct.bulk_discount_rules) 
          ? existingProduct.bulk_discount_rules 
          : [],
        taxable: existingProduct.taxable ?? true,
        unit_type: existingProduct.unit_type || 'Item',
        units_per_box: existingProduct.units_per_box || 1,
        units_per_pack: existingProduct.units_per_pack || 1,
        track_inventory: existingProduct.track_inventory ?? true,
        low_stock_threshold: existingProduct.low_stock_threshold || 10,
        available_to_stores: existingProduct.available_to_stores ?? true,
        available_to_wholesalers: existingProduct.available_to_wholesalers ?? true,
        available_to_ambassadors: existingProduct.available_to_ambassadors ?? false,
        available_direct: existingProduct.available_direct ?? false,
        available_for_promotions: existingProduct.available_for_promotions ?? true,
        short_description: existingProduct.short_description || '',
        description: existingProduct.description || '',
        strength_level: existingProduct.strength_level || '',
        flavor_notes: existingProduct.flavor_notes || '',
        image_url: existingProduct.image_url || null,
        documents: existingProduct.documents || [],
        suggested_upsell_product_id: existingProduct.suggested_upsell_product_id || null,
        suggested_crosssell_product_id: existingProduct.suggested_crosssell_product_id || null,
        target_store_type: existingProduct.target_store_type || '',
        ai_notes: existingProduct.ai_notes || '',
        age_restricted: existingProduct.age_restricted ?? true,
        requires_license: existingProduct.requires_license ?? true,
        internal_notes: existingProduct.internal_notes || '',
      });
    } else if (!isEditMode && open) {
      setForm(defaultForm);
    }
  }, [existingProduct, isEditMode, open]);

  const profitPerUnit = useMemo(() => {
    return (form.wholesale_price || 0) - (form.cost || 0);
  }, [form.wholesale_price, form.cost]);

  const updateField = <K extends keyof ProductForm>(field: K, value: ProductForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const generateSKU = () => {
    const brandPrefix = form.brand_id 
      ? brands.find(b => b.id === form.brand_id)?.name?.slice(0, 2).toUpperCase() || 'XX'
      : 'XX';
    const catPrefix = form.category?.slice(0, 2).toUpperCase() || 'XX';
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    updateField('sku', `${brandPrefix}-${catPrefix}-${random}`);
  };

  const handleSubmit = async () => {
    if (!form.name) {
      toast.error('Product name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        is_active: form.status === 'active',
      };

      if (isEditMode && productId) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', productId);
        if (error) throw error;
        toast.success('Product updated successfully');
      } else {
        const { error } = await supabase
          .from('products')
          .insert(payload);
        if (error) throw error;
        toast.success('Product created successfully');
      }

      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {isEditMode ? 'Edit Product' : 'Create New Product'}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              <Accordion type="multiple" defaultValue={['core', 'pricing', 'inventory']} className="space-y-4">
                {/* SECTION 1: Core Product Info */}
                <AccordionItem value="core" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Core Product Info</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-2">
                        <Label>Product Name *</Label>
                        <Input
                          value={form.name}
                          onChange={(e) => updateField('name', e.target.value)}
                          placeholder="e.g. Grabba Leaf Premium 2oz"
                        />
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

                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={form.category || 'none'}
                          onValueChange={(v) => updateField('category', v === 'none' ? '' : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Category</SelectItem>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Product Type</Label>
                        <Select
                          value={form.type}
                          onValueChange={(v) => updateField('type', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>SKU</Label>
                        <div className="flex gap-2">
                          <Input
                            value={form.sku}
                            onChange={(e) => updateField('sku', e.target.value)}
                            placeholder="GRB-LF-A1B2"
                            className="flex-1"
                          />
                          <Button type="button" variant="outline" size="sm" onClick={generateSKU}>
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={form.status}
                          onValueChange={(v) => updateField('status', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* SECTION 2: Pricing */}
                <AccordionItem value="pricing" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <span className="font-semibold">Pricing</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Retail Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.suggested_retail_price}
                          onChange={(e) => updateField('suggested_retail_price', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Wholesale Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.wholesale_price}
                          onChange={(e) => updateField('wholesale_price', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cost Per Unit</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.cost}
                          onChange={(e) => updateField('cost', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Profit Per Unit</span>
                        <span className={`font-bold ${profitPerUnit >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                          ${profitPerUnit.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Minimum Order Quantity</Label>
                        <Input
                          type="number"
                          value={form.min_order_qty}
                          onChange={(e) => updateField('min_order_qty', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <Label className="cursor-pointer">Taxable</Label>
                        <Switch
                          checked={form.taxable}
                          onCheckedChange={(v) => updateField('taxable', v)}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* SECTION 3: Inventory & Counting */}
                <AccordionItem value="inventory" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Boxes className="h-4 w-4 text-blue-500" />
                      <span className="font-semibold">Inventory & Counting</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Unit Type</Label>
                        <Select
                          value={form.unit_type}
                          onValueChange={(v) => updateField('unit_type', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Units Per Box</Label>
                        <Input
                          type="number"
                          value={form.units_per_box}
                          onChange={(e) => updateField('units_per_box', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Units Per Pack</Label>
                        <Input
                          type="number"
                          value={form.units_per_pack}
                          onChange={(e) => updateField('units_per_pack', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Low Stock Alert Threshold</Label>
                        <Input
                          type="number"
                          value={form.low_stock_threshold}
                          onChange={(e) => updateField('low_stock_threshold', parseInt(e.target.value) || 10)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <Label className="cursor-pointer">Track Inventory</Label>
                      <Switch
                        checked={form.track_inventory}
                        onCheckedChange={(v) => updateField('track_inventory', v)}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* SECTION 4: Sales Channels */}
                <AccordionItem value="channels" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-purple-500" />
                      <span className="font-semibold">Sales Channels</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-3">
                    {[
                      { key: 'available_to_stores', label: 'Available to Stores' },
                      { key: 'available_to_wholesalers', label: 'Available to Wholesalers' },
                      { key: 'available_to_ambassadors', label: 'Available to Ambassadors' },
                      { key: 'available_direct', label: 'Available Direct-to-Customer' },
                      { key: 'available_for_promotions', label: 'Available for Promotions' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                        <Label className="cursor-pointer">{label}</Label>
                        <Switch
                          checked={form[key as keyof ProductForm] as boolean}
                          onCheckedChange={(v) => updateField(key as keyof ProductForm, v as any)}
                        />
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>

                {/* SECTION 5: Descriptions & Media */}
                <AccordionItem value="media" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-orange-500" />
                      <span className="font-semibold">Descriptions & Media</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                    <ImageUpload
                      value={form.image_url}
                      onChange={(url) => updateField('image_url', url)}
                    />

                    <div className="space-y-2">
                      <Label>Short Description</Label>
                      <Input
                        value={form.short_description}
                        onChange={(e) => updateField('short_description', e.target.value)}
                        placeholder="Brief product summary"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Long Description</Label>
                      <Textarea
                        value={form.description}
                        onChange={(e) => updateField('description', e.target.value)}
                        placeholder="Detailed product description..."
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Strength Level</Label>
                        <Input
                          value={form.strength_level}
                          onChange={(e) => updateField('strength_level', e.target.value)}
                          placeholder="e.g. Mild, Medium, Strong"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Flavor Notes</Label>
                        <Input
                          value={form.flavor_notes}
                          onChange={(e) => updateField('flavor_notes', e.target.value)}
                          placeholder="e.g. Earthy, Sweet, Robust"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* SECTION 6: AI Intelligence */}
                <AccordionItem value="ai" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-cyan-500" />
                      <span className="font-semibold">AI Intelligence</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Suggested Upsell Product</Label>
                        <Select
                          value={form.suggested_upsell_product_id || 'none'}
                          onValueChange={(v) => updateField('suggested_upsell_product_id', v === 'none' ? null : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Product" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {existingProducts.filter(p => p.id !== productId).map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Suggested Cross-Sell Product</Label>
                        <Select
                          value={form.suggested_crosssell_product_id || 'none'}
                          onValueChange={(v) => updateField('suggested_crosssell_product_id', v === 'none' ? null : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Product" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {existingProducts.filter(p => p.id !== productId).map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Target Store Type</Label>
                      <Select
                        value={form.target_store_type || 'none'}
                        onValueChange={(v) => updateField('target_store_type', v === 'none' ? '' : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Store Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Any Store Type</SelectItem>
                          {STORE_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>AI Notes (Read-Only)</Label>
                      <Textarea
                        value={form.ai_notes}
                        readOnly
                        className="bg-muted/50"
                        placeholder="AI-generated insights will appear here..."
                        rows={3}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* SECTION 7: Compliance */}
                <AccordionItem value="compliance" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-500" />
                      <span className="font-semibold">Compliance</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <Label className="cursor-pointer">Age Restricted (21+)</Label>
                        <Switch
                          checked={form.age_restricted}
                          onCheckedChange={(v) => updateField('age_restricted', v)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <Label className="cursor-pointer">Requires License</Label>
                        <Switch
                          checked={form.requires_license}
                          onCheckedChange={(v) => updateField('requires_license', v)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Internal Notes</Label>
                      <Textarea
                        value={form.internal_notes}
                        onChange={(e) => updateField('internal_notes', e.target.value)}
                        placeholder="Private notes for internal use..."
                        rows={3}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </ScrollArea>
        )}

        <div className="border-t p-4 flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditMode ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
