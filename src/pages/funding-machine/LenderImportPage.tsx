import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import {
  LENDER_FIELDS,
  FIELD_BY_KEY,
  autoMapColumns,
  buildRows,
  type ParsedRow,
} from '@/lib/funding/lenderImportSchema';

const UNMAPPED = '__skip__';
const CHUNK_SIZE = 200;

interface SheetData {
  name: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

interface ImportSummary {
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
}

export default function LenderImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const sheet = useMemo(
    () => sheets.find((s) => s.name === activeSheet) ?? null,
    [sheets, activeSheet],
  );

  const parsedRows: ParsedRow[] = useMemo(
    () => (sheet ? buildRows(sheet.rows, mapping, sheet.name) : []),
    [sheet, mapping],
  );

  const validRows = useMemo(() => parsedRows.filter((r) => r.errors.length === 0), [parsedRows]);
  const invalidRows = useMemo(() => parsedRows.filter((r) => r.errors.length > 0), [parsedRows]);

  const mappedFieldKeys = useMemo(
    () => new Set(Object.values(mapping).filter((key) => key && key !== UNMAPPED)),
    [mapping],
  );

  const resetState = () => {
    setSheets([]);
    setActiveSheet('');
    setMapping({});
    setSummary(null);
    setProgress(0);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    setSummary(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      const parsedSheets: SheetData[] = workbook.SheetNames.map((name) => {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], {
          defval: null,
          raw: false,
        });
        const headers = Array.from(
          rows.reduce<Set<string>>((set, row) => {
            Object.keys(row).forEach((key) => set.add(key));
            return set;
          }, new Set<string>()),
        ).filter((header) => header && !header.startsWith('__EMPTY'));

        return { name, headers, rows };
      }).filter((s) => s.rows.length > 0 && s.headers.length > 0);

      if (parsedSheets.length === 0) {
        toast.error('No readable rows found in that file.');
        resetState();
        return;
      }

      setSheets(parsedSheets);
      selectSheet(parsedSheets[0], parsedSheets);
      toast.success(
        `Loaded ${parsedSheets.length} sheet${parsedSheets.length === 1 ? '' : 's'} from ${file.name}`,
      );
    } catch (error) {
      console.error('Failed to parse workbook:', error);
      toast.error(error instanceof Error ? error.message : 'Could not read that file.');
      resetState();
    }
  };

  const selectSheet = (target: SheetData, allSheets: SheetData[] = sheets) => {
    const found = allSheets.find((s) => s.name === target.name);
    if (!found) return;
    setActiveSheet(found.name);
    setMapping(autoMapColumns(found.headers));
  };

  const runImport = async () => {
    if (!sheet || validRows.length === 0) return;

    setImporting(true);
    setProgress(0);
    setSummary(null);

    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data: batch, error: batchError } = await supabase
        .from('funding_lender_import_batches')
        .insert({
          file_name: fileName,
          source_tab: sheet.name,
          target_table: 'funding_lender_database',
          column_mapping: mapping,
          rows_total: parsedRows.length,
          rows_failed: invalidRows.length,
          status: 'pending',
          imported_by: userData?.user?.id ?? null,
        })
        .select('id')
        .single();

      if (batchError) throw batchError;

      let inserted = 0;
      let updated = 0;
      let failed = invalidRows.length;
      const errors: string[] = invalidRows
        .slice(0, 20)
        .map((row) => `Row ${row.rowNumber}: ${row.errors.join('; ')}`);

      const payload = validRows.map((row) => ({ ...row.record, import_batch_id: batch.id }));
      const withRef = payload.filter((row) => row.external_ref);
      const withoutRef = payload.filter((row) => !row.external_ref);

      const totalChunks =
        Math.ceil(withRef.length / CHUNK_SIZE) + Math.ceil(withoutRef.length / CHUNK_SIZE);
      let completedChunks = 0;

      const advance = () => {
        completedChunks += 1;
        setProgress(Math.round((completedChunks / Math.max(totalChunks, 1)) * 100));
      };

      // Rows carrying a stable reference update in place instead of duplicating.
      for (let i = 0; i < withRef.length; i += CHUNK_SIZE) {
        const chunk = withRef.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase
          .from('funding_lender_database')
          .upsert(chunk, { onConflict: 'external_ref' })
          .select('id');

        if (error) {
          failed += chunk.length;
          errors.push(`Rows ${i + 1}-${i + chunk.length}: ${error.message}`);
        } else {
          updated += data?.length ?? 0;
        }
        advance();
      }

      for (let i = 0; i < withoutRef.length; i += CHUNK_SIZE) {
        const chunk = withoutRef.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase
          .from('funding_lender_database')
          .insert(chunk)
          .select('id');

        if (error) {
          failed += chunk.length;
          errors.push(`Rows ${i + 1}-${i + chunk.length}: ${error.message}`);
        } else {
          inserted += data?.length ?? 0;
        }
        advance();
      }

      await supabase
        .from('funding_lender_import_batches')
        .update({
          rows_inserted: inserted,
          rows_updated: updated,
          rows_failed: failed,
          errors: errors.slice(0, 50),
          status: failed > 0 && inserted + updated === 0 ? 'failed' : 'completed',
        })
        .eq('id', batch.id);

      setProgress(100);
      setSummary({ inserted, updated, failed, errors });

      if (inserted + updated > 0) {
        toast.success(`Imported ${inserted + updated} lenders from "${sheet.name}"`);
      } else {
        toast.error('No rows were imported. Check the errors below.');
      }
    } catch (error) {
      console.error('Lender import failed:', error);
      const message = error instanceof Error ? error.message : 'Import failed';
      toast.error(message);
      setSummary({ inserted: 0, updated: 0, failed: parsedRows.length, errors: [message] });
    } finally {
      setImporting(false);
    }
  };

  const previewFields = useMemo(
    () => LENDER_FIELDS.filter((field) => mappedFieldKeys.has(field.key)).slice(0, 7),
    [mappedFieldKeys],
  );

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <Database className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Lender Bulk Import</h1>
        </div>
        <p className="text-muted-foreground">
          Drop a workbook tab straight in — Excel or CSV. Map your columns once, then load hundreds of
          lenders, credit unions, cards, and vendors into the matching engine.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              1
            </span>
            Upload the file
          </CardTitle>
          <CardDescription>Accepts .xlsx, .xls and .csv. Every tab is read.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="max-w-md"
              disabled={importing}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            {fileName && (
              <>
                <Badge variant="secondary" className="gap-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  {fileName}
                </Badge>
                <Button variant="ghost" size="sm" onClick={resetState} disabled={importing}>
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              </>
            )}
          </div>

          {sheets.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {sheets.map((s) => (
                <Button
                  key={s.name}
                  size="sm"
                  variant={s.name === activeSheet ? 'default' : 'outline'}
                  disabled={importing}
                  onClick={() => selectSheet(s)}
                >
                  {s.name}
                  <Badge variant="secondary" className="ml-2">
                    {s.rows.length}
                  </Badge>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {sheet && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                2
              </span>
              Map your columns
            </CardTitle>
            <CardDescription>
              Auto-matched where possible. Anything left as "Don't import" is ignored — extra columns are
              never a problem.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {sheet.headers.map((header) => {
                const selected = mapping[header] ?? UNMAPPED;
                const field = selected !== UNMAPPED ? FIELD_BY_KEY[selected] : null;

                return (
                  <div
                    key={header}
                    className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={header}>
                        {header}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {field?.hint ?? String(sheet.rows[0]?.[header] ?? '—')}
                      </p>
                    </div>
                    <Select
                      value={selected}
                      disabled={importing}
                      onValueChange={(value) =>
                        setMapping((prev) => {
                          const next = { ...prev };
                          if (value === UNMAPPED) delete next[header];
                          else {
                            // A field can only be filled by one column.
                            for (const key of Object.keys(next)) {
                              if (next[key] === value) delete next[key];
                            }
                            next[header] = value;
                          }
                          return next;
                        })
                      }
                    >
                      <SelectTrigger className="w-56 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value={UNMAPPED}>Don't import</SelectItem>
                        {LENDER_FIELDS.map((option) => (
                          <SelectItem key={option.key} value={option.key}>
                            {option.label}
                            {option.required ? ' *' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>

            {!mappedFieldKeys.has('lender_name') && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Lender name is not mapped</AlertTitle>
                <AlertDescription>
                  Pick the column holding the lender or institution name before importing.
                </AlertDescription>
              </Alert>
            )}

            {!mappedFieldKeys.has('submission_method') && mappedFieldKeys.has('lender_name') && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Submission method not mapped</AlertTitle>
                <AlertDescription>
                  These rows will default to <strong>manual</strong> with automation off — safe, but you'll
                  want to tag them before the submission engine can use them.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {sheet && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                3
              </span>
              Review and import
            </CardTitle>
            <CardDescription className="flex flex-wrap gap-2 pt-1">
              <Badge variant="secondary">{parsedRows.length} rows read</Badge>
              <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">
                {validRows.length} ready
              </Badge>
              {invalidRows.length > 0 && (
                <Badge variant="destructive">{invalidRows.length} need attention</Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewFields.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Row</TableHead>
                      {previewFields.map((field) => (
                        <TableHead key={field.key}>{field.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 8).map((row) => (
                      <TableRow key={row.rowNumber} className={row.errors.length ? 'bg-destructive/5' : ''}>
                        <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                        {previewFields.map((field) => {
                          const value = row.record[field.key];
                          return (
                            <TableCell key={field.key} className="max-w-48 truncate">
                              {Array.isArray(value)
                                ? value.join(', ')
                                : typeof value === 'boolean'
                                  ? value
                                    ? 'Yes'
                                    : 'No'
                                  : value === undefined || value === null
                                    ? '—'
                                    : String(value)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {invalidRows.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{invalidRows.length} rows will be skipped</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                    {invalidRows.slice(0, 5).map((row) => (
                      <li key={row.rowNumber}>
                        Row {row.rowNumber}: {row.errors.join('; ')}
                      </li>
                    ))}
                    {invalidRows.length > 5 && <li>…and {invalidRows.length - 5} more</li>}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {importing && <Progress value={progress} />}

            <Button
              size="lg"
              className="w-full"
              disabled={importing || validRows.length === 0 || !mappedFieldKeys.has('lender_name')}
              onClick={() => void runImport()}
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import {validRows.length} lenders
                </>
              )}
            </Button>

            {summary && (
              <Alert variant={summary.inserted + summary.updated > 0 ? 'default' : 'destructive'}>
                {summary.inserted + summary.updated > 0 ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertTitle>Import finished</AlertTitle>
                <AlertDescription>
                  <span className="block">
                    {summary.inserted} added · {summary.updated} updated · {summary.failed} skipped
                  </span>
                  {summary.errors.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">
                      {summary.errors.slice(0, 5).map((message, index) => (
                        <li key={index}>{message}</li>
                      ))}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
