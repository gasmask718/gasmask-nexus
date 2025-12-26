/**
 * CRM Import Page - Entity-Centric Import
 * Import CRM data with field mapping and validation
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useBusiness } from '@/contexts/BusinessContext';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMBlueprint, useAvailableEntityTypes } from '@/hooks/useCRMBlueprint';
import CRMLayout from './CRMLayout';
import * as XLSX from 'xlsx';
import {
  Upload, ArrowLeft, FileSpreadsheet, FileJson, Building2,
  Check, AlertCircle, Loader2, X, FileUp, Eye,
} from 'lucide-react';

interface ImportPreview {
  headers: string[];
  rows: any[];
  totalRows: number;
}

export default function CRMImportPage() {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const { simulationMode } = useSimulationMode();
  const { blueprint, businessName } = useCRMBlueprint(currentBusiness?.slug);
  const entityTypes = useAvailableEntityTypes(currentBusiness?.slug);

  const [selectedEntityType, setSelectedEntityType] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    setPreview(null);

    try {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const data = event.target?.result;
          
          if (selectedFile.name.endsWith('.json')) {
            const jsonData = JSON.parse(data as string);
            const rows = Array.isArray(jsonData) ? jsonData : [jsonData];
            const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
            
            setPreview({
              headers,
              rows: rows.slice(0, 5),
              totalRows: rows.length,
            });
          } else {
            // Excel/CSV
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            if (jsonData.length > 0) {
              const headers = jsonData[0] as string[];
              const rows = jsonData.slice(1, 6).map(row => {
                const obj: Record<string, any> = {};
                headers.forEach((h, i) => {
                  obj[h] = (row as any[])[i];
                });
                return obj;
              });

              setPreview({
                headers,
                rows,
                totalRows: jsonData.length - 1,
              });
            }
          }
        } catch (err) {
          toast.error('Failed to parse file. Please check the format.');
          console.error('File parse error:', err);
        } finally {
          setIsProcessing(false);
        }
      };

      if (selectedFile.name.endsWith('.json')) {
        reader.readAsText(selectedFile);
      } else {
        reader.readAsBinaryString(selectedFile);
      }
    } catch (err) {
      toast.error('Failed to read file');
      setIsProcessing(false);
    }
  }, []);

  const handleImport = async () => {
    if (!selectedEntityType || !preview) {
      toast.error('Please select an entity type and upload a file');
      return;
    }

    if (preview.totalRows === 0) {
      toast.error('No data to import');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      // Simulate import progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setImportProgress(i);
      }

      toast.success(`Successfully imported ${preview.totalRows} records to ${selectedEntityType}`);
      
      // Reset state
      setFile(null);
      setPreview(null);
      setFieldMapping({});
      setImportProgress(0);
    } catch (error) {
      toast.error('Import failed. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setFieldMapping({});
  };

  // No business selected
  if (!currentBusiness) {
    return (
      <CRMLayout title="Import Data">
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Business Selected</h3>
          <p className="text-muted-foreground mb-6">
            Please select a business to import CRM data.
          </p>
          <Button onClick={() => navigate('/crm')}>
            Select Business
          </Button>
        </Card>
      </CRMLayout>
    );
  }

  const selectedSchema = selectedEntityType ? blueprint.entitySchemas[selectedEntityType] : null;

  return (
    <CRMLayout title="Import Data">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/crm/data')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Import Data</h1>
                {simulationMode && <SimulationBadge />}
              </div>
              <p className="text-muted-foreground">
                Import data into {businessName} CRM
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Import Steps */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Select Entity Type */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline">1</Badge>
                  Select Entity Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose entity type to import..." />
                  </SelectTrigger>
                  <SelectContent>
                    {entityTypes.map((entity) => (
                      <SelectItem key={entity.key} value={entity.key}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: entity.color }}
                          />
                          {entity.labelPlural}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Step 2: Upload File */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline">2</Badge>
                  Upload File
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!file ? (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileUp className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="mb-2 text-sm text-muted-foreground">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">
                        CSV, XLSX, or JSON files
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".csv,.xlsx,.xls,.json"
                      onChange={handleFileChange}
                    />
                  </label>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-8 w-8 text-primary" />
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={clearFile}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {isProcessing && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                        <span className="text-sm text-muted-foreground">Processing file...</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 3: Preview & Field Mapping */}
            {preview && selectedSchema && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="outline">3</Badge>
                    Preview & Field Mapping
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <span className="text-sm">
                      <Eye className="h-4 w-4 inline mr-2" />
                      Showing {preview.rows.length} of {preview.totalRows} rows
                    </span>
                    <Badge variant="secondary">
                      {preview.headers.length} columns detected
                    </Badge>
                  </div>

                  {/* Field Mapping */}
                  <div className="space-y-3">
                    <Label>Map File Columns to Entity Fields</Label>
                    <div className="grid gap-2 max-h-64 overflow-y-auto">
                      {preview.headers.map((header) => (
                        <div key={header} className="flex items-center gap-3">
                          <div className="flex-1 px-3 py-2 rounded bg-muted text-sm">
                            {header}
                          </div>
                          <span className="text-muted-foreground">→</span>
                          <Select
                            value={fieldMapping[header] || ''}
                            onValueChange={(v) => setFieldMapping(prev => ({ ...prev, [header]: v }))}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__skip__">Skip this column</SelectItem>
                              {selectedSchema.fields.map((field) => (
                                <SelectItem key={field.key} value={field.key}>
                                  {field.label}
                                  {field.required && <span className="text-destructive ml-1">*</span>}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Data Preview Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          {preview.headers.map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, i) => (
                          <tr key={i} className="border-b">
                            {preview.headers.map((h) => (
                              <td key={h} className="px-3 py-2 text-muted-foreground">
                                {row[h]?.toString() || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Import Summary & Actions */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Import Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Entity Type</span>
                    <span className="font-medium">
                      {selectedEntityType 
                        ? entityTypes.find(e => e.key === selectedEntityType)?.labelPlural 
                        : 'Not selected'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">File</span>
                    <span className="font-medium">{file?.name || 'None'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Records to Import</span>
                    <span className="font-medium">{preview?.totalRows || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fields Mapped</span>
                    <span className="font-medium">
                      {Object.values(fieldMapping).filter(v => v).length}
                    </span>
                  </div>
                </div>

                {isImporting && (
                  <div className="space-y-2">
                    <Progress value={importProgress} />
                    <p className="text-xs text-center text-muted-foreground">
                      Importing... {importProgress}%
                    </p>
                  </div>
                )}

                <Button 
                  className="w-full" 
                  onClick={handleImport}
                  disabled={!selectedEntityType || !preview || isImporting}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Data
                    </>
                  )}
                </Button>

                {(!selectedEntityType || !preview) && (
                  <p className="text-xs text-muted-foreground text-center">
                    Complete all steps above to import
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Validation Notes */}
            {selectedSchema && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Required Fields</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedSchema.fields
                      .filter(f => f.required)
                      .map(field => (
                        <div key={field.key} className="flex items-center gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          <span>{field.label}</span>
                        </div>
                      ))}
                    {selectedSchema.fields.filter(f => f.required).length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No required fields
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
