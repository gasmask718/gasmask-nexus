/**
 * Bulk Upload Hook
 * Handles file parsing, validation, and import with audit logging
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { UploadSchema, getSchemaByType } from '@/lib/uploadSchemas';
import { 
  validateColumns, 
  validateAllRows, 
  ValidationResult,
  RowValidationError,
  ValidatedRow
} from '@/lib/uploadValidation';

// Stage enum for deterministic state transitions
export type UploadStage = 
  | 'SELECT_TYPE' 
  | 'FILE_UPLOADED' 
  | 'MAPPED' 
  | 'VALIDATED' 
  | 'IMPORT_READY' 
  | 'IMPORTING' 
  | 'COMPLETE' 
  | 'ERROR';

export interface UploadState {
  step: 'select' | 'upload' | 'validate' | 'preview' | 'importing' | 'complete' | 'error';
  stage: UploadStage; // New deterministic stage controller
  uploadType: string | null;
  fileName: string | null;
  rawData: Record<string, any>[];
  columns: string[];
  columnMapping: Record<string, string>;
  validationResult: ValidationResult | null;
  isImportReady: boolean; // Explicit boolean to unlock import
  importResult: ImportResult | null;
  isProcessing: boolean;
  error: string | null;
}

export interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: RowValidationError[];
  auditLogId: string | null;
}

const initialState: UploadState = {
  step: 'select',
  stage: 'SELECT_TYPE',
  uploadType: null,
  fileName: null,
  rawData: [],
  columns: [],
  columnMapping: {},
  validationResult: null,
  isImportReady: false,
  importResult: null,
  isProcessing: false,
  error: null
};

export function useBulkUpload() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<UploadState>(initialState);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const setUploadType = useCallback((type: string) => {
    setState(prev => ({
      ...prev,
      uploadType: type,
      step: 'upload',
      stage: 'FILE_UPLOADED'
    }));
  }, []);

  const parseFile = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      if (jsonData.length === 0) {
        throw new Error('File is empty or has no data rows');
      }

      const columns = Object.keys(jsonData[0] as any);
      
      // Auto-map columns based on schema
      const schema = getSchemaByType(state.uploadType || '');
      const autoMapping: Record<string, string> = {};
      
      if (schema) {
        columns.forEach(col => {
          const normalizedCol = col.toLowerCase().trim().replace(/\s+/g, '_');
          const matchingField = schema.fields.find(
            f => f.field.toLowerCase() === normalizedCol ||
                 f.displayName.toLowerCase() === col.toLowerCase().trim()
          );
          if (matchingField) {
            autoMapping[col] = matchingField.field;
          }
        });
      }

      setState(prev => ({
        ...prev,
        fileName: file.name,
        rawData: jsonData as Record<string, any>[],
        columns,
        columnMapping: autoMapping,
        step: 'validate',
        stage: 'MAPPED',
        isProcessing: false,
        isImportReady: false // Reset import ready state
      }));

      toast.success(`Loaded ${jsonData.length} rows from ${file.name}`);
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error.message,
        step: 'error',
        stage: 'ERROR'
      }));
      toast.error(`Failed to parse file: ${error.message}`);
    }
  }, [state.uploadType]);

  const updateColumnMapping = useCallback((excelCol: string, schemaField: string) => {
    setState(prev => ({
      ...prev,
      columnMapping: {
        ...prev.columnMapping,
        [excelCol]: schemaField
      },
      // Reset validation when mapping changes
      isImportReady: false,
      stage: 'MAPPED'
    }));
  }, []);

  const validateData = useCallback(() => {
    const schema = getSchemaByType(state.uploadType || '');
    if (!schema) {
      toast.error('Unknown upload type');
      return;
    }

    setState(prev => ({ ...prev, isProcessing: true }));

    // Validate columns first
    const columnValidation = validateColumns(state.columns, schema);
    
    if (columnValidation.missing.length > 0) {
      toast.error(`Missing required columns: ${columnValidation.missing.join(', ')}`);
      setState(prev => ({ ...prev, isProcessing: false }));
      return;
    }

    // Validate all rows
    const result = validateAllRows(state.rawData, schema, state.columnMapping);

    // Determine if import is ready: validation completed AND has valid rows
    // Blocking errors prevent import, but warnings (optional fields) do NOT block
    const hasValidRows = result.summary.validRows > 0;
    const isImportReady = hasValidRows; // Import is ready if we have any valid rows

    setState(prev => ({
      ...prev,
      validationResult: result,
      step: 'preview',
      stage: isImportReady ? 'IMPORT_READY' : 'VALIDATED',
      isImportReady: isImportReady,
      isProcessing: false
    }));

    if (result.summary.errorRows > 0 && result.summary.validRows > 0) {
      toast.warning(`${result.summary.errorRows} rows have errors, but ${result.summary.validRows} rows are ready to import`);
    } else if (result.summary.errorRows > 0) {
      toast.error(`All ${result.summary.errorRows} rows have errors - please fix and re-upload`);
    } else {
      toast.success(`All ${result.summary.validRows} rows validated successfully - ready to import!`);
    }
  }, [state.uploadType, state.columns, state.rawData, state.columnMapping]);

  const performImport = useCallback(async (mode: 'append' | 'upsert' = 'append') => {
    if (!state.validationResult) {
      toast.error('Please validate data first');
      return;
    }

    const schema = getSchemaByType(state.uploadType || '');
    if (!schema) {
      toast.error('Unknown upload type');
      return;
    }

    setState(prev => ({ ...prev, step: 'importing', stage: 'IMPORTING', isProcessing: true }));

    const result: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      auditLogId: null
    };

    try {
      // Get current user for audit log
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create audit log entry
      const { data: auditLog, error: auditError } = await supabase
        .from('admin_audit_log')
        .insert({
          actor_user_id: user?.id || 'system',
          action: 'bulk_import',
          target_type: state.uploadType || 'unknown',
          target_id: null,
          before: null,
          after: {
            file_name: state.fileName,
            total_rows: state.validationResult.summary.totalRows,
            mode
          },
          reason: `Bulk import from ${state.fileName}`
        })
        .select()
        .single();

      if (!auditError && auditLog) {
        result.auditLogId = auditLog.id;
      }

      // Get valid rows only
      const validRows = state.validationResult.rows.filter(r => r.status === 'valid');
      
      // Import based on upload type
      if (state.uploadType === 'stores' || state.uploadType === 'combined_crm') {
        await importStores(validRows, mode, result);
      } else if (state.uploadType === 'store_contacts') {
        await importStoreContacts(validRows, result);
      } else if (state.uploadType === 'store_notes') {
        await importStoreNotes(validRows, result);
      } else if (state.uploadType === 'invoices') {
        await importInvoices(validRows, result);
      }

      // Skipped = error rows from validation
      result.skipped = state.validationResult.summary.errorRows;

      // Update audit log with results
      if (result.auditLogId) {
        await supabase
          .from('admin_audit_log')
          .update({
            after: {
              file_name: state.fileName,
              total_rows: state.validationResult.summary.totalRows,
              mode,
              imported: result.success,
              failed: result.failed,
              skipped: result.skipped
            }
          })
          .eq('id', result.auditLogId);
      }

      setState(prev => ({
        ...prev,
        importResult: result,
        step: 'complete',
        stage: 'COMPLETE',
        isProcessing: false,
        isImportReady: false
      }));

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['store-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['store-notes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['stores-with-contacts'] });

      toast.success(`Import complete: ${result.success} rows imported`);
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        step: 'error',
        stage: 'ERROR',
        isProcessing: false,
        isImportReady: false
      }));
      toast.error(`Import failed: ${error.message}`);
    }
  }, [state.validationResult, state.uploadType, state.fileName, queryClient]);

  return {
    state,
    reset,
    setUploadType,
    parseFile,
    updateColumnMapping,
    validateData,
    performImport
  };
}

// Import functions for each type
async function importStores(
  rows: ValidatedRow[], 
  mode: 'append' | 'upsert',
  result: ImportResult
) {
  const BATCH_SIZE = 20;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (row) => {
      try {
        // Normalize store type
        let storeType = 'other';
        if (row.data.type) {
          const normalized = row.data.type.toLowerCase().trim().replace(/\s+/g, '_');
          const validTypes = ['bodega', 'smoke_shop', 'gas_station', 'wholesaler', 'other'];
          if (validTypes.includes(normalized)) {
            storeType = normalized;
          }
        }

        const storeData: any = {
          name: row.data.name || row.data.store_name,
          type: storeType,
          address_street: row.data.address_street || row.data.address,
          address_city: row.data.address_city || row.data.city,
          address_state: row.data.address_state || row.data.state,
          address_zip: row.data.address_zip || row.data.zip,
          phone: row.data.phone || row.data.contact_phone, // Also check contact_phone
          email: row.data.email || row.data.contact_email, // Also check contact_email
          status: row.data.status || 'active',
          open_date: row.data.open_date || row.data.member_since,
        };

        // Handle company - need to look up or create
        if (row.data.company) {
          const { data: company } = await supabase
            .from('companies')
            .select('id')
            .eq('name', row.data.company)
            .maybeSingle();
          
          if (company) {
            storeData.company_id = company.id;
          }
        }

        if (mode === 'upsert') {
          // Check if store exists
          const { data: existing } = await supabase
            .from('stores')
            .select('id')
            .eq('name', storeData.name)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('stores')
              .update(storeData)
              .eq('id', existing.id);
          } else {
            await supabase.from('stores').insert(storeData);
          }
        } else {
          await supabase.from('stores').insert(storeData);
        }

        // Handle tags if present - support both array and pipe-separated string
        if (row.data.tags) {
          let tagsArray: string[] = [];
          
          if (Array.isArray(row.data.tags)) {
            tagsArray = row.data.tags;
          } else if (typeof row.data.tags === 'string') {
            // Split by " | " (pipe with spaces) or "|" (just pipe) or "," (comma)
            tagsArray = row.data.tags
              .split(/\s*\|\s*|,/)
              .map((t: string) => t.trim())
              .filter((t: string) => t.length > 0);
          }

          // Get the store id for tag attachment
          const { data: store } = await supabase
            .from('stores')
            .select('id')
            .eq('name', storeData.name)
            .maybeSingle();

          for (const tag of tagsArray) {
            // Ensure tag exists in global_tags (slug is required)
            const slug = tag.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const { data: globalTag } = await supabase
              .from('global_tags')
              .upsert({ name: tag, slug, status: 'active' }, { onConflict: 'name' })
              .select('id')
              .single();

            // Attach tag to store via tag_attachments
            if (store && globalTag) {
              await supabase
                .from('tag_attachments')
                .upsert({
                  tag_id: globalTag.id,
                  entity_type: 'store',
                  entity_id: store.id
                }, { onConflict: 'tag_id,entity_type,entity_id', ignoreDuplicates: true });
            }
          }
        }

        // Handle notes if present
        if (row.data.notes) {
          const { data: store } = await supabase
            .from('stores')
            .select('id')
            .eq('name', storeData.name)
            .maybeSingle();

          if (store) {
            await supabase.from('store_notes').insert({
              store_id: store.id,
              note_text: row.data.notes,
              created_at: row.data.note_date 
                ? new Date(row.data.note_date).toISOString() 
                : new Date().toISOString()
            });
          }
        }

        // Handle contact if present (combined upload) - require at least name OR phone
        const hasContactData = row.data.contact_name || row.data.contact_phone;
        if (hasContactData) {
          const { data: store } = await supabase
            .from('stores')
            .select('id')
            .eq('name', storeData.name)
            .maybeSingle();

          if (store) {
            const contactData: any = {
              store_id: store.id,
              name: row.data.contact_name || 'Unknown',
              phone: row.data.contact_phone || null,
              email: row.data.contact_email || null,
              role: row.data.contact_role || 'worker'
            };
            
            const { error: contactError } = await supabase
              .from('store_contacts')
              .insert(contactData);
            
            if (contactError) {
              console.error('Contact insert error:', contactError);
            }
          }
        }

        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: row.rowNumber,
          column: '',
          columnDisplayName: '',
          value: null,
          error: error.message,
          severity: 'error'
        });
      }
    }));
  }
}

async function importStoreContacts(rows: ValidatedRow[], result: ImportResult) {
  const BATCH_SIZE = 20;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (row) => {
      try {
        // Find store by name
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('name', row.data.store_name)
          .maybeSingle();

        if (!store) {
          result.failed++;
          result.errors.push({
            row: row.rowNumber,
            column: 'store_name',
            columnDisplayName: 'Store Name',
            value: row.data.store_name,
            error: 'Store not found',
            severity: 'error'
          });
          return;
        }

        await supabase.from('store_contacts').insert({
          store_id: store.id,
          name: row.data.name,
          phone: row.data.phone,
          email: row.data.email,
          role: row.data.role || 'worker',
          is_primary: row.data.is_primary || false,
          notes: row.data.notes
        });

        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: row.rowNumber,
          column: '',
          columnDisplayName: '',
          value: null,
          error: error.message,
          severity: 'error'
        });
      }
    }));
  }
}

async function importStoreNotes(rows: ValidatedRow[], result: ImportResult) {

  // Fetch all stores from store_master for flexible matching (same as invoices)
  const { data: allStores, error: storesError } = await supabase
    .from('store_master')
    .select('id, store_name, address, phone');

  if (storesError || !allStores) {
    console.error('[Notes Import] Failed to fetch stores for matching:', storesError);
    result.failed = rows.length;
    return;
  }

  // Create lookup maps for flexible matching
  const storeByExactName: Record<string, string> = {};
  const storeByNormalizedName: Record<string, string> = {};
  const storeByPhone: Record<string, string> = {};
  const storeByAddress: Record<string, string> = {};
  const storeByAddressInName: Record<string, string> = {}; // For "(address) name" patterns

  allStores.forEach(store => {
    if (store.store_name) {
      // Exact match (case-insensitive, trimmed)
      const exactName = store.store_name.toLowerCase().trim();
      storeByExactName[exactName] = store.id;
      
      // Normalized match (collapsed spaces, normalized chars)
      const normalizedName = normalizeForMatch(store.store_name);
      storeByNormalizedName[normalizedName] = store.id;
      
      // Extract address from name pattern like "(123 Main St) Store Name"
      const addressInName = extractAddressFromName(store.store_name);
      if (addressInName) {
        storeByAddressInName[addressInName] = store.id;
      }
    }
    if (store.phone) {
      const normalizedPhone = String(store.phone).replace(/\D/g, '');
      if (normalizedPhone.length >= 7) {
        storeByPhone[normalizedPhone] = store.id;
      }
    }
    if (store.address) {
      const normalizedAddress = normalizeForMatch(store.address);
      storeByAddress[normalizedAddress] = store.id;
    }
  });

  console.log('[Notes Import] Loaded stores for matching:', {
    exactNames: Object.keys(storeByExactName).length,
    addressPatterns: Object.keys(storeByAddressInName).length
  });

  const BATCH_SIZE = 20;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (row) => {
      try {
        const storeName = row.data.store_name?.trim() || '';
        
        // Try to find matching store with priority order
        let storeId: string | null = null;
        let matchMethod = '';

        // Normalize the store name for matching
        const exactStoreName = storeName.toLowerCase().trim();
        const normalizedStoreName = normalizeForMatch(storeName);
        const addressFromStoreName = extractAddressFromName(storeName);

        // 1. Try exact name match first (most reliable)
        if (storeByExactName[exactStoreName]) {
          storeId = storeByExactName[exactStoreName];
          matchMethod = 'exact_name';
        }
        
        // 2. Try normalized name match (handles whitespace/char differences)
        if (!storeId && storeByNormalizedName[normalizedStoreName]) {
          storeId = storeByNormalizedName[normalizedStoreName];
          matchMethod = 'normalized_name';
        }
        
        // 3. Try matching address extracted from store name to store's address-in-name
        if (!storeId && addressFromStoreName && storeByAddressInName[addressFromStoreName]) {
          storeId = storeByAddressInName[addressFromStoreName];
          matchMethod = 'address_in_name';
        }
        
        // 4. Try partial name match (store name contained in input or vice versa)
        if (!storeId) {
          for (const [name, id] of Object.entries(storeByNormalizedName)) {
            const minLen = Math.min(normalizedStoreName.length, name.length);
            if (minLen >= 5) {
              if (normalizedStoreName.includes(name) || name.includes(normalizedStoreName)) {
                storeId = id;
                matchMethod = 'partial_name';
                break;
              }
            }
          }
        }

        // If no match found, skip this note
        if (!storeId) {
          console.log('[Notes Import] No match found for:', { 
            storeName, 
            exactStoreName, 
            normalizedStoreName,
            addressFromStoreName 
          });
          result.skipped++;
          result.errors.push({
            row: row.rowNumber,
            column: 'store_name',
            columnDisplayName: 'Store Name',
            value: storeName,
            error: 'No matching store found',
            severity: 'warning'
          });
          return;
        }
        
        console.log('[Notes Import] Matched:', { storeName, storeId, matchMethod });

        // Parse note date (handles Excel serial numbers and date strings)
        let noteDate = new Date().toISOString();
        if (row.data.note_date) {
          try {
            const dateValue = row.data.note_date;
            let parsed: Date | null = null;
            
            // Check if it's an Excel serial date number (e.g., 46032.42847222222)
            const numValue = Number(dateValue);
            if (!isNaN(numValue) && numValue > 25000 && numValue < 60000) {
              // Excel serial date: days since Dec 30, 1899
              const excelEpoch = new Date(Date.UTC(1899, 11, 30));
              const days = Math.floor(numValue);
              const timeFraction = numValue - days;
              parsed = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000 + timeFraction * 24 * 60 * 60 * 1000);
            } else {
              const dateStr = String(dateValue).trim();
              
              // Try parsing m/d/yyyy h:mm or m/d/yyyy hh:mm format
              const customMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
              if (customMatch) {
                const [, month, day, year, hours, minutes, seconds = '0'] = customMatch;
                parsed = new Date(
                  parseInt(year),
                  parseInt(month) - 1,
                  parseInt(day),
                  parseInt(hours),
                  parseInt(minutes),
                  parseInt(seconds)
                );
              } else {
                // Fallback to standard Date parsing
                parsed = new Date(dateStr);
              }
            }
            
            if (parsed && !isNaN(parsed.getTime())) {
              noteDate = parsed.toISOString();
            }
          } catch (e) {
            console.warn('[Notes Import] Failed to parse note_date:', row.data.note_date);
          }
        }

        // Keep note_text as-is (including HTML content)
        const noteText = row.data.note_text?.trim() 
          || 'Contact customer for partnership details.';

        await supabase.from('store_notes').insert({
          store_id: storeId,
          note_text: noteText,
          created_at: noteDate
        });

        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: row.rowNumber,
          column: '',
          columnDisplayName: '',
          value: null,
          error: error.message,
          severity: 'error'
        });
      }
    }));
  }
  // Note: member_since auto-derivation removed due to type sync issues
  // The notes are already imported with correct created_at timestamps
}

/**
 * Extract address from parentheses pattern like "(123 Main St) Store Name"
 */
function extractAddressFromName(name: string): string | null {
  const match = name.match(/^\s*\(([^)]+)\)/);
  return match ? match[1].toLowerCase().trim() : null;
}

/**
 * Normalize text for fuzzy matching: lowercase, remove extra spaces, normalize special chars
 */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')           // Collapse multiple spaces
    .replace(/['']/g, "'")          // Normalize quotes
    .replace(/[–—]/g, '-');         // Normalize dashes
}

/**
 * Import invoices matched to existing stores by client name
 * Skips rows where no matching store is found
 */
async function importInvoices(rows: ValidatedRow[], result: ImportResult) {
  // First, fetch all stores from store_master for matching
  const { data: allStores, error: storesError } = await supabase
    .from('store_master')
    .select('id, store_name, address, phone');

  if (storesError || !allStores) {
    console.error('Failed to fetch stores for matching:', storesError);
    result.failed = rows.length;
    return;
  }

  // Create lookup maps for flexible matching
  const storeByExactName: Record<string, string> = {};
  const storeByNormalizedName: Record<string, string> = {};
  const storeByPhone: Record<string, string> = {};
  const storeByAddress: Record<string, string> = {};
  const storeByAddressInName: Record<string, string> = {}; // For "(address) name" patterns

  allStores.forEach(store => {
    if (store.store_name) {
      // Exact match (case-insensitive, trimmed)
      const exactName = store.store_name.toLowerCase().trim();
      storeByExactName[exactName] = store.id;
      
      // Normalized match (collapsed spaces, normalized chars)
      const normalizedName = normalizeForMatch(store.store_name);
      storeByNormalizedName[normalizedName] = store.id;
      
      // Extract address from name pattern like "(123 Main St) Store Name"
      const addressInName = extractAddressFromName(store.store_name);
      if (addressInName) {
        storeByAddressInName[addressInName] = store.id;
      }
    }
    if (store.phone) {
      const normalizedPhone = String(store.phone).replace(/\D/g, '');
      if (normalizedPhone.length >= 7) {
        storeByPhone[normalizedPhone] = store.id;
      }
    }
    if (store.address) {
      const normalizedAddress = normalizeForMatch(store.address);
      storeByAddress[normalizedAddress] = store.id;
    }
  });

  console.log('[Invoice Import] Loaded stores for matching:', {
    exactNames: Object.keys(storeByExactName).length,
    addressPatterns: Object.keys(storeByAddressInName).length
  });

  const BATCH_SIZE = 20;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (row) => {
      try {
        const clientName = row.data.client_name?.trim() || '';
        const clientPhone = row.data.client_phone ? String(row.data.client_phone).replace(/\D/g, '') : '';
        const clientAddress = row.data.client_address?.toLowerCase().trim() || '';

        // Try to find matching store with priority order
        let storeId: string | null = null;
        let matchMethod = '';

        // Normalize the client name for matching
        const exactClientName = clientName.toLowerCase().trim();
        const normalizedClientName = normalizeForMatch(clientName);
        const addressFromClientName = extractAddressFromName(clientName);

        // 1. Try exact name match first (most reliable)
        if (storeByExactName[exactClientName]) {
          storeId = storeByExactName[exactClientName];
          matchMethod = 'exact_name';
        }
        
        // 2. Try normalized name match (handles whitespace/char differences)
        if (!storeId && storeByNormalizedName[normalizedClientName]) {
          storeId = storeByNormalizedName[normalizedClientName];
          matchMethod = 'normalized_name';
        }
        
        // 3. Try matching address extracted from client name to store's address-in-name
        if (!storeId && addressFromClientName && storeByAddressInName[addressFromClientName]) {
          storeId = storeByAddressInName[addressFromClientName];
          matchMethod = 'address_in_name';
        }
        
        // 4. Try partial name match (store name contained in client name or vice versa)
        if (!storeId) {
          for (const [storeName, id] of Object.entries(storeByNormalizedName)) {
            // Only match if significant overlap (at least 10 chars or 50% of shorter string)
            const minLen = Math.min(normalizedClientName.length, storeName.length);
            if (minLen >= 5) {
              if (normalizedClientName.includes(storeName) || storeName.includes(normalizedClientName)) {
                storeId = id;
                matchMethod = 'partial_name';
                break;
              }
            }
          }
        }

        // 5. Try phone match
        if (!storeId && clientPhone.length >= 7 && storeByPhone[clientPhone]) {
          storeId = storeByPhone[clientPhone];
          matchMethod = 'phone';
        }

        // 6. Try address match
        if (!storeId && clientAddress && storeByAddress[clientAddress]) {
          storeId = storeByAddress[clientAddress];
          matchMethod = 'address';
        }

        // If no match found, skip this invoice
        if (!storeId) {
          console.log('[Invoice Import] No match found for:', { 
            clientName, 
            exactClientName, 
            normalizedClientName,
            addressFromClientName 
          });
          result.skipped++;
          result.errors.push({
            row: row.rowNumber,
            column: 'client_name',
            columnDisplayName: 'Client Name',
            value: clientName,
            error: 'No matching store found',
            severity: 'warning'
          });
          return;
        }
        
        console.log('[Invoice Import] Matched:', { clientName, storeId, matchMethod });

        // Parse amount
        const amountStr = String(row.data.amount || '0').replace(/[^0-9.-]/g, '');
        const amount = parseFloat(amountStr) || 0;

        // Parse due date (handles Excel serial numbers and date strings)
        let dueDate = new Date().toISOString().split('T')[0];
        if (row.data.due_date) {
          try {
            const dateValue = row.data.due_date;
            let parsed: Date | null = null;
            
            // Check if it's an Excel serial date number
            const numValue = Number(dateValue);
            if (!isNaN(numValue) && numValue > 25000 && numValue < 60000) {
              const excelEpoch = new Date(Date.UTC(1899, 11, 30));
              const days = Math.floor(numValue);
              const timeFraction = numValue - days;
              parsed = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000 + timeFraction * 24 * 60 * 60 * 1000);
            } else {
              const dateStr = String(dateValue).trim();
              
              // Try parsing m/d/yyyy h:mm format
              const customMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
              if (customMatch) {
                const [, month, day, year, hours, minutes, seconds = '0'] = customMatch;
                parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds));
              } else {
                parsed = new Date(dateStr);
              }
            }
            
            if (parsed && !isNaN(parsed.getTime())) {
              dueDate = parsed.toISOString().split('T')[0];
            }
          } catch (e) {
            console.warn('Failed to parse due_date:', row.data.due_date);
          }
        }

        // Parse created_at from uploaded file (handles Excel serial numbers and date strings)
        let createdAt: string | undefined;
        if (row.data.created_at) {
          try {
            const dateValue = row.data.created_at;
            let parsed: Date | null = null;
            
            // Check if it's an Excel serial date number (e.g., 46032.42847222222)
            const numValue = Number(dateValue);
            if (!isNaN(numValue) && numValue > 25000 && numValue < 60000) {
              // Excel serial date: days since Dec 30, 1899 (Excel's quirky base date)
              // Convert to JavaScript Date
              const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Dec 30, 1899 UTC
              const days = Math.floor(numValue);
              const timeFraction = numValue - days;
              
              parsed = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000 + timeFraction * 24 * 60 * 60 * 1000);
            } else {
              const dateStr = String(dateValue).trim();
              
              // Try parsing m/d/yyyy h:mm or m/d/yyyy hh:mm format
              const customMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
              if (customMatch) {
                const [, month, day, year, hours, minutes, seconds = '0'] = customMatch;
                parsed = new Date(
                  parseInt(year),
                  parseInt(month) - 1,
                  parseInt(day),
                  parseInt(hours),
                  parseInt(minutes),
                  parseInt(seconds)
                );
              } else {
                // Fallback to standard Date parsing
                parsed = new Date(dateStr);
              }
            }
            
            if (parsed && !isNaN(parsed.getTime())) {
              createdAt = parsed.toISOString();
            }
          } catch (e) {
            console.warn('Failed to parse created_at:', row.data.created_at);
          }
        }

        // Parse payment status - accept any string value
        const paymentStatus = (row.data.payment_status || 'unpaid').toString().toLowerCase().trim() || 'unpaid';

        // Generate invoice number
        const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        // Insert the invoice
        const { error: insertError } = await supabase
          .from('invoices')
          .insert({
            store_id: storeId,
            invoice_number: invoiceNumber,
            total_amount: amount,
            total: amount,
            amount_paid: paymentStatus === 'paid' ? amount : 0,
            due_date: dueDate,
            payment_status: paymentStatus,
            payment_method: row.data.payment_method || null,
            notes: row.data.notes || row.data.title || null,
            brand: row.data.brand || row.data.issued_by || null,
            created_by: row.data.issued_by || null,
            ...(createdAt && { created_at: createdAt })
          });

        if (insertError) {
          throw insertError;
        }

        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: row.rowNumber,
          column: '',
          columnDisplayName: '',
          value: null,
          error: error.message,
          severity: 'error'
        });
      }
    }));
  }
}
