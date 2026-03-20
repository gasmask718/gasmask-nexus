import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Kanban, Phone, MapPin, Star, Filter, MessageSquare, X,
  StickyNote, TrendingUp, Users, DollarSign, Target, Zap, RefreshCw,
  Search, Rocket, Inbox, ChevronDown,
} from "lucide-react";
import {
  useBrandaroPipeline,
  PIPELINE_STAGES,
  PipelineLead,
} from "@/hooks/useBrandaroPipeline";
import { usePipelineInsights } from "@/hooks/usePipelineInsights";

import { BrandaroLeadCard } from "@/components/brandaro/BrandaroLeadCard";
import { BuildDemoModal } from "@/components/brandaro/BuildDemoModal";
import { HotLeadsPanels } from "@/components/brandaro/HotLeadsPanels";
import { LeadStageProgressBar } from "@/components/brandaro/LeadStageProgressBar";
import { AITakeoverToggle } from "@/components/brandaro/AITakeoverToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ConversationThread } from "@/components/brandaro/ConversationThread";
import { IntentLog } from "@/components/brandaro/IntentLog";

// ── Column header colors ──
const COLUMN_HEADER_COLORS: Record<string, string> = {
  new: "bg-muted/60",
  contacted: "bg-amber-500/10",
  responded: "bg-blue-500/10",
  interested: "bg-purple-500/10",
  booked: "bg-teal-500/10",
  closed: "bg-green-600/10",
  lost: "bg-red-500/10",
};

// ── Lead Profile Dialog ──
function LeadProfileDialog({
  lead, open, onClose, onMove, onSaveNotes,
}: {
  lead: PipelineLead | null;
  open: boolean;
  onClose: () => void;
  onMove: (id: string, stage: string) => void;
  onSaveNotes: (id: string, notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [localAiPaused, setLocalAiPaused] = useState(false);

  if (!lead) return null;

  const aiPaused = localAiPaused || (lead as any).ai_paused || false;

  const handleStageChange = async (stage: string, eventType: string) => {
    try {
      await supabase.functions.invoke("brandaro-pipeline-automator", {
        body: { action: "record_event", lead_id: lead.id, event_type: eventType },
      });
      onMove(lead.id, stage);
      toast.success(`Moved to ${stage}`);
    } catch {
      toast.error("Failed to change stage");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {lead.business_name || "Unknown Lead"}
            <Badge variant="outline">{lead.pipeline_stage}</Badge>
          </DialogTitle>
        </DialogHeader>
        <LeadStageProgressBar
          currentStage={lead.pipeline_stage}
          businessName={lead.business_name || "Lead"}
          updatedAt={lead.updated_at}
          onStageChange={handleStageChange}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {lead.phone_number && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href={`tel:${lead.phone_number}`} className="hover:underline">{lead.phone_number}</a>
                </div>
              )}
              {lead.city && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {lead.city}{(lead as any).state ? `, ${(lead as any).state}` : ""}
                </div>
              )}
              {lead.industry && <p><strong>Industry:</strong> {lead.industry}</p>}
              {lead.rating != null && (
                <p className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-amber-400" />
                  {lead.rating} ({lead.review_count} reviews)
                </p>
              )}
              <p><strong>Priority:</strong> {lead.priority_score}pt ({lead.priority_tier})</p>
              <p><strong>Engagement:</strong> {lead.engagement_score}</p>
              <p><strong>Call attempts:</strong> {lead.call_attempts}</p>
              {lead.last_call_at && (
                <p><strong>Last call:</strong> {new Date(lead.last_call_at).toLocaleString()}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">📅 Booking Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button size="sm" className="w-full justify-start" onClick={async () => {
                if (!lead.phone_number) { toast.error("No phone number"); return; }
                try {
                  await supabase.functions.invoke("send-sms", {
                    body: {
                      to_number: lead.phone_number,
                      message_body: `Hi ${lead.business_name || "there"}, here's my booking link to schedule your website review call: https://calendly.com/brandarodigital-sales/website-strategy-call`,
                      idempotency_key: `book-profile-${lead.id}-${Date.now()}`,
                    },
                  });
                  toast.success("Booking link sent");
                } catch { toast.error("Failed to send"); }
              }}>📅 Send Booking Link</Button>
              {(lead.pipeline_stage === "interested" || ((lead as any).service_interest || "").includes("funding")) && (
                <Button size="sm" variant="outline" className="w-full justify-start" onClick={async () => {
                  if (!lead.phone_number) { toast.error("No phone number"); return; }
                  try {
                    await supabase.functions.invoke("send-sms", {
                      body: {
                        to_number: lead.phone_number,
                        message_body: `Hi ${lead.business_name || "there"}, here's the link to book your free funding consultation: https://calendly.com/brandarodigital-sales/funding-consultation`,
                        idempotency_key: `fund-${lead.id}-${Date.now()}`,
                      },
                    });
                    toast.success("Funding link sent");
                  } catch { toast.error("Failed to send"); }
                }}>💰 Send Funding Call Link</Button>
              )}
            </CardContent>
          </Card>
          <div className="space-y-3">
            <AITakeoverToggle
              leadId={lead.id}
              businessName={lead.business_name || "Lead"}
              phoneNumber={lead.phone_number}
              aiPaused={aiPaused}
              onToggle={setLocalAiPaused}
            />
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline Stage</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {PIPELINE_STAGES.map((s) => (
                  <Button key={s.key} variant={lead.pipeline_stage === s.key ? "default" : "outline"} size="sm" className="w-full justify-start" onClick={() => onMove(lead.id, s.key)}>
                    <span className={`w-2 h-2 rounded-full ${s.color} mr-2`} />{s.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <StickyNote className="h-4 w-4" /> Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingNotes ? (
              <div className="space-y-2">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes..." rows={4} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { onSaveNotes(lead.id, notes); setEditingNotes(false); }}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground min-h-[60px] cursor-pointer hover:bg-muted/50 rounded p-2"
                onClick={() => { setNotes(lead.call_notes || ""); setEditingNotes(true); }}>
                {lead.call_notes || "Click to add notes..."}
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──
export default function CRMPipelinePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [cityFilter, setCityFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("any");
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [noDemoOnly, setNoDemoOnly] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [demoLead, setDemoLead] = useState<PipelineLead | null>(null);
  const [stageFilter, setStageFilter] = useState<string[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mobileStage, setMobileStage] = useState("new");

  // Force refresh on mount
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["brandaro-pipeline"] });
    queryClient.invalidateQueries({ queryKey: ["brandaro-hot-leads"] });
  }, [queryClient]);

  // Realtime
  useEffect(() => {
    const channel = supabase.channel("pipeline-leads-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "brandaro_qualified_leads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["brandaro-pipeline"] });
        queryClient.invalidateQueries({ queryKey: ["brandaro-total-count"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Total count
  const { data: totalCount } = useQuery({
    queryKey: ["brandaro-total-count"],
    queryFn: async () => {
      const { count } = await (supabase as any).from("brandaro_qualified_leads").select("*", { count: "exact", head: true });
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const { columns, stats, cities, industries, isLoading, moveLead, updateNotes } =
    useBrandaroPipeline({ city: cityFilter || undefined, industry: industryFilter || undefined });

  const { autoMove } = usePipelineInsights();

  // Apply client-side filters
  const filteredColumns = useMemo(() => {
    let cols = stageFilter ? columns.filter((c) => stageFilter.includes(c.key)) : columns;
    return cols.map((col) => ({
      ...col,
      leads: col.leads.filter((l: PipelineLead) => {
        if (searchQuery && !(l.business_name || "").toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (priorityFilter === "high" && l.priority_score < 7) return false;
        if (priorityFilter === "medium" && (l.priority_score < 4 || l.priority_score >= 7)) return false;
        if (priorityFilter === "low" && l.priority_score >= 4) return false;
        if (hasPhoneOnly && !l.phone_number) return false;
        if (noDemoOnly && (l as any).demo_url) return false;
        return true;
      }),
    }));
  }, [columns, stageFilter, searchQuery, priorityFilter, hasPhoneOnly, noDemoOnly]);

  const handleMove = (id: string, stage: string) => {
    moveLead.mutate({ leadId: id, stage });
    if (selectedLead?.id === id) setSelectedLead({ ...selectedLead, pipeline_stage: stage });
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const handleSelectAll = (columnKey: string) => {
    const col = filteredColumns.find((c) => c.key === columnKey);
    if (!col) return;
    const allSelected = col.leads.every((l: PipelineLead) => selectedIds.has(l.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      col.leads.forEach((l: PipelineLead) => allSelected ? next.delete(l.id) : next.add(l.id));
      return next;
    });
  };

  const syncPipeline = async () => {
    setSyncing(true);
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brandaro-fix-imports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({}),
      });
      await queryClient.invalidateQueries();
      toast.success("Pipeline synced");
    } catch (err: any) {
      toast.error(err?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // Quick stats for command bar
  const readyToContact = columns.find((c) => c.key === "new")?.leads.filter((l: PipelineLead) => l.phone_number && !(l as any).ai_paused).length || 0;
  const awaitingReply = columns.find((c) => c.key === "contacted")?.leads.length || 0;
  const hotNow = (columns.find((c) => c.key === "interested")?.leads.length || 0) + (columns.find((c) => c.key === "booked")?.leads.length || 0);
  const isEmpty = columns.every((c) => c.leads.length === 0);

  const hasFilters = !!(searchQuery || cityFilter || industryFilter || stageFilter || priorityFilter !== "any" || hasPhoneOnly || noDemoOnly);

  const [showPanels, setShowPanels] = useState(false);

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Fixed header section */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Kanban className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Sales Pipeline</h1>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={syncPipeline} disabled={syncing}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "⚡ Sync"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => autoMove.mutate()} disabled={autoMove.isPending}>
              <Zap className="h-3.5 w-3.5 mr-1" />
              {autoMove.isPending ? "Running…" : "Auto-Move"}
            </Button>
          </div>
        </div>

        {/* Collapsible Intelligence Panels */}
        <button
          onClick={() => setShowPanels(!showPanels)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${showPanels ? 'rotate-180' : ''}`} />
          {showPanels ? 'Hide' : 'Show'} Intelligence Panels
        </button>
        {showPanels && (
          <HotLeadsPanels onFilterStage={(stages) => setStageFilter((prev) => prev && prev.join() === stages.join() ? null : stages)} />
        )}

        {/* KPI Bar - compact */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Card className="p-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> Total</div>
            <p className="text-xl font-semibold">{totalCount ?? stats.total}</p>
          </Card>
          <Card className="p-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5" /> Interested</div>
            <p className="text-xl font-semibold text-emerald-500">{(stats.byStage["interested"] || 0) + (stats.byStage["booked"] || 0)}</p>
          </Card>
          <Card className="p-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><DollarSign className="h-3.5 w-3.5" /> Closed</div>
            <p className="text-xl font-semibold text-green-600">{stats.byStage["closed"] || 0}</p>
          </Card>
          <Card className="p-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Close Rate</div>
            <p className="text-xl font-semibold">{stats.conversionRate}%</p>
          </Card>
        </div>

        {/* Execution Command Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/5 border border-primary/20 flex-wrap">
            <span className="text-xs font-medium">{selectedIds.size} selected</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
              toast.info(`Queueing SMS for ${selectedIds.size} leads…`);
              for (const id of selectedIds) {
                const l = columns.flatMap((c) => c.leads).find((x: PipelineLead) => x.id === id);
                if (l?.phone_number) {
                  await supabase.functions.invoke("sms-writer", { body: { lead_id: l.id, business_name: l.business_name, city: l.city, industry: l.industry } });
                }
              }
              toast.success("SMS batch queued");
            }}>
              <MessageSquare className="h-3 w-3 mr-1" /> SMS All
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
              toast.info(`Initiating AI calls for ${selectedIds.size} leads…`);
              for (const id of selectedIds) {
                await supabase.functions.invoke("brandaro-ai-caller", { body: { lead_id: id } });
              }
              toast.success("AI calls initiated");
            }}>
              <Phone className="h-3 w-3 mr-1" /> AI Call All
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
            <div className="ml-auto flex gap-4 text-[11px] text-muted-foreground">
              <span>{readyToContact} ready</span>
              <span>{awaitingReply} awaiting</span>
              <span>{hotNow} hot</span>
            </div>
          </div>
        )}

        {/* Quick Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap pb-1">
          <div className="relative shrink-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-44 pl-7 text-xs"
            />
          </div>
          <Select value={industryFilter || "all"} onValueChange={(v) => setIndustryFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-36 h-7 text-xs shrink-0"><SelectValue placeholder="All Industries" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              {(industries as string[]).map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cityFilter || "all"} onValueChange={(v) => setCityFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-32 h-7 text-xs shrink-0"><SelectValue placeholder="All Cities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {(cities as string[]).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-28 h-7 text-xs shrink-0"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Priority: Any</SelectItem>
              <SelectItem value="high">High (7+)</SelectItem>
              <SelectItem value="medium">Medium (4-6)</SelectItem>
              <SelectItem value="low">Low (&lt;4)</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1 text-xs cursor-pointer shrink-0">
            <Checkbox checked={hasPhoneOnly} onCheckedChange={(v) => setHasPhoneOnly(!!v)} className="h-3.5 w-3.5" />
            Phone
          </label>
          <label className="flex items-center gap-1 text-xs cursor-pointer shrink-0">
            <Checkbox checked={noDemoOnly} onCheckedChange={(v) => setNoDemoOnly(!!v)} className="h-3.5 w-3.5" />
            No Demo
          </label>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => {
              setSearchQuery(""); setCityFilter(""); setIndustryFilter(""); setStageFilter(null);
              setPriorityFilter("any"); setHasPhoneOnly(false); setNoDemoOnly(false);
            }}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Mobile Stage Tabs */}
        <div className="flex gap-1 overflow-x-auto md:hidden pb-1">
          {PIPELINE_STAGES.map((s) => (
            <Button key={s.key} size="sm" variant={mobileStage === s.key ? "default" : "outline"}
              className="text-xs shrink-0 h-7" onClick={() => setMobileStage(s.key)}>
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Scrollable Kanban section — fills remaining height */}
      <div className="flex-1 overflow-hidden px-4 pb-4 min-h-0">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isEmpty && !hasFilters ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <Rocket className="h-16 w-16 text-muted-foreground/40" />
            <h2 className="text-xl font-semibold">Your pipeline is empty</h2>
            <p className="text-muted-foreground max-w-md">Import leads or run the Scout Agent to find businesses without websites</p>
            <div className="flex gap-3">
              <Button onClick={() => navigate("/brandaro/leads")}>Import Leads</Button>
              <Button variant="outline" onClick={() => navigate("/brandaro/scout-agent")}>Run Scout Agent</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Kanban */}
            <div className="hidden md:flex gap-3 h-full overflow-x-auto overflow-y-hidden pb-2">
              {filteredColumns.map((col) => (
                <div key={col.key} className="flex flex-col flex-shrink-0" style={{ width: 280 }}>
                  {/* Column header */}
                  <div className={`flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md flex-shrink-0 ${COLUMN_HEADER_COLORS[col.key] || ""}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                    <span className="text-sm font-medium">{col.label}</span>
                    <Badge variant="secondary" className="text-xs ml-auto">{col.leads.length}</Badge>
                    <Checkbox
                      className="h-3.5 w-3.5 ml-1"
                      checked={col.leads.length > 0 && col.leads.every((l: PipelineLead) => selectedIds.has(l.id))}
                      onCheckedChange={() => handleSelectAll(col.key)}
                    />
                  </div>
                  {/* Column body — scrolls vertically */}
                  <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 space-y-2 pr-1">
                    {col.leads.length === 0 ? (
                      <div className="flex flex-col items-center py-10 text-muted-foreground">
                        <Inbox className="h-8 w-8 mb-2 opacity-40" />
                        <p className="text-xs">No leads</p>
                      </div>
                    ) : (
                      col.leads.map((lead: PipelineLead) => (
                        <BrandaroLeadCard
                          key={lead.id}
                          lead={lead}
                          onOpen={setSelectedLead}
                          onMove={handleMove}
                          onBuildDemo={setDemoLead}
                          selected={selectedIds.has(lead.id)}
                          onSelect={handleSelect}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Single Column */}
            <div className="md:hidden space-y-2 overflow-y-auto h-full">
              {filteredColumns
                .filter((col) => col.key === mobileStage)
                .map((col) => (
                  <div key={col.key}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                      <span className="text-sm font-medium">{col.label}</span>
                      <Badge variant="secondary" className="text-xs">{col.leads.length}</Badge>
                    </div>
                    {col.leads.length === 0 ? (
                      <div className="flex flex-col items-center py-10 text-muted-foreground">
                        <Inbox className="h-8 w-8 mb-2 opacity-40" />
                        <p className="text-xs">No leads in this stage</p>
                      </div>
                    ) : (
                      col.leads.map((lead: PipelineLead) => (
                        <BrandaroLeadCard
                          key={lead.id}
                          lead={lead}
                          onOpen={setSelectedLead}
                          onMove={handleMove}
                          onBuildDemo={setDemoLead}
                          selected={selectedIds.has(lead.id)}
                          onSelect={handleSelect}
                        />
                      ))
                    )}
                  </div>
                ))}
            </div>
          </>
        )}
      </div>

      <LeadProfileDialog
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onMove={handleMove}
        onSaveNotes={(id, notes) => updateNotes.mutate({ leadId: id, notes })}
      />
      <BuildDemoModal lead={demoLead} open={!!demoLead} onClose={() => setDemoLead(null)} />
    </div>
  );
}
