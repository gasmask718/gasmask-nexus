import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FileText, Plus, Send, Filter, Upload, Trash2, Download, Eye } from "lucide-react";

const BUREAU_OPTIONS = ["Equifax", "Experian", "TransUnion", "All Three"];
const LETTER_TYPES = [
  { value: "standard_deletion", label: "Standard Deletion (FCRA §611)" },
  { value: "goodwill", label: "Goodwill Deletion" },
  { value: "cease_desist", label: "Cease & Desist" },
  { value: "debt_validation", label: "Debt Validation (FDCPA §809)" },
  { value: "method_of_verification", label: "Method of Verification" },
];
const CHEX_LETTER_TYPES = [
  { value: "dispute", label: "ChexSystems Dispute" },
  { value: "early_removal", label: "Early Removal Request" },
  { value: "identity_theft_claim", label: "Identity Theft Claim" },
  { value: "opt_out", label: "Opt-Out / Security Freeze" },
];
const CHEX_DISPUTE_TYPES = ["inaccurate", "obsolete", "identity_theft", "never_had_account"];
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  ready_to_send: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  sent: "bg-green-500/20 text-green-400 border-green-500/30",
  responded: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};
const DOC_TYPES = ["bank_statement", "id", "police_report", "ftc_report", "other"];

export default function DeletionLetterEnginePage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"bureau" | "chexsystems">("bureau");
  const [showAdd, setShowAdd] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [filterBureau, setFilterBureau] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showUpload, setShowUpload] = useState<string | null>(null);

  const emptyBureauForm = {
    full_name: "", address: "", city: "", state: "", zip: "", email: "", phone: "",
    ssn_last4: "", date_of_birth: "", account_number: "", creditor_name: "",
    bureau: "All Three", dispute_reason: "", letter_type: "standard_deletion",
    is_chexsystems: false,
  };
  const emptyChexForm = {
    ...emptyBureauForm, is_chexsystems: true,
    chexsystems_report_date: "", chexsystems_item_description: "",
    chexsystems_reporting_bank: "", chexsystems_amount_owed: "",
    chexsystems_dispute_type: "inaccurate", chexsystems_letter_type: "dispute",
    chexsystems_file_number: "",
  };
  const [form, setForm] = useState<any>(emptyBureauForm);

  const { data: recipients = [] } = useQuery({
    queryKey: ["deletion-letter-recipients", mode],
    queryFn: async () => {
      const { data } = await supabase.from("deletion_letter_recipients")
        .select("*")
        .eq("is_chexsystems", mode === "chexsystems")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["chex-docs", showUpload],
    queryFn: async () => {
      if (!showUpload) return [];
      const { data } = await supabase.from("chexsystems_upload_documents")
        .select("*").eq("recipient_id", showUpload).order("uploaded_at", { ascending: false });
      return data || [];
    },
    enabled: !!showUpload,
  });

  const addRecipient = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (form.chexsystems_amount_owed) payload.chexsystems_amount_owed = Number(form.chexsystems_amount_owed);
      else delete payload.chexsystems_amount_owed;
      const { error } = await supabase.from("deletion_letter_recipients").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deletion-letter-recipients"] });
      setShowAdd(false);
      setForm(mode === "chexsystems" ? emptyChexForm : emptyBureauForm);
      toast.success("Recipient added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const generateLetter = async (id: string) => {
    setGenerating(id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-deletion-letter", { body: { recipient_id: id } });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["deletion-letter-recipients"] });
      // Open preview
      const updated = await supabase.from("deletion_letter_recipients").select("*").eq("id", id).single();
      if (updated.data) setPreview(updated.data);
      toast.success("Letter generated");
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(null);
    }
  };

  const markSent = async (id: string) => {
    await supabase.from("deletion_letter_recipients").update({ letter_status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["deletion-letter-recipients"] });
    setPreview(null);
    toast.success("Marked as sent");
  };

  const uploadDoc = async (file: File, recipientId: string, docType: string) => {
    const path = `${recipientId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("chexsystems-docs").upload(path, file);
    if (uploadErr) { toast.error(uploadErr.message); return; }
    const { error: insertErr } = await supabase.from("chexsystems_upload_documents").insert({
      recipient_id: recipientId, document_name: file.name, document_type: docType, storage_path: path,
    });
    if (insertErr) { toast.error(insertErr.message); return; }
    queryClient.invalidateQueries({ queryKey: ["chex-docs"] });
    toast.success("Document uploaded");
  };

  const filtered = recipients.filter((r: any) => {
    if (filterBureau !== "all" && r.bureau !== filterBureau) return false;
    if (filterStatus !== "all" && r.letter_status !== filterStatus) return false;
    if (mode === "bureau" && filterType !== "all" && r.letter_type !== filterType) return false;
    if (mode === "chexsystems" && filterType !== "all" && r.chexsystems_letter_type !== filterType) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Deletion Letter Engine</h1>
            <p className="text-sm text-muted-foreground">Auto-generate dispute letters for Credit Bureaus & ChexSystems</p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setForm(mode === "chexsystems" ? emptyChexForm : emptyBureauForm); setShowAdd(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Recipient
        </Button>
      </div>

      {/* Mode Toggle */}
      <Tabs value={mode} onValueChange={(v: any) => setMode(v)} className="w-full">
        <TabsList>
          <TabsTrigger value="bureau">Credit Bureau Letters</TabsTrigger>
          <TabsTrigger value="chexsystems">ChexSystems Letters</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {mode === "bureau" && (
          <Select value={filterBureau} onValueChange={setFilterBureau}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Bureau" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Bureaus</SelectItem>{BUREAU_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Letter Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {(mode === "bureau" ? LETTER_TYPES : CHEX_LETTER_TYPES).map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="ready_to_send">Ready</SelectItem><SelectItem value="sent">Sent</SelectItem><SelectItem value="responded">Responded</SelectItem></SelectContent>
        </Select>
      </div>

      {/* Recipients Table */}
      <Card className="bg-card border-border">
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No recipients yet</p>
              <Button size="sm" className="mt-3" onClick={() => { setForm(mode === "chexsystems" ? emptyChexForm : emptyBureauForm); setShowAdd(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Recipient
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="pb-2 pr-3">Name</th>
                    <th className="pb-2 pr-3">Creditor</th>
                    {mode === "bureau" ? <th className="pb-2 pr-3">Bureau</th> : <th className="pb-2 pr-3">Reporting Bank</th>}
                    <th className="pb-2 pr-3">Type</th>
                    <th className="pb-2 pr-3">Status</th>
                    {mode === "chexsystems" && <th className="pb-2 pr-3">File #</th>}
                    {mode === "chexsystems" && <th className="pb-2 pr-3">Amount</th>}
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r: any) => {
                    const typeLabel = mode === "bureau"
                      ? LETTER_TYPES.find(t => t.value === r.letter_type)?.label || r.letter_type
                      : CHEX_LETTER_TYPES.find(t => t.value === r.chexsystems_letter_type)?.label || r.chexsystems_letter_type;
                    return (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="py-3 pr-3 font-medium text-foreground">{r.full_name}</td>
                        <td className="py-3 pr-3 text-muted-foreground">{r.creditor_name || "—"}</td>
                        {mode === "bureau" ? <td className="py-3 pr-3 text-muted-foreground">{r.bureau}</td> : <td className="py-3 pr-3 text-muted-foreground">{r.chexsystems_reporting_bank || "—"}</td>}
                        <td className="py-3 pr-3 text-muted-foreground text-xs">{typeLabel}</td>
                        <td className="py-3 pr-3"><Badge className={STATUS_COLORS[r.letter_status]}>{r.letter_status}</Badge></td>
                        {mode === "chexsystems" && <td className="py-3 pr-3 text-muted-foreground font-mono text-xs">{r.chexsystems_file_number || "—"}</td>}
                        {mode === "chexsystems" && <td className="py-3 pr-3 text-muted-foreground">{r.chexsystems_amount_owed ? `$${Number(r.chexsystems_amount_owed).toFixed(2)}` : "—"}</td>}
                        <td className="py-3 space-x-1">
                          <Button size="sm" variant="outline" disabled={generating === r.id} onClick={() => generateLetter(r.id)}>
                            {generating === r.id ? "..." : "Generate"}
                          </Button>
                          {r.generated_letter && <Button size="sm" variant="ghost" onClick={() => setPreview(r)}><Eye className="h-3.5 w-3.5" /></Button>}
                          {mode === "chexsystems" && <Button size="sm" variant="ghost" onClick={() => setShowUpload(r.id)}><Upload className="h-3.5 w-3.5" /></Button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Recipient Modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{mode === "chexsystems" ? "Add ChexSystems Recipient" : "Add Bureau Recipient"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Full Name *</Label><Input value={form.full_name} onChange={e => setForm((p: any) => ({ ...p, full_name: e.target.value }))} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm((p: any) => ({ ...p, address: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>City</Label><Input value={form.city} onChange={e => setForm((p: any) => ({ ...p, city: e.target.value }))} /></div>
              <div><Label>State</Label><Input value={form.state} onChange={e => setForm((p: any) => ({ ...p, state: e.target.value }))} maxLength={2} /></div>
              <div><Label>ZIP</Label><Input value={form.zip} onChange={e => setForm((p: any) => ({ ...p, zip: e.target.value }))} maxLength={5} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm((p: any) => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label>SSN Last 4</Label><Input value={form.ssn_last4} onChange={e => setForm((p: any) => ({ ...p, ssn_last4: e.target.value }))} maxLength={4} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date of Birth</Label><Input value={form.date_of_birth} onChange={e => setForm((p: any) => ({ ...p, date_of_birth: e.target.value }))} placeholder="MM/DD/YYYY" /></div>
              <div><Label>Account Number</Label><Input value={form.account_number} onChange={e => setForm((p: any) => ({ ...p, account_number: e.target.value }))} /></div>
            </div>
            <div><Label>Creditor Name</Label><Input value={form.creditor_name} onChange={e => setForm((p: any) => ({ ...p, creditor_name: e.target.value }))} /></div>
            {mode === "bureau" && (
              <>
                <div><Label>Bureau</Label>
                  <Select value={form.bureau} onValueChange={v => setForm((p: any) => ({ ...p, bureau: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BUREAU_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Letter Type</Label>
                  <Select value={form.letter_type} onValueChange={v => setForm((p: any) => ({ ...p, letter_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LETTER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
            {mode === "chexsystems" && (
              <>
                <div><Label>ChexSystems File Number</Label><Input value={form.chexsystems_file_number} onChange={e => setForm((p: any) => ({ ...p, chexsystems_file_number: e.target.value }))} /></div>
                <div><Label>Reporting Bank</Label><Input value={form.chexsystems_reporting_bank} onChange={e => setForm((p: any) => ({ ...p, chexsystems_reporting_bank: e.target.value }))} /></div>
                <div><Label>Item Description</Label><Input value={form.chexsystems_item_description} onChange={e => setForm((p: any) => ({ ...p, chexsystems_item_description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Amount Owed</Label><Input type="number" value={form.chexsystems_amount_owed} onChange={e => setForm((p: any) => ({ ...p, chexsystems_amount_owed: e.target.value }))} /></div>
                  <div><Label>Report Date</Label><Input value={form.chexsystems_report_date} onChange={e => setForm((p: any) => ({ ...p, chexsystems_report_date: e.target.value }))} placeholder="MM/DD/YYYY" /></div>
                </div>
                <div><Label>Dispute Type</Label>
                  <Select value={form.chexsystems_dispute_type} onValueChange={v => setForm((p: any) => ({ ...p, chexsystems_dispute_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CHEX_DISPUTE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Letter Type</Label>
                  <Select value={form.chexsystems_letter_type} onValueChange={v => setForm((p: any) => ({ ...p, chexsystems_letter_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CHEX_LETTER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div><Label>Dispute Reason</Label><Textarea value={form.dispute_reason} onChange={e => setForm((p: any) => ({ ...p, dispute_reason: e.target.value }))} rows={3} /></div>
            <Button className="w-full" onClick={() => addRecipient.mutate()} disabled={!form.full_name}>Save Recipient</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Letter Preview Drawer */}
      <Sheet open={!!preview} onOpenChange={() => setPreview(null)}>
        <SheetContent className="w-[500px] bg-card overflow-y-auto">
          <SheetHeader><SheetTitle className="text-foreground">Letter Preview</SheetTitle></SheetHeader>
          {preview && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <Badge className={STATUS_COLORS[preview.letter_status]}>{preview.letter_status}</Badge>
                <p className="text-xs text-muted-foreground">{preview.generated_at ? `Generated: ${new Date(preview.generated_at).toLocaleDateString()}` : ""}</p>
              </div>
              <div className="bg-white text-black p-6 rounded-lg text-sm whitespace-pre-wrap font-mono leading-relaxed border">
                {preview.generated_letter || "No letter generated yet. Click Generate first."}
              </div>
              {preview.generated_letter && preview.letter_status !== "sent" && (
                <Button className="w-full" onClick={() => markSent(preview.id)}>
                  <Send className="h-4 w-4 mr-2" /> Mark as Sent
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ChexSystems Document Upload */}
      <Dialog open={!!showUpload} onOpenChange={() => setShowUpload(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Documents</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Document Type</Label>
              <Select defaultValue="other">
                <SelectTrigger id="docTypeSelect"><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>File</Label>
              <Input type="file" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !showUpload) return;
                const docTypeEl = document.getElementById("docTypeSelect");
                const docType = (docTypeEl as any)?.textContent?.toLowerCase().replace(/ /g, "_") || "other";
                await uploadDoc(file, showUpload, docType);
              }} />
            </div>
            {docs.length > 0 && (
              <div className="space-y-2">
                <Label>Uploaded Documents</Label>
                {docs.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between bg-muted/30 rounded p-2 text-sm">
                    <div>
                      <p className="text-foreground">{d.document_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{d.document_type.replace(/_/g, " ")}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{new Date(d.uploaded_at).toLocaleDateString()}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
