// src/services/exportService.ts
import * as XLSX from 'xlsx';
import { departmentRegistry } from '@/modules/RegisterDepartments';
import { getModuleDiagnostics } from '@/modules';
import { getNavigationSnapshot } from '@/services/navigationSnapshotService';

export interface EmpireDataSources {
  fetchCustomers?: () => Promise<Record<string, unknown>[]>;
  fetchStores?: () => Promise<Record<string, unknown>[]>;
  fetchDrivers?: () => Promise<Record<string, unknown>[]>;
  fetchBikers?: () => Promise<Record<string, unknown>[]>;
  fetchOrders?: () => Promise<Record<string, unknown>[]>;
  fetchInventory?: () => Promise<Record<string, unknown>[]>;
  fetchAmbassadors?: () => Promise<Record<string, unknown>[]>;
  fetchFinancials?: () => Promise<Record<string, unknown>[]>;
  fetchGrants?: () => Promise<Record<string, unknown>[]>;
  fetchFundingPipeline?: () => Promise<Record<string, unknown>[]>;
  fetchRealEstateDeals?: () => Promise<Record<string, unknown>[]>;
  fetchICleanJobs?: () => Promise<Record<string, unknown>[]>;
  fetchWholesaleDeals?: () => Promise<Record<string, unknown>[]>;
  fetchPlayboxxxCreators?: () => Promise<Record<string, unknown>[]>;
}

// Helper to convert JSON → sheet
function sheetFromData(data: Record<string, unknown>[], sheetName: string) {
  if (!data || data.length === 0) {
    return { name: sheetName, sheet: XLSX.utils.aoa_to_sheet([[`No data (${sheetName})`]]) };
  }
  const sheet = XLSX.utils.json_to_sheet(data);
  return { name: sheetName, sheet };
}

function downloadFile(content: string | ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export all empire data to a single Excel file with multiple sheets.
 */
export async function exportEmpireDataToExcel(sources: EmpireDataSources = {}): Promise<{ success: boolean; message: string }> {
  const wb = XLSX.utils.book_new();
  let sheetsAdded = 0;

  async function addSheet(label: string, fetcher?: () => Promise<Record<string, unknown>[]>) {
    if (!fetcher) return;
    const data = await fetcher().catch(err => {
      console.error(`Failed to fetch ${label}:`, err);
      return [];
    });
    const { name, sheet } = sheetFromData(data, label);
    XLSX.utils.book_append_sheet(wb, sheet, name.slice(0, 31)); // Excel sheet name limit
    sheetsAdded++;
  }

  await addSheet('Customers', sources.fetchCustomers);
  await addSheet('Stores', sources.fetchStores);
  await addSheet('Drivers', sources.fetchDrivers);
  await addSheet('Bikers', sources.fetchBikers);
  await addSheet('Orders', sources.fetchOrders);
  await addSheet('Inventory', sources.fetchInventory);
  await addSheet('Ambassadors', sources.fetchAmbassadors);
  await addSheet('Financials', sources.fetchFinancials);
  await addSheet('Grants', sources.fetchGrants);
  await addSheet('FundingPipeline', sources.fetchFundingPipeline);
  await addSheet('RealEstate', sources.fetchRealEstateDeals);
  await addSheet('ICleanJobs', sources.fetchICleanJobs);
  await addSheet('WholesaleDeals', sources.fetchWholesaleDeals);
  await addSheet('PlayboxxxCreators', sources.fetchPlayboxxxCreators);

  // Guard: ensure at least one sheet exists before writing
  if (sheetsAdded === 0) {
    console.warn('📤 Export cancelled: No data sources provided');
    return { success: false, message: 'No data to export. Please ensure data sources are configured.' };
  }

  const fileName = `Dynasty_Empire_Data_${new Date().toISOString().split('T')[0]}.xlsx`;
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadFile(
    wbout,
    fileName,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
  );

  console.log('📤 Empire data exported to Excel:', fileName);
  return { success: true, message: `Exported ${sheetsAdded} sheets to ${fileName}` };
}

/**
 * Export OS blueprint (structure) to JSON and download.
 */
export async function exportOsBlueprintToJson(options?: {
  onAfterExport?: (json: string, fileName: string) => Promise<void>;
  uploadToDropboxPath?: string;
  dropboxAccessToken?: string;
}) {
  const diagnostics = getModuleDiagnostics();
  const navSnapshot = getNavigationSnapshot();
  const modules = departmentRegistry.getAllModules();

  const blueprint = {
    generatedAt: new Date().toISOString(),
    diagnostics,
    navSnapshot,
    modules: modules.map(m => ({
      id: m.config.id,
      name: m.config.name,
      basePath: m.config.basePath,
      permissions: m.config.permissions,
      order: m.config.order,
      routes: m.routes?.map(r => r.path) || [],
    })),
  };

  const json = JSON.stringify(blueprint, null, 2);
  const fileName = `Dynasty_OS_Blueprint_${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}.json`;

  downloadFile(json, fileName, 'application/json;charset=utf-8');
  console.log('📤 OS blueprint exported:', fileName);

  // Dropbox upload if configured
  if (options?.uploadToDropboxPath && options?.dropboxAccessToken) {
    try {
      const { uploadToDropbox } = await import('@/services/dropboxService');
      await uploadToDropbox({
        accessToken: options.dropboxAccessToken,
        path: options.uploadToDropboxPath.replace('{fileName}', fileName),
        contents: json,
      });
    } catch (err) {
      console.error('Dropbox upload error:', err);
    }
  }

  if (options?.onAfterExport) {
    await options.onAfterExport(json, fileName);
  }
}
