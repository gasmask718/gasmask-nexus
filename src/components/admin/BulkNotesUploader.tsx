import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Check, Loader2, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isValid } from 'date-fns';

interface ParsedNote {
  row: number;
  note_text: string;
  note_date: string;
  status: 'valid' | 'error';
  error?: string;
}

interface UploadResult {
  inserted: number;
  errors: string[];
}

interface BulkNotesUploaderProps {
  storeId: string;
  storeName: string;
  onClose?: () => void;
}

export function BulkNotesUploader({ storeId, storeName, onClose }: BulkNotesUploaderProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [parsedNotes, setParsedNotes] = useState<ParsedNote[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualNotes, setManualNotes] = useState('');
  const [manualDate, setManualDate] = useState('');

  // Download CSV template - NO store column needed
  const downloadTemplate = () => {
    const template = `note_text,note_date
"Your note text here - preserved exactly as written","2024-01-15"
"Another note with full detail","2024-02-20"
"Meeting notes from client visit","2024-03-10"`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_notes_template_${storeName.replace(/[^a-z0-9]/gi, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Parse CSV file - only note_text and note_date columns
  const parseCSV = (content: string): ParsedNote[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    
    // Skip header
    const dataLines = lines.slice(1);
    const notes: ParsedNote[] = [];
    
    dataLines.forEach((line, index) => {
      // Handle quoted CSV values
      const matches = line.match(/("([^"]*)"|[^,]+)/g);
      if (matches && matches.length >= 1) {
        const note_text = matches[0].replace(/^"|"$/g, '').trim();
        const note_date = matches[1] ? matches[1].replace(/^"|"$/g, '').trim() : '';
        
        // Skip empty rows or header duplicates
        if (!note_text || 
            note_text.toLowerCase() === 'note_text' || 
            note_text.toLowerCase() === 'note text') {
          return;
        }
        
        // Validate date if provided
        let dateError: string | undefined;
        if (note_date && note_date.toLowerCase() !== 'note_date') {
          const parsed = parseISO(note_date);
          if (!isValid(parsed)) {
            dateError = `Invalid date format: "${note_date}"`;
          }
        }
        
        notes.push({
          row: index + 2, // +2 for 1-indexed and header
          note_text,
          note_date: note_date || new Date().toISOString().split('T')[0],
          status: dateError ? 'error' : 'valid',
          error: dateError,
        });
      }
    });
    
    return notes;
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const notes = parseCSV(content);
      
      if (notes.length === 0) {
        toast.error('No valid notes found in CSV');
        return;
      }
      
      setParsedNotes(notes);
      
      const errorCount = notes.filter(n => n.status === 'error').length;
      if (errorCount > 0) {
        toast.warning(`${errorCount} notes have date errors`);
      } else {
        toast.success(`${notes.length} notes ready to import to ${storeName}`);
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Bulk insert mutation - all notes go to current store
  const bulkInsertMutation = useMutation({
    mutationFn: async (notes: ParsedNote[]) => {
      const validNotes = notes.filter(n => n.status === 'valid');
      const results: UploadResult = { inserted: 0, errors: [] };
      
      for (const note of validNotes) {
        try {
          // Parse and validate date
          let createdAt = new Date().toISOString();
          if (note.note_date) {
            const parsed = parseISO(note.note_date);
            if (isValid(parsed)) {
              createdAt = parsed.toISOString();
            }
          }
          
          const { error } = await supabase
            .from('store_notes')
            .insert({
              store_id: storeId, // Always use the current store
              note_text: note.note_text,
              created_at: createdAt,
              created_by: null, // Legacy import - no user
            });
          
          if (error) {
            results.errors.push(`Row ${note.row}: ${error.message}`);
          } else {
            results.inserted++;
          }
        } catch (err: any) {
          results.errors.push(`Row ${note.row}: ${err.message}`);
        }
      }
      
      return results;
    },
    onSuccess: (result) => {
      setUploadResult(result);
      queryClient.invalidateQueries({ queryKey: ['store-notes', storeId] });
      toast.success(`Imported ${result.inserted} notes to ${storeName}`);
      setConfirmDialogOpen(false);
      setParsedNotes([]);
    },
    onError: (error: any) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  // Parse manual multi-line notes - uses same engine as CSV
  const parseManualNotes = () => {
    const lines = manualNotes.trim().split('\n');
    const notes: ParsedNote[] = [];
    const defaultDate = manualDate || new Date().toISOString().split('T')[0];
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return; // Skip empty lines
      
      let noteText = trimmedLine;
      let noteDate = defaultDate;
      
      // Try to parse date from line: "2023-06-14 | Note text" or "2023-06-14 - Note text"
      const datePattern = /^(\d{4}-\d{2}-\d{2})\s*[|\-]\s*(.+)$/;
      const match = trimmedLine.match(datePattern);
      
      if (match) {
        const parsedDate = parseISO(match[1]);
        if (isValid(parsedDate)) {
          noteDate = match[1];
          noteText = match[2].trim();
        }
      }
      
      // Validate date
      let dateError: string | undefined;
      const parsedNoteDate = parseISO(noteDate);
      if (!isValid(parsedNoteDate)) {
        dateError = `Invalid date: ${noteDate}`;
      }
      
      if (noteText) {
        notes.push({
          row: index + 1,
          note_text: noteText,
          note_date: noteDate,
          status: dateError ? 'error' : 'valid',
          error: dateError,
        });
      }
    });
    
    setParsedNotes(notes);
    
    if (notes.length === 0) {
      toast.error('No valid notes found');
    } else {
      const errorCount = notes.filter(n => n.status === 'error').length;
      if (errorCount > 0) {
        toast.warning(`${errorCount} notes have date errors`);
      } else {
        toast.success(`${notes.length} notes ready to import to ${storeName}`);
      }
    }
  };

  const validCount = parsedNotes.filter(n => n.status === 'valid').length;
  const errorCount = parsedNotes.filter(n => n.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Store Context Banner */}
      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <span className="font-medium">Uploading notes to: {storeName}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          All notes will be automatically attached to this store. No store ID needed in your file.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={!manualMode ? 'default' : 'outline'}
          onClick={() => setManualMode(false)}
          size="sm"
        >
          <FileText className="h-4 w-4 mr-2" />
          CSV Upload
        </Button>
        <Button
          variant={manualMode ? 'default' : 'outline'}
          onClick={() => setManualMode(true)}
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
            <p className="font-medium mb-1">CSV Format (2 columns only):</p>
            <code className="text-xs">note_text, note_date</code>
            <p className="mt-1">Date format: YYYY-MM-DD (e.g., 2024-01-15)</p>
          </div>

          {/* Preview Table */}
          {parsedNotes.length > 0 && (
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
                  Import {validCount} Notes
                </Button>
              </div>

              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="w-32">Date</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedNotes.map((note, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{note.row}</TableCell>
                        <TableCell className="max-w-md">
                          <span className="line-clamp-2">{note.note_text}</span>
                          {note.error && (
                            <span className="block text-xs text-destructive mt-1">{note.error}</span>
                          )}
                        </TableCell>
                        <TableCell>{note.note_date}</TableCell>
                        <TableCell>
                          {note.status === 'valid' ? (
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
        </>
      ) : (
        /* Manual Bulk Entry Mode */
        <div className="space-y-4">
          {/* Single Date Option */}
          <div className="p-3 rounded-lg bg-secondary/30 border">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-sm font-medium">Apply single date to all notes (optional)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  If set, this date applies to all notes below. Otherwise, use per-line dates.
                </p>
              </div>
              <Input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-44"
              />
            </div>
          </div>

          {/* Multi-line Entry */}
          <div>
            <Label className="mb-2 block">Notes (one per line)</Label>
            <Textarea
              placeholder={`Enter notes, one per line. Two formats supported:

With per-line dates:
2023-06-14 | Customer called about invoice
2023-07-02 | Followed up re payment

Without dates (uses date above or today):
Customer called about invoice
Followed up re payment`}
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          {/* Parse Preview Button */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={parseManualNotes}
              disabled={!manualNotes.trim()}
            >
              <FileText className="h-4 w-4 mr-2" />
              Preview Notes
            </Button>
            {parsedNotes.length > 0 && (
              <Button
                onClick={() => setConfirmDialogOpen(true)}
                disabled={validCount === 0}
              >
                Import {validCount} Notes
              </Button>
            )}
          </div>

          {/* Format Help */}
          <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
            <strong>Format:</strong> <code>YYYY-MM-DD | Note text</code> or just <code>Note text</code>
            <br />
            <strong>Separator:</strong> Use <code>|</code> or <code>-</code> (dash after date)
          </div>

          {/* Preview Table (reuse from CSV mode) */}
          {parsedNotes.length > 0 && (
            <>
              <div className="flex items-center gap-4">
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

              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Line</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="w-32">Date</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedNotes.map((note, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{note.row}</TableCell>
                        <TableCell className="max-w-md">
                          <span className="line-clamp-2">{note.note_text}</span>
                          {note.error && (
                            <span className="block text-xs text-destructive mt-1">{note.error}</span>
                          )}
                        </TableCell>
                        <TableCell>{note.note_date}</TableCell>
                        <TableCell>
                          {note.status === 'valid' ? (
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
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Import</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to upload <strong>{validCount} notes</strong> to:
              <br />
              <span className="font-medium text-foreground">{storeName}</span>
              <br /><br />
              This action cannot be undone. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkInsertMutation.mutate(parsedNotes)}
              disabled={bulkInsertMutation.isPending}
            >
              {bulkInsertMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Import {validCount} Notes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
