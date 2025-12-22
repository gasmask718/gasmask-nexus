import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Phone, MapPin, FileText, MessageSquare } from 'lucide-react';
import { UpdateInventoryModal } from './UpdateInventoryModal';
import { CreateStoreInvoiceModal } from './CreateStoreInvoiceModal';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface StoreQuickActionsProps {
  storeId: string;
  storeName: string;
  storePhone?: string | null;
  onInventoryUpdated?: () => void;
  onInvoiceCreated?: (invoiceId: string) => void;
}

export function StoreQuickActions({
  storeId,
  storeName,
  storePhone,
  onInventoryUpdated,
  onInvoiceCreated,
}: StoreQuickActionsProps) {
  const navigate = useNavigate();
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [addingToRoute, setAddingToRoute] = useState(false);

  const handleCallStore = () => {
    if (storePhone) {
      // Open phone dialer
      window.location.href = `tel:${storePhone}`;
      toast.success(`Calling ${storeName}`);
    } else {
      toast.error('No phone number available for this store');
    }
  };

  const handleAddToRoute = async () => {
    setAddingToRoute(true);
    try {
      // Get today's route or create a new one
      const today = new Date().toISOString().split('T')[0];
      
      // Check for existing active route
      const { data: existingRoute } = await supabase
        .from('routes')
        .select('id')
        .eq('date', today)
        .eq('status', 'active')
        .single();

      let routeId = existingRoute?.id;

      if (!routeId) {
        // Create a new route for today
        const { data: newRoute, error } = await supabase
          .from('routes')
          .insert({
            date: today,
            type: 'delivery',
            status: 'active',
          })
          .select('id')
          .single();

        if (error) throw error;
        routeId = newRoute?.id;
      }

      // Get highest planned_order for this route
      const { data: lastStop } = await supabase
        .from('route_stops')
        .select('planned_order')
        .eq('route_id', routeId)
        .order('planned_order', { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (lastStop?.planned_order || 0) + 1;

      // Add store to route stops
      const { error: stopError } = await supabase
        .from('route_stops')
        .insert({
          route_id: routeId,
          store_id: storeId,
          planned_order: nextOrder,
          status: 'pending',
        });

      if (stopError) {
        // Check if already in route
        if (stopError.code === '23505') {
          toast.info('Store is already on today\'s route');
        } else {
          throw stopError;
        }
      } else {
        toast.success(`${storeName} added to today's route`);
      }
    } catch (error: any) {
      toast.error(`Failed to add to route: ${error.message}`);
    } finally {
      setAddingToRoute(false);
    }
  };

  const handleSendMessage = () => {
    if (storePhone) {
      window.location.href = `sms:${storePhone}`;
    } else {
      toast.error('No phone number available for this store');
    }
  };

  return (
    <>
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setInventoryModalOpen(true)}
          >
            <Package className="h-4 w-4 mr-2" />
            Update Inventory
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleCallStore}
          >
            <Phone className="h-4 w-4 mr-2" />
            Call Store
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleSendMessage}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Send Text
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleAddToRoute}
            disabled={addingToRoute}
          >
            <MapPin className="h-4 w-4 mr-2" />
            {addingToRoute ? 'Adding...' : 'Add to Route'}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setInvoiceModalOpen(true)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </CardContent>
      </Card>

      <UpdateInventoryModal
        open={inventoryModalOpen}
        onOpenChange={setInventoryModalOpen}
        storeId={storeId}
        storeName={storeName}
        onSuccess={onInventoryUpdated}
      />

      <CreateStoreInvoiceModal
        open={invoiceModalOpen}
        onOpenChange={setInvoiceModalOpen}
        storeId={storeId}
        storeName={storeName}
        onSuccess={onInvoiceCreated}
      />
    </>
  );
}
