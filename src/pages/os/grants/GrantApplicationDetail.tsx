import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Copy, Save, Trash2, Loader2 } from "lucide-react";

const GOLD = "#C9A84C";

const STATUS_OPTIONS = [
  "identified", "drafting", "submitted", "under_review",
  "approved", "awarded", "denied", "withdrawn",
];

const STATUS_STYLES: Record<string, string> = {
  identified:   "bg-gray-500/15 text-gray-300 border-gray-500/30",
  drafting:     "bg-blue-500/15 text-blue-300 border-blue-500/30",
  submitted:    "bg-amber-500/15 text-amber-300 border-amber-500/30",
  under_review: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  approved:     "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  awarded:      "text-black",
  denied:       "bg-red-500/15 text-red-300 border-red-500/30",
  withdrawn:    "bg-muted text-muted-foreground border-border",
};

type AppRow = any;

export default function GrantApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [app, setApp] = useState<AppRow | null>(null);
  const [draftState, setDraftState] = useState("");
  const [generating, setGenerating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const fetchApp = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("grant_applications")
      .select(`
        *,
        grant_opportunities:opportunity_id (amount_min, amount_max, application_url, description),
        funding_clients:funding_client_id (full_name, credit_score_estimate)
      `)
      .eq("id", id)
      .maybeSingle();
    setLoading(false);
    if (error || !data) { setNotFound(true); return; }
    setApp(data);
    setDraftState(data.ai_draft ?? "");
  };

  useEffect(() => { fetchApp(); /* eslint-disable-next-line */ }, [id]);

  const daysLeft = useMemo(() => {
    if (!app?.deadline) return null;
    const d = new Date(app.deadline);
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  }, [app?.deadline]);

  const deadlineBadge = () => {
    if (daysLeft == null) return <span className="text-muted-foreground text-sm">Rolling</span>;
    const cls =
      daysLeft <= 7 ? "text-red-400" :
      daysLeft <= 30 ? "text-amber-400" : "text-emerald-400";
    return (
      <span className={`text-sm font-medium ${cls}`}>
        {daysLeft <= 7 && "⚡ "}{daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}
      </span>
    );
  };

  const handleStatusChange = async (status: string) => {
    if (!app) return;
    const { error } = await supabase
      .from("grant_applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", app.id);
    if (error) { toast.error(error.message); return; }
    setApp({ ...app, status });
    toast.success("Status updated");
  };

  const handleGenerate = async () => {
    if (!id) return;
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("generate-grant-draft", {
      body: { application_id: id },
    });
    setGenerating(false);
    if (error) { toast.error(error.message || "Generation failed"); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    const draft = (data as any)?.draft ?? "";
    setDraftState(draft);
    setApp((a: AppRow) => a ? { ...a, ai_draft: draft } : a);
    toast.success("Draft generated!");
  };

  const handleSaveDraft = async () => {
    if (!app) return;
    setSavingDraft(true);
    const { error } = await supabase
      .from("grant_applications")
      .update({ ai_draft: draftState, updated_at: new Date().toISOString() })
      .eq("id", app.id);
    setSavingDraft(false);
    if (error) { toast.error(error.message); return; }
    setApp({ ...app, ai_draft: draftState });
    toast.success("Draft saved");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(draftState);
    toast.success("Copied!");
  };

  const handleClearDraft = async () => {
    if (!app) return;
    const { error } = await supabase
      .from("grant_applications")
      .update({ ai_draft: null, updated_at: new Date().toISOString() })
      .eq("id", app.id);
    if (error) { toast.error(error.message); return; }
    setDraftState("");
    setApp({ ...app, ai_draft: null });
    toast.success("Draft cleared");
  };

  const wordCount = useMemo(
    () => (draftState.trim() ? draftState.trim().split(/\s+/).length : 0),
    [draftState]
  );

  const fmtMoney = (n: number | null | undefined) =>
    n == null ? "—" : `$${Number(n).toLocaleString()}`;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !app) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate("/os/grants")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Grants
        </Button>
        <Card><CardContent className="p-12 text-center">
          <h2 className="text-xl font-semibold">Application not found</h2>
        </CardContent></Card>
      </div>
    );
  }

  const draftExists = !!app.ai_draft && app.ai_draft.trim() !== "";
  const statusBase = STATUS_STYLES[app.status] ?? STATUS_STYLES.identified;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* SECTION A — Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/os/grants")} className="mb-3">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Grants
        </Button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{app.grant_name}</h1>
            <p className="text-muted-foreground mt-1">{app.funder_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`px-3 py-1 text-sm border ${statusBase}`}
              style={app.status === "awarded" ? { backgroundColor: GOLD } : undefined}>
              {app.status}
            </Badge>
            <Select value={app.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 mt-5">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Requested</div>
            <div className="text-xl font-bold mt-1">{fmtMoney(app.amount_requested)}</div>
          </CardContent></Card>
          {app.amount_awarded != null && (
            <Card><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Awarded</div>
              <div className="text-xl font-bold mt-1" style={{ color: GOLD }}>
                {fmtMoney(app.amount_awarded)}
              </div>
            </CardContent></Card>
          )}
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Deadline</div>
            <div className="mt-1">{deadlineBadge()}</div>
            {app.deadline && (
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(app.deadline).toLocaleDateString()}
              </div>
            )}
          </CardContent></Card>
        </div>
      </div>

      {/* SECTION B — AI Draft Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" style={{ color: GOLD }} />
            AI Grant Writer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {draftExists
                ? "A draft exists. You can regenerate to replace it."
                : "Generate a professional 5-section grant application draft."}
            </p>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              style={{ backgroundColor: GOLD, color: "#000" }}
              className="hover:opacity-90"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> {draftExists ? "Regenerate Draft" : "Generate Application Draft"}</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SECTION C — Draft Editor */}
      {draftState && (
        <Card>
          <CardHeader><CardTitle>Draft Editor</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={draftState}
              onChange={(e) => setDraftState(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
            />
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleSaveDraft} disabled={savingDraft} style={{ backgroundColor: GOLD, color: "#000" }}>
                  <Save className="h-4 w-4 mr-2" /> {savingDraft ? "Saving..." : "Save Draft"}
                </Button>
                <Button variant="outline" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" /> Copy
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-red-400">
                      <Trash2 className="h-4 w-4 mr-2" /> Clear
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear this draft?</AlertDialogTitle>
                      <AlertDialogDescription>This will remove the saved draft.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearDraft}>Clear</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="text-xs text-muted-foreground ml-auto">{wordCount} words</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
