import React, { useState } from 'react';
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
import { toast } from 'sonner';
import { Route, MapPin, Calendar, Search } from 'lucide-react';
import { format } from 'date-fns';

interface RouteAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assigneeId: string;
  assigneeName: string;
  assigneeType: 'driver' | 'biker';
  assigneeUserId?: string | null;
}

export const RouteAssignmentDialog: React.FC<RouteAssignmentDialogProps> = ({
  open,
  onOpenChange,
  assigneeId,
  assigneeName,
  assigneeType,
  assigneeUserId,
}) => {
  const queryClient = useQueryClient();
  const [routeDate, setRouteDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [territory, setTerritory] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [storeSearch, setStoreSearch] = useState('');

  // Fetch available stores for stops
  const { data: stores = [] } = useQuery({
    queryKey: ['stores-for-route', storeSearch],
    queryFn: async () => {
      let query = supabase
        .from('stores')
        .select('id, name, address_street, address_city, boro')
        .is('deleted_at', null)
        .order('name')
        .limit(50);
      if (storeSearch) {
        query = query.ilike('name', `%${storeSearch}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const toggleStore = (storeId: string) => {
    setSelectedStores((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const createRouteMutation = useMutation({
    mutationFn: async () => {
      if (selectedStores.length === 0) throw new Error('Select at least one stop');

      // Use user_id for the FK to profiles, fallback to entity id
      const assignedTo = assigneeUserId || assigneeId;

      // Create the route
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .insert({
          type: assigneeType,
          assigned_to: assignedTo,
          date: routeDate,
          status: 'pending',
          territory: territory || null,
        })
        .select('id')
        .single();

      if (routeError) throw routeError;

      // Create route stops
      const stops = selectedStores.map((storeId, index) => ({
        route_id: route.id,
        store_id: storeId,
        planned_order: index + 1,
        status: 'pending',
        notes_to_worker: notes || null,
      }));

      const { error: stopsError } = await supabase.from('route_stops').insert(stops);
      if (stopsError) throw stopsError;
    },
    onSuccess: () => {
      // Invalidate all relevant queries
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

      toast.success(`Route assigned to ${assigneeName} for ${routeDate}`);
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create route');
    },
  });

  const resetForm = () => {
    setSelectedStores([]);
    setNotes('');
    setTerritory('');
    setStoreSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            Assign Route
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Assignee info */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{assigneeName}</p>
              <Badge variant="outline" className="text-xs capitalize">
                {assigneeType}
              </Badge>
            </div>
          </div>

          {/* Route date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Route Date
            </Label>
            <Input
              type="date"
              value={routeDate}
              onChange={(e) => setRouteDate(e.target.value)}
            />
          </div>

          {/* Territory */}
          <div className="space-y-2">
            <Label>Territory (Optional)</Label>
            <Input
              placeholder="e.g. Brooklyn, Manhattan..."
              value={territory}
              onChange={(e) => setTerritory(e.target.value)}
            />
          </div>

          {/* Store selection */}
          <div className="space-y-2">
            <Label>
              Stops ({selectedStores.length} selected)
            </Label>
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
                  <Checkbox
                    checked={selectedStores.includes(store.id)}
                    onCheckedChange={() => toggleStore(store.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{store.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[store.address_street, store.address_city, store.boro]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              ))}
              {stores.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No stores found
                </p>
              )}
            </ScrollArea>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes to Worker (Optional)</Label>
            <Textarea
              placeholder="Special instructions for this route..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createRouteMutation.mutate()}
              disabled={selectedStores.length === 0 || createRouteMutation.isPending}
              className="flex-1"
            >
              {createRouteMutation.isPending ? 'Assigning...' : 'Assign Route'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteAssignmentDialog;
