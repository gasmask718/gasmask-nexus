import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Phone, PhoneForwarded, Send, Clock, Star, MapPin,
  MessageSquare, ChevronRight, SkipForward, FileText, Zap
} from "lucide-react";

const CALL_OUTCOMES = [
  { value: "no_answer", label: "No Answer", color: "secondary" },
  { value: "voicemail", label: "Voicemail", color: "secondary" },
  { value: "wrong_number", label: "Wrong Number", color: "destructive" },
  { value: "not_interested", label: "Not Interested", color: "destructive" },
  { value: "callback_requested", label: "Callback Requested", color: "default" },
  { value: "send_information", label: "Send Information", color: "default" },
  { value: "interested", label: "Interested", color: "default" },
  { value: "hot_lead", label: "🔥 Hot Lead", color: "default" },
  { value: "sold", label: "💰 Sold!", color: "default" },
  { value: "do_not_call", label: "Do Not Call", color: "destructive" },
] as const;

const RETRY_MAP: Record<string, number> = {
  no_answer: 4 * 60,       // 4 hours in minutes
  voicemail: 24 * 60,      // next day
  callback_requested: 0,   // manual
  send_information: 48 * 60,
};

const SCRIPTS: Record<string, { intro: string; problem: string; offer: string; rebuttals: string[] }> = {
  default: {
    intro: "Hi, this is [Your Name] from Brandaro Digital. I'm reaching out because I noticed your business doesn't have a website yet, and I wanted to show you something that could bring in more customers.",
    problem: "Most people search online before visiting a business. Without a website, you're invisible to a large number of potential customers looking for your services right now.",
    offer: "We actually put together a free preview of what your website could look like. Can I send it over so you can see it? No obligation at all.",
    rebuttals: [
      "\"I don't need a website\" → That's what many of our clients said too, until they saw how many calls they were missing. Can I at least send the free preview?",
      "\"I'm too busy\" → I completely understand. That's exactly why we handle everything. Can I send you a quick preview to look at when you have a moment?",
      "\"How much does it cost?\" → Our packages start at just $750 for a full professional site. But first, let me send you the free preview so you can see the quality.",
      "\"I already have social media\" → That's great! A website actually makes your social media work harder because it gives people a place to land and take action.",
    ],
  },
};

function getScript(industry?: string) {
  return SCRIPTS[industry || ""] || SCRIPTS.default;
}

export default function VAWorkspacePage() {
  const queryClient = useQueryClient();
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [callbackTime, setCallbackTime] = useState("");
  const [showScript, setShowScript] = useState(true);
  const [selectedObjections, setSelectedObjections] = useState<string[]>([]);

  const COMMON_OBJECTIONS = [
    "too expensive", "not now", "already have website", "too busy",
    "need to think", "use social media", "no budget", "bad timing",
    "talk to partner", "not interested",
  ];

  // Get next lead from queue
  const { data: nextInQueue } = useQuery({
    queryKey: ["brandaro-next-queue"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from("brandaro_call_queue")
        .select(`
          *,
          brandaro_qualified_leads(*)
        `)
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

  // Current lead data
  const currentQueueItem = nextInQueue?.find((q: any) => q.lead_id === currentLeadId) || nextInQueue?.[0];
  const currentLead = currentQueueItem?.brandaro_qualified_leads;

  useEffect(() => {
    if (!currentLeadId && nextInQueue?.length) {
      setCurrentLeadId(nextInQueue[0].lead_id);
    }
  }, [nextInQueue, currentLeadId]);

  // Call history for current lead
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

      // Calculate next call time based on retry map
      let nextCallTime: string | null = null;
      const retryMinutes = RETRY_MAP[outcome];
      if (retryMinutes) {
        nextCallTime = new Date(Date.now() + retryMinutes * 60000).toISOString();
      }
      if (outcome === "callback_requested" && callbackTime) {
        nextCallTime = new Date(callbackTime).toISOString();
      }

      // Insert call log (immutable)
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

      // Trigger AI call analysis in background (non-blocking)
      if (notes && logData?.id) {
        supabase.functions.invoke("brandaro-call-analyzer", {
          body: { call_log_id: logData.id },
        }).catch(err => console.warn("Call analyzer failed:", err));
      }

      // Update lead record
      const leadUpdate: any = {
        call_attempts: attemptNumber,
        last_called_at: new Date().toISOString(),
      };
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

      // Update queue
      const shouldRemove = ["interested", "hot_lead", "sold", "wrong_number", "do_not_call", "not_interested"].includes(outcome);
      if (shouldRemove) {
        await supabase.from("brandaro_call_queue").update({ is_active: false }).eq("lead_id", currentLeadId);
      } else if (nextCallTime) {
        await supabase.from("brandaro_call_queue").update({
          next_call_time: nextCallTime,
          retry_count: attemptNumber,
        }).eq("lead_id", currentLeadId);
      }

      // Create callback if requested
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
      setOutcome("");
      setNotes("");
      setCallbackTime("");
      setCurrentLeadId(null);
      queryClient.invalidateQueries({ queryKey: ["brandaro-next-queue"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-call-stats-today"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-lead-history"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const script = getScript(currentLead?.industry);

  const skipLead = () => {
    const nextIdx = nextInQueue?.findIndex((q: any) => q.lead_id === currentLeadId);
    const next = nextInQueue?.[(nextIdx || 0) + 1];
    if (next) {
      setCurrentLeadId(next.lead_id);
      setOutcome("");
      setNotes("");
    } else {
      toast.info("No more leads in queue");
    }
  };

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Lead Card + Actions */}
      <div className="lg:col-span-2 space-y-4">
        {/* Lead Info */}
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{currentLead.business_name}</CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline">
                  T{currentQueueItem?.priority_tier || "?"}
                </Badge>
                <Badge variant="secondary">
                  Attempt #{(callHistory.length || 0) + 1}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono font-bold text-lg">{currentLead.phone_number || "No phone"}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{currentLead.city}, {currentLead.state}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Industry:</span>{" "}
                <span className="font-medium">{currentLead.industry || "Unknown"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <span>{currentLead.rating || "N/A"} ({currentLead.review_count || 0} reviews)</span>
              </div>
            </div>

            {/* Previous call notes */}
            {callHistory.length > 0 && (
              <div className="mt-3 p-3 bg-muted rounded-md">
                <p className="text-xs font-medium text-muted-foreground mb-1">Last Call Note:</p>
                <p className="text-sm">{callHistory[0].call_notes || "No notes"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {callHistory[0].call_outcome} — {new Date(callHistory[0].call_timestamp).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outcome Selection */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Log Call Outcome</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {CALL_OUTCOMES.map((o) => (
                <Button
                  key={o.value}
                  variant={outcome === o.value ? "default" : "outline"}
                  size="sm"
                  className={`text-xs ${outcome === o.value ? "" : ""}`}
                  onClick={() => setOutcome(o.value)}
                >
                  {o.label}
                </Button>
              ))}
            </div>

            {outcome === "callback_requested" && (
              <div className="space-y-2">
                <Label>Callback Date/Time</Label>
                <Input
                  type="datetime-local"
                  value={callbackTime}
                  onChange={(e) => setCallbackTime(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Call Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What happened on the call? Key objections, interest level, follow-up needs..."
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => logCallMutation.mutate()}
                disabled={!outcome || logCallMutation.isPending}
                className="flex-1"
              >
                <ChevronRight className="h-4 w-4 mr-2" />
                {logCallMutation.isPending ? "Logging..." : "Log & Next Lead"}
              </Button>
              <Button variant="outline" onClick={skipLead}>
                <SkipForward className="h-4 w-4 mr-1" /> Skip
              </Button>
            </div>

            {/* Quick Actions */}
            {(outcome === "interested" || outcome === "hot_lead") && (
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="secondary" size="sm" className="flex-1">
                  <Send className="h-4 w-4 mr-1" /> Send Demo
                </Button>
                <Button variant="secondary" size="sm" className="flex-1">
                  <PhoneForwarded className="h-4 w-4 mr-1" /> Escalate to Closer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Script Panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Call Script
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowScript(!showScript)}>
                {showScript ? "Hide" : "Show"}
              </Button>
            </div>
          </CardHeader>
          {showScript && (
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-semibold text-primary mb-1">📞 Introduction</p>
                <p className="text-muted-foreground">{script.intro}</p>
              </div>
              <Separator />
              <div>
                <p className="font-semibold text-amber-500 mb-1">⚡ Problem Awareness</p>
                <p className="text-muted-foreground">{script.problem}</p>
              </div>
              <Separator />
              <div>
                <p className="font-semibold text-green-500 mb-1">🎯 The Offer</p>
                <p className="text-muted-foreground">{script.offer}</p>
              </div>
              <Separator />
              <div>
                <p className="font-semibold text-cyan-500 mb-1">🛡️ Rebuttals</p>
                <div className="space-y-2">
                  {script.rebuttals.map((r, i) => (
                    <p key={i} className="text-muted-foreground text-xs p-2 bg-muted rounded">{r}</p>
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Call History */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Call History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {callHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">First call attempt</p>
            ) : (
              <div className="space-y-2">
                {callHistory.map((log: any, i: number) => (
                  <div key={log.id} className="text-xs p-2 bg-muted rounded">
                    <div className="flex justify-between">
                      <Badge variant="outline" className="text-[10px]">{log.call_outcome}</Badge>
                      <span className="text-muted-foreground">{new Date(log.call_timestamp).toLocaleDateString()}</span>
                    </div>
                    {log.call_notes && <p className="mt-1 text-muted-foreground">{log.call_notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Queue Remaining */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" /> Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{nextInQueue?.length || 0}</p>
            <p className="text-xs text-muted-foreground">leads ready to call</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
