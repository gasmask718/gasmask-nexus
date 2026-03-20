import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Kanban, Phone, MapPin, Star, Filter, MessageSquare, X,
  StickyNote, TrendingUp, Users, DollarSign, Target, Zap, RefreshCw,
} from "lucide-react";
import {
  useBrandaroPipeline,
  PIPELINE_STAGES,
  PipelineLead,
} from "@/hooks/useBrandaroPipeline";
import { usePipelineInsights } from "@/hooks/usePipelineInsights";
import { useQueryClient } from "@tanstack/react-query";
import { BrandaroLeadCard } from "@/components/brandaro/BrandaroLeadCard";
import { BuildDemoModal } from "@/components/brandaro/BuildDemoModal";
import { HotLeadsPanels } from "@/components/brandaro/HotLeadsPanels";
import { LeadStageProgressBar } from "@/components/brandaro/LeadStageProgressBar";
import { AITakeoverToggle } from "@/components/brandaro/AITakeoverToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Lead Profile Dialog (enhanced with stage bar + AI toggle) ──
function LeadProfileDialog({
  lead,
  open,
  onClose,
  onMove,
  onSaveNotes,
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

        {/* Stage Progress Bar */}
        <LeadStageProgressBar
          currentStage={lead.pipeline_stage}
          businessName={lead.business_name || "Lead"}
          updatedAt={lead.updated_at}
          onStageChange={handleStageChange}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
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
              {lead.rating && (
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

           {/* Calendly Buttons */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">📅 Booking Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  size="sm"
                  className="w-full justify-start"
                  onClick={async () => {
                    if (!lead.phone_number) { toast.error("No phone number"); return; }
                    try {
                      await supabase.functions.invoke("send-sms", {
                        body: {
                          phone_number: lead.phone_number,
                          message: `Hi ${lead.business_name || "there"}, here's my booking link to schedule your website review call: https://calendly.com/brandarodigital-sales/website-strategy-call`,
                        },
                      });
                      toast.success("Booking link sent");
                    } catch { toast.error("Failed to send"); }
                  }}
                >
                  📅 Send Booking Link
                </Button>
                {(lead.pipeline_stage === "interested" || ((lead as any).service_interest || "").includes("funding")) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={async () => {
                      if (!lead.phone_number) { toast.error("No phone number"); return; }
                      try {
                        await supabase.functions.invoke("send-sms", {
                          body: {
                            phone_number: lead.phone_number,
                            message: `Hi ${lead.business_name || "there"}, here's the link to book your free funding consultation: https://calendly.com/brandarodigital-sales/funding-consultation`,
                          },
                        });
                        toast.success("Funding link sent");
                      } catch { toast.error("Failed to send"); }
                    }}
                  >
                    💰 Send Funding Call Link
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* AI Takeover Toggle */}
            <div className="space-y-3">
              <AITakeoverToggle
                leadId={lead.id}
                businessName={lead.business_name || "Lead"}
                phoneNumber={lead.phone_number}
                aiPaused={aiPaused}
                onToggle={setLocalAiPaused}
              />

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Pipeline Stage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {PIPELINE_STAGES.map((s) => (
                  <Button
                    key={s.key}
                    variant={lead.pipeline_stage === s.key ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => onMove(lead.id, s.key)}
                  >
                    <span className={`w-2 h-2 rounded-full ${s.color} mr-2`} />
                    {s.label}
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
              <div
                className="text-sm text-muted-foreground min-h-[60px] cursor-pointer hover:bg-muted/50 rounded p-2"
                onClick={() => { setNotes(lead.call_notes || ""); setEditingNotes(true); }}
              >
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
  const [cityFilter, setCityFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [demoLead, setDemoLead] = useState<PipelineLead | null>(null);
  const [stageFilter, setStageFilter] = useState<string[] | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Force refresh all queries on mount
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["brandaro-pipeline"] });
    queryClient.invalidateQueries({ queryKey: ["brandaro-hot-leads"] });
    queryClient.invalidateQueries({ queryKey: ["brandaro-followup-leads"] });
    queryClient.invalidateQueries({ queryKey: ["brandaro-stuck-leads"] });
  }, [queryClient]);

  const { columns, stats, cities, industries, isLoading, moveLead, updateNotes } =
    useBrandaroPipeline({
      city: cityFilter || undefined,
      industry: industryFilter || undefined,
    });

  const { autoMove } = usePipelineInsights();

  const handleMove = (id: string, stage: string) => {
    moveLead.mutate({ leadId: id, stage });
    if (selectedLead?.id === id) {
      setSelectedLead({ ...selectedLead, pipeline_stage: stage });
    }
  };

  const syncPipeline = async () => {
    setSyncing(true);
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brandaro-fix-imports`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({}),
        }
      );
      await queryClient.invalidateQueries();
      toast.success("Pipeline synced — all leads refreshed");
    } catch (err: any) {
      toast.error(err?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const filteredColumns = stageFilter
    ? columns.filter((c) => stageFilter.includes(c.key))
    : columns;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Kanban className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Sales Pipeline</h1>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={syncPipeline}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "⚡ Sync Pipeline"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => autoMove.mutate()}
            disabled={autoMove.isPending}
          >
            <Zap className="h-4 w-4 mr-1" />
            {autoMove.isPending ? "Running…" : "Auto-Move Leads"}
          </Button>
        </div>

      {/* Hot Leads Intelligence Panels */}
      <HotLeadsPanels
        onFilterStage={(stages) =>
          setStageFilter((prev) =>
            prev && prev.join() === stages.join() ? null : stages
          )
        }
      />

      {/* KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> Total Leads
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4" /> Interested
          </div>
          <p className="text-2xl font-bold text-emerald-500">
            {(stats.byStage["interested"] || 0) + (stats.byStage["booked"] || 0)}
          </p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" /> Closed
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.byStage["closed"] || 0}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" /> Close Rate
          </div>
          <p className="text-2xl font-bold">{stats.conversionRate}%</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={cityFilter || "all"} onValueChange={(v) => setCityFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {(cities as string[]).map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={industryFilter || "all"} onValueChange={(v) => setIndustryFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Industries</SelectItem>
            {(industries as string[]).map((i) => (
              <SelectItem key={i} value={i}>{i}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(cityFilter || industryFilter || stageFilter) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs"
            onClick={() => { setCityFilter(""); setIndustryFilter(""); setStageFilter(null); }}
          >
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 500 }}>
          {filteredColumns.map((col) => (
            <div key={col.key} className="flex-shrink-0 w-64">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                <span className="text-sm font-semibold">{col.label}</span>
                <Badge variant="secondary" className="text-xs ml-auto">
                  {col.leads.length}
                </Badge>
              </div>

              <ScrollArea className="h-[calc(100vh-40rem)]">
                <div className="space-y-2 pr-2">
                  {col.leads.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No leads</p>
                  ) : (
                    col.leads.map((lead: PipelineLead) => (
                      <BrandaroLeadCard
                        key={lead.id}
                        lead={lead}
                        onOpen={setSelectedLead}
                        onMove={handleMove}
                        onBuildDemo={setDemoLead}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
      )}

      <LeadProfileDialog
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onMove={handleMove}
        onSaveNotes={(id, notes) => updateNotes.mutate({ leadId: id, notes })}
      />

      <BuildDemoModal
        lead={demoLead}
        open={!!demoLead}
        onClose={() => setDemoLead(null)}
      />
    </div>
  );
}
