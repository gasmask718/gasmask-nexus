import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Upload, FileText, Check, X, Loader2, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isValid } from 'date-fns';

interface ParsedNote {
  row: number;
  store_identifier: string;
  note_text: string;
  note_date: string;
  resolved_store_id?: string;
  store_name?: string;
  error?: string;
  status: 'pending' | 'resolved' | 'error';
}

interface UploadResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

export function BulkNotesUploader() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [parsedNotes, setParsedNotes] = useState<ParsedNote[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualNotes, setManualNotes] = useState('');
  const [manualStoreId, setManualStoreId] = useState('');
  const [manualDate, setManualDate] = useState('');

  // Check if string is a valid UUID
  const isValidUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Download CSV template
  const downloadTemplate = () => {
    const template = `store_identifier,note_text,note_date
"Your Store Name Here","Your note text here - preserved exactly as written","2024-01-15"
"Another Store Name","Another note with full detail","2024-02-20"`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_notes_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Parse CSV file
  const parseCSV = (content: string): ParsedNote[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    
    // Skip header
    const dataLines = lines.slice(1);
    const notes: ParsedNote[] = [];
    
    dataLines.forEach((line, index) => {
      // Handle quoted CSV values
      const matches = line.match(/("([^"]*)"|[^,]+)/g);
      if (matches && matches.length >= 3) {
        const store_identifier = matches[0].replace(/^"|"$/g, '').trim();
        const note_text = matches[1].replace(/^"|"$/g, '').trim();
        const note_date = matches[2].replace(/^"|"$/g, '').trim();
        
        if (store_identifier && note_text) {
          notes.push({
            row: index + 2, // +2 for 1-indexed and header
            store_identifier,
            note_text,
            note_date: note_date || new Date().toISOString().split('T')[0],
            status: 'pending',
          });
        }
      }
    });
    
    return notes;
  };

  // Resolve store identifiers to IDs
  const resolveStores = async (notes: ParsedNote[]): Promise<ParsedNote[]> => {
    const resolved: ParsedNote[] = [];
    
    for (const note of notes) {
      try {
        const identifier = note.store_identifier.trim();
        
        // Skip if it looks like a header row
        if (identifier.toLowerCase() === 'store_identifier' || 
            identifier.toLowerCase() === 'store name' ||
            identifier.toLowerCase() === 'store name or id' ||
            identifier.toLowerCase() === 'store id') {
          resolved.push({
            ...note,
            error: 'Skipped header row',
            status: 'error',
          });
          continue;
        }
        
        let query;
        
        // Check if identifier is a valid UUID
        if (isValidUUID(identifier)) {
          // Search by UUID directly
          query = supabase
            .from('store_master')
            .select('id, store_name')
            .eq('id', identifier)
            .limit(1);
        } else {
          // Search by store name (case-insensitive)
          query = supabase
            .from('store_master')
            .select('id, store_name')
            .ilike('store_name', `%${identifier}%`)
            .limit(1);
        }
        
        const { data: stores, error } = await query;
        
        if (error) throw error;
        
        if (stores && stores.length > 0) {
          resolved.push({
            ...note,
            resolved_store_id: stores[0].id,
            store_name: stores[0].store_name,
            status: 'resolved',
          });
        } else {
          resolved.push({
            ...note,
            error: `Store not found: "${identifier}"`,
            status: 'error',
          });
        }
      } catch (err: any) {
        resolved.push({
          ...note,
          error: err.message || 'Resolution failed',
          status: 'error',
        });
      }
    }
    
    return resolved;
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
      
      setIsResolving(true);
      const resolved = await resolveStores(notes);
      setParsedNotes(resolved);
      setIsResolving(false);
      
      const errorCount = resolved.filter(n => n.status === 'error').length;
      if (errorCount > 0) {
        toast.warning(`${errorCount} notes could not be resolved`);
      } else {
        toast.success(`${resolved.length} notes ready to import`);
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Bulk insert mutation
  const bulkInsertMutation = useMutation({
    mutationFn: async (notes: ParsedNote[]) => {
      const validNotes = notes.filter(n => n.status === 'resolved' && n.resolved_store_id);
      const results: UploadResult = { inserted: 0, skipped: 0, errors: [] };
      
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
              store_id: note.resolved_store_id,
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
      
      results.skipped = notes.length - validNotes.length;
      return results;
    },
    onSuccess: (result) => {
      setUploadResult(result);
      queryClient.invalidateQueries({ queryKey: ['store-notes'] });
      toast.success(`Imported ${result.inserted} notes`);
      setConfirmDialogOpen(false);
      setParsedNotes([]);
    },
    onError: (error: any) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  // Manual single note insert
  const manualInsertMutation = useMutation({
    mutationFn: async () => {
      let createdAt = new Date().toISOString();
      if (manualDate) {
        const parsed = parseISO(manualDate);
        if (isValid(parsed)) {
          createdAt = parsed.toISOString();
        }
      }
      
      const { error } = await supabase
        .from('store_notes')
        .insert({
          store_id: manualStoreId,
          note_text: manualNotes,
          created_at: createdAt,
          created_by: null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Note added');
      setManualNotes('');
      setManualStoreId('');
      setManualDate('');
      queryClient.invalidateQueries({ queryKey: ['store-notes'] });
    },
    onError: (error: any) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const validCount = parsedNotes.filter(n => n.status === 'resolved').length;
  const errorCount = parsedNotes.filter(n => n.status === 'error').length;

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Bulk Notes Uploader
        </CardTitle>
        <CardDescription>
          Import historical notes with custom dates. Notes are preserved exactly as written.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

            {/* Loading State */}
            {isResolving && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Resolving store identifiers...</span>
              </div>
            )}

            {/* Preview Table */}
            {parsedNotes.length > 0 && !isResolving && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex gap-4">
                    <Badge variant="outline" className="bg-green-500/10 text-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      {validCount} Ready
                    </Badge>
                    {errorCount > 0 && (
                      <Badge variant="outline" className="bg-red-500/10 text-red-600">
                        <X className="h-3 w-3 mr-1" />
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
                        <TableHead>Store</TableHead>
                        <TableHead className="max-w-xs">Note</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedNotes.map((note, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{note.row}</TableCell>
                          <TableCell>
                            {note.store_name || note.store_identifier}
                            {note.error && (
                              <span className="block text-xs text-destructive">{note.error}</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate" title={note.note_text}>
                            {note.note_text.substring(0, 50)}...
                          </TableCell>
                          <TableCell>{note.note_date}</TableCell>
                          <TableCell>
                            {note.status === 'resolved' && (
                              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                                <Check className="h-3 w-3" />
                              </Badge>
                            )}
                            {note.status === 'error' && (
                              <Badge variant="outline" className="bg-red-500/10 text-red-600">
                                <X className="h-3 w-3" />
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
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Inserted:</span>
                    <span className="ml-2 font-medium text-green-600">{uploadResult.inserted}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Skipped:</span>
                    <span className="ml-2 font-medium text-yellow-600">{uploadResult.skipped}</span>
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
          /* Manual Entry Mode */
          <div className="space-y-4">
            <div>
              <Label>Store ID</Label>
              <Input
                placeholder="Enter store UUID"
                value={manualStoreId}
                onChange={(e) => setManualStoreId(e.target.value)}
              />
            </div>
            <div>
              <Label>Note Date (optional - defaults to today)</Label>
              <Input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Note Text</Label>
              <Textarea
                placeholder="Enter note text exactly as it should be stored..."
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                rows={4}
              />
            </div>
            <Button
              onClick={() => manualInsertMutation.mutate()}
              disabled={!manualStoreId || !manualNotes || manualInsertMutation.isPending}
            >
              {manualInsertMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Note
            </Button>
          </div>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Confirm Bulk Import
              </AlertDialogTitle>
              <AlertDialogDescription>
                You are about to insert <strong>{validCount}</strong> notes into the system.
                {errorCount > 0 && (
                  <span className="block mt-2 text-yellow-600">
                    {errorCount} notes will be skipped due to unresolved stores.
                  </span>
                )}
                <span className="block mt-2">
                  Notes will be created with their specified historical dates.
                  This action cannot be undone.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkInsertMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => bulkInsertMutation.mutate(parsedNotes)}
                disabled={bulkInsertMutation.isPending}
              >
                {bulkInsertMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Import {validCount} Notes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
