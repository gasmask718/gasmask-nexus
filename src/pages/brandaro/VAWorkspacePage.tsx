import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Phone, PhoneForwarded, Send, Clock, Star, MapPin,
  MessageSquare, ChevronRight, ChevronLeft, SkipForward,
  FileText, Zap, Shield, Brain, ArrowRight, CheckCircle2,
  AlertTriangle, Target, Lightbulb
} from "lucide-react";

const CALL_OUTCOMES = [
  { value: "no_answer", label: "No Answer", color: "secondary" },
  { value: "voicemail", label: "Voicemail", color: "secondary" },
  { value: "wrong_number", label: "Wrong Number", color: "destructive" },
  { value: "not_interested", label: "Not Interested", color: "destructive" },
  { value: "callback_requested", label: "Callback", color: "default" },
  { value: "send_information", label: "Send Info", color: "default" },
  { value: "interested", label: "Interested", color: "default" },
  { value: "hot_lead", label: "🔥 Hot Lead", color: "default" },
  { value: "sold", label: "💰 Sold!", color: "default" },
  { value: "do_not_call", label: "DNC", color: "destructive" },
] as const;

const RETRY_MAP: Record<string, number> = {
  no_answer: 4 * 60,
  voicemail: 24 * 60,
  callback_requested: 0,
  send_information: 48 * 60,
};

const LEAD_TAGS = [
  { value: "no_website", label: "No Website" },
  { value: "outdated_website", label: "Outdated Website" },
  { value: "not_converting", label: "Not Converting" },
];

export default function VAWorkspacePage() {
  const queryClient = useQueryClient();
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [callbackTime, setCallbackTime] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [activeObjection, setActiveObjection] = useState<string | null>(null);
  const [selectedObjections, setSelectedObjections] = useState<string[]>([]);
  const [leadTag, setLeadTag] = useState<string>("");

  // Fetch script steps from DB
  const { data: scriptSteps = [] } = useQuery({
    queryKey: ["brandaro-script-steps"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_sales_script_steps")
        .select("*")
        .eq("is_active", true)
        .eq("is_current", true)
        .is("industry_type", null)
        .order("step_number", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch objection handlers from DB
  const { data: objectionHandlers = [] } = useQuery({
    queryKey: ["brandaro-objection-handlers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_objection_handlers")
        .select("*")
        .eq("is_active", true)
        .is("industry_type", null)
        .order("effectiveness_score", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Get next lead from queue
  const { data: nextInQueue } = useQuery({
    queryKey: ["brandaro-next-queue"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("brandaro_call_queue")
        .select(`*, brandaro_qualified_leads(*)`)
        .eq("is_active", true)
        .lte("next_call_time", now)
        .order("priority_tier", { ascending: true })
        .order("priority_score", { ascending: false })
        .order("next_call_time", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const currentQueueItem = nextInQueue?.find((q: any) => q.lead_id === currentLeadId) || nextInQueue?.[0];
  const currentLead = currentQueueItem?.brandaro_qualified_leads;

  useEffect(() => {
    if (!currentLeadId && nextInQueue?.length) {
      setCurrentLeadId(nextInQueue[0].lead_id);
      setCurrentStep(0);
      setActiveObjection(null);
    }
  }, [nextInQueue, currentLeadId]);

  // Call history
  const { data: callHistory = [] } = useQuery({
    queryKey: ["brandaro-lead-history", currentLeadId],
    queryFn: async () => {
      if (!currentLeadId) return [];
      const { data, error } = await supabase
        .from("brandaro_call_logs")
        .select("*")
        .eq("lead_id", currentLeadId)
        .order("call_timestamp", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentLeadId,
  });

  // Log call mutation
  const logCallMutation = useMutation({
    mutationFn: async () => {
      if (!outcome || !currentLeadId) throw new Error("Select an outcome");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const attemptNumber = (callHistory.length || 0) + 1;
      let nextCallTime: string | null = null;
      const retryMinutes = RETRY_MAP[outcome];
      if (retryMinutes) nextCallTime = new Date(Date.now() + retryMinutes * 60000).toISOString();
      if (outcome === "callback_requested" && callbackTime) nextCallTime = new Date(callbackTime).toISOString();

      // Track which objection handlers were used
      if (selectedObjections.length > 0) {
        for (const objKey of selectedObjections) {
          const handler = objectionHandlers.find((h: any) => h.objection_key === objKey);
          if (handler) {
            await (supabase as any).from("brandaro_objection_handlers").update({
              times_used: (handler.times_used || 0) + 1,
              times_converted: (outcome === "interested" || outcome === "hot_lead" || outcome === "sold")
                ? (handler.times_converted || 0) + 1
                : handler.times_converted,
            }).eq("id", handler.id);
          }
        }
      }

      const { data: logData, error: logErr } = await supabase.from("brandaro_call_logs").insert({
        lead_id: currentLeadId,
        call_attempt_number: attemptNumber,
        called_by_user_id: user.id,
        call_outcome: outcome,
        call_notes: notes || null,
        objection_tags: selectedObjections,
        next_action: outcome === "interested" ? "demo_generation" : outcome === "callback_requested" ? "callback" : null,
        next_call_time: nextCallTime,
        industry_context: currentLead?.industry,
      }).select("id").single();
      if (logErr) throw logErr;

      if (notes && logData?.id) {
        supabase.functions.invoke("brandaro-call-analyzer", {
          body: { call_log_id: logData.id },
        }).catch(err => console.warn("Call analyzer failed:", err));
      }

      const leadUpdate: any = {
        call_attempts: attemptNumber,
        last_called_at: new Date().toISOString(),
      };
      if (leadTag) leadUpdate.lead_qualification_tag = leadTag;
      if (outcome === "interested" || outcome === "hot_lead") {
        leadUpdate.lead_status = "interested";
        leadUpdate.demo_status = "pending";
      } else if (outcome === "sold") {
        leadUpdate.lead_status = "sold";
      } else if (outcome === "wrong_number" || outcome === "do_not_call") {
        leadUpdate.lead_status = outcome;
      } else if (outcome === "not_interested") {
        leadUpdate.lead_status = "not_interested";
      }

      await supabase.from("brandaro_qualified_leads").update(leadUpdate).eq("id", currentLeadId);

      const shouldRemove = ["interested", "hot_lead", "sold", "wrong_number", "do_not_call", "not_interested"].includes(outcome);
      if (shouldRemove) {
        await supabase.from("brandaro_call_queue").update({ is_active: false }).eq("lead_id", currentLeadId);
      } else if (nextCallTime) {
        await supabase.from("brandaro_call_queue").update({
          next_call_time: nextCallTime,
          retry_count: attemptNumber,
        }).eq("lead_id", currentLeadId);
      }

      if (outcome === "callback_requested" && callbackTime) {
        await supabase.from("brandaro_callbacks").insert({
          lead_id: currentLeadId,
          scheduled_time: new Date(callbackTime).toISOString(),
          assigned_va: user.id,
          reason: notes || "Callback requested by prospect",
        });
      }

      return outcome;
    },
    onSuccess: (savedOutcome) => {
      const msgs: Record<string, string> = {
        interested: "🎯 Lead marked interested! Demo pipeline triggered.",
        hot_lead: "🔥 Hot lead captured!",
        sold: "💰 Deal closed!",
      };
      toast.success(msgs[savedOutcome] || "Call logged successfully");
      resetState();
      queryClient.invalidateQueries({ queryKey: ["brandaro-next-queue"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-call-stats-today"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-lead-history"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const resetState = () => {
    setOutcome("");
    setNotes("");
    setCallbackTime("");
    setCurrentLeadId(null);
    setCurrentStep(0);
    setActiveObjection(null);
    setSelectedObjections([]);
    setLeadTag("");
  };

  const skipLead = () => {
    const nextIdx = nextInQueue?.findIndex((q: any) => q.lead_id === currentLeadId);
    const next = nextInQueue?.[(nextIdx || 0) + 1];
    if (next) {
      setCurrentLeadId(next.lead_id);
      setCurrentStep(0);
      setActiveObjection(null);
      setOutcome("");
      setNotes("");
      setLeadTag("");
      setSelectedObjections([]);
    } else {
      toast.info("No more leads in queue");
    }
  };

  const activeStep = scriptSteps[currentStep];

  if (!currentLead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
        <Phone className="h-16 w-16 mb-4 opacity-30" />
        <h2 className="text-xl font-semibold mb-2">No Leads in Queue</h2>
        <p>All leads have been called or the queue needs to be populated.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left Column: Lead + Outcome (4 cols) */}
      <div className="lg:col-span-4 space-y-4">
        {/* Lead Card */}
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg truncate">{currentLead.business_name}</CardTitle>
              <div className="flex gap-1">
                <Badge variant="outline" className="text-[10px]">T{currentQueueItem?.priority_tier || "?"}</Badge>
                <Badge variant="secondary" className="text-[10px]">#{(callHistory.length || 0) + 1}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono font-bold text-lg">{currentLead.phone_number || "No phone"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span>{currentLead.city}, {currentLead.state}</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-500" />
                <span>{currentLead.rating || "N/A"} ({currentLead.review_count || 0})</span>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">{currentLead.industry || "Unknown"}</Badge>

            {callHistory.length > 0 && (
              <div className="p-2 bg-muted rounded text-xs mt-2">
                <p className="font-medium text-muted-foreground">Last: {callHistory[0].call_outcome}</p>
                {callHistory[0].call_notes && <p className="text-muted-foreground mt-1">{callHistory[0].call_notes}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Tagging */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" /> Lead Tag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_TAGS.map((tag) => (
                <Button
                  key={tag.value}
                  variant={leadTag === tag.value ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setLeadTag(leadTag === tag.value ? "" : tag.value)}
                >
                  {tag.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Outcome + Notes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Log Outcome</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              {CALL_OUTCOMES.map((o) => (
                <Button
                  key={o.value}
                  variant={outcome === o.value ? "default" : "outline"}
                  size="sm"
                  className="text-[11px] h-7"
                  onClick={() => setOutcome(o.value)}
                >
                  {o.label}
                </Button>
              ))}
            </div>

            {outcome === "callback_requested" && (
              <Input
                type="datetime-local"
                value={callbackTime}
                onChange={(e) => setCallbackTime(e.target.value)}
                className="text-xs"
              />
            )}

            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Call notes..."
              rows={2}
              className="text-xs"
            />

            <div className="flex gap-2">
              <Button
                onClick={() => logCallMutation.mutate()}
                disabled={!outcome || logCallMutation.isPending}
                className="flex-1 h-9"
                size="sm"
              >
                <ChevronRight className="h-4 w-4 mr-1" />
                {logCallMutation.isPending ? "Logging..." : "Log & Next"}
              </Button>
              <Button variant="outline" size="sm" onClick={skipLead}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            {(outcome === "interested" || outcome === "hot_lead") && (
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="secondary" size="sm" className="flex-1 text-xs">
                  <Send className="h-3 w-3 mr-1" /> Send Demo
                </Button>
                <Button variant="secondary" size="sm" className="flex-1 text-xs">
                  <PhoneForwarded className="h-3 w-3 mr-1" /> Escalate
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Queue */}
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{nextInQueue?.length || 0}</p>
              <p className="text-xs text-muted-foreground">leads ready</p>
            </div>
            <Zap className="h-6 w-6 text-primary opacity-50" />
          </CardContent>
        </Card>
      </div>

      {/* Center Column: Guided Script Flow (5 cols) */}
      <div className="lg:col-span-5 space-y-4">
        {/* Step Progress */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {scriptSteps.map((step: any, idx: number) => (
                <button
                  key={step.id}
                  onClick={() => { setCurrentStep(idx); setActiveObjection(null); }}
                  className={`flex-shrink-0 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                    idx === currentStep
                      ? "bg-primary text-primary-foreground shadow-md"
                      : idx < currentStep
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.display_label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active Script Step */}
        {activeStep && (
          <Card className="border-primary/40 shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Step {activeStep.step_number}: {activeStep.step_name}
                </CardTitle>
                {activeStep.wait_for_response && (
                  <Badge variant="outline" className="text-[10px]">
                    <MessageSquare className="h-3 w-3 mr-1" /> Wait for response
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* What to say */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm font-medium text-primary mb-2">Say this:</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {activeStep.va_says.replace(/\[Name\]/g, currentLead?.business_name?.split(/\s/)[0] || "[Name]")}
                </p>
              </div>

              {/* Coaching tip */}
              {activeStep.coaching_tip && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">{activeStep.coaching_tip}</p>
                </div>
              )}

              {/* Auto-tag indicator */}
              {activeStep.tag_lead_as && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  If positive → tags lead as <Badge variant="outline" className="text-[10px]">{activeStep.tag_lead_as}</Badge>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentStep === 0}
                  onClick={() => { setCurrentStep(s => s - 1); setActiveObjection(null); }}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={currentStep >= scriptSteps.length - 1}
                  onClick={() => { setCurrentStep(s => s + 1); setActiveObjection(null); }}
                >
                  Next Step <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Objection Handling Panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-500" /> Objection Handler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Objection buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              {objectionHandlers.map((handler: any) => (
                <Button
                  key={handler.id}
                  variant={activeObjection === handler.objection_key ? "default" : "outline"}
                  size="sm"
                  className={`text-[11px] h-8 ${
                    selectedObjections.includes(handler.objection_key) ? "ring-2 ring-red-400" : ""
                  }`}
                  onClick={() => {
                    setActiveObjection(
                      activeObjection === handler.objection_key ? null : handler.objection_key
                    );
                    if (!selectedObjections.includes(handler.objection_key)) {
                      setSelectedObjections(prev => [...prev, handler.objection_key]);
                    }
                  }}
                >
                  {handler.objection_label}
                </Button>
              ))}
            </div>

            {/* Active objection response */}
            {activeObjection && (() => {
              const handler = objectionHandlers.find((h: any) => h.objection_key === activeObjection);
              if (!handler) return null;
              return (
                <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Respond with:</p>
                    <p className="text-sm leading-relaxed">{handler.va_response}</p>
                  </div>

                  {handler.follow_up_question && (
                    <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Then ask:</p>
                      <p className="text-sm">{handler.follow_up_question}</p>
                    </div>
                  )}

                  {handler.coaching_tip && (
                    <div className="flex items-start gap-2 p-2 bg-muted rounded">
                      <Brain className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] text-muted-foreground">{handler.coaching_tip}</p>
                    </div>
                  )}

                  {handler.effectiveness_score > 0 && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>Effectiveness: {handler.effectiveness_score}%</span>
                      {handler.times_used > 0 && (
                        <span>• Used {handler.times_used}x • Converted {handler.times_converted || 0}x</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: History + Coaching (3 cols) */}
      <div className="lg:col-span-3 space-y-4">
        {/* AI Coaching Sidebar */}
        <Card className="border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" /> AI Coach
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {/* Contextual coaching based on current step */}
            {currentStep <= 1 && (
              <div className="p-2 bg-purple-500/5 border border-purple-500/10 rounded">
                <p className="font-medium text-purple-600 dark:text-purple-400">🎯 Opening Tips</p>
                <p className="text-muted-foreground mt-1">
                  Smile while you talk — they can hear it. Keep energy matching theirs. If they sound busy, be fast. If relaxed, be conversational.
                </p>
              </div>
            )}
            {currentStep === 2 && (
              <div className="p-2 bg-purple-500/5 border border-purple-500/10 rounded">
                <p className="font-medium text-purple-600 dark:text-purple-400">✅ Qualifying</p>
                <p className="text-muted-foreground mt-1">
                  Listen for pain signals: "we tried...", "it didn't work...", "we're too busy to..." — these are buying signals.
                </p>
              </div>
            )}
            {currentStep === 3 && (
              <div className="p-2 bg-purple-500/5 border border-purple-500/10 rounded">
                <p className="font-medium text-purple-600 dark:text-purple-400">⚡ Problem Phase</p>
                <p className="text-muted-foreground mt-1">
                  Let the problem statement land. Pause 2 seconds after. Silence creates urgency. Don't rush to the offer.
                </p>
              </div>
            )}
            {currentStep >= 4 && currentStep <= 5 && (
              <div className="p-2 bg-purple-500/5 border border-purple-500/10 rounded">
                <p className="font-medium text-purple-600 dark:text-purple-400">🤝 Closing Zone</p>
                <p className="text-muted-foreground mt-1">
                  You're in the zone. Be assumptive. Don't ask "would you like to..." — say "let me send you..."
                </p>
              </div>
            )}
            {currentStep >= 6 && (
              <div className="p-2 bg-green-500/5 border border-green-500/10 rounded">
                <p className="font-medium text-green-600 dark:text-green-400">💰 Close It</p>
                <p className="text-muted-foreground mt-1">
                  Confidence is everything. No hesitation. Act like it's already decided. "I'll send that right over."
                </p>
              </div>
            )}

            {/* Objection alert */}
            {selectedObjections.length > 0 && (
              <div className="p-2 bg-amber-500/5 border border-amber-500/10 rounded">
                <p className="font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Objections Detected
                </p>
                <p className="text-muted-foreground mt-1">
                  {selectedObjections.length} objection{selectedObjections.length > 1 ? "s" : ""} handled. 
                  {selectedObjections.length >= 3 
                    ? " Multiple objections = low interest. Consider moving on."
                    : " Stay calm, keep guiding to the close."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Call History */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              {callHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">First call attempt</p>
              ) : (
                <div className="space-y-2">
                  {callHistory.map((log: any) => (
                    <div key={log.id} className="text-xs p-2 bg-muted rounded">
                      <div className="flex justify-between">
                        <Badge variant="outline" className="text-[10px]">{log.call_outcome}</Badge>
                        <span className="text-muted-foreground">{new Date(log.call_timestamp).toLocaleDateString()}</span>
                      </div>
                      {log.call_notes && <p className="mt-1 text-muted-foreground">{log.call_notes}</p>}
                      {log.objection_tags?.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {log.objection_tags.map((t: string) => (
                            <Badge key={t} variant="secondary" className="text-[9px]">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
