import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Truck, 
  CheckCircle, 
  Clock,
  MapPin,
  Package,
  User,
  Calendar,
  Send
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const statusColors: Record<string, string> = {
  pending: 'bg-orange-500/10 text-orange-500',
  sent: 'bg-blue-500/10 text-blue-500',
  in_progress: 'bg-purple-500/10 text-purple-500',
  completed: 'bg-green-500/10 text-green-500',
};

export default function DispatchPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: dispatches, isLoading } = useQuery({
    queryKey: ['dispatch-triggers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispatch_triggers')
        .select(`
          *,
          store:store_master(store_name, address),
          business:businesses(name),
          deal:deals(expected_value, items)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingOrders } = useQuery({
    queryKey: ['pending-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_orders')
        .select(`
          *,
          store:store_master(store_name, address),
          business:businesses(name),
          deal:deals(expected_value)
        `)
        .eq('status', 'ready_for_dispatch')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const markDispatchedMutation = useMutation({
    mutationFn: async (dispatchId: string) => {
      const { error } = await supabase
        .from('dispatch_triggers')
        .update({ status: 'sent', last_updated: new Date().toISOString() })
        .eq('id', dispatchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-triggers'] });
      queryClient.invalidateQueries({ queryKey: ['deal-stats'] });
      toast({
        title: 'Dispatch Sent',
        description: 'The order has been sent to the driver.',
      });
    },
  });

  const stats = {
    pending: dispatches?.filter(d => d.status === 'pending').length || 0,
    inProgress: dispatches?.filter(d => d.status === 'in_progress').length || 0,
    completed: dispatches?.filter(d => d.status === 'completed').length || 0,
    readyOrders: pendingOrders?.length || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.readyOrders}</p>
                <p className="text-xs text-muted-foreground">Ready Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Truck className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">In Transit</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ready for Dispatch */}
      {pendingOrders && pendingOrders.length > 0 && (
        <Card className="border-orange-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-500" />
              Ready for Dispatch
              <Badge variant="destructive">{pendingOrders.length}</Badge>
            </CardTitle>
            <CardDescription>
              Orders from won deals ready to be assigned to drivers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-4 p-4 border rounded-lg bg-orange-500/5">
                  <div className="flex-1">
                    <p className="font-medium">{order.store?.store_name}</p>
                    <p className="text-sm text-muted-foreground">{order.business?.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3 inline mr-1" />
                      {order.store?.address || 'Address not available'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${Number(order.total).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {(order.items as any[])?.length || 0} items
                    </p>
                  </div>
                  <Button>
                    <Send className="h-4 w-4 mr-2" />
                    Dispatch
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dispatch Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Dispatch Queue</CardTitle>
          <CardDescription>
            All dispatches and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatches?.map((dispatch) => {
                  const payload = dispatch.payload as any;
                  return (
                    <TableRow key={dispatch.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{dispatch.store?.store_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {dispatch.store?.address}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{dispatch.business?.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {dispatch.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${Number(dispatch.deal?.expected_value || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[dispatch.status] || statusColors.pending}>
                          {dispatch.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {dispatch.assigned_driver_id ? (
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>Assigned</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(dispatch.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {dispatch.status === 'pending' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => markDispatchedMutation.mutate(dispatch.id)}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {dispatch.status === 'in_progress' && (
                          <Button size="sm" variant="outline">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {(!dispatches || dispatches.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No dispatches found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
