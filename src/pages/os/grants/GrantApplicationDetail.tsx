import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  ArrowLeft, Sparkles, Copy, Save, Trash2, Loader2, Plus,
  FileText, Image as ImageIcon, File as FileIcon, Download, Upload, Check, X,
} from "lucide-react";

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

  // Section D — Tasks
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");

  // Section E — Documents
  const [docs, setDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Section G — Notes
  const [notesValue, setNotesValue] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTasks = async () => {
    if (!id) return;
    setTasksLoading(true);
    const { data } = await supabase
      .from("grant_tasks")
      .select("*")
      .eq("application_id", id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    setTasks(data ?? []);
    setTasksLoading(false);
  };

  const fetchDocs = async () => {
    if (!id) return;
    setDocsLoading(true);
    const { data } = await supabase
      .from("grant_documents")
      .select("*")
      .eq("application_id", id)
      .order("created_at", { ascending: false });
    setDocs(data ?? []);
    setDocsLoading(false);
  };

  useEffect(() => { fetchTasks(); fetchDocs(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    if (app) setNotesValue(app.notes ?? "");
  }, [app?.id]);

  const toggleTask = async (task: any) => {
    const nextStatus = task.status === "done" ? "pending" : "done";
    const { error } = await supabase
      .from("grant_tasks")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", task.id);
    if (error) { toast.error(error.message); return; }
    fetchTasks();
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from("grant_tasks").delete().eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    setTasks((t) => t.filter((x) => x.id !== taskId));
  };

  const addTask = async () => {
    if (!id || !newTaskTitle.trim()) return;
    const { error } = await supabase.from("grant_tasks").insert({
      application_id: id,
      title: newTaskTitle.trim(),
      description: null,
      due_date: newTaskDue || null,
      status: "pending",
      assigned_to: "David",
    });
    if (error) { toast.error(error.message); return; }
    setNewTaskTitle("");
    setNewTaskDue("");
    fetchTasks();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    const path = `${id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("grant-documents")
      .upload(path, file);
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }
    const { error: insErr } = await supabase.from("grant_documents").insert({
      application_id: id,
      doc_name: file.name,
      doc_type: "supporting",
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: "David",
    });
    setUploading(false);
    if (e.target) e.target.value = "";
    if (insErr) { toast.error(insErr.message); return; }
    toast.success("Document uploaded");
    fetchDocs();
  };

  const downloadDoc = async (doc: any) => {
    const { data, error } = await supabase.storage
      .from("grant-documents")
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data) { toast.error(error?.message || "Download failed"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const deleteDoc = async (doc: any) => {
    await supabase.storage.from("grant-documents").remove([doc.storage_path]);
    const { error } = await supabase.from("grant_documents").delete().eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    setDocs((d) => d.filter((x) => x.id !== doc.id));
    toast.success("Document deleted");
  };

  const handleNotesChange = (v: string) => {
    setNotesValue(v);
    setNotesSaved(false);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(async () => {
      if (!id) return;
      setNotesSaving(true);
      const { error } = await supabase
        .from("grant_applications")
        .update({ notes: v, updated_at: new Date().toISOString() })
        .eq("id", id);
      setNotesSaving(false);
      if (!error) {
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      }
    }, 2000);
  };

  const fmtSize = (b: number | null | undefined) => {
    if (!b) return "—";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  };

  const docIcon = (mime: string | null) => {
    if (!mime) return <FileIcon className="h-5 w-5 text-gray-400" />;
    if (mime.includes("pdf")) return <FileText className="h-5 w-5 text-red-400" />;
    if (mime.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-blue-400" />;
    return <FileIcon className="h-5 w-5 text-gray-400" />;
  };

  const TIMELINE_STEPS = ["identified", "drafting", "submitted", "under_review", "approved", "awarded"];
  const currentIndex = TIMELINE_STEPS.indexOf(app?.status ?? "");
  const isDenied = app?.status === "denied";

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

      {/* SECTION F — Timeline */}
      <Card>
        <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {TIMELINE_STEPS.map((step, i) => {
              const done = !isDenied && i < currentIndex;
              const current = !isDenied && i === currentIndex;
              const isLast = i === TIMELINE_STEPS.length - 1;
              return (
                <div key={step} className="flex items-center flex-1 min-w-[80px]">
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center border-2 ${
                        done ? "bg-emerald-500 border-emerald-500 text-white" :
                        current ? "text-black animate-pulse" :
                        "bg-transparent border-muted text-muted-foreground"
                      }`}
                      style={current ? { backgroundColor: GOLD, borderColor: GOLD } : undefined}
                    >
                      {done ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                    </div>
                    <div
                      className={`text-[10px] text-center capitalize ${
                        current ? "font-bold" :
                        done ? "text-muted-foreground" : "text-muted-foreground/60"
                      }`}
                      style={current ? { color: GOLD } : undefined}
                    >
                      {step.replace(/_/g, " ")}
                    </div>
                  </div>
                  {!isLast && (
                    <div className={`h-0.5 flex-1 -mt-6 ${done ? "bg-emerald-500" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
          {isDenied && (
            <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
              <X className="h-4 w-4" /> Denied
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION D — Tasks */}
      <Card>
        <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {tasksLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No tasks yet. Add tasks to track your progress.
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => {
                const overdue = t.due_date && t.status !== "done" &&
                  new Date(t.due_date).getTime() < Date.now();
                return (
                  <div key={t.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    <Checkbox
                      checked={t.status === "done"}
                      onCheckedChange={() => toggleTask(t)}
                      className={t.status === "done" ? "border-emerald-500 data-[state=checked]:bg-emerald-500" : ""}
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                        {t.title}
                      </div>
                      {t.due_date && (
                        <div className={`text-xs mt-0.5 ${overdue ? "text-red-400" : "text-muted-foreground"}`}>
                          Due {new Date(t.due_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteTask(t.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-2 pt-2 flex-wrap">
            <Input
              placeholder="Add a task..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              className="flex-1 min-w-[180px]"
            />
            <Input
              type="date"
              value={newTaskDue}
              onChange={(e) => setNewTaskDue(e.target.value)}
              className="w-40"
            />
            <Button
              onClick={addTask}
              disabled={!newTaskTitle.trim()}
              style={{ backgroundColor: GOLD, color: "#000" }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SECTION E — Documents */}
      <Card>
        <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            hidden
            ref={fileInputRef}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={handleUpload}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition"
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <Upload className="h-6 w-6" />
                <span>Click to upload a document</span>
                <span className="text-xs">PDF, DOC, DOCX, JPG, PNG</span>
              </div>
            )}
          </div>

          {docsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No documents uploaded yet.
            </p>
          ) : (
            <div className="grid gap-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                  {docIcon(d.mime_type)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{d.doc_name}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{d.doc_type}</Badge>
                      <span className="text-xs text-muted-foreground">{fmtSize(d.size_bytes)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => downloadDoc(d)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteDoc(d)}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION G — Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Notes</span>
            <span className="text-xs font-normal">
              {notesSaving ? (
                <span className="text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                </span>
              ) : notesSaved ? (
                <span className="text-emerald-400">Saved ✓</span>
              ) : null}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notesValue}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Add notes about this application..."
            className="min-h-[150px]"
          />
        </CardContent>
      </Card>
    </div>
  );
}
