import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useAllVAPerformance, useVALeaderboard, useVAAlerts, useAddCoachingNote,
} from "@/hooks/useBrandaroVAPerformance";
import {
  useAllLeadHeat, useVACloserHandoffs, useAssignCloserHandoff, useAllConversionMetrics,
} from "@/hooks/useBrandaroCloserBrain";
import {
  useWinningPatterns, useResponseLibrary, useVASkillProfiles, useOptimizeResponses,
} from "@/hooks/useBrandaroLearningEngine";
import {
  useCompetitorIntel, useOfferVariants, usePricingTests, usePositioningTests,
  useOptimizeOffers, useEvaluatePricingTests, useUpsertCompetitor, useCreateOffer,
  useCreatePricingTest, useCreatePositioningTest, useSystemDecisions,
} from "@/hooks/useBrandaroMarketDomination";
import {
  usePersonalities, useStrategyFrameworks, useCreatePersonality,
  useCreateFramework, useTogglePersonality, useGeneratePersonalityResponse,
  useIngestFromTranscript, useGenerateFromDescription, useSeedStarterPersonalities,
} from "@/hooks/useBrandaroPersonalityEngine";
import { toast } from "sonner";
import {
  Users, Phone, TrendingUp, Target, Flame, Clock, AlertTriangle,
  Trophy, Shield, Star, Eye, MessageSquare, CheckCircle2, Bell,
  Brain, ArrowUpRight, ThermometerSun, Sparkles, Zap, BookOpen, BarChart3,
  Crosshair, DollarSign, Swords, Tag, UserCircle, Mic, FileText, PlayCircle, RefreshCw,
} from "lucide-react";
import { RecordingPlayer } from "@/components/phone/RecordingPlayer";

export default function VAManagerPage() {
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"today" | "week" | "month">("today");
  const [selectedVA, setSelectedVA] = useState<string | null>(null);
  const [coachingNotes, setCoachingNotes] = useState("");
  const [qualityScore, setQualityScore] = useState("3");
  const [improvementTarget, setImprovementTarget] = useState("");
  const [patternFilter, setPatternFilter] = useState<string | undefined>();
  const [newCompName, setNewCompName] = useState("");
  const [newCompPricing, setNewCompPricing] = useState("");
  const [newCompWeakness, setNewCompWeakness] = useState("");
  const [newOfferName, setNewOfferName] = useState("");
  const [newOfferPrice, setNewOfferPrice] = useState("");
  const [newOfferHeadline, setNewOfferHeadline] = useState("");
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newPersonaTone, setNewPersonaTone] = useState("confident");
  const [newPersonaCadence, setNewPersonaCadence] = useState("medium");
  const [newPersonaPersuasion, setNewPersonaPersuasion] = useState("logical");
  const [newPersonaObjection, setNewPersonaObjection] = useState("reframe");
  const [newPersonaClosing, setNewPersonaClosing] = useState("direct");
  const [newPersonaEnergy, setNewPersonaEnergy] = useState("7");
  const [testTranscript, setTestTranscript] = useState("");
  const [testPersonalityId, setTestPersonalityId] = useState("");
  const [testResult, setTestResult] = useState<any>(null);

  const { data: allPerf = [] } = useAllVAPerformance();
  const { data: leaderboard = [] } = useVALeaderboard(leaderboardPeriod);
  const { data: alerts = [] } = useVAAlerts();
  const addCoaching = useAddCoachingNote();

  const { data: hotLeads = [] } = useAllLeadHeat(45);
  const { data: handoffs = [] } = useVACloserHandoffs("pending");
  const { data: allMetrics = [] } = useAllConversionMetrics();
  const assignHandoff = useAssignCloserHandoff();

  // Learning engine hooks
  const { data: patterns = [] } = useWinningPatterns(patternFilter);
  const { data: responses = [] } = useResponseLibrary();
  const { data: skills = [] } = useVASkillProfiles();
  const optimizeResponses = useOptimizeResponses();

  // Market domination hooks
  const { data: competitors = [] } = useCompetitorIntel();
  const { data: offers = [] } = useOfferVariants();
  const { data: pricingTests = [] } = usePricingTests();
  const { data: positioningTests = [] } = usePositioningTests();
  const optimizeOffers = useOptimizeOffers();
  const evaluatePricing = useEvaluatePricingTests();
  const upsertCompetitor = useUpsertCompetitor();
  const createOffer = useCreateOffer();
  const createPricingTest = useCreatePricingTest();
  const createPositioning = useCreatePositioningTest();
  const { data: decisions = [] } = useSystemDecisions();

  // Personality engine hooks
  const { data: personalities = [] } = usePersonalities();
  const { data: frameworks = [] } = useStrategyFrameworks();
  const createPersonality = useCreatePersonality();
  const createFramework = useCreateFramework();
  const togglePersonality = useTogglePersonality();
  const generatePersonalityResponse = useGeneratePersonalityResponse();
  const ingestFromTranscript = useIngestFromTranscript();
  const generateFromDescription = useGenerateFromDescription();
  const seedStarters = useSeedStarterPersonalities();
  const [ingestMode, setIngestMode] = useState<"manual" | "transcript" | "description">("manual");
  const [ingestText, setIngestText] = useState("");
  const [ingestName, setIngestName] = useState("");
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [recordingsFilter, setRecordingsFilter] = useState<string | undefined>();
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  // Fetch all call recordings from DB + Twilio
  const { data: allCallRecordings = [], refetch: refetchRecordings, isLoading: loadingRecordings } = useQuery({
    queryKey: ["brandaro-all-recordings", recordingsFilter],
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const params = new URLSearchParams({ action: "list", limit: "200" });
      if (recordingsFilter) params.set("va_id", recordingsFilter);
      
      const { data, error } = await supabase.functions.invoke("brandaro-fetch-recordings", {
        body: null,
        headers: { "Content-Type": "application/json" },
      });

      // Fallback: query directly from DB if edge function fails
      if (error || !data?.calls) {
        const { data: vaLogs } = await supabase
          .from("va_call_logs")
          .select("id, va_id, call_sid, recording_url, recording_sid, transcript, duration_seconds, call_status, disposition, called_at, direction, excitement_level, va_notes, lead_id")
          .eq("twilio_number", "+19292623850")
          .order("called_at", { ascending: false })
          .limit(200);

        const { data: brandLogs } = await supabase
          .from("brandaro_call_logs")
          .select("id, called_by_user_id, call_outcome, call_notes, call_timestamp, call_duration_seconds, recording_url, lead_id")
          .order("call_timestamp", { ascending: false })
          .limit(200);

        const { data: profiles } = await supabase.from("profiles").select("id, name");
        const nameMap: Record<string, string> = {};
        (profiles || []).forEach((p: any) => { nameMap[p.id] = p.name || "VA"; });

        const unified: any[] = [];
        (vaLogs || []).forEach((l: any) => unified.push({
          id: l.id, source: "va_call_logs", va_id: l.va_id, va_name: nameMap[l.va_id] || "Unknown",
          call_sid: l.call_sid, recording_url: l.recording_url, transcript: l.transcript,
          duration_seconds: l.duration_seconds, call_status: l.call_status, disposition: l.disposition,
          called_at: l.called_at, direction: l.direction, notes: l.va_notes, lead_id: l.lead_id,
        }));
        (brandLogs || []).forEach((l: any) => unified.push({
          id: l.id, source: "brandaro_call_logs", va_id: l.called_by_user_id, va_name: nameMap[l.called_by_user_id] || "Unknown",
          call_sid: null, recording_url: l.recording_url, transcript: null,
          duration_seconds: l.call_duration_seconds, call_status: l.call_outcome, disposition: l.call_outcome,
          called_at: l.call_timestamp, direction: "outbound", notes: l.call_notes, lead_id: l.lead_id,
        }));
        unified.sort((a, b) => new Date(b.called_at || 0).getTime() - new Date(a.called_at || 0).getTime());
        return unified;
      }

      return data.calls;
    },
    refetchInterval: 60000,
  });

  // VA leaderboard from DB
  const { data: dbLeaderboard = [], refetch: refetchLeaderboard } = useQuery({
    queryKey: ["brandaro-db-leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_leaderboard_stats")
        .select("*, profiles(name)")
        .eq("session_date", new Date().toISOString().split("T")[0])
        .order("calls_closed", { ascending: false });
      if (error) return [];
      return (data || []).map((d: any) => ({
        va_id: d.va_id,
        va_name: d.profiles?.name || "VA",
        calls_dialed: d.calls_dialed || 0,
        calls_answered: d.calls_answered || 0,
        calls_closed: d.calls_closed || 0,
        total_talk_time: d.total_talk_time_seconds || 0,
      }));
    },
    refetchInterval: 30000,
  });

  // Sync recordings from Twilio
  const handleSyncRecordings = async () => {
    try {
      await supabase.functions.invoke("brandaro-sync-recordings", { body: {} });
      refetchRecordings();
      toast.success("Recordings synced from Twilio");
    } catch {
      toast.error("Sync failed");
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Get unique VAs for filter
  const uniqueVAs = Array.from(new Map(
    allCallRecordings.map((c: any) => [c.va_id, { id: c.va_id, name: c.va_name }])
  ).values());

  const recordingsWithAudio = allCallRecordings.filter((c: any) => c.recording_url);
  const recordingsWithTranscripts = allCallRecordings.filter((c: any) => c.transcript);

  const totalCalls = allPerf.reduce((s: number, p: any) => s + (p.calls_made || 0), 0);
  const totalConversations = allPerf.reduce((s: number, p: any) => s + (p.conversations || 0), 0);
  const totalInterested = allPerf.reduce((s: number, p: any) => s + (p.interested_leads || 0), 0);
  const totalHot = allPerf.reduce((s: number, p: any) => s + (p.hot_leads || 0), 0);
  const onShift = allPerf.filter((p: any) => p.is_on_shift).length;
  const behindQuota = allPerf.filter((p: any) => {
    const callPct = p.quota_calls > 0 ? p.calls_made / p.quota_calls : 1;
    return callPct < 0.5;
  });

  const totalObjections = allMetrics.reduce((s: number, m: any) => s + (m.objections_handled || 0), 0);
  const totalSignals = allMetrics.reduce((s: number, m: any) => s + (m.buying_signals_detected || 0), 0);
  const totalHandoffs = allMetrics.reduce((s: number, m: any) => s + (m.closer_handoffs || 0), 0);
  const closingNowLeads = hotLeads.filter((l: any) => l.status === "closing_now" || l.status === "hot");

  const submitCoaching = () => {
    if (!selectedVA || !coachingNotes) return;
    addCoaching.mutate({
      va_user_id: selectedVA,
      notes: coachingNotes,
      quality_score: parseInt(qualityScore),
      improvement_target: improvementTarget || undefined,
    });
    setCoachingNotes("");
    setImprovementTarget("");
    toast.success("Coaching note added");
  };

  const riskVAs = allPerf.filter((p: any) => {
    const metric = allMetrics.find((m: any) => m.va_user_id === p.va_user_id);
    return p.calls_made >= 20 && (metric?.interested_leads || 0) === 0;
  });

  const getSkillColor = (score: number) => {
    if (score >= 70) return "text-emerald-400";
    if (score >= 40) return "text-amber-400";
    return "text-destructive";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manager Oversight</h1>
        <p className="text-muted-foreground text-sm">AI Closer Brain + Self-Learning Intelligence</p>
      </div>

      {/* Critical Alerts + Hot Lead Banners */}
      {closingNowLeads.length > 0 && (
        <div className="rounded-lg px-4 py-3 bg-red-500/15 border border-red-500/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Flame className="h-5 w-5 text-red-500 animate-pulse" />
            <div>
              <p className="text-sm font-bold text-red-400">🔥 {closingNowLeads.length} HOT/CLOSING leads need immediate action</p>
              <p className="text-xs text-red-300/80">{handoffs.length} pending closer handoffs</p>
            </div>
          </div>
          <Badge variant="destructive">{closingNowLeads.length}</Badge>
        </div>
      )}

      {alerts.filter((a: any) => a.severity === "critical" || a.severity === "high").length > 0 && (
        <div className="space-y-2">
          {alerts.filter((a: any) => a.severity === "critical" || a.severity === "high").slice(0, 3).map((a: any) => (
            <div key={a.id} className="rounded-lg px-4 py-2 text-sm flex items-center gap-2 bg-destructive/20 text-destructive border border-destructive/30">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="font-medium">{a.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Team Overview KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "On Shift", val: onShift, icon: Users, color: "text-green-500" },
          { label: "Calls", val: totalCalls, icon: Phone, color: "text-primary" },
          { label: "Convos", val: totalConversations, icon: TrendingUp, color: "text-cyan-500" },
          { label: "Interested", val: totalInterested, icon: Target, color: "text-blue-500" },
          { label: "Hot Leads", val: totalHot, icon: Flame, color: "text-orange-500" },
          { label: "Objections", val: totalObjections, icon: Shield, color: "text-purple-400" },
          { label: "Signals", val: totalSignals, icon: Sparkles, color: "text-emerald-400" },
          { label: "Handoffs", val: totalHandoffs, icon: ArrowUpRight, color: "text-amber-400" },
        ].map(({ label, val, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <div>
                  <p className="text-xl font-bold">{val}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="escalation" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="escalation"><Flame className="h-3 w-3 mr-1" /> Escalation</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-3 w-3 mr-1" /> Team</TabsTrigger>
          <TabsTrigger value="risk"><AlertTriangle className="h-3 w-3 mr-1" /> Risk</TabsTrigger>
          <TabsTrigger value="leaderboard"><Trophy className="h-3 w-3 mr-1" /> Rank</TabsTrigger>
          <TabsTrigger value="coaching"><Shield className="h-3 w-3 mr-1" /> Coach</TabsTrigger>
          <TabsTrigger value="alerts"><Bell className="h-3 w-3 mr-1" /> Alerts</TabsTrigger>
          <TabsTrigger value="patterns"><Brain className="h-3 w-3 mr-1" /> Patterns</TabsTrigger>
          <TabsTrigger value="responses"><BookOpen className="h-3 w-3 mr-1" /> Responses</TabsTrigger>
          <TabsTrigger value="skills"><BarChart3 className="h-3 w-3 mr-1" /> Skills</TabsTrigger>
          <TabsTrigger value="competitors"><Swords className="h-3 w-3 mr-1" /> Intel</TabsTrigger>
          <TabsTrigger value="offers"><Tag className="h-3 w-3 mr-1" /> Offers</TabsTrigger>
          <TabsTrigger value="pricing"><DollarSign className="h-3 w-3 mr-1" /> Pricing</TabsTrigger>
          <TabsTrigger value="positioning"><Crosshair className="h-3 w-3 mr-1" /> Position</TabsTrigger>
          <TabsTrigger value="decisions"><Eye className="h-3 w-3 mr-1" /> Decisions</TabsTrigger>
          <TabsTrigger value="personalities"><UserCircle className="h-3 w-3 mr-1" /> Personas</TabsTrigger>
          <TabsTrigger value="recordings"><Mic className="h-3 w-3 mr-1" /> Recordings</TabsTrigger>
          <TabsTrigger value="transcripts"><FileText className="h-3 w-3 mr-1" /> Transcripts</TabsTrigger>
          <TabsTrigger value="db-leaderboard"><Trophy className="h-3 w-3 mr-1" /> Live Board</TabsTrigger>
        </TabsList>

        {/* ── Escalation Queue ── */}
        <TabsContent value="escalation" className="space-y-4">
          <Card className="border-orange-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-orange-500" /> Closer Handoff Queue ({handoffs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {handoffs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No pending handoffs</p>}
                  {handoffs.map((h: any) => (
                    <div key={h.id} className="p-3 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Flame className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-medium">Lead {h.lead_id?.slice(0, 8)}…</span>
                          <Badge variant="destructive" className="text-xs">Score: {Math.round(h.lead_heat_score)}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{h.handoff_reason}</p>
                      {h.qualification_notes && <p className="text-xs">{h.qualification_notes}</p>}
                      <Button size="sm" className="text-xs h-7" onClick={() => assignHandoff.mutate({ handoffId: h.id, closerId: h.va_user_id })}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Assign Closer
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ThermometerSun className="h-4 w-4 text-orange-500" /> Lead Heat Board
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px]">
                <div className="space-y-2">
                  {hotLeads.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No hot leads</p>}
                  {hotLeads.map((lead: any) => (
                    <div key={lead.id} className="flex items-center justify-between p-2 rounded-lg border bg-card text-xs">
                      <div className="flex items-center gap-2">
                        {lead.status === "closing_now" ? <Flame className="h-3 w-3 text-red-500 animate-pulse" /> : <Flame className="h-3 w-3 text-orange-500" />}
                        <span>Lead {lead.lead_id?.slice(0, 8)}…</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{Math.round(lead.heat_score)}</span>
                        <Badge variant="outline" className="text-xs capitalize">{lead.status?.replace(/_/g, " ")}</Badge>
                        <span className="text-muted-foreground">{lead.next_best_action?.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Team Status ── */}
        <TabsContent value="team">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">VA Team — Today's Performance</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {allPerf.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No VA activity today</p>}
                  {allPerf.map((va: any) => {
                    const callPct = va.quota_calls > 0 ? Math.round((va.calls_made / va.quota_calls) * 100) : 0;
                    const vaMetric = allMetrics.find((m: any) => m.va_user_id === va.va_user_id);
                    return (
                      <div key={va.id} className="p-4 rounded-lg border bg-card space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${va.is_on_shift ? "bg-green-500" : "bg-muted-foreground"}`} />
                            <span className="font-medium text-sm">{va.va_user_id.slice(0, 8)}…</span>
                            <Badge variant={va.is_on_shift ? "default" : "secondary"} className="text-xs">{va.is_on_shift ? "On Shift" : "Off"}</Badge>
                          </div>
                          <Badge variant="outline">{va.performance_score} pts</Badge>
                        </div>
                        <div className="grid grid-cols-6 gap-2 text-center text-xs">
                          <div><p className="font-bold text-lg">{va.calls_made}</p><p className="text-muted-foreground">Calls</p></div>
                          <div><p className="font-bold text-lg">{va.conversations}</p><p className="text-muted-foreground">Convos</p></div>
                          <div><p className="font-bold text-lg">{va.interested_leads}</p><p className="text-muted-foreground">Interested</p></div>
                          <div><p className="font-bold text-lg">{va.hot_leads}</p><p className="text-muted-foreground">Hot</p></div>
                          <div><p className="font-bold text-lg">{vaMetric?.objections_handled || 0}</p><p className="text-muted-foreground">Obj</p></div>
                          <div><p className="font-bold text-lg">{vaMetric?.closer_handoffs || 0}</p><p className="text-muted-foreground">Handoffs</p></div>
                        </div>
                        <Progress value={Math.min(100, callPct)} className="h-1.5" />
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => setSelectedVA(va.va_user_id)}>
                            <Eye className="h-3 w-3 mr-1" /> Review
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => setSelectedVA(va.va_user_id)}>
                            <MessageSquare className="h-3 w-3 mr-1" /> Coach
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Risk Board ── */}
        <TabsContent value="risk">
          <Card className="border-destructive/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Risk Board
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground mb-2">VAs with high call volume but low conversion</div>
                  {riskVAs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No risk flags — team is performing well</p>}
                  {riskVAs.map((va: any) => (
                    <div key={va.id} className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{va.va_user_id.slice(0, 8)}…</span>
                        <Badge variant="destructive" className="text-xs">At Risk</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-center">
                        <div><p className="font-bold">{va.calls_made}</p><p className="text-muted-foreground">Calls</p></div>
                        <div><p className="font-bold">{va.conversations}</p><p className="text-muted-foreground">Convos</p></div>
                        <div><p className="font-bold text-destructive">{va.interested_leads}</p><p className="text-muted-foreground">Interested</p></div>
                      </div>
                      <p className="text-xs text-destructive">⚠ High call volume with zero interested leads — coaching needed</p>
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => setSelectedVA(va.va_user_id)}>
                        <Shield className="h-3 w-3 mr-1" /> Coach Now
                      </Button>
                    </div>
                  ))}
                  {behindQuota.length > 0 && (
                    <>
                      <div className="text-xs text-muted-foreground mt-4 mb-2">VAs behind quota (&lt;50%)</div>
                      {behindQuota.map((va: any) => (
                        <div key={va.id} className="p-3 rounded-lg border border-orange-500/30 bg-orange-500/5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-orange-500" />
                            <span className="text-sm">{va.va_user_id.slice(0, 8)}…</span>
                          </div>
                          <Badge variant="outline" className="text-xs text-orange-500">{va.calls_made}/{va.quota_calls} calls</Badge>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Leaderboard ── */}
        <TabsContent value="leaderboard">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Team Leaderboard</CardTitle>
              <div className="flex gap-1">
                {(["today", "week", "month"] as const).map(p => (
                  <Button key={p} size="sm" variant={leaderboardPeriod === p ? "default" : "ghost"} onClick={() => setLeaderboardPeriod(p)} className="text-xs h-7">
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaderboard.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>}
                {leaderboard.map((va: any, i: number) => (
                  <div key={va.va_user_id} className={`flex items-center justify-between p-3 rounded-lg border ${i === 0 ? "border-amber-500/30 bg-amber-500/5" : "bg-card"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold w-8 ${i === 0 ? "text-amber-400" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-700" : "text-muted-foreground"}`}>#{i + 1}</span>
                      <p className="text-sm font-medium">{va.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {i === 0 && <Trophy className="h-4 w-4 text-amber-400" />}
                      <Badge variant="secondary">{va.score} pts</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Coaching ── */}
        <TabsContent value="coaching">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Add Coaching Note</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedVA || ""} onValueChange={setSelectedVA}>
                <SelectTrigger><SelectValue placeholder="Select VA…" /></SelectTrigger>
                <SelectContent>
                  {allPerf.map((va: any) => (
                    <SelectItem key={va.va_user_id} value={va.va_user_id}>{va.va_user_id.slice(0, 8)}… — {va.calls_made} calls</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea placeholder="Coaching notes…" value={coachingNotes} onChange={e => setCoachingNotes(e.target.value)} />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Quality Score (1-5)</label>
                  <Select value={qualityScore} onValueChange={setQualityScore}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Improvement Target</label>
                  <Input value={improvementTarget} onChange={e => setImprovementTarget(e.target.value)} placeholder="e.g. Objection handling" />
                </div>
              </div>
              <Button onClick={submitCoaching} disabled={!selectedVA || !coachingNotes}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Submit Coaching Note
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Alerts ── */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Active Alerts</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {alerts.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No active alerts</p>}
                  {alerts.map((a: any) => (
                    <div key={a.id} className={`p-3 rounded-lg border flex items-start gap-3 ${
                      a.severity === "critical" ? "border-destructive/50 bg-destructive/5" :
                      a.severity === "high" ? "border-orange-500/30 bg-orange-500/5" : "bg-card"
                    }`}>
                      <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                        a.severity === "critical" ? "text-destructive" :
                        a.severity === "high" ? "text-orange-500" : "text-muted-foreground"
                      }`} />
                      <div>
                        <p className="text-sm font-medium">{a.title}</p>
                        {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString()}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">{a.severity}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NEW: Winning Patterns ── */}
        <TabsContent value="patterns" className="space-y-4">
          <Card className="border-purple-500/20">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-400" /> Winning Patterns
              </CardTitle>
              <div className="flex gap-1">
                {[undefined, "objection", "signal", "strategy"].map(t => (
                  <Button key={t || "all"} size="sm" variant={patternFilter === t ? "default" : "ghost"} onClick={() => setPatternFilter(t)} className="text-xs h-7">
                    {t ? t.charAt(0).toUpperCase() + t.slice(1) : "All"}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {patterns.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Not enough data yet (min 3 samples)</p>}
                  {patterns.map((p: any) => (
                    <div key={p.id} className="p-3 rounded-lg border bg-card flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs capitalize">{p.pattern_type}</Badge>
                        <span className="text-sm font-medium">{p.pattern_key?.replace(/_/g, " ")}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="text-right">
                          <p className={`font-bold ${p.success_rate >= 60 ? "text-emerald-400" : p.success_rate >= 30 ? "text-amber-400" : "text-destructive"}`}>
                            {Math.round(p.success_rate)}%
                          </p>
                          <p className="text-muted-foreground">win rate</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{p.sample_size}</p>
                          <p className="text-muted-foreground">samples</p>
                        </div>
                        {p.avg_revenue > 0 && (
                          <div className="text-right">
                            <p className="font-bold text-emerald-400">${Math.round(p.avg_revenue)}</p>
                            <p className="text-muted-foreground">avg rev</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NEW: Response Library ── */}
        <TabsContent value="responses" className="space-y-4">
          <Card className="border-blue-500/20">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-400" /> Response Leaderboard
              </CardTitle>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => optimizeResponses.mutate()} disabled={optimizeResponses.isPending}>
                <Zap className="h-3 w-3 mr-1" /> {optimizeResponses.isPending ? "Optimizing…" : "Optimize"}
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {responses.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No responses yet — run Optimize to seed</p>}
                  {responses.map((r: any, i: number) => (
                    <div key={r.id} className={`p-3 rounded-lg border bg-card space-y-2 ${i === 0 ? "border-emerald-500/30" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {i === 0 && <Star className="h-3 w-3 text-emerald-400" />}
                          <Badge variant="outline" className="text-xs capitalize">{r.objection_type?.replace(/_/g, " ")}</Badge>
                          {r.strategy && <span className="text-xs text-muted-foreground">• {r.strategy}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${r.success_rate >= 60 ? "text-emerald-400" : r.success_rate >= 30 ? "text-amber-400" : "text-muted-foreground"}`}>
                            {Math.round(r.success_rate)}%
                          </span>
                          <span className="text-xs text-muted-foreground">{r.usage_count} uses</span>
                        </div>
                      </div>
                      <p className="text-sm italic text-muted-foreground">"{r.response_text}"</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NEW: VA Skill Heatmap ── */}
        <TabsContent value="skills" className="space-y-4">
          <Card className="border-cyan-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-cyan-400" /> VA Skill Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {skills.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No skill profiles yet — data builds after call analyses</p>}
                  {skills.map((s: any) => (
                    <div key={s.id} className="p-4 rounded-lg border bg-card space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{s.va_user_id?.slice(0, 8)}…</span>
                        <Badge variant="outline" className="text-xs">{Math.round(s.conversion_rate)}% conversion</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Objection Handling</span>
                            <span className={`font-bold ${getSkillColor(s.objection_handling_score)}`}>{Math.round(s.objection_handling_score)}%</span>
                          </div>
                          <Progress value={s.objection_handling_score} className="h-1.5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Closing</span>
                            <span className={`font-bold ${getSkillColor(s.closing_score)}`}>{Math.round(s.closing_score)}%</span>
                          </div>
                          <Progress value={s.closing_score} className="h-1.5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Follow-up</span>
                            <span className={`font-bold ${getSkillColor(s.followup_score)}`}>{Math.round(s.followup_score)}%</span>
                          </div>
                          <Progress value={s.followup_score} className="h-1.5" />
                        </div>
                      </div>
                      <div className="flex gap-2 text-xs">
                        {s.strongest_area && (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                            💪 {s.strongest_area.replace(/_/g, " ")}
                          </Badge>
                        )}
                        {s.weakest_area && (
                          <Badge className="bg-red-500/15 text-red-400 border-red-500/30">
                            ⚠ {s.weakest_area.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NEW: Competitor Intel ── */}
        <TabsContent value="competitors" className="space-y-4">
          <Card className="border-red-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Swords className="h-4 w-4 text-red-400" /> Competitor Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Competitor Form */}
              <div className="flex gap-2">
                <Input placeholder="Competitor name" value={newCompName} onChange={e => setNewCompName(e.target.value)} className="flex-1" />
                <Input placeholder="Pricing model" value={newCompPricing} onChange={e => setNewCompPricing(e.target.value)} className="flex-1" />
                <Input placeholder="Key weakness" value={newCompWeakness} onChange={e => setNewCompWeakness(e.target.value)} className="flex-1" />
                <Button size="sm" onClick={() => {
                  if (!newCompName) return;
                  upsertCompetitor.mutate({
                    competitor_name: newCompName,
                    pricing_model: newCompPricing,
                    weaknesses: newCompWeakness ? [newCompWeakness] : [],
                  });
                  setNewCompName(""); setNewCompPricing(""); setNewCompWeakness("");
                }}>Add</Button>
              </div>
              <ScrollArea className="h-[350px]">
                <div className="space-y-3">
                  {competitors.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No competitor intel yet</p>}
                  {competitors.map((c: any) => (
                    <div key={c.id} className="p-3 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">{c.competitor_name}</span>
                        <span className="text-xs text-muted-foreground">{c.last_updated ? new Date(c.last_updated).toLocaleDateString() : ""}</span>
                      </div>
                      {c.pricing_model && <p className="text-xs"><span className="text-muted-foreground">Pricing:</span> {c.pricing_model}</p>}
                      {c.positioning && <p className="text-xs"><span className="text-muted-foreground">Positioning:</span> {c.positioning}</p>}
                      {c.guarantees && <p className="text-xs"><span className="text-muted-foreground">Guarantees:</span> {c.guarantees}</p>}
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(c.weaknesses) && c.weaknesses.map((w: string, i: number) => (
                          <Badge key={i} className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">⚠ {w}</Badge>
                        ))}
                        {Array.isArray(c.strengths) && c.strengths.map((s: string, i: number) => (
                          <Badge key={i} className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">✓ {s}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NEW: Offer Variants ── */}
        <TabsContent value="offers" className="space-y-4">
          <Card className="border-amber-500/20">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Tag className="h-4 w-4 text-amber-400" /> Offer Variants
              </CardTitle>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => optimizeOffers.mutate()} disabled={optimizeOffers.isPending}>
                <Zap className="h-3 w-3 mr-1" /> {optimizeOffers.isPending ? "Optimizing…" : "Auto-Optimize"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="Offer name" value={newOfferName} onChange={e => setNewOfferName(e.target.value)} className="flex-1" />
                <Input placeholder="Price" type="number" value={newOfferPrice} onChange={e => setNewOfferPrice(e.target.value)} className="w-24" />
                <Input placeholder="Headline" value={newOfferHeadline} onChange={e => setNewOfferHeadline(e.target.value)} className="flex-1" />
                <Button size="sm" onClick={() => {
                  if (!newOfferName || !newOfferPrice) return;
                  createOffer.mutate({ offer_name: newOfferName, pricing: Number(newOfferPrice), headline: newOfferHeadline });
                  setNewOfferName(""); setNewOfferPrice(""); setNewOfferHeadline("");
                }}>Test</Button>
              </div>
              <ScrollArea className="h-[350px]">
                <div className="space-y-2">
                  {offers.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No offer variants yet</p>}
                  {offers.map((o: any, i: number) => (
                    <div key={o.id} className={`p-3 rounded-lg border bg-card flex items-center justify-between ${
                      o.status === "winning" ? "border-emerald-500/30" : o.status === "losing" ? "border-destructive/30" : ""
                    }`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {o.status === "winning" && <Star className="h-3 w-3 text-emerald-400" />}
                          <span className="text-sm font-medium">{o.offer_name}</span>
                          <Badge variant="outline" className={`text-xs capitalize ${
                            o.status === "winning" ? "text-emerald-400 border-emerald-500/30" :
                            o.status === "losing" ? "text-destructive border-destructive/30" : ""
                          }`}>{o.status}</Badge>
                        </div>
                        {o.headline && <p className="text-xs text-muted-foreground italic">"{o.headline}"</p>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-right">
                        <div>
                          <p className="font-bold">${o.pricing}</p>
                          <p className="text-muted-foreground">price</p>
                        </div>
                        <div>
                          <p className="font-bold">{o.exposure_count || 0}</p>
                          <p className="text-muted-foreground">exposed</p>
                        </div>
                        <div>
                          <p className={`font-bold ${(o.sample_size || 0) >= 20 ? "text-emerald-400" : "text-amber-400"}`}>{o.sample_size || 0}</p>
                          <p className="text-muted-foreground">n</p>
                        </div>
                        <div>
                          <p className={`font-bold ${o.conversion_rate >= 15 ? "text-emerald-400" : ""}`}>{Math.round(o.conversion_rate || 0)}%</p>
                          <p className="text-muted-foreground">conv</p>
                        </div>
                        <div>
                          <p className="font-bold text-emerald-400">${Math.round(o.revenue_generated || 0)}</p>
                          <p className="text-muted-foreground">rev</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NEW: Pricing Tests ── */}
        <TabsContent value="pricing" className="space-y-4">
          <Card className="border-green-500/20">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-400" /> Pricing Experiments
              </CardTitle>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => evaluatePricing.mutate()} disabled={evaluatePricing.isPending}>
                <Zap className="h-3 w-3 mr-1" /> Evaluate Running
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px]">
                <div className="space-y-2">
                  {pricingTests.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No pricing tests yet</p>}
                  {pricingTests.map((t: any) => (
                    <div key={t.id} className={`p-3 rounded-lg border bg-card flex items-center justify-between ${
                      t.test_status === "winner" ? "border-emerald-500/30" : t.test_status === "loser" ? "border-destructive/30" : ""
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Base</p>
                          <p className="font-bold">${t.base_price}</p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Test</p>
                          <p className="font-bold">${t.test_price}</p>
                        </div>
                        {t.segment && <Badge variant="outline" className="text-xs">{t.segment}</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="text-right">
                          <p className="font-bold">{t.exposure_count || 0}</p>
                          <p className="text-muted-foreground">exposed</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${(t.exposure_count || 0) >= 20 ? "" : "text-amber-400"}`}>{Math.round(t.conversion_rate || 0)}%</p>
                          <p className="text-muted-foreground">conv</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">${Math.round(t.revenue_per_lead || 0)}</p>
                          <p className="text-muted-foreground">RPL</p>
                        </div>
                        <Badge variant="outline" className={`text-xs capitalize ${
                          t.test_status === "winner" ? "text-emerald-400" :
                          t.test_status === "loser" ? "text-destructive" :
                          t.test_status === "insufficient_data" ? "text-amber-400" : ""
                        }`}>{t.test_status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NEW: Positioning Tests ── */}
        <TabsContent value="positioning" className="space-y-4">
          <Card className="border-purple-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Crosshair className="h-4 w-4 text-purple-400" /> Positioning & Messaging Tests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px]">
                <div className="space-y-2">
                  {positioningTests.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No positioning tests yet</p>}
                  {positioningTests.map((p: any) => (
                    <div key={p.id} className="p-3 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{p.positioning_angle}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`font-bold ${(p.win_rate || 0) >= 50 ? "text-emerald-400" : ""}`}>{Math.round(p.win_rate || 0)}% win</span>
                          <span className="text-muted-foreground">{Math.round(p.engagement_rate || 0)}% engage</span>
                          <span className="text-muted-foreground">{Math.round(p.conversion_rate || 0)}% conv</span>
                        </div>
                      </div>
                      {p.headline && <p className="text-xs italic text-muted-foreground">"{p.headline}"</p>}
                      {p.script_variant && <p className="text-xs text-muted-foreground">{p.script_variant}</p>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NEW: System Decisions Log ── */}
        <TabsContent value="decisions" className="space-y-4">
          <Card className="border-cyan-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4 text-cyan-400" /> System Decision Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {decisions.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No decisions logged yet</p>}
                  {decisions.map((d: any) => (
                    <div key={d.id} className="p-3 rounded-lg border bg-card space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize">{d.decision_type?.replace(/_/g, " ")}</Badge>
                          <span className="text-sm font-medium">{d.action_taken}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {d.impact_score > 0 && (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
                              +{d.impact_score} impact
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      {d.decision_reason && <p className="text-xs text-muted-foreground">{d.decision_reason}</p>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Personality Engine ── */}
        <TabsContent value="personalities" className="space-y-4">
          {/* Create Personality */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-primary" /> Create Sales Personality
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant={ingestMode === "manual" ? "default" : "outline"} className="h-6 text-xs" onClick={() => setIngestMode("manual")}>Manual</Button>
                  <Button size="sm" variant={ingestMode === "transcript" ? "default" : "outline"} className="h-6 text-xs" onClick={() => setIngestMode("transcript")}>From Transcript</Button>
                  <Button size="sm" variant={ingestMode === "description" ? "default" : "outline"} className="h-6 text-xs" onClick={() => setIngestMode("description")}>AI Generate</Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ingestMode === "transcript" && (
                <>
                  <Input placeholder="Personality name (optional)" value={ingestName} onChange={e => setIngestName(e.target.value)} />
                  <Textarea placeholder="Paste sales transcript, script, or ad copy here..." value={ingestText} onChange={e => setIngestText(e.target.value)} rows={5} />
                  <Button size="sm" disabled={!ingestText || ingestFromTranscript.isPending} onClick={() => {
                    ingestFromTranscript.mutate({ input_text: ingestText, personality_name: ingestName || undefined });
                    setIngestText(""); setIngestName("");
                  }}>
                    {ingestFromTranscript.isPending ? "Extracting..." : "🧠 Extract Personality"}
                  </Button>
                </>
              )}
              {ingestMode === "description" && (
                <>
                  <Input placeholder="Personality name (optional)" value={ingestName} onChange={e => setIngestName(e.target.value)} />
                  <Textarea placeholder="Describe the personality (e.g. 'High-energy closer with strong ROI logic and urgency')" value={ingestText} onChange={e => setIngestText(e.target.value)} rows={3} />
                  <Button size="sm" disabled={!ingestText || generateFromDescription.isPending} onClick={() => {
                    generateFromDescription.mutate({ description: ingestText, personality_name: ingestName || undefined });
                    setIngestText(""); setIngestName("");
                  }}>
                    {generateFromDescription.isPending ? "Generating..." : "⚡ AI Generate Personality"}
                  </Button>
                </>
              )}
              {ingestMode === "manual" && (
                <>
              <Input placeholder="Name (e.g. Tony Robbins Style)" value={newPersonaName} onChange={e => setNewPersonaName(e.target.value)} />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Select value={newPersonaTone} onValueChange={setNewPersonaTone}>
                  <SelectTrigger><SelectValue placeholder="Tone" /></SelectTrigger>
                  <SelectContent>
                    {["energetic","calm","aggressive","logical","confident","empathetic","authoritative"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newPersonaCadence} onValueChange={setNewPersonaCadence}>
                  <SelectTrigger><SelectValue placeholder="Cadence" /></SelectTrigger>
                  <SelectContent>
                    {["fast","medium","slow"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newPersonaPersuasion} onValueChange={setNewPersonaPersuasion}>
                  <SelectTrigger><SelectValue placeholder="Persuasion" /></SelectTrigger>
                  <SelectContent>
                    {["emotional","logical","authority","curiosity"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newPersonaObjection} onValueChange={setNewPersonaObjection}>
                  <SelectTrigger><SelectValue placeholder="Objection Style" /></SelectTrigger>
                  <SelectContent>
                    {["reframe","challenge","validate","redirect"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newPersonaClosing} onValueChange={setNewPersonaClosing}>
                  <SelectTrigger><SelectValue placeholder="Closing Style" /></SelectTrigger>
                  <SelectContent>
                    {["direct","assumptive","soft","urgency-driven"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newPersonaEnergy} onValueChange={setNewPersonaEnergy}>
                  <SelectTrigger><SelectValue placeholder="Energy" /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <SelectItem key={n} value={String(n)}>⚡ {n}/10</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                disabled={!newPersonaName}
                onClick={() => {
                  createPersonality.mutate({
                    name: newPersonaName,
                    tone: newPersonaTone,
                    cadence: newPersonaCadence,
                    persuasion_style: newPersonaPersuasion,
                    objection_style: newPersonaObjection,
                    closing_style: newPersonaClosing,
                    energy_level: parseInt(newPersonaEnergy),
                  });
                  setNewPersonaName("");
                }}
              >
                <Zap className="h-3 w-3 mr-1" /> Create Personality
              </Button>
                </>
              )}
              {personalities.length === 0 && (
                <Button size="sm" variant="outline" disabled={seedStarters.isPending} onClick={() => seedStarters.mutate()}>
                  {seedStarters.isPending ? "Deploying..." : "🚀 Deploy 5 Starter Personalities"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Active Personalities */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active Personalities ({personalities.filter((p: any) => p.is_active).length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {personalities.map((p: any) => (
                    <div key={p.id} className={`rounded-lg border p-3 space-y-1 ${p.is_active ? 'border-primary/30 bg-primary/5' : 'border-muted opacity-60'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{p.nickname || p.name}</span>
                          {p.archetype && <Badge className="text-xs bg-accent/50 text-accent-foreground">{p.archetype}</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{p.tone}</Badge>
                          <Badge variant="secondary" className="text-xs">⚡{p.energy_level}</Badge>
                          <Button
                            size="sm"
                            variant={p.is_active ? "destructive" : "default"}
                            className="h-6 text-xs"
                            onClick={() => togglePersonality.mutate({ id: p.id, is_active: !p.is_active })}
                          >
                            {p.is_active ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </div>
                      {p.name !== p.nickname && p.nickname && <p className="text-xs text-muted-foreground">{p.name}</p>}
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Persuasion: {p.persuasion_style}</span>
                        <span className="text-xs text-muted-foreground">Objection: {p.objection_style}</span>
                        <span className="text-xs text-muted-foreground">Close: {p.closing_style}</span>
                        <span className="text-xs text-muted-foreground">Cadence: {p.cadence}</span>
                      </div>
                      {p.inspiration_tags?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {p.inspiration_tags.map((tag: string, i: number) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {personalities.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No personalities created yet</p>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Test Personality */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" /> Test Personality Response
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Select value={testPersonalityId} onValueChange={setTestPersonalityId}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select personality" /></SelectTrigger>
                  <SelectContent>
                    {personalities.filter((p: any) => p.is_active).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="Enter sample transcript (e.g. 'I think it's too expensive for what you're offering')"
                value={testTranscript}
                onChange={e => setTestTranscript(e.target.value)}
                rows={2}
              />
              <Button
                size="sm"
                disabled={!testTranscript || generatePersonalityResponse.isPending}
                onClick={async () => {
                  const result = await generatePersonalityResponse.mutateAsync({
                    transcript_chunk: testTranscript,
                    personality_id: testPersonalityId || undefined,
                  });
                  setTestResult(result);
                }}
              >
                {generatePersonalityResponse.isPending ? "Generating..." : "Test Response"}
              </Button>
              {testResult && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <p className="text-sm font-medium">{testResult.response_text}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">Tone: {testResult.tone}</Badge>
                    <Badge variant="outline" className="text-xs">Strategy: {testResult.strategy_used}</Badge>
                    <Badge variant="outline" className="text-xs">Persona: {testResult.personality_used}</Badge>
                    <Badge variant="outline" className="text-xs">Mood: {testResult.mood}</Badge>
                    <Badge variant="outline" className="text-xs">Confidence: {testResult.confidence_score}%</Badge>
                    {testResult.should_close_now && <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">🎯 CLOSE NOW</Badge>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Strategy Frameworks */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Strategy Frameworks ({frameworks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {frameworks.map((f: any) => (
                    <div key={f.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{f.name}</span>
                        <Badge variant="secondary" className="text-xs">{f.success_rate}% success</Badge>
                      </div>
                      {f.best_use_case && <p className="text-xs text-muted-foreground mt-1">{f.best_use_case}</p>}
                    </div>
                  ))}
                  {frameworks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No frameworks yet</p>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Recordings ── */}
        <TabsContent value="recordings" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mic className="h-4 w-4 text-primary" /> Call Recordings ({recordingsWithAudio.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={recordingsFilter || "all"} onValueChange={v => setRecordingsFilter(v === "all" ? undefined : v)}>
                  <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Filter by VA" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All VAs</SelectItem>
                    {uniqueVAs.map((va: any) => (
                      <SelectItem key={va.id} value={va.id}>{va.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSyncRecordings}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Sync Twilio
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingRecordings ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading recordings…</p>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {recordingsWithAudio.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">No recordings found. Click "Sync Twilio" to fetch from Twilio.</p>
                    )}
                    {recordingsWithAudio.map((call: any) => (
                      <div key={call.id} className="p-3 rounded-lg border bg-card space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <PlayCircle className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">{call.va_name}</span>
                            <Badge variant="outline" className="text-xs">{call.disposition || call.call_status || "N/A"}</Badge>
                            {call.direction && <Badge variant="secondary" className="text-xs">{call.direction}</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{formatDuration(call.duration_seconds)}</span>
                            <span className="text-xs text-muted-foreground">
                              {call.called_at ? new Date(call.called_at).toLocaleString() : "—"}
                            </span>
                          </div>
                        </div>
                        <RecordingPlayer recordingUrl={call.recording_url} compact />
                        {call.notes && <p className="text-xs text-muted-foreground">{call.notes}</p>}
                        {call.transcript && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => setExpandedCallId(expandedCallId === call.id ? null : call.id)}
                          >
                            <FileText className="h-3 w-3 mr-1" /> {expandedCallId === call.id ? "Hide" : "Show"} Transcript
                          </Button>
                        )}
                        {expandedCallId === call.id && call.transcript && (
                          <div className="p-3 rounded bg-muted/50 text-xs whitespace-pre-wrap font-mono max-h-[300px] overflow-auto">
                            {call.transcript}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Transcripts ── */}
        <TabsContent value="transcripts" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Call Transcripts ({recordingsWithTranscripts.length})
              </CardTitle>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSyncRecordings}>
                <RefreshCw className="h-3 w-3 mr-1" /> Sync Transcripts
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {recordingsWithTranscripts.length === 0 && (
                    <div className="text-center py-8 space-y-2">
                      <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                      <p className="text-sm text-muted-foreground">No transcripts available yet</p>
                      <p className="text-xs text-muted-foreground/60">Transcripts are fetched automatically from Twilio after calls complete</p>
                    </div>
                  )}
                  {recordingsWithTranscripts.map((call: any) => (
                    <div key={call.id} className="p-4 rounded-lg border bg-card space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{call.va_name}</span>
                          <Badge variant="outline" className="text-xs">{call.disposition || call.call_status}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDuration(call.duration_seconds)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {call.called_at ? new Date(call.called_at).toLocaleString() : "—"}
                        </span>
                      </div>
                      <div className="p-3 rounded bg-muted/50 text-xs whitespace-pre-wrap font-mono max-h-[400px] overflow-auto leading-relaxed">
                        {call.transcript}
                      </div>
                      {call.recording_url && (
                        <RecordingPlayer recordingUrl={call.recording_url} compact />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── DB Live Leaderboard ── */}
        <TabsContent value="db-leaderboard" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" /> Live VA Leaderboard — Today
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => refetchLeaderboard()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {dbLeaderboard.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Trophy className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">No call data yet for today</p>
                  <p className="text-xs text-muted-foreground/60">Stats update automatically as VAs make calls</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground text-xs border-b border-border/50">
                        <th className="text-left p-3 font-medium">#</th>
                        <th className="text-left p-3 font-medium">VA</th>
                        <th className="text-center p-3 font-medium">Dialed</th>
                        <th className="text-center p-3 font-medium">Answered</th>
                        <th className="text-center p-3 font-medium">Closed</th>
                        <th className="text-center p-3 font-medium">Answer %</th>
                        <th className="text-center p-3 font-medium">Close %</th>
                        <th className="text-center p-3 font-medium">Talk Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbLeaderboard.map((entry: any, idx: number) => {
                        const answerRate = entry.calls_dialed > 0 ? Math.round((entry.calls_answered / entry.calls_dialed) * 100) : 0;
                        const closeRate = entry.calls_answered > 0 ? Math.round((entry.calls_closed / entry.calls_answered) * 100) : 0;
                        return (
                          <tr key={entry.va_id} className={`border-b border-border/30 ${idx < 3 ? "bg-accent/10" : ""}`}>
                            <td className="p-3">
                              <span className={`font-bold ${idx === 0 ? "text-amber-400" : idx === 1 ? "text-gray-400" : idx === 2 ? "text-orange-700" : "text-muted-foreground"}`}>
                                #{idx + 1}
                              </span>
                            </td>
                            <td className="p-3 font-medium">{entry.va_name}</td>
                            <td className="text-center p-3 tabular-nums text-muted-foreground">{entry.calls_dialed}</td>
                            <td className="text-center p-3 tabular-nums text-muted-foreground">{entry.calls_answered}</td>
                            <td className="text-center p-3 tabular-nums font-bold text-green-400">{entry.calls_closed}</td>
                            <td className="text-center p-3 tabular-nums text-muted-foreground">{answerRate}%</td>
                            <td className="text-center p-3 tabular-nums text-muted-foreground">{closeRate}%</td>
                            <td className="text-center p-3 tabular-nums text-muted-foreground">{formatDuration(entry.total_talk_time)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
