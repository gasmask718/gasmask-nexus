// src/services/excelExportService.ts
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Paginated fetch helper — pulls up to `maxRows` in 1000-row pages.
 */
async function fetchAllRows(
  table: string,
  maxRows = 10000,
  orderCol = 'created_at',
  ascending = false
): Promise<any[]> {
  const PAGE = 1000;
  const rows: any[] = [];
  for (let offset = 0; offset < maxRows; offset += PAGE) {
    const { data, error } = await supabase
      .from(table as any)
      .select('*')
      .order(orderCol, { ascending })
      .range(offset, offset + PAGE - 1);
    if (error) { console.error(`fetchAllRows(${table}):`, error); break; }
    if (!data || data.length === 0) break;
    rows.push(...data);
  }
  return rows;
}

function addSheet(wb: XLSX.WorkBook, data: any[], name: string) {
  if (data.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name);
  }
}

/**
 * Export full Owner OS data to Excel (up to 10k rows per entity)
 */
export async function exportFullOSToExcel(): Promise<Blob | null> {
  try {
    toast.info('Gathering empire data...');

    const [companies, stores, invoices, alerts, ambassadors, drivers] = await Promise.all([
      fetchAllRows('companies', 10000, 'created_at'),
      fetchAllRows('store_master', 10000, 'created_at'),
      fetchAllRows('invoices', 10000, 'created_at'),
      fetchAllRows('ai_recommendations', 500, 'created_at'),
      fetchAllRows('ambassadors', 5000, 'created_at'),
      fetchAllRows('biker_routes', 5000, 'created_at'),
    ]);

    const wb = XLSX.utils.book_new();

    addSheet(wb, companies, 'Companies');
    addSheet(wb, stores, 'Stores');
    addSheet(wb, invoices, 'Invoices');
    addSheet(wb, alerts, 'Alerts');
    addSheet(wb, ambassadors, 'Ambassadors');
    addSheet(wb, drivers, 'Routes');

    // Summary sheet
    const summary = [{
      total_companies: companies.length,
      total_stores: stores.length,
      total_invoices: invoices.length,
      active_alerts: alerts.length,
      active_ambassadors: ambassadors.length,
      active_routes: drivers.length,
      exported_at: new Date().toISOString(),
    }];
    addSheet(wb, summary, 'Summary');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    return blob;
  } catch (error) {
    console.error('Excel export error:', error);
    toast.error('Failed to export to Excel');
    return null;
  }
}

/**
 * Export Grabba-specific data
 */
export async function exportGrabbaToExcel(): Promise<Blob | null> {
  try {
    toast.info('Gathering Grabba data...');

    const [stores, invoices, drivers, ambassadors] = await Promise.all([
      fetchAllRows('store_master', 10000, 'created_at'),
      fetchAllRows('invoices', 10000, 'created_at'),
      fetchAllRows('biker_routes', 5000, 'created_at'),
      fetchAllRows('ambassadors', 5000, 'created_at'),
    ]);

    const wb = XLSX.utils.book_new();
    addSheet(wb, stores, 'Stores');
    addSheet(wb, invoices, 'Invoices');
    addSheet(wb, drivers, 'Routes');
    addSheet(wb, ambassadors, 'Ambassadors');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    return blob;
  } catch (error) {
    console.error('Grabba Excel export error:', error);
    toast.error('Failed to export Grabba data');
    return null;
  }
}
