import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TableInfo {
  name: string;
  hasSoftDelete: boolean;
  hasRLS: boolean;
  rowCount?: number;
}

export interface IndexInfo {
  tableName: string;
  indexName: string;
  columns: string;
}

export interface DatabaseDiagnostics {
  tables: TableInfo[];
  indexes: IndexInfo[];
  warnings: string[];
  schemaVersion: string;
  lastSchemaChange?: string;
}

export function useDatabaseDiagnostics() {
  return useQuery({
    queryKey: ['database-diagnostics'],
    queryFn: async (): Promise<DatabaseDiagnostics> => {
      const warnings: string[] = [];
      
      // Get schema history for version info
      const { data: schemaHistory } = await supabase
        .from('schema_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      const lastChange = schemaHistory?.[0];
      
      // Known tables with soft delete
      const tablesWithSoftDelete = [
        'stores', 'crm_contacts', 'ambassadors', 'wholesalers', 
        'driver_profiles', 'orders'
      ];

      // Build table info from known structure
      const tables: TableInfo[] = [
        { name: 'orders', hasSoftDelete: true, hasRLS: true },
        { name: 'stores', hasSoftDelete: true, hasRLS: true },
        { name: 'crm_contacts', hasSoftDelete: true, hasRLS: true },
        { name: 'ambassadors', hasSoftDelete: true, hasRLS: true },
        { name: 'wholesalers', hasSoftDelete: true, hasRLS: true },
        { name: 'driver_profiles', hasSoftDelete: true, hasRLS: true },
        { name: 'ai_approval_queue', hasSoftDelete: false, hasRLS: true },
        { name: 'schema_history', hasSoftDelete: false, hasRLS: true },
        { name: 'profiles', hasSoftDelete: false, hasRLS: true },
        { name: 'user_roles', hasSoftDelete: false, hasRLS: true },
      ];

      // Known indexes
      const indexes: IndexInfo[] = [
        { tableName: 'orders', indexName: 'idx_orders_order_status', columns: 'order_status' },
        { tableName: 'orders', indexName: 'idx_orders_payment_status', columns: 'payment_status' },
        { tableName: 'orders', indexName: 'idx_orders_active', columns: 'deleted_at IS NULL' },
        { tableName: 'stores', indexName: 'idx_stores_active', columns: 'deleted_at IS NULL' },
        { tableName: 'crm_contacts', indexName: 'idx_crm_contacts_active', columns: 'deleted_at IS NULL' },
        { tableName: 'ambassadors', indexName: 'idx_ambassadors_active', columns: 'deleted_at IS NULL' },
        { tableName: 'wholesalers', indexName: 'idx_wholesalers_active', columns: 'deleted_at IS NULL' },
        { tableName: 'driver_profiles', indexName: 'idx_driver_profiles_active', columns: 'deleted_at IS NULL' },
        { tableName: 'schema_history', indexName: 'idx_schema_history_table', columns: 'table_name' },
        { tableName: 'schema_history', indexName: 'idx_schema_history_version', columns: 'version' },
        { tableName: 'ai_approval_queue', indexName: 'idx_ai_approval_status', columns: 'status' },
        { tableName: 'ai_approval_queue', indexName: 'idx_ai_approval_worker', columns: 'ai_worker_id' },
      ];

      // Generate warnings
      const tablesWithoutSoftDelete = tables.filter(t => !t.hasSoftDelete);
      if (tablesWithoutSoftDelete.length > 0) {
        warnings.push(`${tablesWithoutSoftDelete.length} tables without soft-delete pattern`);
      }

      const tablesWithoutRLS = tables.filter(t => !t.hasRLS);
      if (tablesWithoutRLS.length > 0) {
        warnings.push(`⚠️ ${tablesWithoutRLS.length} tables without RLS policies`);
      }

      return {
        tables,
        indexes,
        warnings,
        schemaVersion: lastChange?.version_number?.toString() ?? '1.0.0',
        lastSchemaChange: lastChange?.executed_at,
      };
    },
    staleTime: 60000, // 1 minute
  });
}
