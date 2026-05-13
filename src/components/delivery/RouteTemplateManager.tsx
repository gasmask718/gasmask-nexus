import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  FileStack, Plus, Edit, Trash2, Search, MapPin, GripVertical,
  Truck, Bike, ToggleLeft, ToggleRight,
} from 'lucide-react';

interface RouteTemplate {
  id: string;
  name: string;
  description: string | null;
  worker_type: string;
  default_territory: string | null;
  is_active: boolean;
  created_at: string;
  route_template_stops?: { id: string; store_id: string; default_order: number }[];
}

export const RouteTemplateManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RouteTemplate | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workerType, setWorkerType] = useState<'driver' | 'biker'>('driver');
  const [territory, setTerritory] = useState('');
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [storeSearch, setStoreSearch] = useState('');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['route-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_templates')
        .select('*, route_template_stops(id, store_id, default_order)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RouteTemplate[];
    },
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores-for-template', storeSearch],
    queryFn: async () => {
      let query = supabase
        .from('stores')
        .select('id, name, address_street, address_city, boro')
        .is('deleted_at', null)
        .eq('approval_status', 'approved') // Phase 7: exclude pending captures
        .order('name')
        .limit(50);
      if (storeSearch) query = query.ilike('name', `%${storeSearch}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: dialogOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Template name is required');
      if (selectedStores.length === 0) throw new Error('Select at least one stop');

      if (editingTemplate) {
        // Update template
        const { error: updateError } = await supabase
          .from('route_templates')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            worker_type: workerType,
            default_territory: territory.trim() || null,
          })
          .eq('id', editingTemplate.id);
        if (updateError) throw updateError;

        // Replace stops
        const { error: deleteError } = await supabase
          .from('route_template_stops')
          .delete()
          .eq('template_id', editingTemplate.id);
        if (deleteError) throw deleteError;

        const stops = selectedStores.map((storeId, i) => ({
          template_id: editingTemplate.id,
          store_id: storeId,
          default_order: i + 1,
        }));
        const { error: insertError } = await supabase.from('route_template_stops').insert(stops);
        if (insertError) throw insertError;
      } else {
        // Create new
        const { data: template, error: createError } = await supabase
          .from('route_templates')
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            worker_type: workerType,
            default_territory: territory.trim() || null,
          })
          .select('id')
          .single();
        if (createError) throw createError;

        const stops = selectedStores.map((storeId, i) => ({
          template_id: template.id,
          store_id: storeId,
          default_order: i + 1,
        }));
        const { error: stopsError } = await supabase.from('route_template_stops').insert(stops);
        if (stopsError) throw stopsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-templates'] });
      toast.success(editingTemplate ? 'Template updated' : 'Template created');
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('route_templates')
        .update({ is_active: !is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-templates'] });
      toast.success('Template status updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('route_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-templates'] });
      toast.success('Template deleted');
    },
  });

  const openCreate = () => {
    setEditingTemplate(null);
    setName('');
    setDescription('');
    setWorkerType('driver');
    setTerritory('');
    setSelectedStores([]);
    setDialogOpen(true);
  };

  const openEdit = (template: RouteTemplate) => {
    setEditingTemplate(template);
    setName(template.name);
    setDescription(template.description || '');
    setWorkerType(template.worker_type as 'driver' | 'biker');
    setTerritory(template.default_territory || '');
    setSelectedStores(
      (template.route_template_stops || [])
        .sort((a, b) => a.default_order - b.default_order)
        .map((s) => s.store_id)
    );
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
  };

  const toggleStore = (id: string) => {
    setSelectedStores((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const filtered = templates.filter(
    (t) => filterType === 'all' || t.worker_type === filterType
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileStack className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Route Templates</h2>
          <Badge variant="secondary">{templates.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[130px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="driver">Driver</SelectItem>
              <SelectItem value="biker">Biker</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> New Template
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading templates...</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No route templates yet. Create one to accelerate dispatch.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <Card key={t.id} className={`p-4 space-y-3 ${!t.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{t.name}</h3>
                  <div className="flex gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-xs capitalize gap-1">
                      {t.worker_type === 'driver' ? <Truck className="h-3 w-3" /> : <Bike className="h-3 w-3" />}
                      {t.worker_type}
                    </Badge>
                    {t.default_territory && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <MapPin className="h-3 w-3" />
                        {t.default_territory}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {t.route_template_stops?.length || 0} stops
                    </Badge>
                  </div>
                </div>
                {!t.is_active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
              </div>

              {t.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
              )}

              <div className="flex gap-1.5 pt-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                  <Edit className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleActiveMutation.mutate({ id: t.id, is_active: t.is_active })}
                >
                  {t.is_active ? <ToggleRight className="h-3 w-3 mr-1" /> : <ToggleLeft className="h-3 w-3 mr-1" />}
                  {t.is_active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm('Delete this template? This will NOT affect existing routes.')) {
                      deleteMutation.mutate(t.id);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileStack className="h-5 w-5 text-primary" />
              {editingTemplate ? 'Edit Template' : 'Create Route Template'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                placeholder='e.g. "Flatbush Morning Biker Run"'
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional notes about this template..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Worker Type *</Label>
                <Select value={workerType} onValueChange={(v) => setWorkerType(v as 'driver' | 'biker')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="biker">Biker</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Territory</Label>
                <Input
                  placeholder="e.g. Brooklyn"
                  value={territory}
                  onChange={(e) => setTerritory(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Stops ({selectedStores.length} selected) *</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search stores..."
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-48 rounded-md border p-2">
                {stores.map((store) => (
                  <div
                    key={store.id}
                    className="flex items-center gap-2 py-1.5 px-1 hover:bg-muted/50 rounded cursor-pointer"
                    onClick={() => toggleStore(store.id)}
                  >
                    <Checkbox checked={selectedStores.includes(store.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{store.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[store.address_street, store.address_city, store.boro].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    {selectedStores.includes(store.id) && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        #{selectedStores.indexOf(store.id) + 1}
                      </Badge>
                    )}
                  </div>
                ))}
                {stores.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No stores found</p>
                )}
              </ScrollArea>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={closeDialog} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!name.trim() || selectedStores.length === 0 || saveMutation.isPending}
                className="flex-1"
              >
                {saveMutation.isPending
                  ? 'Saving...'
                  : editingTemplate
                  ? 'Update Template'
                  : 'Save Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RouteTemplateManager;
