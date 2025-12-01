// src/services/excelExportService.ts
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Export full Owner OS data to Excel
 */
export async function exportFullOSToExcel(): Promise<Blob | null> {
  try {
    toast.info('Gathering empire data...');

    // Fetch data from all key tables
    const [companiesRes, storesRes, ordersRes, alertsRes, ambassadorsRes, driversRes] = await Promise.all([
      supabase.from('companies').select('*').limit(500),
      supabase.from('stores').select('*').limit(500),
      supabase.from('wholesale_orders').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('ai_recommendations').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('ambassadors').select('*').limit(200),
      supabase.from('biker_routes').select('*').limit(200),
    ]);

    const wb = XLSX.utils.book_new();

    // Add sheets with data
    if (companiesRes.data && companiesRes.data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(companiesRes.data);
      XLSX.utils.book_append_sheet(wb, ws, 'Companies');
    }

    if (storesRes.data && storesRes.data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(storesRes.data);
      XLSX.utils.book_append_sheet(wb, ws, 'Stores');
    }

    if (ordersRes.data && ordersRes.data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(ordersRes.data);
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    }

    if (alertsRes.data && alertsRes.data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(alertsRes.data);
      XLSX.utils.book_append_sheet(wb, ws, 'Alerts');
    }

    if (ambassadorsRes.data && ambassadorsRes.data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(ambassadorsRes.data);
      XLSX.utils.book_append_sheet(wb, ws, 'Ambassadors');
    }

    if (driversRes.data && driversRes.data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(driversRes.data);
      XLSX.utils.book_append_sheet(wb, ws, 'Routes');
    }

    // Add summary sheet
    const summary = [{
      total_companies: companiesRes.data?.length || 0,
      total_stores: storesRes.data?.length || 0,
      total_orders: ordersRes.data?.length || 0,
      active_alerts: alertsRes.data?.length || 0,
      active_ambassadors: ambassadorsRes.data?.length || 0,
      active_routes: driversRes.data?.length || 0,
      exported_at: new Date().toISOString(),
    }];
    const summaryWs = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Generate binary data
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

    const [storesRes, ordersRes, driversRes, ambassadorsRes] = await Promise.all([
      supabase.from('stores').select('*').limit(500),
      supabase.from('wholesale_orders').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('biker_routes').select('*').limit(200),
      supabase.from('ambassadors').select('*').limit(200),
    ]);

    const wb = XLSX.utils.book_new();

    if (storesRes.data && storesRes.data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(storesRes.data);
      XLSX.utils.book_append_sheet(wb, ws, 'Stores');
    }

    if (ordersRes.data && ordersRes.data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(ordersRes.data);
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    }

    if (driversRes.data && driversRes.data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(driversRes.data);
      XLSX.utils.book_append_sheet(wb, ws, 'Routes');
    }

    if (ambassadorsRes.data && ambassadorsRes.data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(ambassadorsRes.data);
      XLSX.utils.book_append_sheet(wb, ws, 'Ambassadors');
    }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    return blob;
  } catch (error) {
    console.error('Grabba Excel export error:', error);
    toast.error('Failed to export Grabba data');
    return null;
  }
}
