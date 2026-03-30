import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone, MessageSquare, CheckCircle, XCircle, Clock, Send,
  BarChart3, FileText, Loader2, User, Building2, Headset, Brain
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Lead {
  id: string;
  business_name: string;
  phone: string;
  email?: string;
  status: string;
  intent_score?: number;
  region?: string;
  language?: string;
  created_at: string;
}

interface CallNote {
  id: string;
  summary: string;
  objection?: string;
  next_step?: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-500/20 text-blue-400" },
  contacted: { label: "Contacted", color: "bg-yellow-500/20 text-yellow-400" },
  interested: { label: "Interested", color: "bg-emerald-500/20 text-emerald-400" },
  not_interested: { label: "Not Interested", color: "bg-red-500/20 text-red-400" },
  callback: { label: "Call Back", color: "bg-orange-500/20 text-orange-400" },
  form_sent: { label: "Form Sent", color: "bg-cyan-500/20 text-cyan-400" },
  form_completed: { label: "Form Completed", color: "bg-purple-500/20 text-purple-400" },
  closed: { label: "Closed", color: "bg-green-500/20 text-green-400" },
};

export default function EnglishVADashboard() {
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [coachingOpen, setCoachingOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({ summary: "", objection: "", next_step: "" });
  const [coaching, setCoaching] = useState<string | null>(null);
  const [loadingCoaching, setLoadingCoaching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["va-en-assigned-leads", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const { data, error } = await (supabase as any)
        .from("brandaro_leads_master")
        .select("*")
        .eq("assigned_va_id", currentUser.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Lead[];
    },
    enabled: !!currentUser?.id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["va-en-call-notes", selectedLead?.id],
    queryFn: async () => {
      if (!selectedLead?.id) return [];
      const { data } = await (supabase as any)
        .from("brandaro_va_call_notes")
        .select("*")
        .eq("lead_id", selectedLead.id)
        .order("created_at", { ascending: false });
      return (data || []) as CallNote[];
    },
    enabled: !!selectedLead?.id,
  });

  const stats = {
    total: leads.length,
    interested: leads.filter((l) => l.status === "interested").length,
    forms: leads.filter((l) => ["form_sent", "form_completed"].includes(l.status)).length,
    closed: leads.filter((l) => l.status === "closed").length,
  };

  const filteredLeads = statusFilter === "all" ? leads : leads.filter((l) => l.status === statusFilter);

  const updateStatus = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("brandaro_leads_master")
        .update({ status })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["va-en-assigned-leads"] });
      toast.success(`Status updated: ${STATUS_MAP[status]?.label || status}`);
    },
    onError: () => toast.error("Failed to update status"),
  });

  const saveNote = useMutation({
    mutationFn: async () => {
      if (!selectedLead || !currentUser) return;
      const { error } = await (supabase as any)
        .from("brandaro_va_call_notes")
        .insert({
          lead_id: selectedLead.id,
          va_id: currentUser.id,
          summary: noteForm.summary,
          objection: noteForm.objection || null,
          next_step: noteForm.next_step || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["va-en-call-notes"] });
      setNoteForm({ summary: "", objection: "", next_step: "" });
      setNoteOpen(false);
      toast.success("Note saved ✅");
    },
    onError: () => toast.error("Failed to save note"),
  });

  const requestCoaching = async () => {
    if (!selectedLead) return;
    setLoadingCoaching(true);
    setCoachingOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("brandaro-va-coaching", {
        body: {
          lead_id: selectedLead.id,
          notes: notes.map((n) => n.summary).join("\n"),
          language: "english",
        },
      });
      if (error) throw error;
      setCoaching(data?.coaching || "No recommendations available.");
    } catch {
      setCoaching("Error fetching coaching. Please try again.");
    } finally {
      setLoadingCoaching(false);
    }
  };

  const statCards = [
    { label: "Total Leads", value: stats.total, icon: Building2, accent: "text-primary" },
    { label: "Interested", value: stats.interested, icon: CheckCircle, accent: "text-emerald-400" },
    { label: "Forms Sent", value: stats.forms, icon: FileText, accent: "text-cyan-400" },
    { label: "Closed Deals", value: stats.closed, icon: BarChart3, accent: "text-amber-400" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Headset className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">VA Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your sales workspace — leads, calls & results</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.accent}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="leads">📋 My Leads</TabsTrigger>
          <TabsTrigger value="performance">📊 Performance</TabsTrigger>
        </TabsList>

        {/* Leads Tab */}
        <TabsContent value="leads" className="space-y-3">
          {/* Status Filter */}
          <div className="flex flex-wrap gap-2">
            {["all", "new", "contacted", "interested", "callback", "form_sent", "closed"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                className="text-xs"
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "All" : STATUS_MAP[s]?.label || s}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No leads assigned yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Your admin will assign leads to you soon.</p>
              </CardContent>
            </Card>
          ) : (
            filteredLeads.map((lead) => (
              <Card
                key={lead.id}
                className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50 ${
                  selectedLead?.id === lead.id ? "ring-1 ring-primary" : ""
                }`}
                onClick={() => setSelectedLead(lead)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{lead.business_name || "Unnamed"}</h3>
                      <p className="text-sm text-muted-foreground">{lead.phone}</p>
                      <div className="flex gap-2 mt-1">
                        {lead.region && <span className="text-xs text-muted-foreground">📍 {lead.region}</span>}
                        {lead.intent_score && (
                          <span className="text-xs text-amber-400">🔥 {lead.intent_score}%</span>
                        )}
                      </div>
                    </div>
                    <Badge className={STATUS_MAP[lead.status]?.color || "bg-muted text-muted-foreground"}>
                      {STATUS_MAP[lead.status]?.label || lead.status}
                    </Badge>
                  </div>

                  {selectedLead?.id === lead.id && (
                    <div className="mt-3 pt-3 border-t border-border space-y-3">
                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`tel:${lead.phone}`);
                            updateStatus.mutate({ leadId: lead.id, status: "contacted" });
                          }}
                        >
                          <Phone className="h-3 w-3 mr-1" /> Call
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs bg-emerald-600 hover:bg-emerald-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatus.mutate({ leadId: lead.id, status: "interested" });
                          }}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Interested
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatus.mutate({ leadId: lead.id, status: "not_interested" });
                          }}
                        >
                          <XCircle className="h-3 w-3 mr-1" /> Not Interested
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatus.mutate({ leadId: lead.id, status: "callback" });
                          }}
                        >
                          <Clock className="h-3 w-3 mr-1" /> Call Back
                        </Button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatus.mutate({ leadId: lead.id, status: "form_sent" });
                          }}
                        >
                          <Send className="h-3 w-3 mr-1" /> Send Form
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNoteOpen(true);
                          }}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" /> Add Note
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs border-primary/30 text-primary hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            requestCoaching();
                          }}
                        >
                          <Brain className="h-3 w-3 mr-1" /> AI Assist
                        </Button>
                      </div>

                      {/* Recent Notes */}
                      {notes.length > 0 && (
                        <div className="space-y-2 mt-2">
                          <p className="text-xs font-medium text-muted-foreground">Recent Notes:</p>
                          {notes.slice(0, 3).map((n) => (
                            <div key={n.id} className="text-xs bg-muted/50 rounded p-2">
                              <p className="text-foreground">{n.summary}</p>
                              {n.objection && <p className="text-orange-400 mt-1">⚠️ {n.objection}</p>}
                              {n.next_step && <p className="text-primary mt-1">→ {n.next_step}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Your Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Calls Made", value: stats.total, max: 50, color: "bg-primary" },
                { label: "Interested", value: stats.interested, max: 20, color: "bg-emerald-500" },
                { label: "Forms Sent", value: stats.forms, max: 15, color: "bg-cyan-500" },
                { label: "Deals Closed", value: stats.closed, max: 10, color: "bg-amber-500" },
              ].map((bar) => (
                <div key={bar.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{bar.label}</span>
                    <span className="font-bold text-foreground">{bar.value}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${bar.color} rounded-full transition-all`}
                      style={{ width: `${Math.min((bar.value / bar.max) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Note Dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>📝 Add Call Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Conversation Summary *</label>
              <Textarea
                placeholder="What happened on the call?"
                value={noteForm.summary}
                onChange={(e) => setNoteForm({ ...noteForm, summary: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Objection (if any)</label>
              <Input
                placeholder="e.g. No budget, not interested..."
                value={noteForm.objection}
                onChange={(e) => setNoteForm({ ...noteForm, objection: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Next Step</label>
              <Input
                placeholder="e.g. Call Monday, send more info..."
                value={noteForm.next_step}
                onChange={(e) => setNoteForm({ ...noteForm, next_step: e.target.value })}
              />
            </div>
            <Button
              className="w-full"
              disabled={!noteForm.summary || saveNote.isPending}
              onClick={() => saveNote.mutate()}
            >
              {saveNote.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Note
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Coaching Dialog */}
      <Dialog open={coachingOpen} onOpenChange={setCoachingOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>🤖 AI Sales Coach — Recommendations</DialogTitle>
          </DialogHeader>
          {loadingCoaching ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Analyzing your notes...</p>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">
              {coaching}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
