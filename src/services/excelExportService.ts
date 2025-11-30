// src/services/excelExportService.ts
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export type ExportCategory = 
  | 'crm' 
  | 'orders' 
  | 'ambassadors' 
  | 'inventory' 
  | 'finance' 
  | 'drivers' 
  | 'stores' 
  | 'wholesale' 
  | 'warehouse' 
  | 'hr' 
  | 'grants' 
  | 'funding' 
  | 'subscriptions';

interface ExportConfig {
  tableName: string;
  sheetName: string;
  columns?: string[];
}

const EXPORT_CONFIGS: Record<ExportCategory, ExportConfig> = {
  crm: { tableName: 'crm_contacts', sheetName: 'CRM Contacts' },
  orders: { tableName: 'orders', sheetName: 'Orders' },
  ambassadors: { tableName: 'ambassadors', sheetName: 'Ambassadors' },
  inventory: { tableName: 'warehouse_inventory', sheetName: 'Inventory' },
  finance: { tableName: 'accounting_ledger', sheetName: 'Finance Ledger' },
  drivers: { tableName: 'driver_profiles', sheetName: 'Drivers' },
  stores: { tableName: 'stores', sheetName: 'Stores' },
  wholesale: { tableName: 'wholesalers', sheetName: 'Wholesalers' },
  warehouse: { tableName: 'warehouse_inventory', sheetName: 'Warehouse' },
  hr: { tableName: 'hr_employees', sheetName: 'HR Employees' },
  grants: { tableName: 'grant_applications', sheetName: 'Grants' },
  funding: { tableName: 'funding_requests', sheetName: 'Funding Requests' },
  subscriptions: { tableName: 'subscriptions', sheetName: 'Subscriptions' },
};

export async function exportCategoryToExcel(category: ExportCategory): Promise<Blob | null> {
  const config = EXPORT_CONFIGS[category];
  if (!config) {
    console.error(`Unknown export category: ${category}`);
    return null;
  }

  try {
    const { data, error } = await supabase
      .from(config.tableName as any)
      .select('*')
      .is('deleted_at', null)
      .limit(10000);

    if (error) {
      console.error(`Error fetching ${category} data:`, error);
      return null;
    }

    if (!data || data.length === 0) {
      console.warn(`No data found for ${category}`);
      return null;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, config.sheetName);

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  } catch (err) {
    console.error(`Export error for ${category}:`, err);
    return null;
  }
}

export async function exportAllToExcel(): Promise<Blob | null> {
  const workbook = XLSX.utils.book_new();
  let hasData = false;

  for (const [category, config] of Object.entries(EXPORT_CONFIGS)) {
    try {
      const { data, error } = await supabase
        .from(config.tableName as any)
        .select('*')
        .is('deleted_at', null)
        .limit(5000);

      if (!error && data && data.length > 0) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, config.sheetName);
        hasData = true;
      }
    } catch (err) {
      console.warn(`Skipping ${category} export:`, err);
    }
  }

  if (!hasData) {
    console.warn('No data found for export');
    return null;
  }

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportAndDownload(category: ExportCategory | 'all'): Promise<boolean> {
  const timestamp = new Date().toISOString().split('T')[0];
  
  if (category === 'all') {
    const blob = await exportAllToExcel();
    if (blob) {
      downloadBlob(blob, `dynasty-os-full-export-${timestamp}.xlsx`);
      return true;
    }
  } else {
    const blob = await exportCategoryToExcel(category);
    if (blob) {
      downloadBlob(blob, `dynasty-os-${category}-${timestamp}.xlsx`);
      return true;
    }
  }
  
  return false;
}
