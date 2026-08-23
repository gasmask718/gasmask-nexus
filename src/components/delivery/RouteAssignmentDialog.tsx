import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Route, MapPin, Calendar, Search, Users, Plus, X, FileStack } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface BrandStopContext {
  store_id: string;
  brand_id?: string;
  order_ids?: string[];
}

interface RouteAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assigneeId: string;
  assigneeName: string;
  assigneeType: 'driver' | 'biker' | 'ambassador';
  assigneeUserId?: string | null;
  /** Enable bulk mode with multi-assignee / multi-date */
  bulkMode?: boolean;
  /** Pre-selected stores (e.g. from Floor 4 multi-brand board) */
  preselectedStores?: string[];
  /** Brand context per stop for multi-brand routes */
  brandStopContext?: BrandStopContext[];
  /** Brand IDs to tag on the route */
  brandIds?: string[];
  /** Pre-filled territory */
  prefilledTerritory?: string;
  /** Optional callback fired after routes are created successfully. Receives the created route IDs. */
  onAssigned?: (routeIds: string[]) => void;
}

type AssignablePerson = {
  id: string;          // row id in drivers/bikers/ambassadors
  name: string;
  userId: string | null;
  role: 'driver' | 'biker' | 'ambassador';
};

export const RouteAssignmentDialog: React.FC<RouteAssignmentDialogProps> = ({
  open,
  onOpenChange,
  assigneeId,
  assigneeName,
  assigneeType,
  assigneeUserId,
  bulkMode: initialBulkMode = false,
  preselectedStores,
  brandStopContext,
  brandIds,
  prefilledTerritory,
  onAssigned,
}) => {
  const queryClient = useQueryClient();
  const [isBulkMode, setIsBulkMode] = useState(initialBulkMode);
  const [routeDate, setRouteDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [bulkDates, setBulkDates] = useState<string[]>([format(new Date(), 'yyyy-MM-dd')]);
  const [territory, setTerritory] = useState(prefilledTerritory || '');
  const [notes, setNotes] = useState('');
  const [selectedStores, setSelectedStores] = useState<string[]>(preselectedStores || []);
  const [storeSearch, setStoreSearch] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<AssignablePerson[]>(
    assigneeId
      ? [{ id: assigneeId, name: assigneeName, userId: assigneeUserId ?? null, role: assigneeType }]
      : []
  );

  const [neighborhood, setNeighborhood] = useState<string>('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');

  // Re-sync preselected stores whenever the dialog is (re)opened with new preselections
  useEffect(() => {
    if (open && preselectedStores && preselectedStores.length > 0) {
      setSelectedStores(preselectedStores);
    }
  }, [open, preselectedStores]);

  // Fetch route templates
  const { data: templates = [] } = useQuery({
    queryKey: ['route-templates-active', assigneeType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_templates')
        .select('*, route_template_stops(id, store_id, default_order)')
        .eq('is_active', true)
        .eq('worker_type', assigneeType)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === 'none') return;
    const template = templates.find((t: any) => t.id === templateId);
    if (!template) return;
    const stops = (template.route_template_stops || [])
      .sort((a: any, b: any) => a.default_order - b.default_order)
      .map((s: any) => s.store_id);
    setSelectedStores(stops);
    if (template.default_territory) setTerritory(template.default_territory);
    toast.success(`Template "${template.name}" applied — ${stops.length} stops loaded`);
  };

  // Fetch available stores — excludes 'Closed permanently' relationship_status
  // (single source of truth: store_master.relationship_status).
  const { data: stores = [] } = useQuery({
    queryKey: ['stores-for-route', storeSearch],
    queryFn: async () => {
      const closed = await supabase
        .from('store_master')
        .select('id')
        .eq('relationship_status', 'Closed permanently')
        .is('deleted_at', null);
      const closedIds = (closed.data || []).map((r: any) => r.id);

      let query = supabase
        .from('stores')
        .select('id, name, address_street, address_city, boro')
        .is('deleted_at', null)
        .eq('approval_status', 'approved') // Phase 7: exclude pending captures
        .order('name')
        .limit(50);
      if (storeSearch) query = query.ilike('name', `%${storeSearch}%`);
      if (closedIds.length) query = query.not('id', 'in', `(${closedIds.join(',')})`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch ALL assignable people across all 3 roles (active + has user_id)
  const { data: assignablePeople = [] } = useQuery<AssignablePerson[]>({
    queryKey: ['assignable-people-all-roles'],
    queryFn: async () => {
      const [drv, bk, amb] = await Promise.all([
        supabase.from('drivers').select('id, full_name, user_id').eq('status', 'active').not('user_id', 'is', null).order('full_name'),
        supabase.from('bikers').select('id, full_name, user_id').eq('status', 'active').not('user_id', 'is', null).order('full_name'),
        supabase.from('ambassadors').select('id, name, user_id').eq('is_active', true).not('user_id', 'is', null).order('name'),
      ]);
      if (drv.error) throw drv.error;
      if (bk.error) throw bk.error;
      if (amb.error) throw amb.error;
      const drivers: AssignablePerson[] = (drv.data || []).map((r: any) => ({ id: r.id, name: r.full_name || 'Driver', userId: r.user_id, role: 'driver' }));
      const bikers: AssignablePerson[] = (bk.data || []).map((r: any) => ({ id: r.id, name: r.full_name || 'Biker', userId: r.user_id, role: 'biker' }));
      const ambs: AssignablePerson[] = (amb.data || []).map((r: any) => ({ id: r.id, name: (r.name || '').trim() || 'Ambassador', userId: r.user_id, role: 'ambassador' }));
      return [...drivers, ...bikers, ...ambs];
    },
    enabled: open,
  });

  // Distinct neighborhoods for the neighborhood loader
  const { data: neighborhoods = [] } = useQuery<string[]>({
    queryKey: ['stores-distinct-neighborhoods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('neighborhood')
        .is('deleted_at', null)
        .eq('approval_status', 'approved')
        .not('neighborhood', 'is', null)
        .limit(5000);
      if (error) throw error;
      const set = new Set<string>();
      (data || []).forEach((r: any) => { if (r.neighborhood) set.add(r.neighborhood); });
      return Array.from(set).sort();
    },
    enabled: open,
  });

  const loadNeighborhoodStores = async (nbh: string) => {
    setNeighborhood(nbh);
    if (!nbh) return;
    const { data, error } = await supabase
      .from('stores')
      .select('id')
      .is('deleted_at', null)
      .eq('approval_status', 'approved')
      .eq('neighborhood', nbh)
      .limit(500);
    if (error) { toast.error(error.message); return; }
    const ids = (data || []).map((s: any) => s.id);
    setSelectedStores((prev) => Array.from(new Set([...prev, ...ids])));
    toast.success(`Added ${ids.length} stores from ${nbh}`);
  };

  const toggleStore = (storeId: string) => {
    setSelectedStores((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const addBulkDate = () => {
    const lastDate = bulkDates[bulkDates.length - 1];
    const next = format(addDays(new Date(lastDate), 1), 'yyyy-MM-dd');
    setBulkDates((prev) => [...prev, next]);
  };

  const removeBulkDate = (index: number) => {
    if (bulkDates.length <= 1) return;
    setBulkDates((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleAssignee = (person: AssignablePerson) => {
    setSelectedAssignees((prev) => {
      const exists = prev.find((a) => a.id === person.id && a.role === person.role);
      if (exists) return prev.filter((a) => !(a.id === person.id && a.role === person.role));
      return [...prev, person];
    });
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['routes'] });
    queryClient.invalidateQueries({ queryKey: ['driver-routes'] });
    queryClient.invalidateQueries({ queryKey: ['biker-routes'] });
    queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
    queryClient.invalidateQueries({ queryKey: ['biker-profile'] });
    queryClient.invalidateQueries({ queryKey: ['driver-crm'] });
    queryClient.invalidateQueries({ queryKey: ['biker-crm'] });
    queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    queryClient.invalidateQueries({ queryKey: ['dispatch'] });
    queryClient.invalidateQueries({ queryKey: ['store-checks'] });
    queryClient.invalidateQueries({ queryKey: ['worker_payouts'] });
  };

  const createRouteMutation = useMutation({
    mutationFn: async () => {
      if (selectedStores.length === 0) throw new Error('Select at least one stop');

      const dates = isBulkMode ? bulkDates : [routeDate];
      const fallback: AssignablePerson | null = assigneeId
        ? { id: assigneeId, name: assigneeName, userId: assigneeUserId ?? null, role: assigneeType }
        : null;
      const assignees: AssignablePerson[] = isBulkMode
        ? selectedAssignees
        : (selectedAssignees[0] ? [selectedAssignees[0]] : (fallback ? [fallback] : []));

      if (assignees.length === 0) throw new Error('Select at least one assignee');

      const createdRouteIds: string[] = [];

      // One route per assignee per date
      for (const assignee of assignees) {
        for (const date of dates) {
          const assignedTo = assignee.userId || assignee.id;

          const { data: route, error: routeError } = await supabase
            .from('routes')
            .insert({
              type: assignee.role,
              assigned_to: assignedTo,
              date,
              status: 'pending',
              territory: territory || null,
              brand_ids: brandIds || [],
            })
            .select('id')
            .single();

          if (routeError) throw routeError;

          const stops = selectedStores.map((storeId, index) => {
            const brandCtx = brandStopContext?.find(b => b.store_id === storeId);
            return {
              route_id: route.id,
              store_id: storeId,
              planned_order: index + 1,
              status: 'pending',
              notes_to_worker: notes || null,
              brand_id: brandCtx?.brand_id || null,
              order_ids: brandCtx?.order_ids || [],
              opportunity_ids: (brandCtx as any)?.opportunity_ids || [],
            };
          });

          const { error: stopsError } = await supabase.from('route_stops').insert(stops);
          if (stopsError) throw stopsError;
          createdRouteIds.push(route.id);
        }
      }

      return createdRouteIds;
    },
    onSuccess: (routeIds) => {
      invalidateAll();
      const count = routeIds.length;
      toast.success(`${count} route${count > 1 ? 's' : ''} assigned successfully`);
      onAssigned?.(routeIds);
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create route(s)');
    },
  });

  const resetForm = () => {
    setSelectedStores(preselectedStores || []);
    setNotes('');
    setTerritory(prefilledTerritory || '');
    setStoreSearch('');
    setBulkDates([format(new Date(), 'yyyy-MM-dd')]);
    setSelectedAssignees(
      assigneeId
        ? [{ id: assigneeId, name: assigneeName, userId: assigneeUserId ?? null, role: assigneeType }]
        : []
    );
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            {isBulkMode ? 'Bulk Assign Routes' : 'Assign Route'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Bulk mode toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Bulk Assignment</span>
            </div>
            <Switch checked={isBulkMode} onCheckedChange={setIsBulkMode} />
          </div>

          {/* Unified assignee picker — all 3 roles */}
          <div className="space-y-2">
            <Label>
              Assignee{isBulkMode ? `s (${selectedAssignees.length} selected)` : ''}
            </Label>
            <div className="flex flex-wrap gap-1 mb-1">
              {selectedAssignees.map((a) => (
                <Badge key={`${a.role}-${a.id}`} variant="secondary" className="gap-1">
                  <span className="capitalize text-[10px] opacity-70">{a.role}</span>
                  {a.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedAssignees((prev) => prev.filter((x) => !(x.id === a.id && x.role === a.role)))}
                  />
                </Badge>
              ))}
            </div>
            <Input
              placeholder="Search by name or role (driver / biker / ambassador)..."
              value={assigneeSearch}
              onChange={(e) => setAssigneeSearch(e.target.value)}
            />
            <ScrollArea className="h-40 rounded-md border p-2">
              {assignablePeople
                .filter((p) => {
                  const q = assigneeSearch.trim().toLowerCase();
                  if (!q) return true;
                  return p.name.toLowerCase().includes(q) || p.role.includes(q);
                })
                .map((person) => {
                  const checked = !!selectedAssignees.find((a) => a.id === person.id && a.role === person.role);
                  return (
                    <div
                      key={`${person.role}-${person.id}`}
                      className="flex items-center gap-2 py-1.5 px-1 hover:bg-muted/50 rounded cursor-pointer"
                      onClick={() => {
                        if (isBulkMode) {
                          toggleAssignee(person);
                        } else {
                          setSelectedAssignees([person]);
                        }
                      }}
                    >
                      <Checkbox checked={checked} />
                      <span className="text-sm flex-1">{person.name}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{person.role}</Badge>
                    </div>
                  );
                })}
              {assignablePeople.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No active assignable people</p>
              )}
            </ScrollArea>
          </div>


          {/* Date(s) */}
          {!isBulkMode ? (
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Route Date</Label>
              <Input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Route Dates</Label>
              {bulkDates.map((date, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input type="date" value={date} onChange={(e) => setBulkDates((prev) => prev.map((d, j) => (j === i ? e.target.value : d)))} className="flex-1" />
                  {bulkDates.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeBulkDate(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addBulkDate} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Add Date
              </Button>
            </div>
          )}

          {/* Template selector */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><FileStack className="h-4 w-4" /> Load from Template</Label>
              <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No Template —</SelectItem>
                  {templates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.route_template_stops?.length || 0} stops)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Territory */}
          <div className="space-y-2">
            <Label>Territory (Optional)</Label>
            <Input placeholder="e.g. Brooklyn, Manhattan..." value={territory} onChange={(e) => setTerritory(e.target.value)} />
          </div>

          {/* Store selection */}
          <div className="space-y-2">
            <Label>Stops ({selectedStores.length} selected)</Label>

            {/* Neighborhood bulk-add */}
            <div className="flex items-center gap-2">
              <Select value={neighborhood || 'none'} onValueChange={(v) => loadNeighborhoodStores(v === 'none' ? '' : v)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Add all stores from a neighborhood..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Pick a neighborhood —</SelectItem>
                  {neighborhoods.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStores.length > 0 && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedStores([])}>
                  Clear
                </Button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search stores (individual / bulk multi-select)..." value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} className="pl-9" />
            </div>
            <ScrollArea className="h-48 rounded-md border p-2">
              {stores.map((store) => (
                <div key={store.id} className="flex items-center gap-2 py-1.5 px-1 hover:bg-muted/50 rounded cursor-pointer" onClick={() => toggleStore(store.id)}>
                  <Checkbox checked={selectedStores.includes(store.id)} onCheckedChange={() => toggleStore(store.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{store.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[store.address_street, store.address_city, store.boro].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              ))}
              {stores.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No stores found</p>}
            </ScrollArea>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes to Worker (Optional)</Label>
            <Textarea placeholder="Special instructions for this route..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {/* Summary for bulk */}
          {isBulkMode && selectedAssignees.length > 0 && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
              <p className="font-medium text-primary">
                Will create {selectedAssignees.length * bulkDates.length} route{selectedAssignees.length * bulkDates.length > 1 ? 's' : ''}
              </p>
              <p className="text-muted-foreground">
                {selectedAssignees.length} assignee{selectedAssignees.length > 1 ? 's' : ''} × {bulkDates.length} date{bulkDates.length > 1 ? 's' : ''} × {selectedStores.length} stop{selectedStores.length !== 1 ? 's' : ''} each
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button
              onClick={() => createRouteMutation.mutate()}
              disabled={selectedStores.length === 0 || createRouteMutation.isPending || (isBulkMode && selectedAssignees.length === 0)}
              className="flex-1"
            >
              {createRouteMutation.isPending ? 'Assigning...' : isBulkMode ? 'Assign All Routes' : 'Assign Route'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteAssignmentDialog;
