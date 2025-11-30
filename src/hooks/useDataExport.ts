// src/hooks/useDataExport.ts
import { useState, useCallback } from 'react';
import { exportAndDownload, ExportCategory } from '@/services/excelExportService';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';

export function useDataExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const { logAction } = useAuditLog();

  const exportCategory = useCallback(async (category: ExportCategory | 'all') => {
    setIsExporting(true);
    setExportProgress(`Exporting ${category}...`);

    try {
      const success = await exportAndDownload(category);
      
      if (success) {
        toast.success(`${category === 'all' ? 'Full' : category} export completed`);
        await logAction({
          action: 'export',
          entityType: 'data_export',
          metadata: { category, timestamp: new Date().toISOString() }
        });
      } else {
        toast.error(`No data found for ${category}`);
      }
      
      return success;
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
