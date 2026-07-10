// GEE-9 — Application Package editor at /os/grants/apply/:packageId
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, CheckCircle2, XCircle, Loader2, Save, RefreshCw, Send, ArrowLeft } from "lucide-react";

type QA = { question: string; answer: string };

type Pkg = {
  id: string;
  business_profile_id: string;
  grant_opportunity_id: string;
  cover_letter: string | null;
  business_narrative: string | null;
  fund_usage_plan: string | null;
  qa_answers: QA[] | null;
  documents_ready: string[] | null;
  documents_missing: string[] | null;
  generation_status: string;
  submitted_at: string | null;
  submission_confirmation: string | null;
};

type Header = {
  business_name: string;
  grant_title: string;
  amount: number | null;
  deadline: string | null;
};

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text || "").then(
    () => toast.success(label),
    () => toast.error("Copy failed"),
  );
}

export default function ApplicationPackage() {
  const { packageId } = useParams<{ packageId: string }>();
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [header, setHeader] = useState<Header | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regen, setRegen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [coverLetter, setCoverLetter] = useState("");
  const [narrative, setNarrative] = useState("");
  const [fundPlan, setFundPlan] = useState("");
  const [qa, setQa] = useState<QA[]>([]);

  async function load() {
    if (!packageId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("grant_application_packages")
      .select("*")
      .eq("id", packageId)
      .maybeSingle();
    if (error || !data) {
      toast.error(error?.message ?? "Package not found");
      setLoading(false);
      return;
    }
    const p = data as unknown as Pkg;
    setPkg(p);
    setCoverLetter(p.cover_letter ?? "");
    setNarrative(p.business_narrative ?? "");
    setFundPlan(p.fund_usage_plan ?? "");
    setQa(Array.isArray(p.qa_answers) ? p.qa_answers : []);

    const [{ data: biz }, { data: g }] = await Promise.all([
      supabase.from("grant_business_profiles").select("business_name").eq("id", p.business_profile_id).maybeSingle(),
      supabase
        .from("grant_opportunities")
        .select("title,grant_name,amount,amount_typical,amount_max,amount_min,deadline,next_deadline")
        .eq("id", p.grant_opportunity_id)
        .maybeSingle(),
    ]);
    setHeader({
      business_name: (biz as any)?.business_name ?? "Business",
      grant_title: (g as any)?.title ?? (g as any)?.grant_name ?? "Grant",
      amount: (g as any)?.amount ?? (g as any)?.amount_typical ?? (g as any)?.amount_max ?? (g as any)?.amount_min ?? null,
      deadline: (g as any)?.deadline ?? (g as any)?.next_deadline ?? null,
    });
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [packageId]);

  async function handleSave() {
    if (!pkg) return;
    setSaving(true);
    const { error } = await supabase
      .from("grant_application_packages")
      .update({
        cover_letter: coverLetter,
        business_narrative: narrative,
        fund_usage_plan: fundPlan,
        qa_answers: qa,
      })
      .eq("id", pkg.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Changes saved");
  }

  async function handleRegenerate() {
    if (!pkg) return;
    setRegenOpen(false);
    setRegen(true);
    const { data, error } = await supabase.functions.invoke("grant-auto-apply", {
      body: { eligibility_result_id: (pkg as any).eligibility_result_id ?? null },
    });
    setRegen(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Regenerate failed");
      return;
    }
    toast.success("Package regenerated");
    await load();
  }

  async function handleSubmit() {
    if (!pkg) return;
    setSubmitting(true);
    const now = new Date().toISOString();
    const { error: e1 } = await supabase
      .from("grant_application_packages")
      .update({
        generation_status: "submitted",
        submitted_at: now,
        submission_confirmation: confirmationCode || null,
      })
      .eq("id", pkg.id);
    const elig_id = (pkg as any).eligibility_result_id;
    if (elig_id) {
      await supabase
        .from("grant_eligibility_results")
        .update({ application_status: "submitted", submitted_at: now })
        .eq("id", elig_id);
    }
    setSubmitting(false);
    setSubmitOpen(false);
    if (e1) toast.error(e1.message);
    else {
      toast.success("Marked as submitted");
      load();
    }
  }

  const status = pkg?.generation_status ?? "pending";
  const statusBadge = useMemo(() => {
    if (status === "submitted") return <Badge className="bg-emerald-600">Submitted</Badge>;
    if (status === "ready") return <Badge className="bg-amber-500">Package Ready</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  }, [status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!pkg) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Link to="/os/grants/eligibility" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Eligibility Matrix
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Package not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This application package doesn't exist yet. Generate one from a matching grant in the Eligibility Matrix.
            </p>
            <Button asChild style={{ backgroundColor: "#C9A84C", color: "#000" }}>
              <Link to="/os/grants/eligibility">Generate a Package</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 pb-32 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <Link to="/os/grants/eligibility" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Eligibility Matrix
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {header?.business_name} — {header?.grant_title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Grant Amount: <span className="font-medium text-foreground">
                {header?.amount != null ? `$${Number(header.amount).toLocaleString()}` : "—"}
              </span>
              {" · "}Deadline: <span className="font-medium text-foreground">{header?.deadline ?? "—"}</span>
            </p>
          </div>
          {statusBadge}
        </div>
      </div>

      {/* SECTION A — Cover Letter */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Cover Letter</CardTitle>
          <Button variant="outline" size="sm" onClick={() => copy(coverLetter, "Cover letter copied")}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} rows={14} />
          <div className="text-xs text-muted-foreground">{coverLetter.length} characters</div>
        </CardContent>
      </Card>

      {/* SECTION B — Business Narrative */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Business Narrative</CardTitle>
          <Button variant="outline" size="sm" onClick={() => copy(narrative, "Narrative copied")}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={16} />
        </CardContent>
      </Card>

      {/* SECTION C — Fund Usage Plan */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Fund Usage Plan</CardTitle>
          <Button variant="outline" size="sm" onClick={() => copy(fundPlan, "Fund plan copied")}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea value={fundPlan} onChange={(e) => setFundPlan(e.target.value)} rows={10} />
        </CardContent>
      </Card>

      {/* SECTION D — Q&A */}
      <Card>
        <CardHeader>
          <CardTitle>Application Q&A</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {qa.length === 0 && <p className="text-sm text-muted-foreground">No Q&A generated.</p>}
          {qa.map((item, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm">{idx + 1}. {item.question}</p>
                <Button variant="ghost" size="sm" onClick={() => copy(item.answer, "Answer copied")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={item.answer}
                onChange={(e) => {
                  const next = [...qa];
                  next[idx] = { ...next[idx], answer: e.target.value };
                  setQa(next);
                }}
                rows={5}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* SECTION E — Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Document Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-semibold mb-2 text-emerald-600">Ready ({pkg.documents_ready?.length ?? 0})</p>
            <ul className="space-y-1">
              {(pkg.documents_ready ?? []).map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {d}
                </li>
              ))}
              {(pkg.documents_ready?.length ?? 0) === 0 && (
                <li className="text-xs text-muted-foreground">None marked ready.</li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2 text-red-600">Missing ({pkg.documents_missing?.length ?? 0})</p>
            <ul className="space-y-1">
              {(pkg.documents_missing ?? []).map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span>{d}</span>
                  <span className="text-xs text-muted-foreground">
                    — Upload this in Tab 8 of{" "}
                    <Link
                      to={`/os/grants/businesses/${pkg.business_profile_id}`}
                      className="underline text-primary"
                    >
                      your business profile
                    </Link>
                  </span>
                </li>
              ))}
              {(pkg.documents_missing?.length ?? 0) === 0 && (
                <li className="text-xs text-muted-foreground">All documents ready.</li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur p-4 flex flex-wrap gap-2 justify-end z-40">
        <Button variant="outline" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
        <Button variant="outline" onClick={() => setRegenOpen(true)} disabled={regen}>
          {regen ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Regenerate Package
        </Button>
        <Button onClick={() => setSubmitOpen(true)} disabled={status === "submitted"}>
          <Send className="h-4 w-4 mr-2" />
          {status === "submitted" ? "Submitted" : "Mark as Submitted"}
        </Button>
      </div>

      {/* Regenerate dialog */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate package?</DialogTitle>
            <DialogDescription>
              This will run the AI again and create a new package. Your unsaved edits to the current
              package will not be overwritten, but a new package row will be created.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenOpen(false)}>Cancel</Button>
            <Button onClick={handleRegenerate}>Regenerate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as submitted</DialogTitle>
            <DialogDescription>
              Optionally record the funder's confirmation number for reference.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="conf">Confirmation number (optional)</Label>
            <Input
              id="conf"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              placeholder="e.g. GRT-2026-00123"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
