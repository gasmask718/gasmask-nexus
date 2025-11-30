// Dropbox Cloud Export Service - Section 3.2
import { departmentRegistry } from '@/modules/RegisterDepartments';
import { supabase } from '@/integrations/supabase/client';

export interface CloudExportResult {
  success: boolean;
  exportedAt: string;
  filesUploaded: string[];
  error?: string;
}

export interface DiagnosticsSnapshot {
  generatedAt: string;
  modules: {
    id: string;
    name: string;
    basePath: string;
    routeCount: number;
    isEnabled: boolean;
  }[];
  routes: { path: string }[];
  sidebarItems: { label: string; path: string }[];
  tables: string[];
  indexes: { table: string; index: string }[];
}

/**
 * Get diagnostics snapshot for export
 */
export async function getDiagnosticsSnapshot(): Promise<DiagnosticsSnapshot> {
  const diagnostics = departmentRegistry.getDiagnostics();
  const routes = departmentRegistry.getAllRoutes();
  const sidebarItems = departmentRegistry.getSidebarItems();

  // Fetch table list
  const { data: tablesData } = await supabase
    .from('schema_history')
    .select('table_name')
    .order('created_at', { ascending: false })
    .limit(100);

  const tables = tablesData?.map(t => t.table_name) ?? [];

  return {
    generatedAt: new Date().toISOString(),
    modules: diagnostics.moduleList,
    routes: routes.map(r => ({ path: r.path })),
    sidebarItems: sidebarItems.map(s => ({ label: s.label, path: s.path })),
    tables,
    indexes: [], // Would need direct DB access for full index list
  };
}

/**
 * Export to Dropbox via Edge Function
 * Requires DROPBOX_ACCESS_TOKEN secret to be configured
 */
export async function exportToDropbox(): Promise<CloudExportResult> {
  try {
    const snapshot = await getDiagnosticsSnapshot();
    
    const { data, error } = await supabase.functions.invoke('dropbox-export', {
      body: {
        snapshot,
        fileName: `dynasty-os-backup-${new Date().toISOString().split('T')[0]}.json`,
      },
    });

    if (error) {
      return {
        success: false,
        exportedAt: new Date().toISOString(),
        filesUploaded: [],
        error: error.message || 'Failed to export to Dropbox',
      };
    }

    return {
      success: true,
      exportedAt: new Date().toISOString(),
      filesUploaded: data?.filesUploaded ?? ['dynasty-os-backup.json'],
    };
  } catch (err) {
    return {
      success: false,
      exportedAt: new Date().toISOString(),
      filesUploaded: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
