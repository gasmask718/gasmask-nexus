import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { GeocodingService } from '@/services/geocoding';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportRow {
  name: string;
  type: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  phone?: string;
  email?: string;
  status?: string;
}

interface ImportResult {
  row: number;
  name: string;
  status: 'success' | 'error' | 'updated';
  message: string;
}

const BatchImport = () => {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [summary, setSummary] = useState<{ created: number; updated: number; failed: number } | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResults([]);
    setSummary(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<ImportRow>(worksheet);

      if (jsonData.length === 0) {
        toast({
          title: 'Empty File',
          description: 'The uploaded file contains no data.',
          variant: 'destructive',
        });
        setImporting(false);
        return;
      }

      const importResults: ImportResult[] = [];
      let created = 0;
      let updated = 0;
      let failed = 0;

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNum = i + 2; // Excel row (accounting for header)

        try {
          // Validate required fields
          if (!row.name || !row.type) {
            importResults.push({
              row: rowNum,
              name: row.name || 'Unknown',
              status: 'error',
              message: 'Missing required fields (name, type)',
            });
            failed++;
            continue;
          }

          // Check if store exists
          const { data: existingStore } = await supabase
            .from('stores')
            .select('id')
            .eq('name', row.name)
            .maybeSingle();

          // Geocode address if provided
          let lat = null;
          let lng = null;
          if (row.address_street || row.address_city) {
            const geocodeResult = await GeocodingService.geocodeAddress(
              row.address_street,
              row.address_city,
              row.address_state,
              row.address_zip
            );

            if ('error' in geocodeResult) {
              console.warn(`Geocoding failed for ${row.name}:`, geocodeResult.error);
            } else {
              lat = geocodeResult.lat;
              lng = geocodeResult.lng;
            }
          }

          const storeData = {
            name: row.name,
            type: row.type as any,
            address_street: row.address_street || null,
            address_city: row.address_city || null,
            address_state: row.address_state || null,
            address_zip: row.address_zip || null,
            phone: row.phone || null,
            email: row.email || null,
            status: (row.status as any) || 'prospect',
            lat,
            lng,
          };

          if (existingStore) {
            // Update existing store
            const { error } = await supabase
              .from('stores')
              .update(storeData)
              .eq('id', existingStore.id);

            if (error) throw error;

            importResults.push({
              row: rowNum,
              name: row.name,
              status: 'updated',
              message: 'Store updated successfully',
            });
            updated++;
          } else {
            // Create new store
            const { error } = await supabase.from('stores').insert(storeData);

            if (error) throw error;

            importResults.push({
              row: rowNum,
              name: row.name,
              status: 'success',
              message: lat && lng ? 'Store created and geocoded' : 'Store created (no coordinates)',
            });
            created++;
          }
        } catch (error) {
          console.error(`Error processing row ${rowNum}:`, error);
          importResults.push({
            row: rowNum,
            name: row.name || 'Unknown',
            status: 'error',
            message: error instanceof Error ? error.message : 'Import failed',
          });
          failed++;
        }
      }

      setResults(importResults);
      setSummary({ created, updated, failed });

      toast({
        title: 'Import Complete',
        description: `Created: ${created}, Updated: ${updated}, Failed: ${failed}`,
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to process file',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Batch Import</h2>
        <p className="text-muted-foreground mt-2">
          Upload Excel or CSV files to bulk import stores with automatic geocoding
        </p>
      </div>

      <Card className="p-6 glass-card">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Upload Store Data</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your file should include these columns: <code className="bg-muted px-1 py-0.5 rounded">name</code>,{' '}
                <code className="bg-muted px-1 py-0.5 rounded">type</code>,{' '}
                <code className="bg-muted px-1 py-0.5 rounded">address_street</code>,{' '}
                <code className="bg-muted px-1 py-0.5 rounded">address_city</code>,{' '}
                <code className="bg-muted px-1 py-0.5 rounded">address_state</code>,{' '}
                <code className="bg-muted px-1 py-0.5 rounded">address_zip</code>,{' '}
                <code className="bg-muted px-1 py-0.5 rounded">phone</code>
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="default"
                  disabled={importing}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importing ? 'Importing...' : 'Choose File'}
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {summary && (
        <Card className="p-6 glass-card">
          <h3 className="font-semibold mb-4">Import Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{summary.created}</p>
                <p className="text-sm text-muted-foreground">Created</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{summary.updated}</p>
                <p className="text-sm text-muted-foreground">Updated</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{summary.failed}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {results.length > 0 && (
        <Card className="p-6 glass-card">
          <h3 className="font-semibold mb-4">Import Details</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((result, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-background/50"
              >
                {result.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />}
                {result.status === 'updated' && <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />}
                {result.status === 'error' && <XCircle className="h-5 w-5 text-red-500 mt-0.5" />}
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    Row {result.row}: {result.name}
                  </p>
                  <p className="text-sm text-muted-foreground">{result.message}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default BatchImport;
