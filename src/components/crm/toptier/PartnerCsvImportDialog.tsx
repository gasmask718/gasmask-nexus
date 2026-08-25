/**
 * TopTier Partner CRM — CSV import dialog.
 * Parses the file client-side, then hands rows to the server-side
 * `tt-partner-csv-import` function which batches at 200 rows and
 * de-dupes on google_place_id. No client-side bulk inserts.
 */
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Upload, Loader2, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/** Minimal RFC4180-ish CSV parser (handles quoted fields and embedded commas/newlines). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
}

interface Props {
  onImported?: () => void;
}

type Result = {
  dryRun: boolean;
  received: number;
  would_insert?: number;
  inserted?: number;
  skipped_duplicate_place_id?: number;
  rejected: number;
  rejects?: { index: number; reasons: string[]; company_name?: string | null }[];
  batch_errors?: { batch: number; error: string }[];
};

export function PartnerCsvImportDialog({ onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      toast.error('No data rows found in that file');
      return;
    }
    setRows(parsed);
    setFileName(file.name);
  };

  const run = async (dryRun: boolean) => {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('tt-partner-csv-import', {
        body: { rows, dryRun },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(`${(data as any).error}: ${(data as any).message ?? ''}`);
      setResult(data as Result);
      if (!dryRun) {
        toast.success(`Imported ${(data as Result).inserted ?? 0} partners`);
        onImported?.();
      }
    } catch (err: any) {
      console.error('partner csv import failed:', err);
      toast.error(err.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setRows([]); setFileName(''); setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import sourced partners</DialogTitle>
          <DialogDescription>
            Columns recognised: company_name (required), category, specialty, contact_name, phone, email,
            website, office_address, city, state, coverage_areas, google_place_id, source, source_ref, stage,
            licence_number, licence_state, licence_status, insurance_expiry, insurance_status, lat, lng, notes.
            Rows are processed server-side in batches of 200 and de-duplicated on google_place_id.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
          />

          {rows.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
              <span className="text-muted-foreground">— {rows.length} rows parsed</span>
            </div>
          )}

          {result && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <div className="font-medium">
                {result.dryRun ? 'Validation preview' : 'Import complete'}
              </div>
              <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                <span>Received</span><span>{result.received}</span>
                {result.dryRun
                  ? (<><span>Would insert</span><span>{result.would_insert}</span></>)
                  : (<>
                      <span>Inserted</span><span>{result.inserted}</span>
                      <span>Skipped (duplicate place id)</span><span>{result.skipped_duplicate_place_id}</span>
                    </>)}
                <span>Rejected</span><span>{result.rejected}</span>
              </div>
              {!!result.rejects?.length && (
                <div className="max-h-40 overflow-y-auto rounded bg-muted/40 p-2 text-xs">
                  {result.rejects.map((r) => (
                    <div key={r.index}>
                      Row {r.index + 2}: {r.company_name || '(no name)'} — {r.reasons.join(', ')}
                    </div>
                  ))}
                </div>
              )}
              {!!result.batch_errors?.length && (
                <div className="rounded bg-destructive/15 p-2 text-xs text-destructive">
                  {result.batch_errors.map((b) => (
                    <div key={b.batch}>Batch {b.batch}: {b.error}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy || rows.length === 0} onClick={() => run(true)}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Validate
          </Button>
          <Button disabled={busy || rows.length === 0} onClick={() => run(false)}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import {rows.length > 0 ? `${rows.length} rows` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PartnerCsvImportDialog;
