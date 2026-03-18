import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Kanban, Phone, MapPin, Star, Filter, ChevronRight, ChevronLeft,
  MessageSquare, X, StickyNote, TrendingUp, Users, DollarSign, Target,
} from "lucide-react";
import {
  useBrandaroPipeline,
  PIPELINE_STAGES,
  PipelineLead,
  PipelineStageKey,
} from "@/hooks/useBrandaroPipeline";

// ── Lead Card ──
function LeadCard({
  lead,
  onOpen,
  onMove,
}: {
  lead: PipelineLead;
  onOpen: (l: PipelineLead) => void;
  onMove: (id: string, stage: string) => void;
}) {
  const stageIdx = PIPELINE_STAGES.findIndex((s) => s.key === lead.pipeline_stage);
  const nextStage = PIPELINE_STAGES[stageIdx + 1];
  const prevStage = stageIdx > 0 ? PIPELINE_STAGES[stageIdx - 1] : null;

  return (
    <Card
      className="cursor-pointer hover:ring-1 hover:ring-primary/40 transition-all group"
      onClick={() => onOpen(lead)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-1">
          <p className="font-semibold text-sm leading-tight truncate flex-1">
            {lead.business_name || "Unknown"}
          </p>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {lead.priority_score}pt
          </Badge>
        </div>

        {lead.industry && (
          <p className="text-xs text-muted-foreground truncate">{lead.industry}</p>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lead.city && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {lead.city}
            </span>
          )}
          {lead.rating && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 text-amber-400" />
              {lead.rating}
            </span>
          )}
        </div>

        {lead.call_attempts > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {lead.call_attempts} call{lead.call_attempts > 1 ? "s" : ""}
          </p>
        )}

        {/* Quick stage arrows */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1"
          onClick={(e) => e.stopPropagation()}
        >
          {prevStage && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1 text-xs"
              onClick={() => onMove(lead.id, prevStage.key)}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
          )}
          {nextStage && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1 text-xs flex-1"
              onClick={() => onMove(lead.id, nextStage.key)}
            >
              {nextStage.label} <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Lead Profile Dialog ──
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

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {lead.business_name || "Unknown Lead"}
            <Badge variant="outline">{lead.pipeline_stage}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {lead.phone_number && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href={`tel:${lead.phone_number}`} className="hover:underline">
                    {lead.phone_number}
                  </a>
                </div>
              )}
              {lead.city && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {lead.city}{lead.state ? `, ${lead.state}` : ""}
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

          {/* Stage Control */}
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

        {/* Notes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <StickyNote className="h-4 w-4" /> Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this lead..."
                  rows={4}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { onSaveNotes(lead.id, notes); setEditingNotes(false); }}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                    Cancel
                  </Button>
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
  const [cityFilter, setCityFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);

  const { columns, stats, cities, industries, isLoading, moveLead, updateNotes } =
    useBrandaroPipeline({
      city: cityFilter || undefined,
      industry: industryFilter || undefined,
    });

  const handleMove = (id: string, stage: string) => {
    moveLead.mutate({ leadId: id, stage });
    if (selectedLead?.id === id) {
      setSelectedLead({ ...selectedLead, pipeline_stage: stage });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Kanban className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Sales Pipeline</h1>
        </div>
      </div>

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
        {(cityFilter || industryFilter) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setCityFilter(""); setIndustryFilter(""); }}
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
          {columns.map((col) => (
            <div key={col.key} className="flex-shrink-0 w-64">
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                <span className="text-sm font-semibold">{col.label}</span>
                <Badge variant="secondary" className="text-xs ml-auto">
                  {col.leads.length}
                </Badge>
              </div>

              {/* Column Cards */}
              <ScrollArea className="h-[calc(100vh-22rem)]">
                <div className="space-y-2 pr-2">
                  {col.leads.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      No leads
                    </p>
                  ) : (
                    col.leads.map((lead: PipelineLead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onOpen={setSelectedLead}
                        onMove={handleMove}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
      )}

      {/* Profile Dialog */}
      <LeadProfileDialog
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onMove={handleMove}
        onSaveNotes={(id, notes) => updateNotes.mutate({ leadId: id, notes })}
      />
    </div>
  );
}
