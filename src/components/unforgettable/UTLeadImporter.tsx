import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X, ArrowRight, Shield, Phone, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const UT_FIELDS = [
  { key: 'business_name', label: 'Business Name', required: true },
  { key: 'contact_name', label: 'Contact Name' },
  { key: 'category', label: 'Category' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'source', label: 'Source' },
  { key: 'notes', label: 'Notes' },
  { key: 'website', label: 'Website' },
] as const;

type FieldKey = typeof UT_FIELDS[number]['key'];

const VALID_CATEGORIES = [
  'event_hall', 'decorator', 'bartender', 'caterer', 'rental_company',
  'entertainer', 'dj', 'photographer', 'security', 'cleaner', 'server',
  'florist', 'staff', 'other',
];

// Outscraper + common CSV header patterns
const FIELD_PATTERNS: Record<FieldKey, RegExp> = {
  business_name: /^(business|company|name|title|full_name|query)$/i,
  contact_name: /^(contact|owner|person|first.?name|contact.?name)$/i,
  category: /^(category|type|industry|vertical|subtypes|main_category)$/i,
  phone: /^(phone|tel|mobile|cell|phone_number|telephone)$/i,
  email: /^(email|e.?mail|mail|email_1)$/i,
  city: /^(city|town|locality)$/i,
  state: /^(state|province|region)$/i,
  source: /^(source|origin|channel)$/i,
  notes: /^(note|comment|description|about)$/i,
  website: /^(website|url|site|web|domain)$/i,
};

function autoMap(headers: string[]): Record<FieldKey, string> {
  const map: Record<string, string> = {};
  for (const [field, regex] of Object.entries(FIELD_PATTERNS)) {
    const match = headers.find(h => regex.test(h.trim()));
    if (match) map[field] = match;
  }
  // Outscraper: "name" maps to business_name, "full_address" can be parsed
  if (!map.business_name) {
    const fallback = headers.find(h => /^name$/i.test(h.trim()));
    if (fallback) map.business_name = fallback;
  }
  return map as Record<FieldKey, string>;
}

function normalizePhone(val: unknown): string | null {
  if (!val) return null;
  const raw = String(val).trim();
  if (!raw) return null;
  // Strip all non-digit except leading +
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.length < 7) return null;
  // Ensure US numbers have +1
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.startsWith('+')) return digits;
  return `+${digits}`;
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
  if (lower.includes('entertain') || lower.includes('music')) return 'entertainer';
  if (lower.includes('dj')) return 'dj';
  if (lower.includes('photo') || lower.includes('video')) return 'photographer';
  if (lower.includes('secur') || lower.includes('guard')) return 'security';
  if (lower.includes('clean') || lower.includes('janit')) return 'cleaner';
  if (lower.includes('serv') || lower.includes('wait')) return 'server';
  if (lower.includes('flor') || lower.includes('flower')) return 'florist';
  if (lower.includes('staff')) return 'staff';
  return 'other';
}

function detectSource(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('outscraper')) return 'outscraper';
  if (lower.includes('yelp')) return 'yelp_import';
  if (lower.includes('google')) return 'google_import';
  return 'csv_import';
}

// Parse city/state from Outscraper "full_address" or "address"
function parseCityState(address: string | undefined): { city?: string; state?: string } {
  if (!address) return {};
  // Try pattern: "..., City, ST ZIP" or "..., City, State"
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 3) {
    const city = parts[parts.length - 2];
    const stateZip = parts[parts.length - 1];
    const stateMatch = stateZip.match(/^([A-Z]{2})/);
    return { city, state: stateMatch?.[1] };
  }
  return {};
}

interface Props { onClose: () => void; }
type Step = 'upload' | 'map' | 'preview' | 'importing' | 'done';

export default function UTLeadImporter({ onClose }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as any);
  const [fileName, setFileName] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number; failed: number; skipped: number; errors: string[];
  }>({ success: 0, failed: 0, skipped: 0, errors: [] });

  const processFile = useCallback((file: File) => {
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
        toast.success(`Parsed ${json.length} rows`);
      } catch {
        toast.error('Failed to parse file');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  // Check if an address column exists for Outscraper parsing
  const addressCol = useMemo(() => {
    return headers.find(h => /^(full_address|address|street_address)$/i.test(h.trim()));
  }, [headers]);

  const buildRow = useCallback((row: Record<string, any>) => {
    const get = (key: FieldKey) => mapping[key] ? String(row[mapping[key]] || '').trim() : '';
    const phone = normalizePhone(get('phone'));
    let city = get('city') || undefined;
    let state = get('state') || undefined;

    // Outscraper: parse city/state from address if not mapped
    if ((!city || !state) && addressCol) {
      const parsed = parseCityState(String(row[addressCol] || ''));
      if (!city && parsed.city) city = parsed.city;
      if (!state && parsed.state) state = parsed.state;
    }

    return {
      business_name: get('business_name'),
      contact_name: get('contact_name') || null,
      category: normalizeCategory(get('category') || undefined),
      phone: phone,
      email: get('email') || null,
      city: city || null,
      state: state || null,
      source: get('source') || detectSource(fileName),
      notes: get('notes') || null,
      status: 'new' as const,
      ai_score: 50,
    };
  }, [mapping, addressCol, fileName]);

  const mappedPreview = useMemo(() => rawRows.slice(0, 8).map(buildRow), [rawRows, buildRow]);

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
    let success = 0, failed = 0, skipped = 0;
    const errors: string[] = [];

    const validRows = rawRows.filter(row => {
      const col = mapping.business_name;
      return col && String(row[col] || '').trim().length > 0;
    });

    // Load existing phones + business_name+city combos for dedup
    let existingPhones = new Set<string>();
    let existingBizKeys = new Set<string>();

    if (skipDuplicates) {
      try {
        // Fetch in pages of 1000
        let allLeads: any[] = [];
        let from = 0;
        const PAGE = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data } = await (supabase.from('ut_partner_leads') as any)
            .select('phone,business_name,city')
            .range(from, from + PAGE - 1);
          if (data && data.length > 0) {
            allLeads = allLeads.concat(data);
            from += PAGE;
            if (data.length < PAGE) hasMore = false;
          } else {
            hasMore = false;
          }
        }
        for (const lead of allLeads) {
          if (lead.phone) existingPhones.add(lead.phone);
          if (lead.business_name && lead.city) {
            existingBizKeys.add(`${lead.business_name.toLowerCase()}|${(lead.city || '').toLowerCase()}`);
          }
        }
      } catch {
        // Continue without dedup if fetch fails
      }
    }

    for (let i = 0; i < validRows.length; i += BATCH) {
      const chunk = validRows.slice(i, i + BATCH);
      const toInsert: any[] = [];

      for (const row of chunk) {
        const mapped = buildRow(row);

        if (skipDuplicates) {
          // Check phone duplicate
          if (mapped.phone && existingPhones.has(mapped.phone)) {
            skipped++;
            continue;
          }
          // Check business_name + city duplicate
          const bizKey = `${mapped.business_name.toLowerCase()}|${(mapped.city || '').toLowerCase()}`;
          if (existingBizKeys.has(bizKey)) {
            skipped++;
            continue;
          }
          // Add to sets so within-batch dedup works
          if (mapped.phone) existingPhones.add(mapped.phone);
          existingBizKeys.add(`${mapped.business_name.toLowerCase()}|${(mapped.city || '').toLowerCase()}`);
        }

        toInsert.push(mapped);
      }

      if (toInsert.length > 0) {
        const { error } = await (supabase.from('ut_partner_leads') as any).insert(toInsert);
        if (error) {
          failed += toInsert.length;
          errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
        } else {
          success += toInsert.length;
        }
      }
      setImportProgress(Math.round(((i + chunk.length) / validRows.length) * 100));
    }

    setImportResult({ success, failed, skipped, errors });
    setStep('done');
    qc.invalidateQueries({ queryKey: ['ut-partner-leads'] });
    qc.invalidateQueries({ queryKey: ['ut-lead-stats'] });
    toast.success(`Imported ${success} leads`);
  }, [rawRows, mapping, buildRow, skipDuplicates, qc]);

  return (
    <Card className="border-border/40 bg-card">
      <CardHeader className="py-2 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" /> Import Leads
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4">

        {/* STEP 1: Upload — Drag & Drop */}
        {step === 'upload' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`text-center py-10 space-y-4 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border/50'
            }`}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
            <Upload className={`h-10 w-10 mx-auto transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-sm text-muted-foreground">
              {isDragging ? 'Drop file here' : 'Drag & drop or click to upload'}
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <Badge variant="outline" className="text-[10px]">CSV</Badge>
              <Badge variant="outline" className="text-[10px]">XLSX</Badge>
              <Badge variant="outline" className="text-[10px]">Outscraper</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">Required: Business Name column</p>
          </div>
        )}

        {/* STEP 2: Column Mapping */}
        {step === 'map' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {rawRows.length} rows from <span className="font-mono text-foreground">{fileName}</span>
              </p>
              <Badge variant="outline" className="text-[10px]">{validCount} valid</Badge>
            </div>

            {addressCol && !mapping.city && (
              <div className="flex items-center gap-2 text-[10px] text-primary bg-primary/5 rounded p-1.5">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                Outscraper address column detected — city/state will be auto-parsed
              </div>
            )}

            <div className="grid gap-1.5">
              {UT_FIELDS.map(f => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="text-xs w-28 truncate">
                    {f.label}{'required' in f && f.required && <span className="text-destructive">*</span>}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <Select
                    value={mapping[f.key] || '_none'}
                    onValueChange={v => setMapping(m => ({ ...m, [f.key]: v === '_none' ? '' : v }))}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Skip —</SelectItem>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {mapping[f.key] && <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />}
                </div>
              ))}
            </div>

            {/* Dedup toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div className="flex items-center gap-2 text-xs">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span>Skip duplicates</span>
                <span className="text-[10px] text-muted-foreground">(phone or name+city)</span>
              </div>
              <Switch checked={skipDuplicates} onCheckedChange={setSkipDuplicates} />
            </div>

            {!mapping.business_name && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Business Name must be mapped
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('upload')}>Back</Button>
              <Button size="sm" disabled={!mapping.business_name} onClick={() => setStep('preview')} className="flex-1">
                Preview →
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Preview */}
        {step === 'preview' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Preview (first 8 of {validCount})</p>
            <ScrollArea className="h-56 border rounded">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b bg-muted/20">
                    {['Name', 'Category', 'Phone', 'City', 'State', 'Source'].map(h => (
                      <th key={h} className="px-1.5 py-1 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedPreview.map((row, i) => (
                    <tr key={i} className="border-b border-border/20">
                      <td className="px-1.5 py-1 truncate max-w-[120px] font-medium">{row.business_name || '—'}</td>
                      <td className="px-1.5 py-1">
                        <Badge variant="outline" className="text-[9px]">{row.category}</Badge>
                      </td>
                      <td className="px-1.5 py-1 font-mono text-[9px]">
                        {row.phone ? (
                          <span className="flex items-center gap-0.5 text-green-400">
                            <Phone className="h-2.5 w-2.5" />{row.phone}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-1.5 py-1">{row.city || '—'}</td>
                      <td className="px-1.5 py-1">{row.state || '—'}</td>
                      <td className="px-1.5 py-1 text-muted-foreground">{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              {skipDuplicates && (
                <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-primary" /> Dedup active</span>
              )}
              {mapping.phone && (
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Phones normalized</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('map')}>Back</Button>
              <Button size="sm" className="flex-1" onClick={handleImport}>
                Import {validCount} Leads
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Importing */}
        {step === 'importing' && (
          <div className="py-8 space-y-4 text-center">
            <p className="text-sm font-medium">Importing leads...</p>
            <Progress value={importProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">{importProgress}%</p>
          </div>
        )}

        {/* STEP 5: Done — Summary */}
        {step === 'done' && (
          <div className="py-4 space-y-4">
            <div className="text-center">
              <CheckCircle className="h-8 w-8 mx-auto text-green-400" />
              <p className="text-sm font-medium mt-2">Import Complete</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-green-500/10 border border-green-500/20 py-2">
                <p className="text-lg font-bold text-green-400">{importResult.success}</p>
                <p className="text-[10px] text-muted-foreground">Imported</p>
              </div>
              <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 py-2">
                <p className="text-lg font-bold text-yellow-400">{importResult.skipped}</p>
                <p className="text-[10px] text-muted-foreground">Duplicates</p>
              </div>
              <div className="rounded-md bg-destructive/10 border border-destructive/20 py-2">
                <p className="text-lg font-bold text-destructive">{importResult.failed}</p>
                <p className="text-[10px] text-muted-foreground">Failed</p>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <ScrollArea className="h-16 text-[10px] text-destructive border rounded p-1.5">
                {importResult.errors.map((e, i) => <p key={i}>{e}</p>)}
              </ScrollArea>
            )}
            <Button size="sm" onClick={onClose} className="w-full">Close</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
