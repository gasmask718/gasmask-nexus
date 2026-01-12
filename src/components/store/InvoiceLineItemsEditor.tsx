import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Package, Box, Layers } from 'lucide-react';

export interface LineItem {
  id?: string;
  brand: string;
  product_name: string;
  quantity: number;
  unit_type: 'BOX' | 'HALF_BOX' | 'TUBE';
  unit_price: number;
  total: number;
  tubes_equivalent?: number;
}

interface InvoiceLineItemsEditorProps {
  lineItems: LineItem[];
  onChange: (items: LineItem[]) => void;
  disabled?: boolean;
}

const UNIT_TYPES = [
  { value: 'BOX', label: 'Box', icon: Box },
  { value: 'HALF_BOX', label: 'Half Box', icon: Layers },
  { value: 'TUBE', label: 'Tube', icon: Package },
] as const;

const DEFAULT_BRANDS = [
  'Grabba',
  'Gasmask',
  'Fronto',
  'Hotscolatti',
  'HotMama',
  'GasmaskTubes',
];

export function InvoiceLineItemsEditor({ 
  lineItems, 
  onChange,
  disabled = false 
}: InvoiceLineItemsEditorProps) {
  // Fetch conversion rules for auto-calculation
  const { data: conversions = [] } = useQuery({
    queryKey: ['product-conversions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_conversions')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    },
  });

  const getConversionRate = (brand: string, productName: string, unitType: string): number => {
    const conversion = conversions.find(
      c => c.brand.toLowerCase() === brand.toLowerCase() &&
           c.product_name.toLowerCase() === productName.toLowerCase() &&
           c.unit_type === unitType
    );
    return conversion?.base_units_per_unit || (unitType === 'TUBE' || unitType === 'SINGLE' ? 1 : 1);
  };

  const calculateTubes = (item: LineItem): number => {
    const rate = getConversionRate(item.brand, item.product_name, item.unit_type);
    return item.quantity * rate;
  };

  const addLineItem = () => {
    const newItem: LineItem = {
      brand: DEFAULT_BRANDS[0],
      product_name: '',
      quantity: 1,
      unit_type: 'TUBE',
      unit_price: 0,
      total: 0,
    };
    onChange([...lineItems, newItem]);
  };

  const updateLineItem = (index: number, updates: Partial<LineItem>) => {
    const newItems = [...lineItems];
    const item = { ...newItems[index], ...updates };
    
    // Recalculate total
    item.total = item.quantity * item.unit_price;
    item.tubes_equivalent = calculateTubes(item);
    
    newItems[index] = item;
    onChange(newItems);
  };

  const removeLineItem = (index: number) => {
    const newItems = lineItems.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + item.total, 0);
  const totalTubes = lineItems.reduce((sum, item) => sum + (item.tubes_equivalent || calculateTubes(item)), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Line Items</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addLineItem}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      {lineItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No line items yet</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLineItem}
            disabled={disabled}
            className="mt-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add first item
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {lineItems.map((item, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border bg-secondary/20 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-muted-foreground">Item {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => removeLineItem(index)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Brand */}
                <div className="space-y-1">
                  <Label className="text-xs">Brand</Label>
                  <Select
                    value={item.brand}
                    onValueChange={(v) => updateLineItem(index, { brand: v })}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_BRANDS.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Product Name */}
                <div className="space-y-1">
                  <Label className="text-xs">Product</Label>
                  <Input
                    placeholder="Product name"
                    value={item.product_name}
                    onChange={(e) => updateLineItem(index, { product_name: e.target.value })}
                    disabled={disabled}
                    className="h-9"
                  />
                </div>

                {/* Quantity */}
                <div className="space-y-1">
                  <Label className="text-xs">Quantity</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                    disabled={disabled}
                    className="h-9"
                  />
                </div>

                {/* Unit Type */}
                <div className="space-y-1">
                  <Label className="text-xs">Unit</Label>
                  <Select
                    value={item.unit_type}
                    onValueChange={(v) => updateLineItem(index, { unit_type: v as any })}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPES.map((ut) => (
                        <SelectItem key={ut.value} value={ut.value}>
                          {ut.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Unit Price */}
                <div className="space-y-1">
                  <Label className="text-xs">Unit Price ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateLineItem(index, { unit_price: parseFloat(e.target.value) || 0 })}
                    disabled={disabled}
                    className="h-9"
                  />
                </div>

                {/* Line Total (calculated) */}
                <div className="space-y-1">
                  <Label className="text-xs">Total</Label>
                  <div className="h-9 px-3 flex items-center rounded-md border bg-muted/50 font-mono">
                    ${item.total.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Tubes Equivalent */}
              <div className="pt-2 border-t flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tubes Equivalent:</span>
                <span className="font-mono font-medium text-primary">
                  {calculateTubes(item).toLocaleString()} tubes
                </span>
              </div>
            </div>
          ))}

          {/* Totals */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">${totalAmount.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Tubes</p>
                <p className="text-2xl font-bold text-primary">{totalTubes.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
