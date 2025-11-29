import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuditLog } from "./useAuditLog";
import { useDataHealing } from "./useDataHealing";
import { validateEntity, getValidationStatus } from "@/utils/validation/validationEngine";

type EntityType = 
  | 'companies' | 'stores' | 'contacts' | 'wholesalers' 
  | 'ambassadors' | 'drivers' | 'invoices' | 'orders'
  | 'inventory' | 'production_batches' | 'routes' | 'communication_logs';

interface UseEntityCrudOptions {
  entity: EntityType;
  queryKey?: string[];
  enableAuditLog?: boolean;
}

interface UseEntityCrudReturn {
  create: (data: Record<string, unknown>) => Promise<unknown>;
  update: (data: { id: string } & Record<string, unknown>) => Promise<unknown>;
  remove: (id: string) => Promise<string>;
  softDelete: (id: string) => Promise<string>;
  toggleStatus: (params: { id: string; field: string; value: boolean | string }) => Promise<void>;
  validateBeforeSave: (data: Record<string, unknown>) => { isValid: boolean; errors: string[] };
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function useEntityCrud({ entity, queryKey, enableAuditLog = true }: UseEntityCrudOptions): UseEntityCrudReturn {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();
  const { validateAndHeal } = useDataHealing();

  const invalidate = () => {
    if (queryKey) {
      queryClient.invalidateQueries({ queryKey });
    }
  };

  // Validate before save helper
  const validateBeforeSave = (data: Record<string, unknown>): { isValid: boolean; errors: string[] } => {
    const result = validateEntity(entity, data);
    return {
      isValid: result.isValid,
      errors: result.errors.map(e => e.message),
    };
  };

  const create = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      // Validate and heal data before insert
      const { data: healedData, validation } = validateAndHeal(entity, data);
      
      if (!validation.isValid) {
        const errorMessages = validation.errors.map(e => e.message).join(', ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }

      const { data: result, error } = await (supabase as any)
        .from(entity)
        .insert(healedData)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      invalidate();
      toast.success(`${formatEntityName(entity)} created`);
      if (enableAuditLog) {
        logAction({ action: 'create', entityType: entity, entityId: result?.id });
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const { data: result, error } = await (supabase as any)
        .from(entity)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      invalidate();
      toast.success(`${formatEntityName(entity)} updated`);
      if (enableAuditLog) {
        logAction({ action: 'update', entityType: entity, entityId: result?.id });
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(entity).delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      invalidate();
      toast.success(`${formatEntityName(entity)} deleted`);
      if (enableAuditLog) {
        logAction({ action: 'delete', entityType: entity, entityId: id });
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from(entity)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      invalidate();
      toast.success(`${formatEntityName(entity)} archived`);
      if (enableAuditLog) {
        logAction({ action: 'delete', entityType: entity, entityId: id, metadata: { soft: true } });
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to archive: ${error.message}`);
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean | string }) => {
      const { error } = await (supabase as any)
        .from(entity)
        .update({ [field]: value })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Status updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  return {
    create: create.mutateAsync,
    update: update.mutateAsync,
    remove: remove.mutateAsync,
    softDelete: softDelete.mutateAsync,
    toggleStatus: toggleStatus.mutateAsync,
    validateBeforeSave,
    isCreating: create.isPending,
    isUpdating: update.isPending,
    isDeleting: remove.isPending,
  };
}

function formatEntityName(entity: EntityType): string {
  const names: Record<EntityType, string> = {
    companies: 'Company',
    stores: 'Store',
    contacts: 'Contact',
    wholesalers: 'Wholesaler',
    ambassadors: 'Ambassador',
    drivers: 'Driver',
    invoices: 'Invoice',
    orders: 'Order',
    inventory: 'Inventory item',
    production_batches: 'Production batch',
    routes: 'Route',
    communication_logs: 'Communication log',
  };
  return names[entity] || entity;
}
