import { useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

export default function BatchImport() {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [targetTable, setTargetTable] = useState<string>('');
  const [rawData, setRawData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<any[]>([]);
  const [cleanedData, setCleanedData] = useState<any>(null);
  const [importMode, setImportMode] = useState<'append' | 'upsert' | 'update_only'>('append');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const targetTables = [
    { value: 'crm_customers', label: 'CRM Customers' },
    { value: 'stores', label: 'Stores' },
    { value: 'wholesale_hubs', label: 'Wholesale Hubs' },
    { value: 'drivers', label: 'Drivers' },
    { value: 'influencers', label: 'Influencers' },
    { value: 'products', label: 'Products' },
  ];

  const schemaFields: Record<string, { field: string; type: string; required: boolean }[]> = {
    crm_customers: [
      { field: 'name', type: 'string', required: true },
      { field: 'email', type: 'email', required: false },
      { field: 'phone', type: 'phone', required: false },
      { field: 'address', type: 'string', required: false },
      { field: 'city', type: 'string', required: false },
      { field: 'state', type: 'string', required: false },
      { field: 'zip', type: 'string', required: false },
      { field: 'business_type', type: 'string', required: false },
      { field: 'notes', type: 'string', required: false },
    ],
    stores: [
      { field: 'name', type: 'string', required: true },
      { field: 'type', type: 'enum', required: true },
      { field: 'address_street', type: 'string', required: false },
      { field: 'address_city', type: 'string', required: false },
      { field: 'address_state', type: 'string', required: false },
      { field: 'address_zip', type: 'string', required: false },
      { field: 'phone', type: 'phone', required: false },
      { field: 'email', type: 'email', required: false },
      { field: 'status', type: 'enum', required: false },
      { field: 'notes', type: 'string', required: false },
    ],
    wholesale_hubs: [
      { field: 'name', type: 'string', required: true },
      { field: 'address_street', type: 'string', required: false },
      { field: 'address_city', type: 'string', required: false },
      { field: 'address_state', type: 'string', required: false },
      { field: 'address_zip', type: 'string', required: false },
      { field: 'phone', type: 'phone', required: false },
      { field: 'email', type: 'email', required: false },
      { field: 'status', type: 'enum', required: false },
      { field: 'notes', type: 'string', required: false },
    ],
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);

    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      if (jsonData.length === 0) {
        throw new Error('File is empty');
      }

      setRawData(jsonData);
      setColumns(Object.keys(jsonData[0] as any));

      toast({
        title: "File uploaded",
        description: `${jsonData.length} rows detected`,
      });
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : 'Failed to read file',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoMap = async () => {
    if (!targetTable || columns.length === 0) return;

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-map-columns', {
        body: {
          columns,
          target_table: targetTable,
          sample_rows: rawData.slice(0, 3),
        },
      });

      if (error) throw error;

      if (data?.mappings) {
        setMapping(data.mappings);
        toast({
          title: "Auto-mapping complete",
          description: `Mapped ${data.mappings.length} columns`,
        });
      }
    } catch (error) {
      console.error('Auto-map error:', error);
      toast({
        title: "Auto-mapping failed",
        description: "Please map columns manually",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCleanData = async () => {
    if (mapping.length === 0) {
      toast({
        title: "No mapping",
        description: "Please map columns first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-clean-data', {
        body: {
          rows: rawData,
          target_table: targetTable,
          mapping,
        },
      });

      if (error) throw error;

      setCleanedData(data);
      setStep('preview');
      toast({
        title: "Data cleaned",
        description: data.summary || "Data processing complete",
      });
    } catch (error) {
      console.error('Clean data error:', error);
      toast({
        title: "Cleaning failed",
        description: error instanceof Error ? error.message : 'Failed to clean data',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!cleanedData?.cleaned_rows) return;

    setIsProcessing(true);
    setStep('importing');

    try {
      // Create file record
      const { data: fileRecord, error: fileError } = await supabase
        .from('uploaded_files')
        .insert({
          file_name: file?.name || 'unknown',
          file_type: file?.name.endsWith('.xlsx') ? 'xlsx' : 'csv',
          target_table: targetTable,
          row_count: cleanedData.cleaned_rows.length,
          preview_data: cleanedData.cleaned_rows.slice(0, 25),
          status: 'processing',
        })
        .select()
        .single();

      if (fileError) throw fileError;

      // Save mapping
      await supabase.from('data_import_mapping').insert(
        mapping.map(m => ({
          file_id: fileRecord.id,
          source_column: m.source_column,
          destination_field: m.destination_field,
          type: m.type,
          required: m.required,
        }))
      );

      // Import data
      const { data: importResult, error: importError } = await supabase.functions.invoke('import-cleaned-data', {
        body: {
          file_id: fileRecord.id,
          cleaned_rows: cleanedData.cleaned_rows,
          mapping,
          target_table: targetTable,
          mode: importMode,
        },
      });

      if (importError) throw importError;

      setStep('complete');
      toast({
        title: "Import complete",
        description: `${importResult.rows_inserted} rows imported successfully`,
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : 'Failed to import data',
        variant: "destructive",
      });
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Bulk Data Import</h1>
        <p className="text-muted-foreground">Upload and import CSV or Excel files with AI-powered data cleaning</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-4">
        {['upload', 'mapping', 'preview', 'importing', 'complete'].map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === s ? 'bg-primary text-primary-foreground' :
              ['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(step) > i ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {i + 1}
            </div>
            {i < 4 && <div className={`w-16 h-0.5 ${
              ['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(step) > i ? 'bg-primary' : 'bg-muted'
            }`} />}
          </div>
        ))}
      </div>

      {step === 'upload' && (
        <Card className="p-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Select Target Table</label>
              <Select value={targetTable} onValueChange={setTargetTable}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose where to import data" />
                </SelectTrigger>
                <SelectContent>
                  {targetTables.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={!targetTable || isProcessing}
              />
              <label htmlFor="file-upload" className={`cursor-pointer ${!targetTable ? 'opacity-50' : ''}`}>
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Upload CSV or Excel File</p>
                <p className="text-sm text-muted-foreground">Drag and drop or click to browse</p>
              </label>
            </div>

            {file && (
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  {file.name} - {rawData.length} rows detected
                </AlertDescription>
              </Alert>
            )}

            {rawData.length > 0 && (
              <Button onClick={() => setStep('mapping')} className="w-full">
                Continue to Column Mapping
              </Button>
            )}
          </div>
        </Card>
      )}

      {step === 'mapping' && (
        <Card className="p-8">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Map Columns</h2>
              <Button onClick={handleAutoMap} disabled={isProcessing} variant="outline">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Auto-Map with AI
              </Button>
            </div>

            <div className="space-y-4">
              {columns.map((col, i) => (
                <div key={i} className="grid grid-cols-2 gap-4 items-center">
                  <div className="font-medium">{col}</div>
                  <Select
                    value={mapping.find(m => m.source_column === col)?.destination_field || ''}
                    onValueChange={(value) => {
                      const newMapping = [...mapping];
                      const existingIndex = newMapping.findIndex(m => m.source_column === col);
                      if (existingIndex >= 0) {
                        newMapping[existingIndex].destination_field = value;
                      } else {
                        newMapping.push({
                          source_column: col,
                          destination_field: value,
                          type: 'string',
                          required: false,
                        });
                      }
                      setMapping(newMapping);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Skip this column</SelectItem>
                      {(schemaFields[targetTable] || []).map(field => (
                        <SelectItem key={field.field} value={field.field}>
                          {field.field} {field.required && '*'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={handleCleanData} disabled={mapping.length === 0 || isProcessing} className="flex-1">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Clean Data with AI
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 'preview' && cleanedData && (
        <Card className="p-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Preview Cleaned Data</h2>
              <p className="text-muted-foreground">{cleanedData.summary}</p>
            </div>

            {cleanedData.flagged_rows && cleanedData.flagged_rows.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {cleanedData.flagged_rows.length} rows need review
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Import Mode</label>
                <Select value={importMode} onValueChange={(v: any) => setImportMode(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">Append Only (Insert New)</SelectItem>
                    <SelectItem value="upsert">Upsert (Insert or Update)</SelectItem>
                    <SelectItem value="update_only">Update Only (No Inserts)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      {Object.keys(cleanedData.cleaned_rows[0] || {}).map((key, i) => (
                        <th key={i} className="px-4 py-2 text-left text-sm font-medium">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cleanedData.cleaned_rows.slice(0, 10).map((row: any, i: number) => (
                      <tr key={i} className="border-t">
                        {Object.values(row).map((val: any, j: number) => (
                          <td key={j} className="px-4 py-2 text-sm">{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep('mapping')}>Back</Button>
              <Button onClick={handleImport} disabled={isProcessing} className="flex-1">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Import {cleanedData.cleaned_rows.length} Rows
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 'importing' && (
        <Card className="p-8 text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-2">Importing Data...</h2>
          <p className="text-muted-foreground">Please wait while we import your data</p>
        </Card>
      )}

      {step === 'complete' && (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Import Complete!</h2>
          <p className="text-muted-foreground mb-6">Your data has been successfully imported</p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => {
              setStep('upload');
              setFile(null);
              setRawData([]);
              setColumns([]);
              setMapping([]);
              setCleanedData(null);
            }}>
              Import Another File
            </Button>
            <Button onClick={() => window.history.back()}>
              Return to Dashboard
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
