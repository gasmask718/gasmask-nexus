/**
 * Upload Validation Utilities
 * Row-level validation with detailed error reporting
 */

import { UploadSchema, FieldSchema } from './uploadSchemas';

export interface RowValidationError {
  row: number;
  column: string;
  columnDisplayName: string;
  value: any;
  error: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  rows: ValidatedRow[];
  errors: RowValidationError[];
  warnings: RowValidationError[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    warningRows: number;
  };
}

export interface ValidatedRow {
  rowNumber: number;
  data: Record<string, any>;
  status: 'valid' | 'error' | 'warning';
  errors: RowValidationError[];
  warnings: RowValidationError[];
}

/**
 * Validate column headers against schema
 */
export function validateColumns(
  excelColumns: string[],
  schema: UploadSchema
): {
  valid: string[];
  optional: string[];
  invalid: string[];
  missing: string[];
} {
  const schemaFieldNames = schema.fields.map(f => f.field.toLowerCase());
  const requiredFields = schema.fields.filter(f => f.required).map(f => f.field.toLowerCase());
  
  const normalizedExcelCols = excelColumns.map(c => c.toLowerCase().trim().replace(/\s+/g, '_'));
  
  const valid: string[] = [];
  const optional: string[] = [];
  const invalid: string[] = [];
  
  excelColumns.forEach((col, i) => {
    const normalized = normalizedExcelCols[i];
    if (schemaFieldNames.includes(normalized)) {
      const field = schema.fields.find(f => f.field.toLowerCase() === normalized);
      if (field?.required) {
        valid.push(col);
      } else {
        optional.push(col);
      }
    } else {
      invalid.push(col);
    }
  });
  
  const missing = requiredFields.filter(
    rf => !normalizedExcelCols.includes(rf)
  );
  
  return { valid, optional, invalid, missing };
}

/**
 * Normalize a column name to match schema field
 */
function normalizeColumnName(col: string): string {
  return col.toLowerCase().trim().replace(/\s+/g, '_');
}

/**
 * Find matching field in schema for a column
 */
function findSchemaField(col: string, schema: UploadSchema): FieldSchema | undefined {
  const normalized = normalizeColumnName(col);
  return schema.fields.find(f => f.field.toLowerCase() === normalized);
}

/**
 * Validate a single row against schema
 */
export function validateRow(
  row: Record<string, any>,
  rowNumber: number,
  schema: UploadSchema,
  columnMapping: Record<string, string>
): ValidatedRow {
  const errors: RowValidationError[] = [];
  const warnings: RowValidationError[] = [];
  const transformedData: Record<string, any> = {};
  
  // Check required fields
  for (const field of schema.fields) {
    if (field.required) {
      const excelColumn = Object.keys(columnMapping).find(
        k => columnMapping[k] === field.field
      );
      
      const value = excelColumn ? row[excelColumn] : undefined;
      
      if (value === undefined || value === null || String(value).trim() === '') {
        errors.push({
          row: rowNumber,
          column: field.field,
          columnDisplayName: field.displayName,
          value: value,
          error: `Missing required field: ${field.displayName}`,
          severity: 'error'
        });
      }
    }
  }
  
  // Validate each mapped column
  for (const [excelCol, schemaField] of Object.entries(columnMapping)) {
    if (schemaField === '__skip__') continue;
    
    const field = schema.fields.find(f => f.field === schemaField);
    if (!field) continue;
    
    const rawValue = row[excelCol];
    let value = rawValue;
    
    // Type coercion - ALL values are treated as strings for simplicity
    if (rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== '') {
      // Always convert to string - no special type handling
      value = String(rawValue).trim();
      
      // Run custom validation if defined
      if (field.validation) {
        const validationResult = field.validation(value);
        if (!validationResult.valid) {
          errors.push({
            row: rowNumber,
            column: field.field,
            columnDisplayName: field.displayName,
            value: rawValue,
            error: validationResult.error || 'Validation failed',
            severity: 'error'
          });
        }
      }
    }
    
    transformedData[schemaField] = value;
  }
  
  // CROSS-FIELD VALIDATION: Phone is required when contact_name is provided (combined_crm)
  if (schema.tableName === 'combined') {
    const hasContactName = transformedData.contact_name && String(transformedData.contact_name).trim();
    const hasContactPhone = transformedData.contact_phone && String(transformedData.contact_phone).trim();
    
    if (hasContactName && !hasContactPhone) {
      errors.push({
        row: rowNumber,
        column: 'contact_phone',
        columnDisplayName: 'Contact Phone',
        value: null,
        error: 'Phone number is required when Contact Name is provided',
        severity: 'error'
      });
    }
  }
  
  return {
    rowNumber,
    data: transformedData,
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid',
    errors,
    warnings
  };
}

/**
 * Validate all rows in a dataset
 */
export function validateAllRows(
  rows: Record<string, any>[],
  schema: UploadSchema,
  columnMapping: Record<string, string>
): ValidationResult {
  const validatedRows: ValidatedRow[] = [];
  const allErrors: RowValidationError[] = [];
  const allWarnings: RowValidationError[] = [];
  
  rows.forEach((row, index) => {
    const validated = validateRow(row, index + 1, schema, columnMapping);
    validatedRows.push(validated);
    allErrors.push(...validated.errors);
    allWarnings.push(...validated.warnings);
  });
  
  const validRows = validatedRows.filter(r => r.status === 'valid').length;
  const errorRows = validatedRows.filter(r => r.status === 'error').length;
  const warningRows = validatedRows.filter(r => r.status === 'warning').length;
  
  return {
    valid: errorRows === 0,
    rows: validatedRows,
    errors: allErrors,
    warnings: allWarnings,
    summary: {
      totalRows: rows.length,
      validRows,
      errorRows,
      warningRows
    }
  };
}

/**
 * Generate error report CSV for download
 */
export function generateErrorReportCSV(errors: RowValidationError[]): string {
  const headers = ['Row', 'Column', 'Value', 'Error', 'Severity'];
  const rows = errors.map(e => [
    e.row.toString(),
    e.columnDisplayName,
    String(e.value || ''),
    e.error,
    e.severity
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  return csvContent;
}

/**
 * Download error report as CSV file
 */
export function downloadErrorReport(errors: RowValidationError[], filename?: string): void {
  const csv = generateErrorReportCSV(errors);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `upload_errors_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Duplicate Detection ─────────────────────────────────────────────────────

export interface DuplicateGroup {
  key: string;
  storeName: string;
  address: string;
  fileRows: number[];
  existingStore?: { id: string; name: string; address: string; status: string };
  action: 'append' | 'skip' | 'create_new';
}

/**
 * Detect duplicates within the uploaded file.
 * Same store_name → check address → same address = duplicate.
 */
export function detectIntraFileDuplicates(rows: ValidatedRow[]): DuplicateGroup[] {
  const nameGroups = new Map<string, Map<string, number[]>>();

  for (const row of rows) {
    if (row.status === 'error') continue;
    const name = (row.data.name || row.data.store_name || '').toString().toLowerCase().trim();
    if (!name) continue;
    const address = (row.data.address_street || row.data.address || '').toString().toLowerCase().trim();

    if (!nameGroups.has(name)) nameGroups.set(name, new Map());
    const addrMap = nameGroups.get(name)!;
    if (!addrMap.has(address)) addrMap.set(address, []);
    addrMap.get(address)!.push(row.rowNumber);
  }

  const duplicates: DuplicateGroup[] = [];
  for (const [name, addrMap] of nameGroups) {
    for (const [address, rowNums] of addrMap) {
      if (rowNums.length > 1) {
        duplicates.push({
          key: `file|${name}|${address}`,
          storeName: name,
          address,
          fileRows: rowNums,
          action: 'skip',
        });
      }
    }
  }
  return duplicates;
}

/**
 * Detect duplicates against existing DB stores.
 * Match by store_name (case-insensitive) + address.
 */
export function detectDbDuplicates(
  rows: ValidatedRow[],
  existingStores: { id: string; name: string; address: string; status: string }[]
): DuplicateGroup[] {
  const duplicates: DuplicateGroup[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.status === 'error') continue;
    const name = (row.data.name || row.data.store_name || '').toString().toLowerCase().trim();
    if (!name) continue;
    const address = (row.data.address_street || row.data.address || '').toString().toLowerCase().trim();
    const key = `db|${name}|${address}`;
    if (seen.has(key)) continue;

    const match = existingStores.find(s => {
      const sName = (s.name || '').toLowerCase().trim();
      const sAddr = (s.address || '').toLowerCase().trim();
      return sName === name && (sAddr === address || (!sAddr && !address));
    });

    if (match) {
      seen.add(key);
      const matchingRows = rows
        .filter(r => {
          if (r.status === 'error') return false;
          const rName = (r.data.name || r.data.store_name || '').toString().toLowerCase().trim();
          const rAddr = (r.data.address_street || r.data.address || '').toString().toLowerCase().trim();
          return rName === name && rAddr === address;
        })
        .map(r => r.rowNumber);

      duplicates.push({
        key,
        storeName: match.name,
        address: match.address,
        fileRows: matchingRows,
        existingStore: match,
        action: 'append',
      });
    }
  }
  return duplicates;
}
