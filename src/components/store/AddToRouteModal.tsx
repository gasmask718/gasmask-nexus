/**
 * @deprecated routes_generated is legacy as of 2026-05-09.
 * Use the canonical `routes` table instead.
 * This consumer is preserved for historical data access only.
 * Do not write new logic against routes_generated.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Navigation, Calendar, User, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface AddToRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName?: string;
}

export function AddToRouteModal({ open, onOpenChange, storeId, storeName }: AddToRouteModalProps) {
  const queryClient = useQueryClient();
  const [routeDate, setRouteDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [createNewRoute, setCreateNewRoute] = useState(false);
  const [driverId, setDriverId] = useState<string>('');

  // Fetch available drivers
  const { data: drivers } = useQuery({
    queryKey: ['available-drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role')
        .in('role', ['driver', 'biker', 'admin'])
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Fetch existing routes for the selected date
  const { data: existingRoutes } = useQuery({
    queryKey: ['routes-for-date', routeDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes_generated')
        .select(`
          id,
          date,
          status,
          driver:profiles!routes_generated_driver_id_fkey(id, name),
          stops
        `)
        .eq('date', routeDate)
        .in('status', ['pending', 'active', 'scheduled'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open && !createNewRoute,
  });

  // Check if store is already in any route for this date
  const isStoreInRoute = existingRoutes?.some(route => {
    if (Array.isArray(route.stops)) {
      return route.stops.includes(storeId);
    }
    return false;
  });

  // Add to existing route mutation
  const addToExistingRoute = useMutation({
    mutationFn: async (routeId: string) => {
      // Get the route
      const { data: route, error: routeError } = await supabase
        .from('routes_generated')
        .select('stops')
        .eq('id', routeId)
        .single();

      if (routeError) throw routeError;

      // Check if store is already in this route
      const stops = Array.isArray(route.stops) ? route.stops : [];
      if (stops.includes(storeId)) {
        throw new Error('Store is already in this route');
      }

      // Add store to stops array
      const updatedStops = [...stops, storeId];

      // Update route
      const { error: updateError } = await supabase
        .from('routes_generated')
        .update({ stops: updatedStops })
        .eq('id', routeId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success(`${storeName || 'Store'} added to route successfully`);
      queryClient.invalidateQueries({ queryKey: ['routes-for-date', routeDate] });
      queryClient.invalidateQueries({ queryKey: ['store-route-history', storeId] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Failed to add to route: ${error.message}`);
    },
  });

  // Create new route mutation
  const createNewRouteMutation = useMutation({
    mutationFn: async () => {
      if (!driverId) {
        throw new Error('Please select a driver');
      }

      // Create new route
      const { data: newRoute, error: routeError } = await supabase
        .from('routes_generated')
        .insert({
          date: routeDate,
          driver_id: driverId,
          stops: [storeId],
          status: 'pending',
        })
        .select('id')
        .single();

      if (routeError) throw routeError;
      return newRoute;
    },
    onSuccess: () => {
      toast.success(`New route created and ${storeName || 'store'} added successfully`);
      queryClient.invalidateQueries({ queryKey: ['routes-for-date', routeDate] });
      queryClient.invalidateQueries({ queryKey: ['store-route-history', storeId] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Failed to create route: ${error.message}`);
    },
  });

  const resetForm = () => {
    setRouteDate(format(new Date(), 'yyyy-MM-dd'));
    setSelectedRouteId('');
    setCreateNewRoute(false);
    setDriverId('');
  };

  const handleSubmit = () => {
    if (createNewRoute) {
      createNewRouteMutation.mutate();
    } else if (selectedRouteId) {
      addToExistingRoute.mutate(selectedRouteId);
    } else {
      toast.error('Please select a route or create a new one');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Add to Route
          </DialogTitle>
          <DialogDescription>
            Add {storeName || 'this store'} to an existing route or create a new one
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Route Date */}
          <div className="space-y-2">
            <Label htmlFor="route-date">Route Date</Label>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                id="route-date"
                type="date"
                value={routeDate}
                onChange={(e) => {
                  setRouteDate(e.target.value);
                  setSelectedRouteId('');
                }}
              />
            </div>
          </div>

          {/* Warning if store already in route */}
          {isStoreInRoute && !createNewRoute && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-600">
                ⚠️ This store is already in a route for this date
              </p>
            </div>
          )}

          {/* Toggle: Existing Route or New Route */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={!createNewRoute ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => {
                setCreateNewRoute(false);
                setSelectedRouteId('');
              }}
            >
              Select Existing Route
            </Button>
            <Button
              type="button"
              variant={createNewRoute ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => {
                setCreateNewRoute(true);
                setSelectedRouteId('');
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Route
            </Button>
          </div>

          {/* Existing Routes List */}
          {!createNewRoute && (
            <div className="space-y-2">
              <Label>Select Route</Label>
              {existingRoutes && existingRoutes.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                  {existingRoutes.map((route) => {
                    const stopsCount = Array.isArray(route.stops) ? route.stops.length : 0;
                    const isInThisRoute = Array.isArray(route.stops) && route.stops.includes(storeId);
                    
                    return (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => setSelectedRouteId(route.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedRouteId === route.id
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-secondary/50'
                        } ${isInThisRoute ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={isInThisRoute}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {(route.driver as any)?.name || 'Unassigned'}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {stopsCount} stop{stopsCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={route.status === 'active' ? 'default' : 'secondary'}>
                              {route.status}
                            </Badge>
                            {isInThisRoute && (
                              <Badge variant="outline" className="text-xs">
                                Already Added
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground border rounded-lg">
                  No routes found for this date. Create a new route instead.
                </div>
              )}
            </div>
          )}

          {/* Create New Route Form */}
          {createNewRoute && (
            <div className="space-y-2">
              <Label htmlFor="driver-select">Assign Driver</Label>
              <Select value={driverId} onValueChange={setDriverId}>
                <SelectTrigger id="driver-select">
                  <SelectValue placeholder="Select a driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers?.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name} ({driver.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!driverId && (
                <p className="text-xs text-muted-foreground">
                  Driver is required to create a new route
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              createNewRoute
                ? createNewRouteMutation.isPending || !driverId
                : addToExistingRoute.isPending || !selectedRouteId
            }
          >
            {createNewRoute
              ? createNewRouteMutation.isPending
                ? 'Creating...'
                : 'Create Route'
              : addToExistingRoute.isPending
              ? 'Adding...'
              : 'Add to Route'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

