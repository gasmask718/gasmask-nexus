import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Warehouse, MapPin, Clock, Edit, Plus, Trash2, Package, Activity, Box } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import WarehouseFormModal from '@/components/inventory/WarehouseFormModal';
import BinFormModal from '@/components/inventory/BinFormModal';

export default function WarehouseDetailPage() {
  const { warehouseId } = useParams<{ warehouseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [binModalOpen, setBinModalOpen] = useState(false);
  const [editingBinId, setEditingBinId] = useState<string | null>(null);

  const { data: warehouse, isLoading } = useQuery({
    queryKey: ['warehouse-detail', warehouseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('id', warehouseId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!warehouseId,
  });

  const { data: bins } = useQuery({
    queryKey: ['warehouse-bins', warehouseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('*')
        .eq('warehouse_id', warehouseId)
        .order('bin_code');
      if (error) throw error;
      return data || [];
    },
    enabled: !!warehouseId,
  });

  const deleteBin = useMutation({
    mutationFn: async (binId: string) => {
      const { error } = await supabase.from('warehouse_bins').delete().eq('id', binId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bins', warehouseId] });
      toast.success('Bin deleted');
    },
    onError: () => {
      toast.error('Failed to delete bin');
    },
  });

  const handleAddBin = () => {
    setEditingBinId(null);
    setBinModalOpen(true);
  };

  const handleEditBin = (binId: string) => {
    setEditingBinId(binId);
    setBinModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Loading warehouse...</p>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Warehouse not found</p>
        <Button variant="outline" onClick={() => navigate('/os/inventory/warehouses')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Warehouses
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/os/inventory/warehouses')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Warehouse className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  {warehouse.name}
                  <Badge variant="outline">{warehouse.code}</Badge>
                </h1>
                <p className="text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {warehouse.city && warehouse.state 
                    ? `${warehouse.city}, ${warehouse.state}` 
                    : 'Location not set'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={warehouse.is_active ? 'default' : 'secondary'}>
              {warehouse.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <Button variant="outline" onClick={() => setEditModalOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{warehouse.capacity || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground">Capacity (units)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Box className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{bins?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Bins</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium truncate">
                    {warehouse.timezone || 'Not set'}
                  </p>
                  <p className="text-xs text-muted-foreground">Timezone</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Activity className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">{warehouse.type || 'central'}</p>
                  <p className="text-xs text-muted-foreground">Type</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="stock">Stock</TabsTrigger>
            <TabsTrigger value="bins">Bins</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Warehouse Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">
                      {warehouse.address_line1 || 'Not set'}
                      {warehouse.address_line2 && <><br />{warehouse.address_line2}</>}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">City, State, ZIP</p>
                    <p className="font-medium">
                      {warehouse.city || 'N/A'}, {warehouse.state || 'N/A'} {warehouse.zip || ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Country</p>
                    <p className="font-medium">{warehouse.country || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contact Phone</p>
                    <p className="font-medium">{warehouse.contact_phone || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stock">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Stock</CardTitle>
                <CardDescription>Per-product warehouse inventory will be displayed here in Inventory Levels V2.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Stock levels coming in V2</p>
                  {/* TODO (Inventory Levels V2):
                    - fetchInventoryLevelsByWarehouse(warehouseId)
                    - show SKUs, on_hand, reserved, available
                    - add filter/search by product */}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bins">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Bins</CardTitle>
                  <CardDescription>Storage locations within this warehouse</CardDescription>
                </div>
                <Button size="sm" onClick={handleAddBin}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bin
                </Button>
              </CardHeader>
              <CardContent>
                {bins?.length === 0 ? (
                  <div className="text-center py-12">
                    <Box className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No bins configured yet.</p>
                    <Button variant="outline" className="mt-4" onClick={handleAddBin}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Bin
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bin Code</TableHead>
                        <TableHead>Aisle</TableHead>
                        <TableHead>Shelf</TableHead>
                        <TableHead>Max Weight</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bins?.map((bin) => (
                        <TableRow key={bin.id}>
                          <TableCell className="font-medium">{bin.bin_code}</TableCell>
                          <TableCell>{bin.aisle || '-'}</TableCell>
                          <TableCell>{bin.shelf || '-'}</TableCell>
                          <TableCell>{bin.max_weight ? `${bin.max_weight} lbs` : '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{bin.description || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEditBin(bin.id)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => deleteBin.mutate(bin.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {/* TODO (Bin-level Tracking V3):
                  - link inventory_levels to specific bins
                  - allow bin-to-bin transfers */}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
                <CardDescription>Inventory movements and receiving logs will appear here in Inventory Movements V2.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Activity log coming in V2</p>
                  {/* TODO (Movements V2):
                    - fetchWarehouseMovements(warehouseId)
                    - show recent inbound/outbound/transfer logs */}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <WarehouseFormModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        warehouseId={warehouseId}
      />

      <BinFormModal
        open={binModalOpen}
        onClose={() => setBinModalOpen(false)}
        warehouseId={warehouseId!}
        binId={editingBinId}
      />
    </div>
  );
}
