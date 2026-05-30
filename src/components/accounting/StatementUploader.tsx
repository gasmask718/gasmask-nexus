import React, { useState, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Upload, FileText, Check, X, Loader2, AlertTriangle,
  CheckCircle, Clock, Download, Eye,
} from 'lucide-react';
import { format } from 'date-fns';

// Category suggestions based on common vendor/description patterns
const CATEGORY_RULES: Record<string, string> = {
  'home depot': 'Supplies',
  'walmart': 'Supplies',
  'amazon': 'Supplies',
  'gas': 'Gas/Fuel',
  'shell': 'Gas/Fuel',
  'exxon': 'Gas/Fuel',
  'bp ': 'Gas/Fuel',
  'chevron': 'Gas/Fuel',
  'uber': 'Transportation',
  'lyft': 'Transportation',
  'rent': 'Rent',
  'insurance': 'Insurance',
  'electric': 'Utilities',
  'water': 'Utilities',
  'internet': 'Utilities',
  'verizon': 'Utilities',
  'att': 'Utilities',
  'tmobile': 'Utilities',
  'stripe': 'Software',
  'google': 'Software',
  'microsoft': 'Software',
  'adobe': 'Software',
  'payroll': 'Payroll',
  'salary': 'Payroll',
  'restaurant': 'Meals & Entertainment',
  'food': 'Meals & Entertainment',
  'uber eats': 'Meals & Entertainment',
  'doordash': 'Meals & Entertainment',
  'zelle': 'Transfer',
  'transfer': 'Transfer',
  'deposit': 'Income',
  'payment received': 'Income',
};

function suggestCategory(description: string): string {
  const lower = description.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_RULES)) {
    if (lower.includes(keyword)) return category;
  }
  return 'Uncategorized';
}

interface ParsedTransaction {
  transaction_date: string;
  description: string;
  amount: number;
  direction: 'debit' | 'credit';
  suggested_category: string;
  final_category: string;
  is_approved: boolean;
}

function parseCSV(text: string): ParsedTransaction[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  
  // Try to detect column positions
  const dateCol = headers.findIndex(h => h.includes('date') || h.includes('posted'));
  const descCol = headers.findIndex(h => h.includes('description') || h.includes('memo') || h.includes('name') || h.includes('payee'));
  const amountCol = headers.findIndex(h => h === 'amount' || h.includes('amount'));
  const debitCol = headers.findIndex(h => h.includes('debit') || h.includes('withdrawal'));
  const creditCol = headers.findIndex(h => h.includes('credit') || h.includes('deposit'));

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV respecting quotes
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += char;
    }
    values.push(current.trim());

    const dateStr = dateCol >= 0 ? values[dateCol] : values[0];
    const desc = descCol >= 0 ? values[descCol] : values[1] || '';
    
    let amount = 0;
    let direction: 'debit' | 'credit' = 'debit';

    if (debitCol >= 0 && creditCol >= 0) {
      const debit = parseFloat(values[debitCol]?.replace(/[$,]/g, '') || '0');
      const credit = parseFloat(values[creditCol]?.replace(/[$,]/g, '') || '0');
      if (debit > 0) { amount = debit; direction = 'debit'; }
      else if (credit > 0) { amount = credit; direction = 'credit'; }
    } else if (amountCol >= 0) {
      amount = parseFloat(values[amountCol]?.replace(/[$,]/g, '') || '0');
      if (amount < 0) { amount = Math.abs(amount); direction = 'debit'; }
      else { direction = 'credit'; }
    }

    if (!dateStr || amount === 0) continue;

    // Parse date
    let parsedDate: string;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;
      parsedDate = format(d, 'yyyy-MM-dd');
    } catch { continue; }

    const suggested = suggestCategory(desc);

    transactions.push({
      transaction_date: parsedDate,
      description: desc,
      amount,
      direction,
      suggested_category: suggested,
      final_category: suggested,
      is_approved: false,
    });
  }

  return transactions;
}

// ─── Imports List ─────────────────────────────────────────────────────────────
function useStatementImports() {
  return useQuery({
    queryKey: ['statement-imports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('statement_imports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });
}

function useStatementTransactions(importId: string | null) {
  return useQuery({
    queryKey: ['statement-transactions', importId],
    queryFn: async () => {
      if (!importId) return [];
      const { data, error } = await supabase
        .from('statement_transactions')
        .select('*')
        .eq('import_id', importId)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!importId,
  });
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function StatementUploader() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedTransaction[]>([]);
  const [fileName, setFileName] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [reviewImportId, setReviewImportId] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const { data: imports, isLoading: importsLoading } = useStatementImports();
  const { data: reviewTxns } = useStatementTransactions(reviewImportId);

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Only CSV files are supported. PDF parsing coming soon.');
      return;
    }

    setParsing(true);
    setFileName(file.name);

    try {
      const text = await file.text();
      const transactions = parseCSV(text);
      if (transactions.length === 0) {
        toast.error('No valid transactions found in CSV');
        setParsing(false);
        return;
      }
      setParsed(transactions);
      setShowUploadDialog(true);
      toast.success(`Parsed ${transactions.length} transactions`);
    } catch (err) {
      toast.error('Failed to parse CSV file');
    } finally {
      setParsing(false);
    }
  }, []);

  // Save import + transactions
  const saveMutation = useMutation({
    mutationFn: async () => {
      const debits = parsed.filter(t => t.direction === 'debit');
      const credits = parsed.filter(t => t.direction === 'credit');

      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from('statement_imports')
        .insert({
          file_name: fileName,
          file_type: 'csv',
          account_label: accountLabel || null,
          status: 'categorized',
          total_transactions: parsed.length,
          total_debits: debits.reduce((s, t) => s + t.amount, 0),
          total_credits: credits.reduce((s, t) => s + t.amount, 0),
        })
        .select()
        .single();

      if (importError) throw importError;

      // Insert parsed transactions
      const txns = parsed.map(t => ({
        import_id: importRecord.id,
        transaction_date: t.transaction_date,
        description: t.description,
        amount: t.amount,
        direction: t.direction,
        suggested_category: t.suggested_category,
        final_category: t.final_category,
        is_approved: t.is_approved,
      }));

      const { error: txnError } = await supabase
        .from('statement_transactions')
        .insert(txns);

      if (txnError) throw txnError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statement-imports'] });
      toast.success('Statement imported and categorized');
      setShowUploadDialog(false);
      setParsed([]);
      setFileName('');
      setAccountLabel('');
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Approve all transactions in an import
  const approveMutation = useMutation({
    mutationFn: async (importId: string) => {
      const { error: txnError } = await supabase
        .from('statement_transactions')
        .update({ is_approved: true })
        .eq('import_id', importId);
      if (txnError) throw txnError;

      const { error: impError } = await supabase
        .from('statement_imports')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', importId);
      if (impError) throw impError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statement-imports'] });
      queryClient.invalidateQueries({ queryKey: ['statement-transactions'] });
      toast.success('Statement approved — transactions posted');
      setReviewImportId(null);
    },
  });

  const updateCategory = (idx: number, category: string) => {
    setParsed(prev => prev.map((t, i) => i === idx ? { ...t, final_category: category } : t));
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'categorized': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-muted-foreground" />;
      default: return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Statement Uploads
          </h2>
          <p className="text-sm text-muted-foreground">
            Upload bank/credit card statements (CSV) — auto-categorize & approve before posting
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={parsing}>
            {parsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {parsing ? 'Parsing...' : 'Upload CSV'}
          </Button>
        </div>
      </div>

      {/* Upload Dialog — Review parsed transactions */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Parsed Transactions — {fileName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Label>Account Label</Label>
                <Input
                  placeholder="e.g. Chase Business, Wells Fargo Personal"
                  value={accountLabel}
                  onChange={e => setAccountLabel(e.target.value)}
                />
              </div>
              <div className="pt-6">
                <Badge variant="outline">{parsed.length} transactions</Badge>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Total Debits</p>
                  <p className="text-lg font-bold text-red-500">
                    ${parsed.filter(t => t.direction === 'debit').reduce((s, t) => s + t.amount, 0).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Total Credits</p>
                  <p className="text-lg font-bold text-emerald-500">
                    ${parsed.filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount, 0).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Categories Found</p>
                  <p className="text-lg font-bold">{new Set(parsed.map(t => t.final_category)).size}</p>
                </CardContent>
              </Card>
            </div>

            {/* Transaction Table */}
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-left py-2 px-3 font-medium">Description</th>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-right py-2 px-3 font-medium">Amount</th>
                    <th className="text-left py-2 px-3 font-medium">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 50).map((t, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-accent/30">
                      <td className="py-2 px-3 whitespace-nowrap">{t.transaction_date}</td>
                      <td className="py-2 px-3 truncate max-w-[200px]">{t.description}</td>
                      <td className="py-2 px-3">
                        <Badge variant={t.direction === 'credit' ? 'default' : 'destructive'} className="text-xs">
                          {t.direction}
                        </Badge>
                      </td>
                      <td className={`py-2 px-3 text-right font-medium ${t.direction === 'credit' ? 'text-emerald-500' : 'text-red-500'}`}>
                        ${t.amount.toLocaleString()}
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          className="h-7 text-xs w-[140px]"
                          value={t.final_category}
                          onChange={e => updateCategory(idx, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Showing first 50 of {parsed.length} transactions
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Save & Categorize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={!!reviewImportId} onOpenChange={() => setReviewImportId(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Statement Transactions</DialogTitle>
          </DialogHeader>
          {reviewTxns && reviewTxns.length > 0 ? (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-left py-2 px-3 font-medium">Description</th>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-right py-2 px-3 font-medium">Amount</th>
                    <th className="text-left py-2 px-3 font-medium">Category</th>
                    <th className="text-center py-2 px-3 font-medium">Approved</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewTxns.map(t => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-2 px-3">{format(new Date(t.transaction_date), 'MMM d, yyyy')}</td>
                      <td className="py-2 px-3 truncate max-w-[200px]">{t.description}</td>
                      <td className="py-2 px-3">
                        <Badge variant={t.direction === 'credit' ? 'default' : 'destructive'} className="text-xs">
                          {t.direction}
                        </Badge>
                      </td>
                      <td className={`py-2 px-3 text-right font-medium ${t.direction === 'credit' ? 'text-emerald-500' : 'text-red-500'}`}>
                        ${Number(t.amount).toLocaleString()}
                      </td>
                      <td className="py-2 px-3">{t.final_category || t.suggested_category || '—'}</td>
                      <td className="py-2 px-3 text-center">
                        {t.is_approved ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground mx-auto" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No transactions found</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewImportId(null)}>Close</Button>
            {reviewImportId && imports?.find(i => i.id === reviewImportId)?.status !== 'approved' && (
              <Button onClick={() => approveMutation.mutate(reviewImportId)} disabled={approveMutation.isPending}>
                {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Approve All & Post
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Past Imports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import History</CardTitle>
          <CardDescription>Previously uploaded statements</CardDescription>
        </CardHeader>
        <CardContent>
          {importsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : imports && imports.length > 0 ? (
            <div className="space-y-2">
              {imports.map(imp => (
                <div key={imp.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50">
                  <div className="flex items-center gap-3">
                    {statusIcon(imp.status || 'pending')}
                    <div>
                      <p className="font-medium text-sm">{imp.file_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {imp.account_label && <span>{imp.account_label}</span>}
                        <span>• {imp.total_transactions} txns</span>
                        <span>• {format(new Date(imp.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right text-xs mr-2">
                      <p className="text-red-500">-${Number(imp.total_debits).toLocaleString()}</p>
                      <p className="text-emerald-500">+${Number(imp.total_credits).toLocaleString()}</p>
                    </div>
                    <Badge variant={imp.status === 'approved' ? 'default' : 'secondary'}>{imp.status}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setReviewImportId(imp.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No statements uploaded yet</p>
              <p className="text-xs">Upload a CSV from your bank or credit card to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
