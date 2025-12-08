import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Warehouse, Plus, Search, MapPin, Building2, Eye, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import WarehouseFormModal from '@/components/inventory/WarehouseFormModal';

export default function WarehousesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: warehouses, isLoading, error } = useQuery({
    queryKey: ['warehouses-list', search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('warehouses')
        .select('*')
        .order('name');

      if (statusFilter === 'active') {
        query = query.eq('is_active', true);
      } else if (statusFilter === 'inactive') {
        query = query.eq('is_active', false);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,city.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    setEditingId(id);
    setModalOpen(true);
  };

  const handleViewDetail = (id: string) => {
    navigate(`/os/inventory/warehouses/${id}`);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Warehouse className="h-8 w-8 text-primary" />
              Warehouses
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage physical locations where inventory is stored.
            </p>
          </div>
          <Button onClick={handleOpenAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Warehouse
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, code, or city..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Warehouse Locations</CardTitle>
            <CardDescription>
              {warehouses?.length || 0} warehouse{warehouses?.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading warehouses...</div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                Error loading warehouses. Please try again.
              </div>
            ) : warehouses?.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No warehouses yet.</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Click "Add Warehouse" to create your first location.
                </p>
                <Button onClick={handleOpenAdd} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Warehouse
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses?.map((wh) => (
                    <TableRow key={wh.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Warehouse className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{wh.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Code: {wh.code}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {wh.city && wh.state ? `${wh.city}, ${wh.state}` : 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{wh.type || 'central'}</Badge>
                      </TableCell>
                      <TableCell>
                        {wh.capacity ? `${wh.capacity.toLocaleString()} units` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={wh.is_active ? 'default' : 'secondary'}>
                          {wh.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewDetail(wh.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleOpenEdit(wh.id)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <WarehouseFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        warehouseId={editingId}
      />
    </div>
  );
}
