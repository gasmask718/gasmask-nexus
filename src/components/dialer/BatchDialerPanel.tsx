import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, Square, Zap, Phone, Clock, CheckCircle2, XCircle,
  AlertTriangle, Activity, RotateCcw, Gauge, Users, TrendingUp,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { toast } from "sonner";

interface BatchDialerPanelProps {
  campaignId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  dialing: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  active: "bg-green-500/15 text-green-600 dark:text-green-400",
  completed: "bg-green-500/10 text-green-600 dark:text-green-500",
  failed: "bg-destructive/15 text-destructive",
  no_answer: "bg-amber-500/15 text-amber-600",
  voicemail: "bg-orange-500/15 text-orange-600",
  retry: "bg-purple-500/15 text-purple-600",
};

export default function BatchDialerPanel({ campaignId }: BatchDialerPanelProps) {
  const { currentBusiness } = useBusiness();
  const bizId = currentBusiness?.id;
  const queryClient = useQueryClient();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const [batchName, setBatchName] = useState("");
  const [maxConcurrent, setMaxConcurrent] = useState(10);
  const [pacingDelay, setPacingDelay] = useState(2);

  // Fetch batches for current campaign
  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ["solar-batches", campaignId],
    queryFn: async () => {
      let query = supabase
        .from("solar_call_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (campaignId) query = query.eq("campaign_id", campaignId);
      else if (bizId) query = query.eq("business_id", bizId);

      const { data } = await query;
      return data || [];
    },
    enabled: !!bizId || !!campaignId,
    refetchInterval: 3000,
  });

  const activeBatch = batches.find((b: any) => b.status === "running");
  const activeBatchId = activeBatch?.id;

  // Fetch queue items for the active batch
  const { data: queueItems = [] } = useQuery({
    queryKey: ["solar-batch-queue", activeBatchId],
    queryFn: async () => {
      const { data } = await supabase
        .from("solar_call_queue")
        .select("*")
        .eq("batch_id", activeBatchId!)
        .order("priority_score", { ascending: false });
      return data || [];
    },
    enabled: !!activeBatchId,
    refetchInterval: 3000,
  });

  // Stats
  const queueStats = {
    total: queueItems.length,
    queued: queueItems.filter((i: any) => i.call_status === "queued").length,
    dialing: queueItems.filter((i: any) => i.call_status === "dialing").length,
    active: queueItems.filter((i: any) => i.call_status === "active").length,
    completed: queueItems.filter((i: any) => i.call_status === "completed").length,
    failed: queueItems.filter((i: any) => i.call_status === "failed").length,
    noAnswer: queueItems.filter((i: any) => i.call_status === "no_answer").length,
    retry: queueItems.filter((i: any) => i.call_status === "retry").length,
    voicemail: queueItems.filter((i: any) => i.call_status === "voicemail").length,
  };

  const completedTotal = queueStats.completed + queueStats.failed + queueStats.noAnswer + queueStats.voicemail;
  const progress = queueStats.total > 0 ? (completedTotal / queueStats.total) * 100 : 0;
  const answerRate = completedTotal > 0 ? ((queueStats.completed / completedTotal) * 100).toFixed(1) : "0";

  // Create batch from campaign queue
  const createBatchMutation = useMutation({
    mutationFn: async () => {
      if (!campaignId) throw new Error("No campaign selected");

      // Fetch queued items from outbound_call_queue for this campaign
      const { data: campaignQueue } = await supabase
        .from("outbound_call_queue")
        .select("id, phone_number, contact_name, priority_score")
        .eq("campaign_id", campaignId)
        .eq("status", "queued")
        .order("priority_score", { ascending: false });

      if (!campaignQueue || campaignQueue.length === 0) throw new Error("No queued contacts in this campaign");

      // Create batch
      const { data: batch, error: batchErr } = await supabase
        .from("solar_call_batches")
        .insert({
          business_id: bizId,
          batch_name: batchName || `Batch ${new Date().toLocaleTimeString()}`,
          campaign_id: campaignId,
          total_contacts: campaignQueue.length,
          max_concurrent: maxConcurrent,
          pacing_delay_ms: pacingDelay * 1000,
          status: "queued",
        })
        .select("id")
        .single();

      if (batchErr) throw batchErr;

      // Insert queue items
      const items = campaignQueue.map((q: any, i: number) => ({
        batch_id: batch.id,
        phone: q.phone_number,
        contact_name: q.contact_name,
        priority_score: q.priority_score || (100 - i),
        call_status: "queued",
        max_attempts: 3,
      }));

      for (let i = 0; i < items.length; i += 50) {
        const { error } = await supabase.from("solar_call_queue").insert(items.slice(i, i + 50));
        if (error) throw error;
      }

      return { batchId: batch.id, count: items.length };
    },
    onSuccess: (data) => {
      toast.success(`Batch created with ${data.count} contacts`);
      queryClient.invalidateQueries({ queryKey: ["solar-batches"] });
      setBatchName("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Batch control mutations
  const batchActionMutation = useMutation({
    mutationFn: async ({ batchId, action }: { batchId: string; action: string }) => {
      if (action === "start") {
        // Update to running, then trigger dialer
        await supabase.from("solar_call_batches").update({ status: "running", started_at: new Date().toISOString() }).eq("id", batchId);
        const { data, error } = await supabase.functions.invoke("solar-parallel-dialer", {
          body: { batch_id: batchId, action: "start" },
        });
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.functions.invoke("solar-parallel-dialer", {
        body: { batch_id: batchId, action },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(`Batch ${vars.action}d`);
      queryClient.invalidateQueries({ queryKey: ["solar-batches"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Auto-poll the dialer when a batch is running
  const triggerDialer = useCallback(async (batchId: string) => {
    try {
      await supabase.functions.invoke("solar-parallel-dialer", {
        body: { batch_id: batchId },
      });
      queryClient.invalidateQueries({ queryKey: ["solar-batch-queue", batchId] });
      queryClient.invalidateQueries({ queryKey: ["solar-batches"] });
    } catch (e) {
      console.error("Dialer poll error:", e);
    }
  }, [queryClient]);

  useEffect(() => {
    if (activeBatchId) {
      pollingRef.current = setInterval(() => triggerDialer(activeBatchId), 6000);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [activeBatchId, triggerDialer]);

  // Update concurrency live
  const updateConcurrency = async (batchId: string, value: number) => {
    await supabase.from("solar_call_batches").update({ max_concurrent: value, updated_at: new Date().toISOString() }).eq("id", batchId);
    setMaxConcurrent(value);
    queryClient.invalidateQueries({ queryKey: ["solar-batches"] });
  };

  return (
    <div className="space-y-4">
      {/* Batch Creation */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Parallel Batch Dialer
          </CardTitle>
          <CardDescription>Create call batches to dial multiple leads simultaneously</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Batch Name</Label>
              <Input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder={`Batch ${new Date().toLocaleTimeString()}`}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max Concurrent Calls: {maxConcurrent}</Label>
              <Slider
                value={[maxConcurrent]}
                onValueChange={([v]) => setMaxConcurrent(v)}
                min={1}
                max={50}
                step={1}
                className="mt-2"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pacing Delay: {pacingDelay}s</Label>
              <Slider
                value={[pacingDelay]}
                onValueChange={([v]) => setPacingDelay(v)}
                min={1}
                max={10}
                step={0.5}
                className="mt-2"
              />
            </div>
          </div>
          <Button
            onClick={() => createBatchMutation.mutate()}
            disabled={createBatchMutation.isPending || !campaignId}
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            {createBatchMutation.isPending ? "Creating..." : "Create Batch from Queue"}
          </Button>
        </CardContent>
      </Card>

      {/* Active Batch Monitor */}
      {activeBatch && (
        <Card className="border border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-600 animate-pulse" />
                {activeBatch.batch_name}
                <Badge className="bg-green-600 text-white text-[10px]">RUNNING</Badge>
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => batchActionMutation.mutate({ batchId: activeBatch.id, action: "pause" })}>
                  <Pause className="h-3.5 w-3.5 mr-1" /> Pause
                </Button>
                <Button size="sm" variant="destructive" onClick={() => batchActionMutation.mutate({ batchId: activeBatch.id, action: "stop" })}>
                  <Square className="h-3.5 w-3.5 mr-1" /> Stop
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Live Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
              {[
                { label: "Total", value: queueStats.total, icon: Users, color: "text-foreground" },
                { label: "Queued", value: queueStats.queued, icon: Clock, color: "text-muted-foreground" },
                { label: "Dialing", value: queueStats.dialing, icon: Phone, color: "text-blue-600" },
                { label: "Active", value: queueStats.active, icon: Activity, color: "text-green-600" },
                { label: "Done", value: queueStats.completed, icon: CheckCircle2, color: "text-green-600" },
                { label: "Failed", value: queueStats.failed, icon: XCircle, color: "text-destructive" },
                { label: "No Ans", value: queueStats.noAnswer, icon: AlertTriangle, color: "text-amber-600" },
                { label: "Retry", value: queueStats.retry, icon: RotateCcw, color: "text-purple-600" },
              ].map(s => (
                <div key={s.label} className="text-center p-2 rounded-lg bg-card border">
                  <s.icon className={`h-3.5 w-3.5 mx-auto mb-1 ${s.color}`} />
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{completedTotal} / {queueStats.total} processed</span>
                <span>{answerRate}% answer rate</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Concurrency Slider (live adjust) */}
            <div className="flex items-center gap-4">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs whitespace-nowrap">Concurrency: {activeBatch.max_concurrent}</Label>
              <Slider
                value={[activeBatch.max_concurrent || 10]}
                onValueChange={([v]) => updateConcurrency(activeBatch.id, v)}
                min={1}
                max={50}
                step={1}
                className="flex-1"
              />
            </div>

            {/* Live Queue */}
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-1">
                {queueItems.filter((i: any) => ["dialing", "active"].includes(i.call_status)).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${item.call_status === "active" ? "bg-green-500 animate-pulse" : "bg-blue-500 animate-pulse"}`} />
                      <span className="text-sm font-medium">{item.contact_name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground font-mono">{item.phone}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[item.call_status] || ""}`}>
                      {item.call_status}
                    </Badge>
                  </div>
                ))}
                {queueStats.dialing + queueStats.active === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-4">Processing queue...</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Batch History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Batch History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {batchesLoading ? (
                <p className="text-center text-sm text-muted-foreground py-4">Loading...</p>
              ) : batches.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">No batches yet</p>
              ) : (
                batches.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{b.batch_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.total_contacts} contacts · {b.calls_completed || 0} completed · {b.calls_answered || 0} answered
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={b.status === "running" ? "default" : b.status === "completed" ? "secondary" : "outline"} className="text-[10px]">
                        {b.status}
                      </Badge>
                      {b.status === "queued" && (
                        <Button size="sm" variant="default" className="h-7 gap-1 text-xs" onClick={() => batchActionMutation.mutate({ batchId: b.id, action: "start" })}>
                          <Play className="h-3 w-3" /> Start
                        </Button>
                      )}
                      {b.status === "paused" && (
                        <Button size="sm" variant="default" className="h-7 gap-1 text-xs" onClick={() => batchActionMutation.mutate({ batchId: b.id, action: "resume" })}>
                          <Play className="h-3 w-3" /> Resume
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
