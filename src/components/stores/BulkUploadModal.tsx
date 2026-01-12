/**
 * Bulk Upload Modal for Store Directory
 * Reuses CRM bulk upload logic in a modal interface
 */

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
  Store,
  Users,
  FileText,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { useBulkUpload } from '@/hooks/useBulkUpload';
import { getSchemaByType, getRequiredFields, getOptionalFields } from '@/lib/uploadSchemas';
import { downloadErrorReport } from '@/lib/uploadValidation';

interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  canUpload?: boolean;
}

const uploadTypes = [
  {
    id: 'stores',
    name: 'Stores Only',
    description: 'Import store/location data',
    icon: Store,
    color: 'bg-blue-500'
  },
  {
    id: 'store_contacts',
    name: 'Stores + Contacts',
    description: 'Import contacts linked to stores',
    icon: Users,
    color: 'bg-green-500'
  },
  {
    id: 'store_notes',
    name: 'Stores + Notes',
    description: 'Import historical notes for stores',
    icon: FileText,
    color: 'bg-purple-500'
  },
  {
    id: 'combined_crm',
    name: 'Full CRM Upload',
    description: 'Stores + Contacts + Notes in one file',
    icon: Layers,
    color: 'bg-orange-500'
  }
];

export default function BulkUploadModal({ open, onOpenChange, onSuccess, canUpload = true }: BulkUploadModalProps) {
  const { state, reset, setUploadType, parseFile, updateColumnMapping, validateData, performImport } = useBulkUpload();
  const [dragActive, setDragActive] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'upsert'>('append');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const successCallbackFired = useRef(false);

  const schema = state.uploadType ? getSchemaByType(state.uploadType) : null;

  // Watch for completion and trigger success callback via useEffect
  useEffect(() => {
    if (state.stage === 'COMPLETE' && state.importResult && onSuccess && !successCallbackFired.current) {
      successCallbackFired.current = true;
      onSuccess();
    }
    // Reset the flag when modal closes or state resets
    if (state.stage === 'SELECT_TYPE') {
      successCallbackFired.current = false;
    }
  }, [state.stage, state.importResult, onSuccess]);

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

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
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!state.uploadType) {
      toast.error('Please select an upload type first');
      return;
    }

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      toast.error('Please upload an Excel (.xlsx) or CSV file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    await parseFile(file);
  };

  const handleValidate = () => {
    validateData();
  };

  const handleProceedToUpload = () => {
    // Only allow if import is explicitly ready
    if (!state.isImportReady || validCount === 0) {
      toast.error('Cannot proceed - resolve validation errors first');
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmImport = async () => {
    setShowConfirmDialog(false);
    if (!state.uploadType || !state.isImportReady) {
      toast.error('Import not ready');
      return;
    }
    
    // Set initial progress
    setImportProgress({ current: 0, total: validCount });
    
    await performImport(importMode);
  };

  const handleCancelImport = () => {
    setShowConfirmDialog(false);
  };

  const downloadTemplate = () => {
    if (!schema) return;
    
    const required = getRequiredFields(schema);
    const optional = getOptionalFields(schema);
    const headers = [...required.map(f => f.field), ...optional.map(f => f.field)];
    
    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.uploadType}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  // Determine current step based on stage (deterministic)
  const getStepNumber = () => {
    switch (state.stage) {
      case 'SELECT_TYPE': return 1;
      case 'FILE_UPLOADED': return 2;
      case 'MAPPED': return 3;
      case 'VALIDATED': return 4;
      case 'IMPORT_READY': return 4; // Still on step 4, but import is unlocked
      case 'IMPORTING': return 4;
      case 'COMPLETE': return 5;
      case 'ERROR': return state.step === 'select' ? 1 : 4;
      default: return 1;
    }
  };

  const currentStep = getStepNumber();

  // Count validation results
  const validCount = state.validationResult?.summary.validRows || 0;
  const invalidCount = state.validationResult?.summary.errorRows || 0;

  // Import can proceed when explicitly marked ready by validation
  const canProceedToUpload = state.isImportReady && validCount > 0 && !state.isProcessing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Upload Stores & CRM Data</DialogTitle>
          <DialogDescription>
            Upload Excel or CSV files to import stores, contacts, and notes
          </DialogDescription>
        </DialogHeader>

        {!canUpload ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Permission Required</p>
            <p className="text-sm text-muted-foreground">
              You do not have permission to upload stores.
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            {/* Step Indicator */}
            <div className="flex items-center gap-2 mb-6">
              {['Select Type', 'Upload File', 'Map Columns', 'Validate', 'Import'].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                    currentStep > i + 1 ? 'bg-green-500 text-white' :
                    currentStep === i + 1 ? 'bg-primary text-primary-foreground' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {currentStep > i + 1 ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={`text-xs ${currentStep === i + 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {step}
                  </span>
                  {i < 4 && <div className="w-8 h-px bg-border" />}
                </div>
              ))}
            </div>

            {/* Step 1: Select Upload Type */}
            {currentStep === 1 && (
              <div className="grid grid-cols-2 gap-4">
                {uploadTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setUploadType(type.id)}
                      className="flex items-start gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-left"
                    >
                      <div className={`p-2 rounded-lg ${type.color} text-white`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{type.name}</p>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 2: Upload File */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => reset()}>
                    ← Back
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                </div>

                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                    dragActive ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  {state.isProcessing ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p>Parsing file...</p>
                    </div>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-lg font-medium mb-2">Drag & drop your file here</p>
                      <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                      <Input
                        type="file"
                        accept=".xlsx,.csv"
                        className="max-w-xs mx-auto"
                        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                      />
                      <p className="text-xs text-muted-foreground mt-4">
                        Accepts .xlsx and .csv files up to 10MB
                      </p>
                    </>
                  )}
                </div>

                {schema && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        Required Columns
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {getRequiredFields(schema).map(field => (
                          <Badge key={field.field} variant="destructive" className="text-xs">{field.displayName}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Check className="h-4 w-4 text-muted-foreground" />
                        Optional Columns
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {getOptionalFields(schema).map(field => (
                          <Badge key={field.field} variant="outline" className="text-xs">{field.displayName}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Column Mapping */}
            {currentStep === 3 && state.rawData.length > 0 && schema && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => reset()}>
                    ← Start Over
                  </Button>
                  <Badge variant="outline">
                    {state.rawData.length} rows detected
                  </Badge>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">File Column</TableHead>
                        <TableHead className="w-1/3">Maps To</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {state.columns.map(col => {
                        const mapping = state.columnMapping[col];
                        const schemaField = schema.fields.find(c => c.field === mapping);
                        const isRequired = schemaField?.required;
                        
                        return (
                          <TableRow key={col}>
                            <TableCell className="font-mono text-sm">{col}</TableCell>
                            <TableCell>
                              <Select
                                value={mapping || '_unmapped'}
                                onValueChange={(val) => updateColumnMapping(col, val === '_unmapped' ? '' : val)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="_unmapped">-- Skip --</SelectItem>
                                  {schema.fields.map(schemaCol => (
                                    <SelectItem key={schemaCol.field} value={schemaCol.field}>
                                      {schemaCol.displayName} {schemaCol.required && '*'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {mapping ? (
                                isRequired ? (
                                  <Badge className="bg-green-500">Required ✓</Badge>
                                ) : (
                                  <Badge variant="outline">Optional</Badge>
                                )
                              ) : (
                                <Badge variant="secondary">Skipped</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-2">
                  <Button onClick={handleValidate} disabled={state.isProcessing}>
                    {state.isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Validate Data
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Validation Results */}
            {currentStep === 4 && state.validationResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => reset()}>
                    ← Start Over
                  </Button>
                  <div className="flex gap-2">
                    <Badge className="bg-green-500">{validCount} Valid</Badge>
                    <Badge variant="destructive">{invalidCount} Invalid</Badge>
                  </div>
                </div>

                {invalidCount > 0 && (
                  <div className="border rounded-lg p-4 bg-destructive/5 border-destructive/20">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-destructive" />
                        {invalidCount} rows have errors
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const errors = state.validationResult?.rows
                            .filter(r => r.status === 'error')
                            .flatMap(r => r.errors) || [];
                          downloadErrorReport(errors);
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Error Report
                      </Button>
                    </div>
                    <ScrollArea className="h-32">
                      {state.validationResult.rows.filter(r => r.status === 'error').slice(0, 10).map((row, i) => (
                        <div key={i} className="text-sm py-1 border-b border-border/50 last:border-0">
                          <span className="font-mono text-muted-foreground">Row {row.rowNumber}:</span>{' '}
                          {row.errors.map(e => `${e.column}: ${e.error}`).join('; ')}
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}

                {validCount > 0 && !state.isProcessing && (
                  <div className="border rounded-lg p-4 bg-green-500/5 border-green-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <p className="font-medium">{validCount} rows ready to import</p>
                    </div>
                    
                    <div className="flex items-center gap-4 mb-4">
                      <Label>Import Mode:</Label>
                      <Select value={importMode} onValueChange={(v) => setImportMode(v as any)}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="append">Append Only (Skip Existing)</SelectItem>
                          <SelectItem value="upsert">Update Existing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Import Progress */}
                {state.isProcessing && (
                  <div className="border rounded-lg p-6 bg-primary/5 border-primary/20">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="font-medium">Importing records...</p>
                      <p className="text-sm text-muted-foreground">
                        Please do not close this window or navigate away.
                      </p>
                      <Progress value={50} className="w-full max-w-xs" />
                    </div>
                  </div>
                )}

                {/* Sticky Footer with Proceed Button - Always visible when on validation step */}
                <div className="sticky bottom-0 bg-background pt-4 pb-2 border-t mt-4">
                  {!canProceedToUpload && validCount === 0 && (
                    <div className="text-center text-sm text-muted-foreground mb-2">
                      All rows have errors. Fix the data and re-upload.
                    </div>
                  )}
                  <Button 
                    onClick={handleProceedToUpload} 
                    disabled={!canProceedToUpload}
                    className="w-full"
                    size="lg"
                    title={!canProceedToUpload ? "Resolve validation errors before proceeding." : undefined}
                  >
                    {state.isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {canProceedToUpload 
                          ? `Proceed to Upload (${validCount} records)` 
                          : 'Resolve Errors to Continue'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Complete */}
            {currentStep === 5 && state.importResult && (
              <div className="text-center py-8">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Upload Complete!</h3>
                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-6">
                  <div className="p-3 rounded-lg bg-green-500/10">
                    <p className="text-2xl font-bold text-green-500">{state.importResult.success}</p>
                    <p className="text-xs text-muted-foreground">Inserted</p>
                  </div>
                  <div className="p-3 rounded-lg bg-yellow-500/10">
                    <p className="text-2xl font-bold text-yellow-500">{state.importResult.skipped}</p>
                    <p className="text-xs text-muted-foreground">Skipped</p>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/10">
                    <p className="text-2xl font-bold text-destructive">{state.importResult.failed}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
                <Button onClick={handleClose}>
                  Close
                </Button>
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Upload</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to upload <strong>{validCount}</strong> rows into the CRM.
              </p>
              <p>
                This action will {importMode === 'append' ? 'insert new records only (existing will be skipped)' : 'insert new records and update existing ones'}.
              </p>
              <p className="text-destructive font-medium">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelImport}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>
              <Upload className="h-4 w-4 mr-2" />
              Start Upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}