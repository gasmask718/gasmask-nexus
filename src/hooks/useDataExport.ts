// src/hooks/useDataExport.ts
import { useState, useCallback } from 'react';
import { exportFullOSToExcel, exportGrabbaToExcel } from '@/services/excelExportService';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';

export type ExportCategory = 'owner' | 'grabba' | 'all';

export function useDataExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const { logAction } = useAuditLog();

  const exportCategory = useCallback(async (category: ExportCategory) => {
    setIsExporting(true);
    setExportProgress(`Exporting ${category}...`);

    try {
      let blob: Blob | null = null;
      
      if (category === 'all' || category === 'owner') {
        blob = await exportFullOSToExcel();
      } else if (category === 'grabba') {
        blob = await exportGrabbaToExcel();
      }
      
      if (blob) {
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `Dynasty_${category}_Export_${timestamp}.xlsx`;
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast.success(`${category} export completed`);
        await logAction({
          action: 'export',
          entityType: 'data_export',
          metadata: { category, timestamp: new Date().toISOString() }
        });
        return true;
      } else {
        toast.error(`No data found for ${category}`);
        return false;
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed. Please try again.');
      return false;
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [logAction]);

  const exportAll = useCallback(() => exportCategory('all'), [exportCategory]);

  return {
    isExporting,
    exportProgress,
    exportCategory,
    exportAll,
  };
}
