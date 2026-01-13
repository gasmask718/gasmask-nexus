/**
 * CRM Bulk Upload Page
 * Hardened upload system with schema validation, row-level errors, and audit logging
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
  AlertTriangle,
  Store,
  Users,
  FileText,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { useBulkUpload } from '@/hooks/useBulkUpload';
import { uploadSchemas, getSchemaByType, getRequiredFields, getOptionalFields } from '@/lib/uploadSchemas';
import { downloadErrorReport, RowValidationError } from '@/lib/uploadValidation';

const uploadTypes = [
  {
    id: 'stores',
    name: 'Stores',
    description: 'Import store/location data',
    icon: Store,
    color: 'bg-blue-500'
  },
  {
    id: 'store_contacts',
    name: 'Store Contacts',
    description: 'Import contacts linked to stores',
    icon: Users,
    color: 'bg-green-500'
  },
  {
    id: 'store_notes',
    name: 'Store Notes',
    description: 'Import historical notes for stores',
    icon: FileText,
    color: 'bg-purple-500'
  },
  {
    id: 'combined_crm',
    name: 'Combined CRM',
    description: 'Stores + Contacts + Notes in one file',
    icon: Layers,
    color: 'bg-orange-500'
  }
];

export default function CRMBulkUpload() {
  const navigate = useNavigate();
  const { state, reset, setUploadType, parseFile, updateColumnMapping, validateData, performImport } = useBulkUpload();
  const [dragActive, setDragActive] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'upsert'>('append');

  const schema = state.uploadType ? getSchemaByType(state.uploadType) : null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseFile(e.target.files[0]);
    }
  };

  const downloadTemplate = () => {
    if (!schema) return;
    
    const headers = schema.fields.map(f => f.field).join(',');
    const exampleRow = schema.fields.map(f => {
      switch (f.type) {
        case 'date': return '2024-01-15';
        case 'email': return 'example@email.com';
        case 'phone': return '555-123-4567';
        case 'boolean': return 'true';
        case 'tags': return 'tag1,tag2';
        default: return f.notes || 'Sample value';
      }
    }).join(',');
    
    const csv = `${headers}\n${exampleRow}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.uploadType}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderStepIndicator = () => {
    const steps = ['Select Type', 'Upload', 'Map Columns', 'Preview', 'Complete'];
    const currentIndex = 
      state.step === 'select' ? 0 :
      state.step === 'upload' ? 1 :
      state.step === 'validate' ? 2 :
      state.step === 'preview' || state.step === 'importing' ? 3 :
      4;

    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              ${i < currentIndex ? 'bg-primary text-primary-foreground' : 
                i === currentIndex ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' : 
                'bg-muted text-muted-foreground'}
            `}>
              {i < currentIndex ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-2 ${i < currentIndex ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">CRM Bulk Upload</h1>
          <p className="text-muted-foreground">
            Safe, validated bulk import with audit logging
          </p>
        </div>
      </div>

      {renderStepIndicator()}

      {/* Step 1: Select Upload Type */}
      {state.step === 'select' && (
        <div className="grid gap-4 md:grid-cols-2">
          {uploadTypes.map((type) => {
            const Icon = type.icon;
            return (
              <Card
                key={type.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setUploadType(type.id)}
              >
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className={`p-3 rounded-lg ${type.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{type.name}</CardTitle>
                    <CardDescription>{type.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      {/* Step 2: Upload File */}
      {state.step === 'upload' && schema && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upload {schema.displayName}</CardTitle>
                <CardDescription>{schema.description}</CardDescription>
              </div>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Schema Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <h4 className="font-medium text-green-700 dark:text-green-400 mb-2">
                  Required Fields ({getRequiredFields(schema).length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {getRequiredFields(schema).map(f => (
                    <Badge key={f.field} variant="outline" className="bg-green-500/10">
                      {f.displayName}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-2">
                  Optional Fields ({getOptionalFields(schema).length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {getOptionalFields(schema).map(f => (
                    <Badge key={f.field} variant="outline" className="bg-blue-500/10">
                      {f.displayName}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Dropzone */}
            <div
              className={`
                border-2 border-dashed rounded-lg p-12 text-center transition-colors
                ${dragActive ? 'border-primary bg-primary/5' : 'border-border'}
                ${state.isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                disabled={state.isProcessing}
              />
              {state.isProcessing ? (
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
              ) : (
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              )}
              <p className="text-lg font-medium mb-1">
                {state.isProcessing ? 'Processing...' : 'Drop file here or click to browse'}
              </p>
              <p className="text-sm text-muted-foreground">
                Supports CSV and Excel files (xlsx, xls)
              </p>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={reset}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Column Mapping & Validation */}
      {state.step === 'validate' && schema && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <CardDescription>
              {state.fileName} • {state.rawData.length} rows detected
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Excel Column</TableHead>
                    <TableHead>Sample Data</TableHead>
                    <TableHead>Maps To</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.columns.map((col) => {
                    const mapped = state.columnMapping[col];
                    const field = schema.fields.find(f => f.field === mapped);
                    const sampleValue = state.rawData[0]?.[col];
                    
                    return (
                      <TableRow key={col}>
                        <TableCell className="font-medium">{col}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {String(sampleValue || '—')}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapped || ''}
                            onValueChange={(v) => updateColumnMapping(col, v)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__skip__">
                                Skip this column
                              </SelectItem>
                              {schema.fields.map(f => (
                                <SelectItem key={f.field} value={f.field}>
                                  {f.displayName} {f.required && '*'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {mapped && mapped !== '__skip__' ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Mapped
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Skipped
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setUploadType(state.uploadType || '')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={validateData} 
                disabled={state.isProcessing}
                className="flex-1"
              >
                {state.isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                Validate Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Preview & Import */}
      {(state.step === 'preview' || state.step === 'importing') && state.validationResult && (
        <Card>
          <CardHeader>
            <CardTitle>Preview & Import</CardTitle>
            <CardDescription>
              Review validation results before importing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 rounded-lg border bg-card">
                <p className="text-sm text-muted-foreground">Total Rows</p>
                <p className="text-2xl font-bold">{state.validationResult.summary.totalRows}</p>
              </div>
              <div className="p-4 rounded-lg border bg-green-500/10">
                <p className="text-sm text-green-600">Valid</p>
                <p className="text-2xl font-bold text-green-600">
                  {state.validationResult.summary.validRows}
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-yellow-500/10">
                <p className="text-sm text-yellow-600">Warnings</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {state.validationResult.summary.warningRows}
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-red-500/10">
                <p className="text-sm text-red-600">Errors</p>
                <p className="text-2xl font-bold text-red-600">
                  {state.validationResult.summary.errorRows}
                </p>
              </div>
            </div>

            {/* Error List */}
            {state.validationResult.errors.length > 0 && (
              <div className="border rounded-lg p-4 bg-red-500/5 border-red-500/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">
                      {state.validationResult.errors.length} Validation Errors
                    </span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadErrorReport(state.validationResult!.errors)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Error Report
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {state.validationResult.errors.slice(0, 10).map((err, i) => (
                    <div key={i} className="text-sm p-2 rounded bg-background border">
                      <span className="font-medium">Row {err.row}</span>
                      <span className="text-muted-foreground"> — </span>
                      <span className="text-red-600">{err.error}</span>
                      {err.columnDisplayName && (
                        <span className="text-muted-foreground"> ({err.columnDisplayName})</span>
                      )}
                    </div>
                  ))}
                  {state.validationResult.errors.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      +{state.validationResult.errors.length - 10} more errors
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Import Mode */}
            <div className="flex items-center gap-4">
              <Label>Import Mode:</Label>
              <Select value={importMode} onValueChange={(v: 'append' | 'upsert') => setImportMode(v)}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="append">Append Only (Insert New)</SelectItem>
                  <SelectItem value="upsert">Upsert (Insert or Update)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Warning if error rows */}
            {state.validationResult.summary.errorRows > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-700 dark:text-yellow-400">
                    Rows with errors will be skipped
                  </p>
                  <p className="text-sm text-yellow-600">
                    Only {state.validationResult.summary.validRows} valid rows will be imported.
                    Download the error report to review and fix the issues.
                  </p>
                </div>
              </div>
            )}

            {/* Progress during import */}
            {state.step === 'importing' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Importing data...</span>
                </div>
                <Progress value={undefined} className="h-2" />
              </div>
            )}

            <div className="flex gap-4">
              <Button 
                variant="outline" 
                onClick={() => validateData()}
                disabled={state.step === 'importing'}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Re-validate
              </Button>
              <Button 
                onClick={() => performImport(importMode)}
                disabled={state.step === 'importing' || state.validationResult.summary.validRows === 0}
                className="flex-1"
              >
                {state.step === 'importing' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {state.validationResult.summary.validRows} Rows
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Complete */}
      {state.step === 'complete' && state.importResult && (
        <Card className="text-center">
          <CardContent className="py-12">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold mb-2">Import Complete!</h2>
            <p className="text-muted-foreground mb-8">
              Your data has been imported successfully
            </p>

            {/* Results Summary */}
            <div className="grid gap-4 md:grid-cols-3 max-w-lg mx-auto mb-8">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-green-600">Imported</p>
                <p className="text-2xl font-bold text-green-600">{state.importResult.success}</p>
              </div>
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-yellow-600">Skipped</p>
                <p className="text-2xl font-bold text-yellow-600">{state.importResult.skipped}</p>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{state.importResult.failed}</p>
              </div>
            </div>

            {/* Import errors */}
            {state.importResult.errors.length > 0 && (
              <div className="mb-8">
                <Button 
                  variant="outline"
                  onClick={() => downloadErrorReport(state.importResult!.errors, 'import_errors.csv')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Import Errors
                </Button>
              </div>
            )}

            {/* Audit log reference */}
            {state.importResult.auditLogId && (
              <p className="text-xs text-muted-foreground mb-8">
                Audit Log ID: {state.importResult.auditLogId}
              </p>
            )}

            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={reset}>
                Import More Data
              </Button>
              <Button onClick={() => navigate('/stores')}>
                View Stores
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {state.step === 'error' && (
        <Card className="text-center border-red-500/20">
          <CardContent className="py-12">
            <XCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold mb-2">Upload Failed</h2>
            <p className="text-muted-foreground mb-4">
              {state.error || 'An unexpected error occurred'}
            </p>
            <Button onClick={reset}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
