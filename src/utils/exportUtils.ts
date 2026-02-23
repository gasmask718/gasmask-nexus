import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export type ExportFormat = 'csv' | 'excel' | 'json';

export const MAX_EXPORT_ROWS = 10000;

interface ExportOptions {
  filename: string;
  format: ExportFormat;
  data: Record<string, unknown>[];
  columns?: { key: string; label: string }[];
}

export function exportData({ filename, format, data, columns }: ExportOptions) {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Enforce export row limit
  if (data.length > MAX_EXPORT_ROWS) {
    toast.warning(`Export truncated to ${MAX_EXPORT_ROWS.toLocaleString()} rows (${data.length.toLocaleString()} total)`);
    data = data.slice(0, MAX_EXPORT_ROWS);
  }

  // If columns specified, filter and rename data
  let exportData = data;
  if (columns && columns.length > 0) {
    exportData = data.map(row => {
      const newRow: Record<string, unknown> = {};
      columns.forEach(col => {
        newRow[col.label] = row[col.key];
      });
      return newRow;
    });
  }

  switch (format) {
    case 'csv':
      exportToCSV(exportData, filename);
      break;
    case 'excel':
      exportToExcel(exportData, filename);
      break;
    case 'json':
      exportToJSON(exportData, filename);
      break;
  }
}

function exportToCSV(data: Record<string, unknown>[], filename: string) {
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        const stringValue = value === null || value === undefined ? '' : String(value);
        return `"${stringValue.replace(/"/g, '""')}"`;
      }).join(',')
    )
  ];
  
  const csvString = csvRows.join('\n');
  downloadFile(csvString, `${filename}.csv`, 'text/csv');
}

function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

function exportToJSON(data: Record<string, unknown>[], filename: string) {
  const jsonString = JSON.stringify(data, null, 2);
  downloadFile(jsonString, `${filename}.json`, 'application/json');
}

function downloadFile(content: string, filename: string, mimeType: string) {
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

// Export dropdown component helper
export function getExportMenuItems(
  data: Record<string, unknown>[], 
  filename: string,
  columns?: { key: string; label: string }[]
) {
  return [
    {
      label: 'Export as CSV',
      onClick: () => exportData({ filename, format: 'csv', data, columns }),
    },
    {
      label: 'Export as Excel',
      onClick: () => exportData({ filename, format: 'excel', data, columns }),
    },
    {
      label: 'Export as JSON',
      onClick: () => exportData({ filename, format: 'json', data, columns }),
    },
  ];
}
