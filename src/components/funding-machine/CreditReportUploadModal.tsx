import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle, FileText, X } from "lucide-react";

interface Props {
  clientId: string;
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function CreditReportUploadModal({ clientId, open, onClose, onImportComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [bureau, setBureau] = useState("TransUnion");
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("funding-report-parser", {
        body: { client_id: clientId, pdf_base64: base64, bureau },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setParsedData(data.parsed_data);
      setSummary(data.summary);
      toast.success("Credit report parsed successfully");
    } catch (err: any) {
      toast.error(`Parse failed: ${err.message}`);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData) return;
    setImporting(true);
    try {
      const bureauLower = bureau.toLowerCase().replace("transunion", "TransUnion").replace("equifax", "Equifax").replace("experian", "Experian");
      // Insert negative items
      for (const item of parsedData.negative_items || []) {
        await supabase.from("funding_credit_items").insert({
          client_id: clientId,
          bureau: bureau,
          creditor_name: item.creditor_name,
          account_number: item.account_number || null,
          item_type: item.item_type?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) || "Collection",
          balance: item.balance || null,
          date_opened: item.date_opened || null,
          date_of_first_delinquency: item.date_of_first_delinquency || null,
          current_status: item.current_status || "open",
          scheduled_purge_date: item.scheduled_purge_date || null,
        });
      }
      // Insert hard inquiries
      for (const inq of parsedData.hard_inquiries || []) {
        await supabase.from("funding_credit_items").insert({
          client_id: clientId,
          bureau: bureau,
          creditor_name: inq.creditor_name,
          item_type: "Hard Inquiry",
          inquiry_date: inq.inquiry_date || null,
          current_status: "open",
        });
      }
      // Update bureau score
      if (parsedData.bureau_score) {
        const scoreField = bureau === "TransUnion" ? "personal_credit_tu" : bureau === "Equifax" ? "personal_credit_eq" : "personal_credit_ex";
        const { data: latestScore } = await supabase.from("funding_dfs_scores").select("id").eq("client_id", clientId).order("scored_at", { ascending: false }).limit(1).maybeSingle();
        if (latestScore) {
          await supabase.from("funding_dfs_scores").update({ [scoreField]: parsedData.bureau_score }).eq("id", latestScore.id);
        }
      }
      toast.success("Items imported successfully");
      onImportComplete();
      handleClose();
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData(null);
    setSummary(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <Card className="w-full max-w-lg border-red-500/30 mx-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-red-400" /> Upload & Parse Credit Report
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!summary ? (
            <>
              <div>
                <Label>Bureau</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={bureau} onChange={e => setBureau(e.target.value)}>
                  <option>TransUnion</option><option>Equifax</option><option>Experian</option>
                </select>
              </div>
              <div>
                <Label>Credit Report PDF</Label>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                <Button variant="outline" className="w-full mt-1" onClick={() => fileRef.current?.click()}>
                  {file ? <><FileText className="h-4 w-4 mr-2" /> {file.name}</> : <><Upload className="h-4 w-4 mr-2" /> Select PDF</>}
                </Button>
              </div>
              <Button onClick={handleParse} disabled={!file || parsing} className="w-full bg-gradient-to-r from-red-600 to-rose-500 text-white">
                {parsing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing credit report with AI — this takes 15 to 30 seconds</> : "Parse Report"}
              </Button>
            </>
          ) : (
            <>
              <div className="text-center space-y-2">
                <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto" />
                <h3 className="font-bold text-lg">Report Parsed Successfully</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <div className="text-2xl font-bold text-red-400">{summary.negative_items_found}</div>
                  <div className="text-xs text-muted-foreground">Negative Items</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <div className="text-2xl font-bold text-amber-400">{summary.hard_inquiries_found}</div>
                  <div className="text-xs text-muted-foreground">Hard Inquiries</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <div className="text-2xl font-bold text-blue-400">{summary.open_accounts_found}</div>
                  <div className="text-xs text-muted-foreground">Open Accounts</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <div className="text-2xl font-bold text-emerald-400">{summary.bureau_score_found || "—"}</div>
                  <div className="text-xs text-muted-foreground">Bureau Score</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleImport} disabled={importing} className="flex-1 bg-gradient-to-r from-emerald-600 to-green-500 text-white">
                  {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  {importing ? "Importing..." : "Confirm & Import"}
                </Button>
                <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
