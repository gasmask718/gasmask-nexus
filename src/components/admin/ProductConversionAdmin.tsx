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
import { Plus, Package, Edit, Trash2, Loader2, Box, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface ProductConversion {
  id: string;
  brand: string;
  product_name: string;
  unit_type: 'BOX' | 'HALF_BOX' | 'TUBE';
  tubes_per_unit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  const [unitType, setUnitType] = useState<'BOX' | 'HALF_BOX' | 'TUBE'>('BOX');
  const [tubesPerUnit, setTubesPerUnit] = useState('20');
  
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
    setUnitType('BOX');
    setTubesPerUnit('20');
  };

  const handleAdd = () => {
    const finalBrand = brand === 'custom' ? customBrand : brand;
    if (!finalBrand || !productName || !tubesPerUnit) {
      toast.error('Please fill all required fields');
      return;
    }

    createMutation.mutate({
      brand: finalBrand,
      product_name: productName,
      unit_type: unitType,
      tubes_per_unit: parseFloat(tubesPerUnit),
      is_active: true,
    });
  };

  const handleEdit = () => {
    if (!editConversion) return;
    
    updateMutation.mutate({
      id: editConversion.id,
      tubes_per_unit: editConversion.tubes_per_unit,
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
                Define how BOX, HALF_BOX, and TUBE units convert to base tubes
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
                        <TableHead>Unit Type</TableHead>
                        <TableHead className="text-right">Tubes/Unit</TableHead>
                        <TableHead className="text-center">Active</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brandConversions.map((conv) => (
                        <TableRow key={conv.id} className={!conv.is_active ? 'opacity-50' : ''}>
                          <TableCell className="font-medium">{conv.product_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{conv.unit_type.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {conv.tubes_per_unit}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Conversion Rule</DialogTitle>
            <DialogDescription>
              Define how many tubes equal one unit for a specific product
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Brand</Label>
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
              <Label>Product Name</Label>
              <Input
                placeholder="e.g., Standard Tube, Premium Box"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Unit Type</Label>
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
              <Label>Tubes Per Unit</Label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="e.g., 20"
                value={tubesPerUnit}
                onChange={(e) => setTubesPerUnit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                How many individual tubes equal 1 {unitType.toLowerCase().replace('_', ' ')}?
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
                    <span className="text-muted-foreground">Unit Type:</span>
                    <span className="ml-2 font-medium">{editConversion.unit_type.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tubes Per Unit</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={editConversion.tubes_per_unit}
                  onChange={(e) => setEditConversion({
                    ...editConversion,
                    tubes_per_unit: parseFloat(e.target.value) || 0,
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
                This may affect tube calculations for existing invoices.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConversion && deleteMutation.mutate(deleteConversion.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
