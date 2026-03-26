import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const UT_FIELDS = [
  { key: 'business_name', label: 'Business Name', required: true },
  { key: 'contact_name', label: 'Contact Name', required: false },
  { key: 'category', label: 'Category', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'state', label: 'State', required: false },
  { key: 'source', label: 'Source', required: false },
  { key: 'notes', label: 'Notes', required: false },
] as const;

type FieldKey = typeof UT_FIELDS[number]['key'];

const VALID_CATEGORIES = [
  'event_hall', 'decorator', 'bartender', 'caterer', 'rental_company',
  'entertainer', 'dj', 'photographer', 'security', 'cleaner', 'server',
  'florist', 'staff', 'other'
];

// Auto-map common column names
function autoMap(headers: string[]): Record<FieldKey, string> {
  const map: Record<string, string> = {};
  const patterns: Record<FieldKey, RegExp> = {
    business_name: /business|company|name|title/i,
    contact_name: /contact|owner|person|first.?name/i,
    category: /category|type|industry|vertical/i,
    phone: /phone|tel|mobile|cell/i,
    email: /email|e-mail|mail/i,
    city: /city|town|locality/i,
    state: /state|province|region/i,
    source: /source|origin|channel/i,
    notes: /note|comment|description/i,
  };
  for (const [field, regex] of Object.entries(patterns)) {
    const match = headers.find(h => regex.test(h));
    if (match) map[field] = match;
  }
  return map as Record<FieldKey, string>;
}

function normalizeCategory(val: string | undefined): string {
  if (!val) return 'other';
  const lower = val.toLowerCase().replace(/[\s-]+/g, '_');
  if (VALID_CATEGORIES.includes(lower)) return lower;
  if (lower.includes('hall') || lower.includes('venue') || lower.includes('banquet')) return 'event_hall';
  if (lower.includes('decor')) return 'decorator';
  if (lower.includes('cater') || lower.includes('food')) return 'caterer';
  if (lower.includes('bar')) return 'bartender';
  if (lower.includes('rent')) return 'rental_company';
  if (lower.includes('entertain') || lower.includes('music') || lower.includes('dj')) return 'entertainer';
  if (lower.includes('photo') || lower.includes('video')) return 'photographer';
  if (lower.includes('secur') || lower.includes('guard')) return 'security';
  if (lower.includes('clean') || lower.includes('janit')) return 'cleaner';
  if (lower.includes('serv') || lower.includes('wait')) return 'server';
  if (lower.includes('flor') || lower.includes('flower')) return 'florist';
  if (lower.includes('staff')) return 'staff';
  return 'other';
}

interface Props {
  onClose: () => void;
}

type Step = 'upload' | 'map' | 'preview' | 'importing' | 'done';

export default function UTLeadImporter({ onClose }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('upload');
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as any);
  const [fileName, setFileName] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
        if (!json.length) { toast.error('File is empty'); return; }
        const hdrs = Object.keys(json[0]);
        setHeaders(hdrs);
        setRawRows(json);
        setMapping(autoMap(hdrs));
        setStep('map');
        toast.success(`Parsed ${json.length} rows from ${file.name}`);
      } catch {
        toast.error('Failed to parse file');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const mappedPreview = useMemo(() => {
    return rawRows.slice(0, 5).map(row => {
      const mapped: Record<string, any> = {};
      for (const f of UT_FIELDS) {
        const col = mapping[f.key];
        mapped[f.key] = col ? row[col] : '';
      }
      mapped.category = normalizeCategory(mapped.category);
      return mapped;
    });
  }, [rawRows, mapping]);

  const validCount = useMemo(() => {
    return rawRows.filter(row => {
      const col = mapping.business_name;
      return col && String(row[col] || '').trim().length > 0;
    }).length;
  }, [rawRows, mapping]);

  const handleImport = useCallback(async () => {
    setStep('importing');
    setImportProgress(0);
    const BATCH = 100;
    let success = 0, failed = 0;
    const errors: string[] = [];

    const rows = rawRows.filter(row => {
      const col = mapping.business_name;
      return col && String(row[col] || '').trim().length > 0;
    });

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH).map(row => ({
        business_name: String(row[mapping.business_name] || '').trim(),
        contact_name: mapping.contact_name ? String(row[mapping.contact_name] || '').trim() || null : null,
        category: normalizeCategory(mapping.category ? String(row[mapping.category] || '') : ''),
        phone: mapping.phone ? String(row[mapping.phone] || '').trim() || null : null,
        email: mapping.email ? String(row[mapping.email] || '').trim() || null : null,
        city: mapping.city ? String(row[mapping.city] || '').trim() || null : null,
        state: mapping.state ? String(row[mapping.state] || '').trim() || null : null,
        source: mapping.source ? String(row[mapping.source] || '').trim() || 'import' : 'import',
        notes: mapping.notes ? String(row[mapping.notes] || '').trim() || null : null,
        status: 'new',
        ai_score: 50,
      }));

      const { error } = await (supabase.from('ut_partner_leads') as any).insert(batch);
      if (error) {
        failed += batch.length;
        errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      } else {
        success += batch.length;
      }
      setImportProgress(Math.round(((i + batch.length) / rows.length) * 100));
    }

    setImportResult({ success, failed, errors });
    setStep('done');
    qc.invalidateQueries({ queryKey: ['ut-partner-leads'] });
    qc.invalidateQueries({ queryKey: ['ut-lead-stats'] });
    toast.success(`Imported ${success} leads${failed ? `, ${failed} failed` : ''}`);
  }, [rawRows, mapping, qc]);

  return (
    <Card className="border-border/40">
      <CardHeader className="py-2 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Import Leads
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="text-center py-8 space-y-4">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Upload CSV or Excel file with lead data</p>
            <label className="cursor-pointer">
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
              <Button variant="outline" className="gap-2" asChild><span><Upload className="h-4 w-4" /> Choose File</span></Button>
            </label>
            <p className="text-[10px] text-muted-foreground">Supported: CSV, XLSX, XLS • Required: Business Name column</p>
          </div>
        )}

        {/* STEP 2: Column Mapping */}
        {step === 'map' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{rawRows.length} rows from <span className="font-mono text-foreground">{fileName}</span></p>
              <Badge variant="outline" className="text-[10px]">{validCount} valid</Badge>
            </div>
            <div className="grid gap-2">
              {UT_FIELDS.map(f => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="text-xs w-28 truncate">{f.label}{f.required && <span className="text-destructive">*</span>}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <Select value={mapping[f.key] || '_none'} onValueChange={v => setMapping(m => ({ ...m, [f.key]: v === '_none' ? '' : v }))}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Skip" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Skip —</SelectItem>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {mapping[f.key] && <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />}
                </div>
              ))}
            </div>
            {!mapping.business_name && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Business Name must be mapped</p>}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('upload')}>Back</Button>
              <Button size="sm" disabled={!mapping.business_name} onClick={() => setStep('preview')} className="flex-1">Preview →</Button>
            </div>
          </div>
        )}

        {/* STEP 3: Preview */}
        {step === 'preview' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Preview (first 5 of {validCount})</p>
            <ScrollArea className="h-48 border rounded">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b">{UT_FIELDS.map(f => <th key={f.key} className="px-1.5 py-1 text-left font-medium text-muted-foreground">{f.label}</th>)}</tr></thead>
                <tbody>
                  {mappedPreview.map((row, i) => (
                    <tr key={i} className="border-b border-border/20">
                      {UT_FIELDS.map(f => <td key={f.key} className="px-1.5 py-1 truncate max-w-[100px]">{String(row[f.key] || '—')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('map')}>Back</Button>
              <Button size="sm" className="flex-1" onClick={handleImport}>Import {validCount} Leads</Button>
            </div>
          </div>
        )}

        {/* STEP 4: Importing */}
        {step === 'importing' && (
          <div className="py-6 space-y-4 text-center">
            <p className="text-sm font-medium">Importing leads...</p>
            <Progress value={importProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">{importProgress}%</p>
          </div>
        )}

        {/* STEP 5: Done */}
        {step === 'done' && (
          <div className="py-4 space-y-3 text-center">
            <CheckCircle className="h-8 w-8 mx-auto text-green-400" />
            <p className="text-sm font-medium">Import Complete</p>
            <div className="flex justify-center gap-4 text-xs">
              <span className="text-green-400 font-mono">{importResult.success} imported</span>
              {importResult.failed > 0 && <span className="text-destructive font-mono">{importResult.failed} failed</span>}
            </div>
            {importResult.errors.length > 0 && (
              <div className="text-left text-[10px] text-destructive space-y-0.5 max-h-20 overflow-auto">
                {importResult.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <Button size="sm" onClick={onClose}>Close</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
