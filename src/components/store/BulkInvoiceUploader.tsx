import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Upload, FileText, Check, Loader2, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isValid } from 'date-fns';

interface ParsedInvoice {
  row: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
  status: 'unpaid' | 'partial' | 'paid';
  description: string;
  parseStatus: 'valid' | 'error';
  error?: string;
}

interface UploadResult {
  inserted: number;
  errors: string[];
}

interface BulkInvoiceUploaderProps {
  storeId: string;
  storeName: string;
  onClose?: () => void;
}

export function BulkInvoiceUploader({ storeId, storeName, onClose }: BulkInvoiceUploaderProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [parsedInvoices, setParsedInvoices] = useState<ParsedInvoice[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [defaultDate, setDefaultDate] = useState('');
  const [entryMode, setEntryMode] = useState<'line' | 'block'>('line');

  // Generate invoice number
  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}${month}-${random}`;
  };

  // Download CSV template
  const downloadTemplate = () => {
    const template = `invoice_number,invoice_date,due_date,total_amount,amount_paid,status,description
"","2024-01-15","2024-02-15","1200.00","0","unpaid","January service invoice"
"INV-2024-001","2024-02-01","2024-03-01","900.50","500","partial","February partial payment"
"INV-2024-002","2024-02-15","","750.00","750","paid","Product delivery"`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_invoices_template_${storeName.replace(/[^a-z0-9]/gi, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Parse CSV file
  const parseCSV = (content: string): ParsedInvoice[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    
    const dataLines = lines.slice(1);
    const invoices: ParsedInvoice[] = [];
    
    dataLines.forEach((line, index) => {
      // Handle quoted CSV values
      const matches = line.match(/("([^"]*)"|[^,]+)/g);
      if (!matches || matches.length < 4) return;
      
      const cleanValue = (val: string | undefined) => val?.replace(/^"|"$/g, '').trim() || '';
      
      const invoice_number = cleanValue(matches[0]) || generateInvoiceNumber();
      const invoice_date = cleanValue(matches[1]);
      const due_date = cleanValue(matches[2]) || null;
      const total_amount_str = cleanValue(matches[3]);
      const amount_paid_str = cleanValue(matches[4]) || '0';
      const status_str = cleanValue(matches[5])?.toLowerCase() || 'unpaid';
      const description = cleanValue(matches[6]) || '';
      
      // Skip header duplicates or empty rows
      if (!total_amount_str || total_amount_str.toLowerCase() === 'total_amount') {
        return;
      }
      
      let error: string | undefined;
      
      // Validate date
      const parsedDate = parseISO(invoice_date);
      if (!isValid(parsedDate)) {
        error = `Invalid date: "${invoice_date}"`;
      }
      
      // Validate amount
      const total_amount = parseFloat(total_amount_str);
      if (isNaN(total_amount) || total_amount < 0) {
        error = `Invalid amount: "${total_amount_str}"`;
      }
      
      const amount_paid = parseFloat(amount_paid_str) || 0;
      
      // Determine status
      let status: 'unpaid' | 'partial' | 'paid' = 'unpaid';
      if (status_str === 'paid' || amount_paid >= total_amount) {
        status = 'paid';
      } else if (status_str === 'partial' || amount_paid > 0) {
        status = 'partial';
      }
      
      invoices.push({
        row: index + 2,
        invoice_number,
        invoice_date: invoice_date || new Date().toISOString().split('T')[0],
        due_date,
        total_amount: total_amount || 0,
        amount_paid,
        status,
        description,
        parseStatus: error ? 'error' : 'valid',
        error,
      });
    });
    
    return invoices;
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const invoices = parseCSV(content);
      
      if (invoices.length === 0) {
        toast.error('No valid invoices found in CSV');
        return;
      }
      
      setParsedInvoices(invoices);
      
      const errorCount = invoices.filter(n => n.parseStatus === 'error').length;
      if (errorCount > 0) {
        toast.warning(`${errorCount} invoices have errors`);
      } else {
        toast.success(`${invoices.length} invoices ready to import to ${storeName}`);
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Parse LINE MODE invoices (simple format: date | amount | description)
  const parseLineInvoices = (input: string): ParsedInvoice[] => {
    const lines = input.trim().split('\n');
    const invoices: ParsedInvoice[] = [];
    const fallbackDate = defaultDate || new Date().toISOString().split('T')[0];
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      
      // Pattern: "2023-06-01 | 1200 | June service" or just "1200 | June service"
      const parts = trimmedLine.split('|').map(p => p.trim());
      
      let invoiceDate = fallbackDate;
      let totalAmount = 0;
      let description = '';
      let error: string | undefined;
      
      if (parts.length >= 2) {
        // Check if first part is a date
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (datePattern.test(parts[0])) {
          const parsed = parseISO(parts[0]);
          if (isValid(parsed)) {
            invoiceDate = parts[0];
            totalAmount = parseFloat(parts[1]) || 0;
            description = parts.slice(2).join(' | ').trim();
          } else {
            error = `Invalid date: ${parts[0]}`;
          }
        } else {
          // First part is amount
          totalAmount = parseFloat(parts[0]) || 0;
          description = parts.slice(1).join(' | ').trim();
        }
      } else {
        // Just an amount?
        totalAmount = parseFloat(parts[0]) || 0;
      }
      
      if (totalAmount <= 0 && !error) {
        error = 'Invalid or missing amount';
      }
      
      invoices.push({
        row: index + 1,
        invoice_number: generateInvoiceNumber(),
        invoice_date: invoiceDate,
        due_date: null,
        total_amount: totalAmount,
        amount_paid: 0,
        status: 'unpaid',
        description,
        parseStatus: error ? 'error' : 'valid',
        error,
      });
    });
    
    return invoices;
  };

  // Parse BLOCK MODE invoices (detailed format with --- DATE --- delimiters)
  const parseBlockInvoices = (input: string): ParsedInvoice[] => {
    const invoices: ParsedInvoice[] = [];
    const fallbackDate = defaultDate || new Date().toISOString().split('T')[0];
    
    // Split by block delimiter: --- YYYY-MM-DD ---
    const blockPattern = /---\s*(\d{4}-\d{2}-\d{2})\s*---/g;
    const blocks: { date: string; startIndex: number }[] = [];
    let match;
    
    while ((match = blockPattern.exec(input)) !== null) {
      blocks.push({ date: match[1], startIndex: match.index + match[0].length });
    }
    
    if (blocks.length === 0) {
      // No block delimiters - treat as single invoice
      const trimmed = input.trim();
      if (trimmed) {
        const parsed = parseBlockContent(trimmed, fallbackDate);
        if (parsed) {
          invoices.push({ ...parsed, row: 1 });
        }
      }
      return invoices;
    }
    
    // Extract each block's content
    blocks.forEach((block, index) => {
      const endIndex = blocks[index + 1]?.startIndex 
        ? input.lastIndexOf('---', blocks[index + 1].startIndex - 1)
        : input.length;
      
      const content = input.slice(block.startIndex, endIndex).trim();
      
      if (content) {
        const parsed = parseBlockContent(content, block.date);
        if (parsed) {
          invoices.push({ ...parsed, row: index + 1 });
        }
      }
    });
    
    return invoices;
  };

  // Parse block content (extract Total:, Paid:, Status:, Description:)
  const parseBlockContent = (content: string, dateStr: string): Omit<ParsedInvoice, 'row'> | null => {
    const lines = content.split('\n');
    let totalAmount = 0;
    let amountPaid = 0;
    let statusStr = 'unpaid';
    let description = '';
    let error: string | undefined;
    
    const descriptionLines: string[] = [];
    let inDescription = false;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      const lowerLine = trimmed.toLowerCase();
      
      if (lowerLine.startsWith('total:')) {
        totalAmount = parseFloat(trimmed.slice(6).replace(/[$,]/g, '').trim()) || 0;
        inDescription = false;
      } else if (lowerLine.startsWith('paid:')) {
        amountPaid = parseFloat(trimmed.slice(5).replace(/[$,]/g, '').trim()) || 0;
        inDescription = false;
      } else if (lowerLine.startsWith('status:')) {
        statusStr = trimmed.slice(7).trim().toLowerCase();
        inDescription = false;
      } else if (lowerLine.startsWith('description:')) {
        const descPart = trimmed.slice(12).trim();
        if (descPart) descriptionLines.push(descPart);
        inDescription = true;
      } else if (inDescription) {
        descriptionLines.push(trimmed);
      } else if (!lowerLine.includes(':')) {
        // Treat unrecognized lines as description
        descriptionLines.push(trimmed);
      }
    });
    
    description = descriptionLines.join('\n').trim();
    
    // Validate date
    const parsedDate = parseISO(dateStr);
    if (!isValid(parsedDate)) {
      error = `Invalid date: ${dateStr}`;
    }
    
    if (totalAmount <= 0 && !error) {
      error = 'Invalid or missing total amount';
    }
    
    // Determine status
    let status: 'unpaid' | 'partial' | 'paid' = 'unpaid';
    if (statusStr === 'paid' || (amountPaid > 0 && amountPaid >= totalAmount)) {
      status = 'paid';
    } else if (statusStr === 'partial' || amountPaid > 0) {
      status = 'partial';
    }
    
    return {
      invoice_number: generateInvoiceNumber(),
      invoice_date: dateStr,
      due_date: null,
      total_amount: totalAmount,
      amount_paid: amountPaid,
      status,
      description,
      parseStatus: error ? 'error' : 'valid',
      error,
    };
  };

  // Main parse function - routes to correct parser
  const parseManualInvoices = () => {
    const invoices = entryMode === 'line' 
      ? parseLineInvoices(manualInput)
      : parseBlockInvoices(manualInput);
    
    setParsedInvoices(invoices);
    
    if (invoices.length === 0) {
      toast.error('No valid invoices found');
    } else {
      const errorCount = invoices.filter(n => n.parseStatus === 'error').length;
      if (errorCount > 0) {
        toast.warning(`${errorCount} invoices have errors`);
      } else {
        toast.success(`${invoices.length} invoices ready to import to ${storeName}`);
      }
    }
  };

  // Bulk insert mutation
  const bulkInsertMutation = useMutation({
    mutationFn: async (invoices: ParsedInvoice[]) => {
      const validInvoices = invoices.filter(n => n.parseStatus === 'valid');
      const results: UploadResult = { inserted: 0, errors: [] };
      
      for (const invoice of validInvoices) {
        try {
          let createdAt = new Date().toISOString();
          let businessDate: string | null = null;
          if (invoice.invoice_date) {
            const parsed = parseISO(invoice.invoice_date);
            if (isValid(parsed)) {
              createdAt = parsed.toISOString();
              businessDate = format(parsed, 'yyyy-MM-dd');
            }
          }

          if (!businessDate) {
            results.errors.push(`Row ${invoice.row}: missing or invalid invoice date — refusing to import without a business date`);
            continue;
          }

          const { error } = await supabase
            .from('invoices')
            .insert({
              store_id: storeId,
              invoice_number: invoice.invoice_number,
              total_amount: invoice.total_amount,
              subtotal: invoice.total_amount,
              tax: 0,
              payment_status: invoice.status,
              partial_amount: invoice.status === 'partial' ? invoice.amount_paid : null,
              paid_at: invoice.status === 'paid' || invoice.status === 'partial' ? createdAt : null,
              due_date: invoice.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              notes: invoice.description || null,
              created_at: createdAt,
              business_date: businessDate,
              entry_mode: entryMode,
              business_date_source: 'bulk_uploader_v1',
              business_date_source_note: `parsed from ${entryMode} mode row ${invoice.row}`,
            });
          
          if (error) {
            results.errors.push(`Row ${invoice.row}: ${error.message}`);
          } else {
            results.inserted++;
          }

        } catch (err: any) {
          results.errors.push(`Row ${invoice.row}: ${err.message}`);
        }
      }
      
      return results;
    },
    onSuccess: (result) => {
      setUploadResult(result);
      queryClient.invalidateQueries({ queryKey: ['store-invoices', storeId] });
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      // CRITICAL: Invalidate unified feed to sync Floor 5
      queryClient.invalidateQueries({ queryKey: ['unified-invoice-feed'] });
      toast.success(`Imported ${result.inserted} invoices to ${storeName}`);
      setConfirmDialogOpen(false);
      setParsedInvoices([]);
    },
    onError: (error: any) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  const validCount = parsedInvoices.filter(n => n.parseStatus === 'valid').length;
  const errorCount = parsedInvoices.filter(n => n.parseStatus === 'error').length;

  return (
    <div className="space-y-6">
      {/* Store Context Banner */}
      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <span className="font-medium">Importing invoices to: {storeName}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          All invoices will be automatically attached to this store. No store ID needed.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={!manualMode ? 'default' : 'outline'}
          onClick={() => { setManualMode(false); setParsedInvoices([]); }}
          size="sm"
        >
          <FileText className="h-4 w-4 mr-2" />
          CSV Upload
        </Button>
        <Button
          variant={manualMode ? 'default' : 'outline'}
          onClick={() => { setManualMode(true); setParsedInvoices([]); }}
          size="sm"
        >
          <Upload className="h-4 w-4 mr-2" />
          Manual Entry
        </Button>
      </div>

      {!manualMode ? (
        <>
          {/* CSV Upload Section */}
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <div className="flex-1">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
            </div>
          </div>

          {/* Template Info */}
          <div className="text-sm text-muted-foreground p-3 bg-secondary/30 rounded-lg">
            <p className="font-medium mb-1">CSV Format:</p>
            <code className="text-xs">invoice_number, invoice_date, due_date, total_amount, amount_paid, status, description</code>
            <p className="mt-1">Date format: YYYY-MM-DD | Status: unpaid, partial, paid</p>
          </div>
        </>
      ) : (
        /* Manual Bulk Entry Mode */
        <div className="space-y-4">
          {/* Entry Mode Toggle */}
          <div className="flex gap-2 p-1 bg-muted/50 rounded-lg w-fit">
            <Button
              variant={entryMode === 'line' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => { setEntryMode('line'); setParsedInvoices([]); }}
            >
              Line Mode
            </Button>
            <Button
              variant={entryMode === 'block' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => { setEntryMode('block'); setParsedInvoices([]); }}
            >
              Block Mode
            </Button>
          </div>

          {/* Default Date (for entries without date) */}
          <div className="space-y-2">
            <Label>Default Date (optional)</Label>
            <Input
              type="date"
              value={defaultDate}
              onChange={(e) => setDefaultDate(e.target.value)}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Used when a date isn't specified per invoice
            </p>
          </div>

          {/* Format Instructions */}
          <div className="text-sm text-muted-foreground p-3 bg-secondary/30 rounded-lg space-y-2">
            {entryMode === 'line' ? (
              <>
                <p className="font-medium">Line Mode — One invoice per line:</p>
                <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto">
{`2023-06-01 | 1200 | June service
2023-07-01 | 900 | July service
1500 | Product delivery (uses default date)`}
                </pre>
                <p className="text-xs">Format: date | amount | description</p>
              </>
            ) : (
              <>
                <p className="font-medium">Block Mode — Detailed invoices:</p>
                <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto">
{`--- 2023-06-01 ---
Total: 1200
Paid: 500
Status: partial
Description:
June service retainer
Includes consultation

--- 2023-07-01 ---
Total: 900
Status: unpaid
Description:
July service`}
                </pre>
              </>
            )}
          </div>

          {/* Text Input */}
          <div className="space-y-2">
            <Label>
              {entryMode === 'line' ? 'Enter invoices (one per line)' : 'Enter invoices (block format)'}
            </Label>
            <Textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              rows={entryMode === 'line' ? 8 : 14}
              placeholder={entryMode === 'line' 
                ? "2023-06-01 | 1200 | June service\n2023-07-01 | 900 | July service"
                : "--- 2023-06-01 ---\nTotal: 1200\nDescription: June service"
              }
              className="font-mono text-sm"
            />
          </div>

          <Button onClick={parseManualInvoices} disabled={!manualInput.trim()}>
            Parse Invoices
          </Button>
        </div>
      )}

      {/* Preview Table */}
      {parsedInvoices.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                <Check className="h-3 w-3 mr-1" />
                {validCount} Ready
              </Badge>
              {errorCount > 0 && (
                <Badge variant="outline" className="bg-red-500/10 text-red-600">
                  {errorCount} Errors
                </Badge>
              )}
            </div>
            <Button
              onClick={() => setConfirmDialogOpen(true)}
              disabled={validCount === 0}
            >
              Import {validCount} Invoices
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Row</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead className="w-24 text-right">Amount</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-16">Valid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedInvoices.map((invoice, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{invoice.row}</TableCell>
                    <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.invoice_date}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${invoice.total_amount.toFixed(2)}
                      {invoice.amount_paid > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          Paid: ${invoice.amount_paid.toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        invoice.status === 'paid' ? 'bg-green-500/10 text-green-600' :
                        invoice.status === 'partial' ? 'bg-blue-500/10 text-blue-600' :
                        'bg-yellow-500/10 text-yellow-600'
                      }>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="line-clamp-2 text-sm">{invoice.description}</span>
                      {invoice.error && (
                        <span className="block text-xs text-destructive mt-1">{invoice.error}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {invoice.parseStatus === 'valid' ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600">
                          <Check className="h-3 w-3" />
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600">
                          Error
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Result Summary */}
      {uploadResult && (
        <div className="p-4 rounded-lg bg-secondary/30 border space-y-2">
          <h4 className="font-medium">Import Complete</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Inserted:</span>
              <span className="ml-2 font-medium text-green-600">{uploadResult.inserted}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Errors:</span>
              <span className="ml-2 font-medium text-red-600">{uploadResult.errors.length}</span>
            </div>
          </div>
          {uploadResult.errors.length > 0 && (
            <div className="mt-2 text-xs text-destructive">
              {uploadResult.errors.slice(0, 5).map((err, i) => (
                <p key={i}>{err}</p>
              ))}
              {uploadResult.errors.length > 5 && (
                <p>...and {uploadResult.errors.length - 5} more errors</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Invoice Import</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to import <strong>{validCount}</strong> invoices to:</p>
              <p className="font-medium text-foreground">{storeName}</p>
              {errorCount > 0 && (
                <p className="text-yellow-600">{errorCount} invoices with errors will be skipped.</p>
              )}
              <p>All invoices will be fully editable and deletable after import.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkInsertMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkInsertMutation.mutate(parsedInvoices)}
              disabled={bulkInsertMutation.isPending}
            >
              {bulkInsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {validCount} Invoices
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
