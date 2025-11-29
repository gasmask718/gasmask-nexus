// Phase 12 - Auto-Healing System for Bad or Missing Data

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  normalizePhone,
  normalizeEmail,
  sanitizeName,
  normalizeAddress,
  validateEntity,
  applyAutoFixes,
  ValidationResult,
} from "@/utils/validation/validationEngine";

export interface HealingResult {
  fixed: number;
  skipped: number;
  errors: string[];
  fixes: Array<{
    entityType: string;
    entityId: string;
    field: string;
    original: unknown;
    fixed: unknown;
  }>;
}

// Default values for missing data
const DEFAULT_VALUES: Record<string, Record<string, unknown>> = {
  stores: {
    region: 'Unknown Region',
    status: 'active',
    brand: 'unassigned',
  },
  orders: {
    status: 'pending',
    customer_type: 'Walk-in Customer',
  },
  drivers: {
    region: 'Unassigned',
    status: 'active',
  },
  inventory: {
    status: 'available',
    brand: 'unassigned',
  },
  invoices: {
    status: 'pending',
    paid_amount: 0,
  },
  deliveries: {
    status: 'pending',
    driver_id: null,
  },
};

// Infer region from ZIP code (simplified)
function inferRegionFromZip(zip: string): string {
  if (!zip) return 'Unknown Region';
  const prefix = zip.slice(0, 3);
  // NYC area codes
  if (['100', '101', '102', '103', '104'].includes(prefix)) return 'Manhattan';
  if (['112', '113', '114'].includes(prefix)) return 'Brooklyn';
  if (['104', '113', '114'].includes(prefix)) return 'Bronx';
  if (['111', '113', '114', '116'].includes(prefix)) return 'Queens';
  if (['103'].includes(prefix)) return 'Staten Island';
  return 'Other';
}

export function useDataHealing() {
  const queryClient = useQueryClient();

  // Heal a single record
  const healRecord = (
    entityType: string,
    data: Record<string, unknown>
  ): { healed: Record<string, unknown>; fixes: Array<{ field: string; original: unknown; fixed: unknown }> } => {
    const fixes: Array<{ field: string; original: unknown; fixed: unknown }> = [];
    const healed = { ...data };

    // Apply default values for missing fields
    const defaults = DEFAULT_VALUES[entityType] || {};
    for (const [field, defaultValue] of Object.entries(defaults)) {
      if (healed[field] === null || healed[field] === undefined || healed[field] === '') {
        fixes.push({ field, original: healed[field], fixed: defaultValue });
        healed[field] = defaultValue;
      }
    }

    // Normalize phone
    if (healed.phone) {
      const normalized = normalizePhone(healed.phone as string);
      if (normalized !== healed.phone) {
        fixes.push({ field: 'phone', original: healed.phone, fixed: normalized });
        healed.phone = normalized;
      }
    }

    // Normalize email
    if (healed.email) {
      const normalized = normalizeEmail(healed.email as string);
      if (normalized !== healed.email) {
        fixes.push({ field: 'email', original: healed.email, fixed: normalized });
        healed.email = normalized;
      }
    }

    // Sanitize name
    if (healed.name) {
      const sanitized = sanitizeName(healed.name as string);
      if (sanitized !== healed.name) {
        fixes.push({ field: 'name', original: healed.name, fixed: sanitized });
        healed.name = sanitized;
      }
    }

    // Normalize address
    if (healed.address) {
      const normalized = normalizeAddress(healed.address as string);
      if (normalized !== healed.address) {
        fixes.push({ field: 'address', original: healed.address, fixed: normalized });
        healed.address = normalized;
      }
    }

    // Infer region from ZIP if missing
    if (!healed.region && healed.zip) {
      const inferred = inferRegionFromZip(healed.zip as string);
      fixes.push({ field: 'region', original: null, fixed: inferred });
      healed.region = inferred;
    }

    return { healed, fixes };
  };

  // Validate and heal before save
  const validateAndHeal = (
    entityType: string,
    data: Record<string, unknown>,
    autoHeal: boolean = true
  ): { data: Record<string, unknown>; validation: ValidationResult; fixes: Array<{ field: string; original: unknown; fixed: unknown }> } => {
    let processedData = { ...data };
    let fixes: Array<{ field: string; original: unknown; fixed: unknown }> = [];

    if (autoHeal) {
      const healResult = healRecord(entityType, data);
      processedData = healResult.healed;
      fixes = healResult.fixes;
    }

    const validation = validateEntity(entityType, processedData);

    if (validation.autoFixes.length > 0) {
      processedData = applyAutoFixes(processedData, validation.autoFixes);
      fixes.push(...validation.autoFixes.map(f => ({
        field: f.field,
        original: f.originalValue,
        fixed: f.fixedValue,
      })));
    }

    return { data: processedData, validation, fixes };
  };

  // Bulk heal mutation
  const bulkHeal = useMutation({
    mutationFn: async ({ entityType, ids }: { entityType: string; ids: string[] }) => {
      const result: HealingResult = { fixed: 0, skipped: 0, errors: [], fixes: [] };

      // Fetch records
      const { data: records, error } = await (supabase as any)
        .from(entityType)
        .select('*')
        .in('id', ids);

      if (error) throw error;

      for (const record of records || []) {
        try {
          const { healed, fixes } = healRecord(entityType, record);
          
          if (fixes.length > 0) {
            const { error: updateError } = await (supabase as any)
              .from(entityType)
              .update(healed)
              .eq('id', record.id);

            if (updateError) {
              result.errors.push(`Failed to heal ${record.id}: ${updateError.message}`);
              result.skipped++;
            } else {
              result.fixed++;
              result.fixes.push(...fixes.map(f => ({
                entityType,
                entityId: record.id,
                ...f,
              })));
            }
          } else {
            result.skipped++;
          }
        } catch (err) {
          result.errors.push(`Error processing ${record.id}`);
          result.skipped++;
        }
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      if (result.fixed > 0) {
        toast.success(`Healed ${result.fixed} records`);
      }
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} errors occurred`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Healing failed: ${error.message}`);
    },
  });

  return {
    healRecord,
    validateAndHeal,
    bulkHeal: bulkHeal.mutateAsync,
    isBulkHealing: bulkHeal.isPending,
  };
}

// Hook for checking missing links
export function useMissingLinks(entityType: string) {
  const checkMissingLinks = async () => {
    const missingLinks: Array<{
      id: string;
      name: string;
      missingField: string;
      message: string;
    }> = [];

    try {
      switch (entityType) {
        case 'stores': {
          const { data } = await (supabase as any)
            .from('stores')
            .select('id, name, company_id, region')
            .or('company_id.is.null,region.is.null');
          
          for (const store of data || []) {
            if (!store.company_id) {
              missingLinks.push({
                id: store.id,
                name: store.name,
                missingField: 'company_id',
                message: 'Store missing company link',
              });
            }
            if (!store.region) {
              missingLinks.push({
                id: store.id,
                name: store.name,
                missingField: 'region',
                message: 'Store missing region',
              });
            }
          }
          break;
        }
        case 'orders': {
          const { data } = await (supabase as any)
            .from('wholesale_orders')
            .select('id, store_id')
            .is('store_id', null);
          
          for (const order of data || []) {
            missingLinks.push({
              id: order.id,
              name: `Order ${order.id.slice(0, 8)}`,
              missingField: 'store_id',
              message: 'Order missing store link',
            });
          }
          break;
        }
        case 'deliveries': {
          const { data } = await (supabase as any)
            .from('biker_routes')
            .select('id, biker_name, store_master_id')
            .is('store_master_id', null);
          
          for (const delivery of data || []) {
            missingLinks.push({
              id: delivery.id,
              name: delivery.biker_name,
              missingField: 'store_master_id',
              message: 'Delivery missing store assignment',
            });
          }
          break;
        }
      }
    } catch (error) {
      console.error('Error checking missing links:', error);
    }

    return missingLinks;
  };

  return { checkMissingLinks };
}
