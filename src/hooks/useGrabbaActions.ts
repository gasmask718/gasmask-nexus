// Universal Action Hooks for Grabba Skyscraper
// Centralizes all common CRUD operations and actions across floors

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useGrabbaPermissions } from '@/hooks/useGrabbaPermissions';
import { useActivityLogger } from '@/hooks/useActivityFeed';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ActionType = 
  | 'create_order' | 'create_invoice' | 'add_count' | 'add_note' 
  | 'assign_ambassador' | 'edit_company' | 'edit_store'
  | 'send_text' | 'send_email' | 'place_call' | 'create_template'
  | 'add_inventory' | 'adjust_inventory' | 'transfer_inventory'
  | 'create_delivery' | 'assign_driver' | 'add_to_route' | 'mark_delivered'
  | 'create_batch' | 'log_service' | 'add_tool'
  | 'upload_product' | 'create_wholesale_order'
  | 'add_ambassador' | 'assign_region' | 'assign_stores' | 'adjust_payout'
  | 'queue_ai_task' | 'run_prediction' | 'send_to_route';

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useGrabbaActions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const grabbaPermissions = useGrabbaPermissions();
  const { role, crmPermissions, inventoryPermissions, deliveryPermissions } = grabbaPermissions;
  const { logActivity } = useActivityLogger();
  
  // Modal states
  const [activeModal, setActiveModal] = useState<ActionType | null>(null);
  const [selectedEntities, setSelectedEntities] = useState<any[]>([]);
  const [modalData, setModalData] = useState<any>(null);

  // Permission helpers
  const canCreate = (module: string) => {
    const perms = grabbaPermissions[`${module}Permissions` as keyof typeof grabbaPermissions];
    return (perms as any)?.canCreate ?? false;
  };
  const canUpdate = (module: string) => {
    const perms = grabbaPermissions[`${module}Permissions` as keyof typeof grabbaPermissions];
    return (perms as any)?.canUpdate ?? false;
  };
  const canDelete = (module: string) => {
    const perms = grabbaPermissions[`${module}Permissions` as keyof typeof grabbaPermissions];
    return (perms as any)?.canDelete ?? false;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CRM ACTIONS (Floor 1)
  // ─────────────────────────────────────────────────────────────────────────────
  
  const createOrder = useMutation({
    mutationFn: async (data: { store_id?: string; company_id?: string; brand: string; tubes_total: number; boxes?: number }) => {
      const { data: result, error } = await supabase
        .from('wholesale_orders')
        .insert({ 
          store_id: data.store_id,
          company_id: data.company_id,
          brand: data.brand,
          tubes_total: data.tubes_total,
          boxes: data.boxes,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['grabba-finance-orders'] });
      logActivity('new_order', { brand: result?.brand as any, entityId: result?.id });
      toast.success('Order created successfully');
      closeModal();
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const createInvoice = useMutation({
    mutationFn: async (data: { company_id: string; brand: string; total_amount: number; due_date?: string }) => {
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      const { data: result, error } = await supabase
        .from('invoices')
        .insert({ 
          company_id: data.company_id,
          brand: data.brand,
          total_amount: data.total_amount,
          due_date: data.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          payment_status: 'unpaid',
        } as any)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['grabba-finance-invoices'] });
      logActivity('invoice_created', { brand: result?.brand as any, entityId: result?.id });
      toast.success('Invoice created');
      closeModal();
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const addNote = useMutation({
    mutationFn: async (data: { entity_type: string; entity_id: string; content: string }) => {
      // Store notes in audit_logs as a workaround if entity_notes doesn't exist
      const { error } = await supabase
        .from('audit_logs')
        .insert({ 
          action: 'add_note',
          entity_type: data.entity_type,
          entity_id: data.entity_id,
          metadata: { content: data.content },
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Note added');
      closeModal();
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const assignAmbassador = useMutation({
    mutationFn: async (data: { ambassador_id: string; company_id?: string; wholesaler_id?: string; role_type: string }) => {
      const { error } = await supabase
        .from('ambassador_assignments')
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grabba-ambassador-assignments'] });
      toast.success('Ambassador assigned');
      closeModal();
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // COMMUNICATION ACTIONS (Floor 2)
  // ─────────────────────────────────────────────────────────────────────────────
  
  const logCommunication = useMutation({
    mutationFn: async (data: { channel: string; direction: string; recipient_phone?: string; recipient_email?: string; summary: string; brand: string }) => {
      const { error } = await supabase
        .from('communication_logs')
        .insert({ ...data, delivery_status: 'sent', created_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      logActivity('sms_sent', {});
      toast.success('Communication logged');
      closeModal();
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // INVENTORY ACTIONS (Floor 3)
  // ─────────────────────────────────────────────────────────────────────────────
  
  const addInventory = useMutation({
    mutationFn: async (data: { store_id: string; brand: string; current_tubes_left: number; boxes_on_hand?: number }) => {
      const { error } = await supabase
        .from('store_tube_inventory')
        .insert({ ...data, last_updated: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grabba-live-inventory'] });
      logActivity('inventory_added', {});
      toast.success('Inventory added');
      closeModal();
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const adjustInventory = useMutation({
    mutationFn: async (data: { id: string; current_tubes_left: number; adjustment_reason?: string }) => {
      const { error } = await supabase
        .from('store_tube_inventory')
        .update({ current_tubes_left: data.current_tubes_left, last_updated: new Date().toISOString() })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grabba-live-inventory'] });
      logActivity('inventory_adjusted', {});
      toast.success('Inventory adjusted');
      closeModal();
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DELIVERY ACTIONS (Floor 4)
  // ─────────────────────────────────────────────────────────────────────────────
  
  const createRoute = useMutation({
    mutationFn: async (data: { driver_id: string; route_date: string; stops?: any[] }) => {
      const { data: route, error: routeError } = await supabase
        .from('driver_routes')
        .insert({ driver_id: data.driver_id, route_date: data.route_date, status: 'pending' })
        .select()
        .single();
      if (routeError) throw routeError;
      
      // Add stops if provided
      if (data.stops?.length) {
        const stopsData = data.stops.map((stop, idx) => ({
          route_id: route.id,
          company_id: stop.company_id,
          store_id: stop.store_id,
          task_type: stop.task_type || 'delivery',
          stop_order: idx + 1,
          brand: stop.brand || 'grabba',
        }));
        
        const { error: stopsError } = await supabase
          .from('driver_route_stops')
          .insert(stopsData);
        if (stopsError) throw stopsError;
      }
      
      return route;
    },
    onSuccess: (route) => {
      queryClient.invalidateQueries({ queryKey: ['grabba-routes-today'] });
      logActivity('route_planned', { entityId: route?.id });
      toast.success('Route created');
      closeModal();
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const addStopsToRoute = useMutation({
    mutationFn: async (data: { route_id: string; stops: any[] }) => {
      const existingStops = await supabase
        .from('driver_route_stops')
        .select('*')
        .eq('route_id', data.route_id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      const startOrder = ((existingStops.data as any)?.[0]?.stop_order || 0) + 1;
      
      const stopsData = data.stops.map((stop, idx) => ({
        route_id: data.route_id,
        company_id: stop.company_id,
        store_id: stop.store_id,
        task_type: stop.task_type || 'delivery',
        stop_order: startOrder + idx,
        brand: stop.brand || 'grabba',
      }));
      
      const { error } = await supabase
        .from('driver_route_stops')
        .insert(stopsData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grabba-routes-today'] });
      toast.success('Stops added to route');
      closeModal();
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const markDeliveryComplete = useMutation({
    mutationFn: async (stopId: string) => {
      const { error } = await supabase
        .from('driver_route_stops')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grabba-routes-today'] });
      logActivity('delivery_completed', {});
      toast.success('Delivery marked complete');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PRODUCTION ACTIONS (Floor 6)
  // ─────────────────────────────────────────────────────────────────────────────
  
  const createBatch = useMutation({
    mutationFn: async (data: { office_id: string; brand: string; boxes_produced: number; produced_by?: string; shift_label?: string }) => {
      const batchNumber = `BATCH-${Date.now().toString(36).toUpperCase()}`;
      const tubes_total = (data.boxes_produced || 0) * 100;
      const { error } = await supabase
        .from('production_batches')
        .insert({ ...data, batch_number: batchNumber, tubes_total });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grabba-production-batches'] });
      logActivity('batch_created', {});
      toast.success('Production batch logged');
      closeModal();
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const logMachineService = useMutation({
    mutationFn: async (data: { office_id: string; machine_name: string; issue_description: string; status?: string }) => {
      const { error } = await supabase
        .from('machine_service_logs')
        .insert({ ...data, status: data.status || 'open' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grabba-machine-service'] });
      logActivity('machine_service_logged', {});
      toast.success('Service ticket created');
      closeModal();
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AMBASSADOR ACTIONS (Floor 8)
  // ─────────────────────────────────────────────────────────────────────────────
  
  const adjustPayout = useMutation({
    mutationFn: async (data: { ambassador_id: string; amount: number; entity_type: string; notes?: string }) => {
      const { error } = await supabase
        .from('ambassador_commissions')
        .insert({ ...data, status: 'pending' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grabba-ambassador-commissions'] });
      logActivity('payout_edited', {});
      toast.success('Payout adjustment recorded');
      closeModal();
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AI ACTIONS (Floor 9)
  // ─────────────────────────────────────────────────────────────────────────────
  
  const queueAITask = useMutation({
    mutationFn: async (data: { task_type: string; entity_type?: string; entity_id?: string; priority?: number }) => {
      const { error } = await supabase
        .from('automation_action_queue')
        .insert({ 
          action_type: data.task_type,
          entity_type: data.entity_type,
          entity_id: data.entity_id,
          priority: data.priority || 5,
          status: 'pending'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      logActivity('ai_task_started', {});
      toast.success('AI task queued');
      closeModal();
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // NAVIGATION HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  
  const navigateToFiltered = useCallback((path: string, filters: Record<string, string>) => {
    const params = new URLSearchParams(filters);
    navigate(`${path}?${params.toString()}`);
  }, [navigate]);

  const openUnpaidAccounts = useCallback(() => {
    navigateToFiltered('/grabba/finance', { tab: 'invoices', status: 'unpaid' });
  }, [navigateToFiltered]);

  const openLowStockStores = useCallback(() => {
    navigateToFiltered('/grabba/inventory', { tab: 'alerts' });
  }, [navigateToFiltered]);

  const openNewStores = useCallback(() => {
    navigateToFiltered('/grabba/crm', { tab: 'stores', filter: 'new' });
  }, [navigateToFiltered]);

  // ─────────────────────────────────────────────────────────────────────────────
  // MODAL HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  
  const openModal = useCallback((type: ActionType, data?: any) => {
    setActiveModal(type);
    setModalData(data);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalData(null);
    setSelectedEntities([]);
  }, []);

  const selectEntitiesForRoute = useCallback((entities: any[]) => {
    setSelectedEntities(entities);
    setActiveModal('send_to_route');
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // BULK ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  
  const bulkAddToRoute = useCallback(async (storeIds: string[], routeId?: string) => {
    if (!storeIds.length) {
      toast.error('No stores selected');
      return;
    }
    
    const stops = storeIds.map(id => ({ store_id: id, task_type: 'delivery' }));
    
    if (routeId) {
      await addStopsToRoute.mutateAsync({ route_id: routeId, stops });
    } else {
      // Open route creation modal with pre-selected stops
      setSelectedEntities(stops);
      setActiveModal('send_to_route');
    }
  }, [addStopsToRoute]);

  const bulkSendMessage = useCallback((entityIds: string[], channel: 'sms' | 'email' = 'sms') => {
    setSelectedEntities(entityIds);
    setActiveModal(channel === 'sms' ? 'send_text' : 'send_email');
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────────────────────────────────────
  
  return {
    // Modal state
    activeModal,
    modalData,
    selectedEntities,
    openModal,
    closeModal,
    
    // CRM mutations
    createOrder: createOrder.mutateAsync,
    createInvoice: createInvoice.mutateAsync,
    addNote: addNote.mutateAsync,
    assignAmbassador: assignAmbassador.mutateAsync,
    
    // Communication mutations
    logCommunication: logCommunication.mutateAsync,
    
    // Inventory mutations
    addInventory: addInventory.mutateAsync,
    adjustInventory: adjustInventory.mutateAsync,
    
    // Delivery mutations
    createRoute: createRoute.mutateAsync,
    addStopsToRoute: addStopsToRoute.mutateAsync,
    markDeliveryComplete: markDeliveryComplete.mutateAsync,
    
    // Production mutations
    createBatch: createBatch.mutateAsync,
    logMachineService: logMachineService.mutateAsync,
    
    // Ambassador mutations
    adjustPayout: adjustPayout.mutateAsync,
    
    // AI mutations
    queueAITask: queueAITask.mutateAsync,
    
    // Navigation
    navigateToFiltered,
    openUnpaidAccounts,
    openLowStockStores,
    openNewStores,
    
    // Bulk actions
    bulkAddToRoute,
    bulkSendMessage,
    selectEntitiesForRoute,
    
    // Loading states
    isCreatingOrder: createOrder.isPending,
    isCreatingInvoice: createInvoice.isPending,
    isCreatingRoute: createRoute.isPending,
    isCreatingBatch: createBatch.isPending,
    
    // Permission checks
    canCreate,
    canUpdate,
    canDelete,
    role,
  };
}

export default useGrabbaActions;
