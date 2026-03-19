import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// Only these columns are allowed into the DB
const ALLOWED_COLUMNS = [
  "business_name", "phone_number", "city", "state",
  "address", "industry", "rating", "pipeline_stage",
  "lead_status", "website_status", "call_attempts",
  "priority_score", "engagement_score", "ai_paused", "converted",
] as const;

const COLUMN_ALIASES: Record<string, string> = {
  name: "business_name",
  company: "business_name",
  phone: "phone_number",
  telephone: "phone_number",
  location: "city",
  category: "industry",
  type: "industry",
  status: "lead_status",
  score: "priority_score",
  reviews: "review_count",
  stars: "rating",
};

function normalizePhone(raw: unknown): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[^0-9]/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits[0] === "1") return "+" + digits;
  if (digits.length >= 7) return "+" + digits;
  return null;
}

function cleanNumeric(val: unknown, max?: number): number | null {
  if (val === null || val === undefined || val === "") return null;
  const str = String(val).replace(/[$€£,\s]/g, "");
  const num = Number(str);
  if (isNaN(num)) return null;
  return max !== undefined ? Math.min(num, max) : num;
}

function normalizeColumnName(col: string): string {
  const lower = col.toLowerCase().trim().replace(/[\s\-]+/g, "_");
  return COLUMN_ALIASES[lower] || lower;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  total: number;
}

export function CsvLeadImporter({ onComplete }: { onComplete?: () => void }) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);
    setProgress(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

      if (rawRows.length === 0) {
        toast.error("File is empty");
        setImporting(false);
        return;
      }

      // Map column names
      const headerMap = new Map<string, string>();
      Object.keys(rawRows[0]).forEach((col) => {
        const normalized = normalizeColumnName(col);
        if ((ALLOWED_COLUMNS as readonly string[]).includes(normalized)) {
          headerMap.set(col, normalized);
        }
      });

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      const batchSize = 50;
      const cleanedRows: Record<string, unknown>[] = [];

      for (let i = 0; i < rawRows.length; i++) {
        const raw = rawRows[i];

        try {
          // Build clean row with only allowed columns
          const row: Record<string, unknown> = {};
          for (const [origCol, dbCol] of headerMap) {
            row[dbCol] = raw[origCol];
          }

          // Validate business_name
          if (!row.business_name || String(row.business_name).trim() === "") {
            skipped++;
            continue;
          }
          row.business_name = String(row.business_name).trim();

          // Normalize phone
          const phone = normalizePhone(row.phone_number);
          if (!phone) {
            skipped++;
            errors.push(`Row ${i + 2}: invalid/missing phone "${row.phone_number}"`);
            continue;
          }
          row.phone_number = phone;

          // Cast numeric fields
          row.rating = cleanNumeric(row.rating, 5.0);
          row.call_attempts = cleanNumeric(row.call_attempts) ?? 0;
          row.priority_score = cleanNumeric(row.priority_score) ?? 5;
          row.engagement_score = cleanNumeric(row.engagement_score) ?? 0;

          // Defaults
          row.pipeline_stage = row.pipeline_stage || "new";
          row.lead_status = row.lead_status || "new";
          row.ai_paused = row.ai_paused === true || row.ai_paused === "true" ? true : false;
          row.converted = row.converted === true || row.converted === "true" ? true : false;

          // Clean string fields
          if (row.city) row.city = String(row.city).trim();
          if (row.state) row.state = String(row.state).trim();
          if (row.address) row.address = String(row.address).trim();
          if (row.industry) row.industry = String(row.industry).trim();

          cleanedRows.push(row);
        } catch (rowErr: any) {
          skipped++;
          errors.push(`Row ${i + 2}: ${rowErr.message}`);
        }
      }

      // Insert in batches
      for (let b = 0; b < cleanedRows.length; b += batchSize) {
        const batch = cleanedRows.slice(b, b + batchSize);
        try {
          const { error } = await (supabase as any)
            .from("brandaro_qualified_leads")
            .upsert(batch, { onConflict: "phone_number", ignoreDuplicates: true });

          if (error) {
            // Try row-by-row for this batch
            for (const singleRow of batch) {
              try {
                const { error: sErr } = await (supabase as any)
                  .from("brandaro_qualified_leads")
                  .upsert([singleRow], { onConflict: "phone_number", ignoreDuplicates: true });
                if (sErr) {
                  skipped++;
                  errors.push(`"${singleRow.business_name}": ${sErr.message}`);
                } else {
                  imported++;
                }
              } catch {
                skipped++;
              }
            }
          } else {
            imported += batch.length;
          }
        } catch (batchErr: any) {
          errors.push(`Batch error: ${batchErr.message}`);
          skipped += batch.length;
        }

        setProgress(Math.round(((b + batch.length) / cleanedRows.length) * 100));
      }

      setResult({ imported, skipped, errors: errors.slice(0, 20), total: rawRows.length });
      if (imported > 0) {
        toast.success(`Imported ${imported} leads`);
        onComplete?.();
      }
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Import Leads from CSV / Excel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFile}
          className="hidden"
        />

        <Button
          variant="outline"
          className="w-full"
          onClick={() => inputRef.current?.click()}
          disabled={importing}
        >
          {importing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {importing ? "Importing..." : "Upload CSV or Excel File"}
        </Button>

        {importing && <Progress value={progress} className="h-2" />}

        {result && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{result.imported} leads imported</span>
            </div>
            {result.skipped > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>{result.skipped} rows skipped</span>
              </div>
            )}
            <Badge variant="outline">{result.total} total rows processed</Badge>
            {result.errors.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Show errors ({result.errors.length})</summary>
                <ul className="mt-1 space-y-0.5 max-h-32 overflow-auto">
                  {result.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Accepted columns: business_name, phone_number, city, state, address, industry, rating, priority_score.
          Phone numbers are auto-normalized. Rows without a valid phone or name are skipped.
        </p>
      </CardContent>
    </Card>
  );
}
