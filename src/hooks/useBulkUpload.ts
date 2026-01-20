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
  // Track stores that got notes for member_since auto-derivation
  const storeNoteDates: Record<string, string[]> = {};
  const BATCH_SIZE = 20;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (row) => {
      try {
        // Find store by name
        const { data: store } = await supabase
          .from('stores')
          .select('id, open_date')
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

        const noteDate = row.data.note_date 
          ? new Date(row.data.note_date).toISOString()
          : new Date().toISOString();

        // Insert note with default if empty
        const noteText = row.data.note_text?.trim() 
          || 'Contact customer for partnership details.';

        await supabase.from('store_notes').insert({
          store_id: store.id,
          note_text: noteText,
          created_at: noteDate
        });

        // Track note dates for member_since derivation
        if (!storeNoteDates[store.id]) {
          storeNoteDates[store.id] = [];
        }
        storeNoteDates[store.id].push(noteDate);

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

  // Auto-derive member_since from oldest note for stores without one
  for (const [storeId, dates] of Object.entries(storeNoteDates)) {
    const { data: store } = await supabase
      .from('stores')
      .select('open_date')
      .eq('id', storeId)
      .single();

    if (!store?.open_date && dates.length > 0) {
      const oldestDate = dates.sort()[0];
      await supabase
        .from('stores')
        .update({ open_date: oldestDate.split('T')[0] })
        .eq('id', storeId);
    }
  }
}
