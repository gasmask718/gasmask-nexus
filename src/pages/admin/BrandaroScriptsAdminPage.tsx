import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { History, Pencil, Plus, BookOpen, MessageSquare, HelpCircle, Phone, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { VersionHistoryModal } from "@/components/admin/scripts/VersionHistoryModal";

/* ─────────────────────────────────────────────────────────────
 * Generic editor table — works for any of the 4 surfaces below.
 * Saves issue a plain UPDATE; the snapshot trigger handles versioning.
 * ──────────────────────────────────────────────────────────── */

interface EditorConfig {
  table: string;
  queryKey: string;
  naturalKeyColumn: string;
  isCurrentColumn?: string;
  versionColumn?: string;
  orderBy: { column: string; ascending: boolean };
  /** Columns shown in the list row (compact). */
  listColumns: { key: string; label: string; primary?: boolean; mono?: boolean }[];
  /** Editable form fields. */
  formFields: {
    key: string;
    label: string;
    type: "text" | "textarea" | "number" | "boolean";
    required?: boolean;
  }[];
  /** Columns to show in the version history modal body. */
  historyDisplayColumns: string[];
  /** Default object for "New" rows. */
  emptyRow: Record<string, any>;
}

function GenericVersionedEditor({ config }: { config: EditorConfig }) {
  const qc = useQueryClient();
  const isCurrentCol = config.isCurrentColumn ?? "is_current";
  const versionCol = config.versionColumn ?? "version";

  const { data: rows, isLoading } = useQuery({
    queryKey: [config.queryKey],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(config.table)
        .select("*")
        .eq(isCurrentCol, true)
        .order(config.orderBy.column, { ascending: config.orderBy.ascending });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<any | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (row: any) => {
      if (row.id) {
        const { id, ...patch } = row;
        // strip version-tracking fields the trigger manages
        const skip = ["created_at", "updated_at", "version", "script_version",
          "is_current", "parent_version_id", "superseded_at", "superseded_by", "created_by"];
        skip.forEach((k) => delete patch[k]);
        const { error } = await (supabase as any).from(config.table).update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const insertRow = { ...row, created_by: user?.id ?? null };
        delete insertRow.id;
        const { error } = await (supabase as any).from(config.table).insert(insertRow);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing?.id ? "Saved — new version created." : "Created.");
      qc.invalidateQueries({ queryKey: [config.queryKey] });
      setEditing(null);
      setCreating(false);
    },
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing({ ...config.emptyRow }); setCreating(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
      </div>

      <div className="border rounded-md divide-y">
        {(rows ?? []).map((row) => (
          <div key={row.id} className="flex items-start gap-3 p-3 hover:bg-muted/30">
            <div className="flex-1 min-w-0 space-y-1">
              {config.listColumns.map((c) => {
                const val = row[c.key];
                if (val == null || val === "") return null;
                return (
                  <div key={c.key} className={c.primary ? "font-medium" : "text-sm text-muted-foreground"}>
                    {!c.primary && <span className="text-xs uppercase tracking-wider mr-2">{c.label}:</span>}
                    <span className={c.mono ? "font-mono text-xs" : ""}>
                      {typeof val === "boolean" ? (val ? "yes" : "no") : String(val)}
                    </span>
                  </div>
                );
              })}
              <Badge variant="outline" className="text-[10px]">v{row[versionCol]}</Badge>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => { setEditing({ ...row }); setCreating(false); }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setHistoryTarget(row)}>
                <History className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {(rows ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground p-6 text-center">No entries yet. Click "New" to create one.</p>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editing != null} onOpenChange={(o) => !o && (setEditing(null), setCreating(false))}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{creating ? "New entry" : `Edit ${editing?.[config.naturalKeyColumn] ?? ""}`}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              {config.formFields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label htmlFor={f.key}>{f.label}{f.required && " *"}</Label>
                  {f.type === "textarea" ? (
                    <Textarea
                      id={f.key}
                      rows={3}
                      value={editing[f.key] ?? ""}
                      onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                    />
                  ) : f.type === "boolean" ? (
                    <select
                      id={f.key}
                      value={String(!!editing[f.key])}
                      onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value === "true" })}
                      className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  ) : (
                    <Input
                      id={f.key}
                      type={f.type}
                      value={editing[f.key] ?? ""}
                      onChange={(e) => setEditing({
                        ...editing,
                        [f.key]: f.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value,
                      })}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate(editing)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History modal */}
      <VersionHistoryModal
        open={historyTarget != null}
        onOpenChange={(o) => !o && setHistoryTarget(null)}
        table={config.table}
        naturalKeyColumn={config.naturalKeyColumn}
        naturalKeyValue={historyTarget?.[config.naturalKeyColumn] ?? null}
        isCurrentColumn={isCurrentCol}
        versionColumn={versionCol}
        displayColumns={config.historyDisplayColumns}
        rowId={historyTarget?.id ?? ""}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Surface configs
 * ──────────────────────────────────────────────────────────── */

const SCRIPT_STEPS_CONFIG: EditorConfig = {
  table: "brandaro_sales_script_steps",
  queryKey: "admin-script-steps",
  naturalKeyColumn: "step_key",
  orderBy: { column: "step_number", ascending: true },
  listColumns: [
    { key: "step_number", label: "#", mono: true },
    { key: "display_label", label: "Label", primary: true },
    { key: "step_key", label: "Key", mono: true },
  ],
  formFields: [
    { key: "step_number", label: "Step number", type: "number", required: true },
    { key: "step_key", label: "Step key", type: "text", required: true },
    { key: "step_name", label: "Step name", type: "text", required: true },
    { key: "display_label", label: "Display label", type: "text", required: true },
    { key: "va_says", label: "What the VA says", type: "textarea", required: true },
    { key: "coaching_tip", label: "Coaching tip", type: "textarea" },
    { key: "wait_for_response", label: "Wait for response?", type: "boolean" },
    { key: "tag_lead_as", label: "Tag lead as (optional)", type: "text" },
    { key: "industry_type", label: "Industry filter (optional)", type: "text" },
    { key: "is_active", label: "Active", type: "boolean" },
  ],
  historyDisplayColumns: ["display_label", "va_says", "coaching_tip", "step_number"],
  emptyRow: { step_number: 0, step_key: "", step_name: "", display_label: "", va_says: "", wait_for_response: false, is_active: true },
};

const REBUTTALS_CONFIG: EditorConfig = {
  table: "brandaro_closer_rebuttals",
  queryKey: "admin-rebuttals",
  naturalKeyColumn: "objection_key",
  orderBy: { column: "objection_key", ascending: true },
  listColumns: [
    { key: "label", label: "Label", primary: true },
    { key: "objection_key", label: "Key", mono: true },
  ],
  formFields: [
    { key: "objection_key", label: "Objection key", type: "text", required: true },
    { key: "label", label: "Display label", type: "text", required: true },
    { key: "human_response", label: "Recommended human response", type: "textarea" },
    { key: "ai_response", label: "AI response", type: "textarea" },
    { key: "soft_rebuttal", label: "Soft rebuttal", type: "textarea" },
    { key: "aggressive_rebuttal", label: "Aggressive rebuttal", type: "textarea" },
    { key: "premium_rebuttal", label: "Premium rebuttal", type: "textarea" },
    { key: "downgrade_path", label: "Downgrade path", type: "textarea" },
    { key: "upsell_path", label: "Upsell path", type: "textarea" },
  ],
  historyDisplayColumns: ["label", "human_response", "soft_rebuttal", "aggressive_rebuttal"],
  emptyRow: { objection_key: "", label: "" },
};

const FAQ_CONFIG: EditorConfig = {
  table: "script_faqs",
  queryKey: "admin-script-faqs",
  naturalKeyColumn: "question",
  orderBy: { column: "display_order", ascending: true },
  listColumns: [
    { key: "question", label: "Question", primary: true },
    { key: "category", label: "Category" },
  ],
  formFields: [
    { key: "question", label: "Question", type: "text", required: true },
    { key: "answer", label: "Answer", type: "textarea", required: true },
    { key: "category", label: "Category", type: "text" },
    { key: "display_order", label: "Display order", type: "number" },
  ],
  historyDisplayColumns: ["question", "answer", "category"],
  emptyRow: { question: "", answer: "", display_order: 0 },
};

const DISPOSITION_CONFIG: EditorConfig = {
  table: "dialer_disposition_codes",
  queryKey: "admin-disposition-codes",
  naturalKeyColumn: "code",
  orderBy: { column: "category", ascending: true },
  listColumns: [
    { key: "label", label: "Label", primary: true },
    { key: "code", label: "Code", mono: true },
    { key: "category", label: "Category" },
  ],
  formFields: [
    { key: "code", label: "Code", type: "text", required: true },
    { key: "label", label: "Display label", type: "text", required: true },
    { key: "category", label: "Category", type: "text", required: true },
    { key: "requires_followup", label: "Requires follow-up?", type: "boolean" },
    { key: "followup_delay_minutes", label: "Follow-up delay (minutes)", type: "number" },
    { key: "marks_do_not_call", label: "Marks DNC?", type: "boolean" },
    { key: "creates_invoice_draft", label: "Creates invoice draft?", type: "boolean" },
    { key: "updates_store_stage", label: "Updates store stage to (optional)", type: "text" },
  ],
  historyDisplayColumns: ["label", "code", "category", "requires_followup", "marks_do_not_call"],
  emptyRow: { code: "", label: "", category: "neutral" },
};

const VOICE_AGENT_CONFIG: EditorConfig = {
  table: "brandaro_voice_agent_scripts",
  queryKey: "admin-voice-agent-scripts",
  naturalKeyColumn: "script_name",
  isCurrentColumn: "is_active",
  versionColumn: "script_version",
  orderBy: { column: "script_name", ascending: true },
  listColumns: [
    { key: "script_name", label: "Script name", primary: true },
  ],
  formFields: [
    { key: "script_name", label: "Script name", type: "text", required: true },
    { key: "value_positioning", label: "Value positioning", type: "textarea" },
    { key: "demo_offer", label: "Demo offer", type: "textarea" },
    { key: "soft_close", label: "Soft close", type: "textarea" },
    { key: "hard_close", label: "Hard close", type: "textarea" },
    { key: "failsafe", label: "Failsafe", type: "textarea" },
  ],
  historyDisplayColumns: ["script_name", "value_positioning", "demo_offer", "soft_close", "hard_close"],
  emptyRow: { script_name: "", is_active: true, call_structure: [], opening_lines: [], qualification_questions: [], behavior_rules: [] },
};

const PLAYBOOKS_CONFIG: EditorConfig = {
  table: "brandaro_closer_playbooks",
  queryKey: "admin-closer-playbooks",
  naturalKeyColumn: "playbook_key",
  orderBy: { column: "playbook_key", ascending: true },
  listColumns: [
    { key: "label", label: "Label", primary: true },
    { key: "playbook_key", label: "Key", mono: true },
  ],
  formFields: [
    { key: "playbook_key", label: "Playbook key", type: "text", required: true },
    { key: "label", label: "Display label", type: "text", required: true },
    { key: "opening_line", label: "Opening line", type: "textarea" },
    { key: "emotional_frame", label: "Emotional frame", type: "textarea" },
    { key: "value_positioning", label: "Value positioning", type: "textarea" },
    { key: "urgency_line", label: "Urgency line", type: "textarea" },
    { key: "cta", label: "Call to action", type: "textarea" },
    { key: "handoff_condition", label: "Handoff condition", type: "textarea" },
    { key: "stop_condition", label: "Stop condition", type: "textarea" },
    { key: "is_active", label: "Active", type: "boolean" },
  ],
  historyDisplayColumns: ["label", "opening_line", "value_positioning", "cta"],
  emptyRow: { playbook_key: "", label: "", is_active: true },
};

/* ─────────────────────────────────────────────────────────────
 * Page shell
 * ──────────────────────────────────────────────────────────── */

export default function BrandaroScriptsAdminPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scripts, Rebuttals, FAQs & Dispositions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Edit any surface — saves automatically create a new version. Click the history icon on any row to view past versions and restore.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <Tabs defaultValue="scripts">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="scripts"><BookOpen className="h-4 w-4 mr-1" />Script steps</TabsTrigger>
              <TabsTrigger value="rebuttals"><MessageSquare className="h-4 w-4 mr-1" />Rebuttals</TabsTrigger>
              <TabsTrigger value="faqs"><HelpCircle className="h-4 w-4 mr-1" />FAQs</TabsTrigger>
              <TabsTrigger value="dispositions"><Phone className="h-4 w-4 mr-1" />Dispositions</TabsTrigger>
              <TabsTrigger value="voice-agent">Voice agent</TabsTrigger>
              <TabsTrigger value="playbooks"><Megaphone className="h-4 w-4 mr-1" />Playbooks</TabsTrigger>
            </TabsList>
            <TabsContent value="scripts" className="mt-4"><GenericVersionedEditor config={SCRIPT_STEPS_CONFIG} /></TabsContent>
            <TabsContent value="rebuttals" className="mt-4"><GenericVersionedEditor config={REBUTTALS_CONFIG} /></TabsContent>
            <TabsContent value="faqs" className="mt-4"><GenericVersionedEditor config={FAQ_CONFIG} /></TabsContent>
            <TabsContent value="dispositions" className="mt-4"><GenericVersionedEditor config={DISPOSITION_CONFIG} /></TabsContent>
            <TabsContent value="voice-agent" className="mt-4"><GenericVersionedEditor config={VOICE_AGENT_CONFIG} /></TabsContent>
            <TabsContent value="playbooks" className="mt-4"><GenericVersionedEditor config={PLAYBOOKS_CONFIG} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
