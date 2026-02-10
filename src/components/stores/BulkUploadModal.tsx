import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Layers,
  ArrowRight,
  Copy,
  RefreshCw,
  PlusCircle,
  GitMerge,
  Database, // Added Database icon
} from "lucide-react";
import { toast } from "sonner";
import { useBulkUpload } from "@/hooks/useBulkUpload";
import { getSchemaByType, getRequiredFields, getOptionalFields } from "@/lib/uploadSchemas";
import { downloadErrorReport } from "@/lib/uploadValidation";
import ConfirmUploadTable from "./ConfirmUploadTable";

interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  canUpload?: boolean;
}

const uploadTypes = [
  {
    id: "stores",
    name: "Stores Only",
    description: "Import store/location data",
    icon: Store,
    color: "bg-blue-500",
  },
  {
    id: "store_contacts",
    name: "Stores + Contacts",
    description: "Import contacts linked to stores",
    icon: Users,
    color: "bg-green-500",
  },
  {
    id: "store_notes",
    name: "Stores + Notes",
    description: "Import historical notes for stores",
    icon: FileText,
    color: "bg-purple-500",
  },
  {
    id: "combined_crm",
    name: "Full CRM Upload",
    description: "Stores + Contacts + Notes in one file",
    icon: Layers,
    color: "bg-orange-500",
  },
  {
    id: "invoices",
    name: "Invoices",
    description: "Import invoices matched to existing stores",
    icon: FileText,
    color: "bg-amber-500",
  },
];

export default function BulkUploadModal({ open, onOpenChange, onSuccess, canUpload = true }: BulkUploadModalProps) {
  const {
    state,
    reset,
    setUploadType,
    parseFile,
    updateColumnMapping,
    validateData,
    setDuplicateAction,
    proceedToConfirm,
    performImport,
  } = useBulkUpload();

  const [dragActive, setDragActive] = useState(false);
  const [importMode, setImportMode] = useState<"append" | "upsert">("append");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const successCallbackFired = useRef(false);

  const schema = state.uploadType ? getSchemaByType(state.uploadType) : null;

  useEffect(() => {
    if (state.stage === "COMPLETE" && state.importResult && onSuccess && !successCallbackFired.current) {
      successCallbackFired.current = true;
      onSuccess();
    }
    if (state.stage === "SELECT_TYPE") {
      successCallbackFired.current = false;
    }
  }, [state.stage, state.importResult, onSuccess]);

  // Auto-mapping is now handled in useBulkUpload.ts during parseFile with full fuzzy matching

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
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
      toast.error("Please select an upload type first");
      return;
    }
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith(".csv") && !file.name.endsWith(".xlsx")) {
      toast.error("Please upload an Excel (.xlsx) or CSV file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }
    await parseFile(file);
  };

  const handleValidate = () => {
    validateData();
  };

  const handleProceedToConfirm = () => {
    if (!state.isImportReady || validCount === 0) {
      toast.error("Cannot proceed - resolve validation errors first");
      return;
    }
    proceedToConfirm();
  };

  const handleProceedToUpload = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmImport = async () => {
    setShowConfirmDialog(false);
    if (!state.uploadType || !state.isImportReady) {
      toast.error("Import not ready");
      return;
    }
    setImportProgress({ current: 0, total: validCount });
    await performImport(importMode);
  };

  const downloadTemplate = () => {
    if (!schema) return;
    // Use the first 18 fields (primary template columns) for the download
    const templateFields = schema.fields.slice(0, 18);
    const headers = templateFields.map((f) => f.displayName);
    const csvContent = headers.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.uploadType}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  };

  const getStepNumber = () => {
    switch (state.stage) {
      case "SELECT_TYPE":
        return 1;
      case "FILE_UPLOADED":
        return 2;
      case "MAPPED":
        return 3;
      case "VALIDATED":
        return 4;
      case "IMPORT_READY":
        return 4;
      case "CONFIRM":
        return 5;
      case "IMPORTING":
        return 5;
      case "COMPLETE":
        return 6;
      case "ERROR":
        return state.step === "select" ? 1 : 4;
      default:
        return 1;
    }
  };

  const currentStep = getStepNumber();
  const validCount = state.validationResult?.summary.validRows || 0;
  const invalidCount = state.validationResult?.summary.errorRows || 0;
  const canProceedToConfirm = state.isImportReady && validCount > 0 && !state.isProcessing;

  const stepLabels = ["Type", "Upload", "Map", "Validate", "Confirm", "Done"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden outline-none">
        {/* --- FIXED HEADER --- */}
        <div className="px-4 sm:px-6 py-4 border-b shrink-0 bg-background z-10">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Bulk Upload Stores & CRM Data</DialogTitle>
            <DialogDescription>Upload Excel or CSV files to import stores, contacts, and notes.</DialogDescription>
          </DialogHeader>

          {/* Stepper */}
          {canUpload && (
            <div className="mt-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex items-center justify-between min-w-[360px]">
                {stepLabels.map((step, i) => (
                  <div key={step} className="flex items-center gap-1.5 shrink-0">
                    <div
                      className={`flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-[10px] sm:text-xs font-bold transition-colors ${
                        currentStep > i + 1
                          ? "bg-green-500 text-white"
                          : currentStep === i + 1
                            ? "bg-primary text-primary-foreground ring-2 ring-primary/20"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {currentStep > i + 1 ? <Check className="h-3 w-3" /> : i + 1}
                    </div>
                    <span
                      className={`text-[10px] sm:text-xs font-medium hidden sm:inline ${currentStep === i + 1 ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {step}
                    </span>
                    {i < stepLabels.length - 1 && <div className="w-3 sm:w-6 h-px bg-border mx-0.5" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {!canUpload ? (
          <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Permission Required</p>
            <p className="text-sm text-muted-foreground">You do not have permission to upload stores.</p>
          </div>
        ) : (
          /* --- SCROLLABLE BODY --- */
          <ScrollArea className="flex-1 w-full">
            <div className="p-4 sm:p-6 pb-24">
              {/* Step 1: Select Type */}
              {currentStep === 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {uploadTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setUploadType(type.id)}
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent/50 transition-all text-left h-auto"
                      >
                        <div className={`p-2.5 rounded-lg ${type.color} text-white shadow-sm shrink-0`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm sm:text-base">{type.name}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-snug">
                            {type.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step 2: Upload */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <Button variant="ghost" size="sm" onClick={() => reset()} className="-ml-2 self-start">
                      ← Back
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full sm:w-auto">
                      <Download className="h-4 w-4 mr-2" /> Download Template
                    </Button>
                  </div>

                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all duration-200 ${
                      dragActive ? "border-primary bg-primary/5 scale-[0.99]" : "border-border hover:bg-secondary/20"
                    }`}
                  >
                    {state.isProcessing ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-sm font-medium animate-pulse">Parsing file structure...</p>
                      </div>
                    ) : (
                      <>
                        <div className="mx-auto bg-secondary/50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                          <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-lg font-medium mb-1">Drag file here</p>
                        <p className="text-sm text-muted-foreground mb-4">.xlsx or .csv up to 10MB</p>
                        <Input
                          type="file"
                          accept=".xlsx,.csv"
                          className="max-w-[200px] mx-auto cursor-pointer"
                          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                        />
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Mapping */}
              {currentStep === 3 && state.rawData.length > 0 && schema && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => reset()} className="-ml-2">
                      ← Start Over
                    </Button>
                    <Badge variant="secondary" className="hidden sm:inline-flex">
                      {state.rawData.length} rows • {state.columns.length} columns detected
                    </Badge>
                  </div>

                  {/* --- MISSING FIELDS DETECTION & ALERT --- */}
                  {(() => {
                    const requiredDbFields = schema.fields.filter((f) => f.required);

                    const mappedFields = Object.values(state.columnMapping).filter(Boolean);

                    const missingRequired = requiredDbFields.filter((f) => !mappedFields.includes(f.field));

                    return (
                      <div className="space-y-4">
                        {missingRequired.length > 0 ? (
                          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                              <div>
                                <h4 className="font-semibold text-destructive mb-1">Missing Required Columns</h4>
                                <p className="text-sm text-muted-foreground mb-3">
                                  Your file is missing the following required columns.
                                  <br />
                                  <span className="text-xs opacity-80">
                                    Tip: Add these columns to your Excel file (even if empty) and re-upload.
                                  </span>
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {missingRequired.map((f) => (
                                    <Badge key={f.field} variant="destructive">
                                      {f.displayName}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 text-sm flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" /> All required fields are mapped.
                          </div>
                        )}

                        {/* RESPONSIVE MAPPING TABLE */}
                        <div className="border rounded-lg overflow-hidden flex flex-col">
                          <div className="overflow-x-auto">
                            <Table className="min-w-[700px] sm:min-w-full">
                              <TableHeader className="bg-muted/50">
                                <TableRow>
                                  <TableHead className="w-[25%]">File Header</TableHead>
                                  <TableHead className="w-[25%] text-muted-foreground">Sample Data (Row 1)</TableHead>
                                  <TableHead className="w-[30%]">Map To CRM Field</TableHead>
                                  <TableHead className="w-[20%]">Requirement</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {state.columns.map((col) => {
                                  const mapping = state.columnMapping[col];
                                  const sampleValue = (state.rawData[0] as any)?.[col];
                                  const isRequiredMapping = requiredDbFields.some((f) => f.field === mapping);

                                  return (
                                    <TableRow key={col}>
                                      <TableCell className="font-medium text-sm truncate max-w-[150px]" title={col}>
                                        {col}
                                      </TableCell>
                                      <TableCell
                                        className="text-xs text-muted-foreground font-mono truncate max-w-[150px]"
                                        title={String(sampleValue)}
                                      >
                                        {sampleValue !== undefined && sampleValue !== null ? (
                                          String(sampleValue)
                                        ) : (
                                          <span className="italic opacity-50">Empty</span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <Select
                                          value={mapping || "_unmapped"}
                                          onValueChange={(val) =>
                                            updateColumnMapping(col, val === "_unmapped" ? "" : val)
                                          }
                                        >
                                          <SelectTrigger className="h-9 w-full min-w-[160px]">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="_unmapped" className="text-muted-foreground italic">
                                              -- Skip Column --
                                            </SelectItem>
                                            {schema.fields.map((f) => {
                                              const isRequired = f.required;
                                              return (
                                                <SelectItem key={f.field} value={f.field}>
                                                  <span className="flex items-center gap-1.5">
                                                    {isRequired && <span className="text-destructive font-bold">*</span>}
                                                    {f.displayName}
                                                    <span className="text-muted-foreground text-[10px]">({f.field})</span>
                                                  </span>
                                                </SelectItem>
                                              );
                                            })}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        {mapping ? (
                                          <Badge
                                            variant={isRequiredMapping ? "default" : "outline"}
                                            className={isRequiredMapping ? "bg-green-600 hover:bg-green-700" : ""}
                                          >
                                            {isRequiredMapping ? "Required" : "Optional"}
                                          </Badge>
                                        ) : (
                                          <span className="text-xs text-muted-foreground italic">Skipped</span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Step 4: Validation + Duplicate Detection */}
              {currentStep === 4 && state.validationResult && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => reset()} className="-ml-2">
                      ← Start Over
                    </Button>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10">
                        {validCount} Valid
                      </Badge>
                      <Badge variant="outline" className="border-red-500 text-red-600 bg-red-500/10">
                        {invalidCount} Invalid
                      </Badge>
                      {state.duplicates.length > 0 && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10">
                          {state.duplicates.length} Duplicates
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Duplicate Detection Results */}
                  {state.duplicates.length > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
                      <div className="p-4 border-b border-amber-500/10 bg-amber-500/10">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
                              <Copy className="h-5 w-5" />
                              <span>Duplicates Detected ({state.duplicates.length} groups)</span>
                            </div>
                            {/* MODIFIED: Explicitly explain the matching criteria */}
                            <p className="text-xs text-muted-foreground mt-1">
                              These records match existing entries in the database based on <strong>Address</strong> and{" "}
                              <strong>Store Name</strong> (or "No Name").
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => {
                                state.duplicates.forEach((dup) => {
                                  setDuplicateAction(dup.key, "update");
                                });
                                toast.success("All duplicates marked to Update");
                              }}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" /> Update All
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => {
                                state.duplicates.forEach((dup) => {
                                  setDuplicateAction(dup.key, "skip");
                                });
                                toast.success("All duplicates marked to Skip");
                              }}
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Skip All
                            </Button>
                          </div>
                        </div>
                      </div>
                      <ScrollArea className="max-h-[250px] w-full">
                        <div className="p-3 space-y-2">
                          {state.duplicates.map((dup) => {
                            const action = state.duplicateActions[dup.key] || "skip";
                            const isFileDuplicate = dup.fileRows.length > 1;
                            const isCombined = action === "combine";

                            return (
                              <div
                                key={dup.key}
                                className={`flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border transition-colors ${
                                  isCombined ? "bg-green-500/5 border-green-500/30" : "bg-background border-border"
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm truncate flex items-center gap-2">
                                      {dup.storeName || "No Name"}
                                    </p>

                                    {isCombined && (
                                      <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px] shrink-0 gap-1 pl-1 pr-2">
                                        <CheckCircle2 className="h-3 w-3" /> Ready to Merge
                                      </Badge>
                                    )}

                                    {/* MODIFIED: DB Badge Visuals */}
                                    {dup.existingStore && !isCombined && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] shrink-0 gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-100/80"
                                      >
                                        <Database className="h-3 w-3" /> In DB ({dup.existingStore.status})
                                      </Badge>
                                    )}
                                    {!dup.existingStore && !isCombined && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] border-orange-400 text-orange-600 bg-orange-50 dark:bg-orange-900/20 shrink-0"
                                      >
                                        In File × {dup.fileRows.length}
                                      </Badge>
                                    )}
                                  </div>
                                  {dup.address && (
                                    <p className="text-xs text-muted-foreground truncate">{dup.address}</p>
                                  )}
                                  <p className="text-[11px] text-muted-foreground">Rows: {dup.fileRows.join(", ")}</p>
                                </div>
                                <Select value={action} onValueChange={(v) => setDuplicateAction(dup.key, v as any)}>
                                  <SelectTrigger
                                    className={`w-full sm:w-[180px] h-8 text-xs ${isCombined ? "border-green-500 ring-green-500/20" : ""}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {isFileDuplicate && (
                                      <SelectItem value="combine">
                                        <span className="flex items-center gap-1.5 text-green-600 font-medium">
                                          <GitMerge className="h-3 w-3" /> Combine & Merge
                                        </span>
                                      </SelectItem>
                                    )}

                                    {dup.existingStore && (
                                      <>
                                        <SelectItem value="append">
                                          <span className="flex items-center gap-1.5">
                                            <RefreshCw className="h-3 w-3" /> Append to Existing
                                          </span>
                                        </SelectItem>
                                        <SelectItem value="update">
                                          <span className="flex items-center gap-1.5">
                                            <ArrowRight className="h-3 w-3" /> Update (Overwrite)
                                          </span>
                                        </SelectItem>
                                      </>
                                    )}
                                    <SelectItem value="skip">
                                      <span className="flex items-center gap-1.5">
                                        <XCircle className="h-3 w-3" /> Skip Duplicates
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="create_new">
                                      <span className="flex items-center gap-1.5">
                                        <PlusCircle className="h-3 w-3" /> Create New Anyway
                                      </span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {invalidCount > 0 && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 overflow-hidden">
                      <div className="p-4 border-b border-destructive/10 flex flex-col sm:flex-row justify-between gap-3 bg-destructive/10">
                        <div className="flex items-center gap-2 text-destructive font-medium">
                          <XCircle className="h-5 w-5" />
                          <span>Validation Errors ({invalidCount} rows)</span>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => {
                            const errors =
                              state.validationResult?.rows
                                .filter((r) => r.status === "error")
                                .flatMap((r) => r.errors) || [];
                            downloadErrorReport(errors);
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" /> Download Report
                        </Button>
                      </div>

                      <ScrollArea className="h-[200px] bg-background/50">
                        <div className="p-2 divide-y divide-border/50">
                          {state.validationResult.rows
                            .filter((r) => r.status === "error")
                            .slice(0, 50)
                            .map((row, i) => (
                              <div key={i} className="py-2 px-2 text-sm">
                                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded mr-2">
                                  Row {row.rowNumber}
                                </span>
                                <span className="text-destructive inline-block">
                                  {row.errors.map((e) => `${e.column}: ${e.error}`).join("; ")}
                                </span>
                              </div>
                            ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {validCount > 0 && !state.isProcessing && (
                    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 sm:p-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium text-lg">
                          <CheckCircle2 className="h-6 w-6" />
                          Ready to review {validCount} records
                        </div>

                        <div className="space-y-2">
                          <Label>Import mode for non-duplicate records:</Label>
                          <Select value={importMode} onValueChange={(v) => setImportMode(v as any)}>
                            <SelectTrigger className="w-full sm:w-1/2 bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="append">Append Only (Insert new records)</SelectItem>
                              <SelectItem value="upsert">Update Existing (Overwrite by name)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {state.isProcessing && (
                    <div className="rounded-lg border bg-card p-8 flex flex-col items-center justify-center gap-4">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <p className="font-semibold">Validating & checking duplicates...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Confirmation Table */}
              {currentStep === 5 && state.validationResult && !state.isProcessing && !state.importResult && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        validateData();
                      }}
                      className="-ml-2"
                    >
                      ← Back to Validation
                    </Button>
                    <Badge variant="secondary">Reviewing {validCount} records</Badge>
                  </div>

                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                    <p className="font-medium mb-1">Review your records before uploading</p>
                    <p className="text-xs text-muted-foreground">
                      Records tagged as <span className="font-semibold text-amber-600">Append</span> will update
                      existing stores. Records tagged as <span className="font-semibold text-green-600">New</span> will
                      be created fresh. Records tagged as <span className="text-muted-foreground">Skip</span> will be
                      ignored.
                    </p>
                  </div>

                  <ConfirmUploadTable
                    rows={state.validationResult.rows}
                    duplicates={state.duplicates}
                    duplicateActions={state.duplicateActions}
                    columns={state.columns}
                  />
                </div>
              )}

              {/* Importing state */}
              {currentStep === 5 && state.isProcessing && (
                <div className="rounded-lg border bg-card p-8 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="font-semibold">Importing records...</p>
                  <Progress
                    value={importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}
                    className="w-full max-w-xs h-2"
                  />
                </div>
              )}

              {/* Step 6: Success */}
              {currentStep === 6 && state.importResult && (
                <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Import Successful</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg mb-8">
                    <div className="p-4 rounded-xl border bg-card shadow-sm">
                      <p className="text-3xl font-bold text-green-600 mb-1">{state.importResult.success}</p>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Imported</p>
                    </div>
                    <div className="p-4 rounded-xl border bg-card shadow-sm">
                      <p className="text-3xl font-bold text-amber-500 mb-1">{state.importResult.skipped}</p>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Skipped</p>
                    </div>
                    <div className="p-4 rounded-xl border bg-card shadow-sm">
                      <p className="text-3xl font-bold text-destructive mb-1">{state.importResult.failed}</p>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Failed</p>
                    </div>
                  </div>
                  <Button size="lg" onClick={handleClose} className="min-w-[150px]">
                    Close
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* --- FIXED FOOTER --- */}
        {canUpload && currentStep !== 6 && (currentStep === 3 || currentStep === 4 || currentStep === 5) && (
          <div className="p-4 sm:p-6 border-t bg-background z-10 shrink-0">
            {currentStep === 3 && (
              <Button
                onClick={handleValidate}
                disabled={state.isProcessing}
                className="w-full sm:w-auto sm:ml-auto sm:flex"
                size="lg"
              >
                {state.isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" /> Validate Data
                  </>
                )}
              </Button>
            )}

            {currentStep === 4 && !state.isProcessing && (
              <Button onClick={handleProceedToConfirm} disabled={!canProceedToConfirm} className="w-full" size="lg">
                <ArrowRight className="h-4 w-4 mr-2" />
                {canProceedToConfirm ? `Review & Confirm (${validCount} records)` : "Resolve Errors to Continue"}
              </Button>
            )}

            {currentStep === 5 && !state.isProcessing && !state.importResult && (
              <Button onClick={handleProceedToUpload} className="w-full" size="lg">
                <Upload className="h-4 w-4 mr-2" />
                Upload {validCount} Records
              </Button>
            )}
          </div>
        )}
      </DialogContent>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Upload</AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                You are about to upload <strong>{validCount}</strong> rows.
              </p>
              <p>
                Mode: <strong>{importMode === "append" ? "Append" : "Upsert"}</strong>
              </p>
              {state.duplicates.filter((d) => state.duplicateActions[d.key] === "append").length > 0 && (
                <p>
                  <strong>{state.duplicates.filter((d) => state.duplicateActions[d.key] === "append").length}</strong>{" "}
                  records will update existing stores.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>Confirm Upload</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
