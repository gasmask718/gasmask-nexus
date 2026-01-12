import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Package, Edit, Trash2, Loader2, Box, Layers, ShoppingBag, Circle, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface ProductConversion {
  id: string;
  brand: string;
  product_name: string;
  base_unit: string;
  unit_type: 'BOX' | 'HALF_BOX' | 'PACK' | 'SINGLE';
  base_units_per_unit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const UNIT_TYPES = [
  { value: 'BOX', label: 'Box', icon: Box },
  { value: 'HALF_BOX', label: 'Half Box', icon: Layers },
  { value: 'PACK', label: 'Pack', icon: Package },
  { value: 'SINGLE', label: 'Single Unit', icon: Circle },
] as const;

const BASE_UNITS = [
  { value: 'TUBE', label: 'Tube', icon: Package },
  { value: 'BAG', label: 'Bag', icon: ShoppingBag },
  { value: 'WRAP', label: 'Wrap', icon: FileText },
  { value: 'PIECE', label: 'Piece', icon: Circle },
] as const;

const DEFAULT_BRANDS = [
  'Grabba',
  'Gasmask',
  'GasmaskTubes',
  'GasmaskBags',
  'Fronto',
  'Hotscolatti',
  'HotMama',
  'Grabba R Us',
];

export function ProductConversionAdmin() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteConversion, setDeleteConversion] = useState<ProductConversion | null>(null);
  const [editConversion, setEditConversion] = useState<ProductConversion | null>(null);
  
  // Form state
  const [brand, setBrand] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [productName, setProductName] = useState('');
  const [baseUnit, setBaseUnit] = useState('TUBE');
  const [customBaseUnit, setCustomBaseUnit] = useState('');
  const [unitType, setUnitType] = useState<'BOX' | 'HALF_BOX' | 'PACK' | 'SINGLE'>('BOX');
  const [baseUnitsPerUnit, setBaseUnitsPerUnit] = useState('20');
  
  const { data: conversions = [], isLoading } = useQuery({
    queryKey: ['product-conversions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_conversions')
        .select('*')
        .order('brand', { ascending: true })
        .order('product_name', { ascending: true });
      
      if (error) throw error;
      return data as ProductConversion[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<ProductConversion, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('product_conversions')
        .insert([data]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conversion rule added');
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] });
      resetForm();
      setIsAddOpen(false);
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('This conversion rule already exists');
      } else {
        toast.error(`Failed to add: ${error.message}`);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<ProductConversion> & { id: string }) => {
      const { error } = await supabase
        .from('product_conversions')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conversion rule updated');
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] });
      setIsEditOpen(false);
      setEditConversion(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_conversions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conversion rule deleted');
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] });
      setDeleteConversion(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('product_conversions')
        .update({ is_active: isActive })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const resetForm = () => {
    setBrand('');
    setCustomBrand('');
    setProductName('');
    setBaseUnit('TUBE');
    setCustomBaseUnit('');
    setUnitType('BOX');
    setBaseUnitsPerUnit('20');
  };

  const getFinalBaseUnit = () => {
    return baseUnit === 'CUSTOM' ? customBaseUnit : baseUnit;
  };

  const handleAdd = () => {
    const finalBrand = brand === 'custom' ? customBrand : brand;
    const finalBaseUnit = getFinalBaseUnit();
    
    if (!finalBrand || !productName || !baseUnitsPerUnit || !finalBaseUnit) {
      toast.error('Please fill all required fields');
      return;
    }

    createMutation.mutate({
      brand: finalBrand,
      product_name: productName,
      base_unit: finalBaseUnit,
      unit_type: unitType,
      base_units_per_unit: parseFloat(baseUnitsPerUnit),
      is_active: true,
    });
  };

  const handleEdit = () => {
    if (!editConversion) return;
    
    updateMutation.mutate({
      id: editConversion.id,
      base_units_per_unit: editConversion.base_units_per_unit,
      is_active: editConversion.is_active,
    });
  };

  const openEdit = (conversion: ProductConversion) => {
    setEditConversion({ ...conversion });
    setIsEditOpen(true);
  };

  // Group conversions by brand
  const groupedConversions = conversions.reduce((acc, conv) => {
    if (!acc[conv.brand]) acc[conv.brand] = [];
    acc[conv.brand].push(conv);
    return acc;
  }, {} as Record<string, ProductConversion[]>);

  const getBaseUnitLabel = (unit: string) => {
    const found = BASE_UNITS.find(u => u.value === unit);
    return found ? found.label : unit;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Product Conversions
              </CardTitle>
              <CardDescription>
                Define unit conversion rules for each product. Each product has its own base unit (TUBE, BAG, WRAP, etc.)
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Conversion
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : conversions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No conversion rules defined</p>
              <p className="text-sm mt-1">Add your first product conversion rule to get started</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedConversions).map(([brandName, brandConversions]) => (
                <div key={brandName} className="space-y-2">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-primary" />
                    {brandName}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Base Unit</TableHead>
                        <TableHead>Unit Type</TableHead>
                        <TableHead className="text-right">Units/Type</TableHead>
                        <TableHead className="text-center">Active</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brandConversions.map((conv) => (
                        <TableRow key={conv.id} className={!conv.is_active ? 'opacity-50' : ''}>
                          <TableCell className="font-medium">{conv.product_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              {getBaseUnitLabel(conv.base_unit)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{conv.unit_type.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            1 {conv.unit_type.replace('_', ' ')} = {conv.base_units_per_unit} {getBaseUnitLabel(conv.base_unit)}s
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={conv.is_active}
                              onCheckedChange={(checked) => 
                                toggleActiveMutation.mutate({ id: conv.id, isActive: checked })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEdit(conv)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeleteConversion(conv)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Conversion Rule</DialogTitle>
            <DialogDescription>
              Define the base unit and conversion rates for a product
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Brand *</Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger>
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_BRANDS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Brand...</SelectItem>
                </SelectContent>
              </Select>
              {brand === 'custom' && (
                <Input
                  placeholder="Enter custom brand name"
                  value={customBrand}
                  onChange={(e) => setCustomBrand(e.target.value)}
                />
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input
                placeholder="e.g., Standard Tubes, Premium Bags"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Base Unit *</Label>
              <p className="text-xs text-muted-foreground mb-1">
                This is the smallest unit you count. Once saved, it cannot be changed.
              </p>
              <Select value={baseUnit} onValueChange={setBaseUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BASE_UNITS.map((bu) => (
                    <SelectItem key={bu.value} value={bu.value}>
                      <div className="flex items-center gap-2">
                        <bu.icon className="h-4 w-4" />
                        {bu.label}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="CUSTOM">Custom...</SelectItem>
                </SelectContent>
              </Select>
              {baseUnit === 'CUSTOM' && (
                <Input
                  placeholder="Enter custom base unit (e.g., ROLL, SHEET)"
                  value={customBaseUnit}
                  onChange={(e) => setCustomBaseUnit(e.target.value.toUpperCase())}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Unit Type</Label>
              <p className="text-xs text-muted-foreground mb-1">
                The larger packaging unit (e.g., a BOX contains multiple base units)
              </p>
              <Select value={unitType} onValueChange={(v) => setUnitType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_TYPES.map((ut) => (
                    <SelectItem key={ut.value} value={ut.value}>
                      <div className="flex items-center gap-2">
                        <ut.icon className="h-4 w-4" />
                        {ut.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Base Units Per {unitType.replace('_', ' ')} *</Label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="e.g., 20"
                value={baseUnitsPerUnit}
                onChange={(e) => setBaseUnitsPerUnit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                How many {getFinalBaseUnit() || 'base units'} equal 1 {unitType.toLowerCase().replace('_', ' ')}?
              </p>
            </div>

            {/* Preview */}
            <div className="p-3 rounded-lg bg-secondary/50 border">
              <p className="text-sm font-medium">Preview:</p>
              <p className="text-sm text-muted-foreground">
                1 {unitType.replace('_', ' ')} = {baseUnitsPerUnit || '?'} {getFinalBaseUnit() || '?'}(s)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Conversion Rule</DialogTitle>
            <DialogDescription>
              Update the conversion rate for {editConversion?.brand} - {editConversion?.product_name}
            </DialogDescription>
          </DialogHeader>
          {editConversion && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Brand:</span>
                    <span className="ml-2 font-medium">{editConversion.brand}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Product:</span>
                    <span className="ml-2 font-medium">{editConversion.product_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Base Unit:</span>
                    <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                      {getBaseUnitLabel(editConversion.base_unit)}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Unit Type:</span>
                    <span className="ml-2 font-medium">{editConversion.unit_type.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{getBaseUnitLabel(editConversion.base_unit)}s Per {editConversion.unit_type.replace('_', ' ')}</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={editConversion.base_units_per_unit}
                  onChange={(e) => setEditConversion({
                    ...editConversion,
                    base_units_per_unit: parseFloat(e.target.value) || 0,
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={editConversion.is_active}
                  onCheckedChange={(checked) => setEditConversion({
                    ...editConversion,
                    is_active: checked,
                  })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConversion} onOpenChange={() => setDeleteConversion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversion Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the conversion rule for{' '}
              <strong>{deleteConversion?.brand} - {deleteConversion?.product_name}</strong>?
              <span className="block mt-2 text-destructive">
                This may affect unit calculations for existing invoices.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConversion && deleteMutation.mutate(deleteConversion.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
