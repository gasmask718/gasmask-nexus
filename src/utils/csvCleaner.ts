/**
 * CSV Data Cleaning Utilities
 * Strips formatting, validates numbers, prevents DB overflow
 */

/** Remove currency symbols, commas, spaces from a numeric string */
export function cleanNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  
  const str = String(value).trim();
  
  // Remove $, €, £, commas, spaces
  const cleaned = str.replace(/[$€£,\s]/g, '');
  
  // Handle parentheses as negative: (500) → -500
  const isNeg = /^\(.*\)$/.test(cleaned);
  const final = isNeg ? '-' + cleaned.replace(/[()]/g, '') : cleaned;
  
  const num = Number(final);
  if (isNaN(num)) return null;
  
  return num;
}

/** Validate a number fits within NUMERIC(precision, scale) */
export function fitsNumeric(value: number, precision: number, scale: number): boolean {
  const maxIntDigits = precision - scale;
  const maxValue = Math.pow(10, maxIntDigits) - Math.pow(10, -scale);
  return Math.abs(value) <= maxValue;
}

/** Clean and validate an entire row of CSV data */
export function cleanCsvRow(
  row: Record<string, unknown>,
  numericColumns: string[],
  options?: { maxPrecision?: number; maxScale?: number }
): { cleaned: Record<string, unknown>; warnings: string[] } {
  const precision = options?.maxPrecision ?? 18;
  const scale = options?.maxScale ?? 2;
  const cleaned = { ...row };
  const warnings: string[] = [];

  for (const col of numericColumns) {
    if (col in cleaned) {
      const original = cleaned[col];
      const num = cleanNumericValue(original);
      
      if (num === null && original !== null && original !== undefined && original !== '') {
        warnings.push(`Column "${col}": could not parse "${original}" as number`);
        continue;
      }
      
      if (num !== null && !fitsNumeric(num, precision, scale)) {
        warnings.push(`Column "${col}": value ${num} exceeds NUMERIC(${precision},${scale}) limit`);
      }
      
      cleaned[col] = num;
    }
  }

  return { cleaned, warnings };
}

/** Clean all rows and return summary */
export function cleanCsvData(
  rows: Record<string, unknown>[],
  numericColumns: string[],
  options?: { maxPrecision?: number; maxScale?: number }
): {
  cleanedRows: Record<string, unknown>[];
  totalWarnings: number;
  warningsByColumn: Record<string, number>;
  overflowDetected: boolean;
} {
  const cleanedRows: Record<string, unknown>[] = [];
  const warningsByColumn: Record<string, number> = {};
  let totalWarnings = 0;
  let overflowDetected = false;

  for (const row of rows) {
    const { cleaned, warnings } = cleanCsvRow(row, numericColumns, options);
    cleanedRows.push(cleaned);
    
    for (const w of warnings) {
      totalWarnings++;
      if (w.includes('exceeds')) overflowDetected = true;
      const colMatch = w.match(/Column "(\w+)"/);
      if (colMatch) {
        warningsByColumn[colMatch[1]] = (warningsByColumn[colMatch[1]] || 0) + 1;
      }
    }
  }

  return { cleanedRows, totalWarnings, warningsByColumn, overflowDetected };
}

/** Auto-detect which columns in a dataset are likely numeric */
export function detectNumericColumns(rows: Record<string, unknown>[], sampleSize = 10): string[] {
  if (rows.length === 0) return [];
  
  const sample = rows.slice(0, sampleSize);
  const columns = Object.keys(rows[0]);
  const numericCols: string[] = [];

  for (const col of columns) {
    let numericCount = 0;
    let totalNonEmpty = 0;

    for (const row of sample) {
      const val = row[col];
      if (val === null || val === undefined || val === '') continue;
      totalNonEmpty++;
      if (cleanNumericValue(val) !== null) numericCount++;
    }

    // If >70% of non-empty values parse as numbers, treat as numeric
    if (totalNonEmpty > 0 && numericCount / totalNonEmpty >= 0.7) {
      numericCols.push(col);
    }
  }

  return numericCols;
}
