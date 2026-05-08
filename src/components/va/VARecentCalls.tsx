import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Clock, PhoneOff, Pencil, Loader2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";

const DISPOSITIONS = [
  { value: "closed", label: "Closed / Won" },
  { value: "interested", label: "Interested" },
  { value: "callback", label: "Callback Requested" },
  { value: "voicemail", label: "Left Voicemail" },
  { value: "no_answer", label: "No Answer" },
  { value: "not_interested", label: "Not Interested" },
  { value: "wrong_number", label: "Wrong Number" },
  { value: "do_not_call", label: "Do Not Call" },
];

const FOLLOW_UP_STATUSES = [
  { value: "none", label: "No Follow-up" },
  { value: "pending", label: "Pending" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export function VARecentCalls() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingCall, setEditingCall] = useState<any | null>(null);
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [disposition, setDisposition] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("");

  const { data: recentCalls = [], isLoading } = useQuery({
    queryKey: ["va-recent-calls", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("va_call_logs")
        .select("id, call_status, disposition, duration_seconds, called_at, excitement_level, lead_id, twilio_number, call_summary, va_notes, follow_up_status, wrap_up_completed_at")
        .eq("va_id", user!.id)
        .order("called_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editingCall) throw new Error("No call selected");
      const payload: Record<string, any> = {
        call_summary: summary.trim() || null,
        va_notes: notes.trim() || null,
        disposition: disposition || null,
        follow_up_status: followUpStatus || null,
        wrap_up_completed_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any)
        .from("va_call_logs")
        .update(payload)
        .eq("id", editingCall.id)
        .eq("va_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Call wrap-up saved");
      queryClient.invalidateQueries({ queryKey: ["va-recent-calls", user?.id] });
      setEditingCall(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to save"),
  });

  const openEditor = (call: any) => {
    setEditingCall(call);
    setSummary(call.call_summary || "");
    setNotes(call.va_notes || "");
    setDisposition(call.disposition || "");
    setFollowUpStatus(call.follow_up_status || "");
  };

  const formatDuration = (s: number | null) => {
    if (!s) return "0:00";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const dispositionConfig: Record<string, { bg: string; text: string }> = {
    closed: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
    interested: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
    not_interested: { bg: "bg-destructive/15", text: "text-destructive" },
    callback: { bg: "bg-orange-500/15", text: "text-orange-400" },
    no_answer: { bg: "bg-muted/30", text: "text-muted-foreground" },
    voicemail: { bg: "bg-purple-500/15", text: "text-purple-400" },
    wrong_number: { bg: "bg-muted/30", text: "text-muted-foreground" },
    do_not_call: { bg: "bg-destructive/15", text: "text-destructive" },
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (recentCalls.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto">
          <PhoneOff className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground">No calls yet today</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1.5">
        {recentCalls.map((call: any, idx: number) => {
          const config = dispositionConfig[call.disposition] || { bg: "bg-muted/20", text: "text-muted-foreground" };
          const wrapped = !!call.wrap_up_completed_at;
          return (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.3 }}
              onClick={() => openEditor(call)}
              className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-accent/50 transition-all duration-200 cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-accent/50 flex items-center justify-center shrink-0 group-hover:bg-accent transition-colors">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                    {call.lead_id ? "Lead Call" : "Manual Call"}
                    {wrapped && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {call.called_at ? formatDistanceToNow(new Date(call.called_at), { addSuffix: true }) : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {formatDuration(call.duration_seconds)}
                </span>
                {call.disposition && (
                  <Badge variant="outline" className={`text-[10px] h-5 px-2 border-transparent ${config.bg} ${config.text}`}>
                    {call.disposition.replace(/_/g, " ")}
                  </Badge>
                )}
                <Pencil className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={!!editingCall} onOpenChange={(o) => !o && setEditingCall(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Call Wrap-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status / Disposition</Label>
                <Select value={disposition} onValueChange={setDisposition}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    {DISPOSITIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Follow-up</Label>
                <Select value={followUpStatus} onValueChange={setFollowUpStatus}>
                  <SelectTrigger><SelectValue placeholder="Select follow-up" /></SelectTrigger>
                  <SelectContent>
                    {FOLLOW_UP_STATUSES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Call Summary</Label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value.slice(0, 2000))}
                placeholder="Brief summary of what was discussed..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
                placeholder="Private notes, next steps, objections..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCall(null)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Wrap-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
