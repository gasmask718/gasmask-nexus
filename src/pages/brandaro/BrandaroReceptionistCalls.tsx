// Brandaro AI Receptionist — All Calls Monitor
// Route: /os/brandaro/receptionist/calls
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, PhoneIncoming } from "lucide-react";

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");

export default function BrandaroReceptionistCalls() {
  const [dateRange, setDateRange] = useState("month");
  const [clientId, setClientId] = useState<string>("all");
  const [outcome, setOutcome] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fromDate = useMemo(() => {
    const d = new Date();
    if (dateRange === "today") d.setHours(0, 0, 0, 0);
    else if (dateRange === "week") d.setDate(d.getDate() - 7);
    else if (dateRange === "month") d.setDate(1), d.setHours(0, 0, 0, 0);
    else return null;
    return d.toISOString();
  }, [dateRange]);

  const { data: clients = [] } = useQuery({
    queryKey: ["brandaro-receptionist-clients-mini"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_receptionist_clients")
        .select("id, business_name")
        .order("business_name");
      return data ?? [];
    },
  });

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["brandaro-receptionist-all-calls", dateRange, clientId, outcome, fromDate],
    queryFn: async () => {
      let q = supabase
        .from("brandaro_receptionist_calls")
        .select("*, brandaro_receptionist_clients!inner(id, business_name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (fromDate) q = q.gte("created_at", fromDate);
      if (clientId !== "all") q = q.eq("client_id", clientId);
      if (outcome !== "all") q = q.eq("call_outcome", outcome);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const total = calls.length;
    const appts = calls.filter((c: any) => c.appointment_booked).length;
    const callbacks = calls.filter((c: any) => c.callback_requested).length;
    const avg = calls.length
      ? Math.round(calls.reduce((s: number, c: any) => s + (c.call_duration_seconds ?? 0), 0) / calls.length / 60)
      : 0;
    return { total, appts, callbacks, avg };
  }, [calls]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <PhoneIncoming className="w-7 h-7" /> All Receptionist Calls
        </h1>
        <p className="text-muted-foreground text-sm">
          {stats.total} calls · {stats.appts} appointments · {stats.callbacks} callbacks · avg {stats.avg} min
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="w-60"><SelectValue placeholder="Client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Outcome" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            <SelectItem value="appointment_booked">Appointment</SelectItem>
            <SelectItem value="callback_requested">Callback</SelectItem>
            <SelectItem value="info_provided">Info</SelectItem>
            <SelectItem value="transferred_to_human">Transfer</SelectItem>
            <SelectItem value="spam">Spam</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : calls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No calls match these filters.</div>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-7 gap-2 text-[10px] uppercase text-muted-foreground pb-2">
                <div>Date/Time</div><div>Business</div><div>Caller</div><div>Duration</div>
                <div>Outcome</div><div>Appt</div><div>Summary</div>
              </div>
              {calls.map((c: any) => (
                <div key={c.id} className="py-2">
                  <button
                    className="w-full text-left grid grid-cols-7 gap-2 items-center text-sm hover:bg-muted/30 rounded p-1"
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  >
                    <div className="text-xs">{fmtDate(c.created_at)}</div>
                    <div className="font-medium">{c.brandaro_receptionist_clients?.business_name ?? "—"}</div>
                    <div>{c.caller_name ?? c.caller_phone ?? "Unknown"}</div>
                    <div className="text-xs">{Math.round((c.call_duration_seconds ?? 0) / 60)} min</div>
                    <div>{outcomeBadge(c.call_outcome)}</div>
                    <div className="text-xs">{c.appointment_booked ? "✅" : "—"}</div>
                    <div className="text-xs line-clamp-1 text-muted-foreground">{c.summary ?? "—"}</div>
                  </button>
                  {expanded === c.id && (
                    <div className="mt-2 border-l-2 border-primary/40 pl-4 space-y-2">
                      {c.recording_url && <audio controls src={c.recording_url} className="w-full h-8" />}
                      {c.transcript && (
                        <pre className="whitespace-pre-wrap text-xs bg-muted/30 p-2 rounded max-h-64 overflow-auto">{c.transcript}</pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function outcomeBadge(outcome: string | null) {
  if (!outcome) return <Badge variant="outline" className="text-[10px]">—</Badge>;
  const styles: Record<string, string> = {
    appointment_booked:  "bg-green-500/15 text-green-600 border-green-500/40",
    callback_requested:  "bg-amber-500/15 text-amber-600 border-amber-500/40",
    info_provided:       "bg-blue-500/15 text-blue-600 border-blue-500/40",
    transferred_to_human:"bg-purple-500/15 text-purple-600 border-purple-500/40",
    voicemail_left:      "bg-gray-500/15 text-gray-500 border-gray-500/40",
    spam:                "bg-gray-500/15 text-gray-500 border-gray-500/40",
    wrong_number:        "bg-gray-500/15 text-gray-500 border-gray-500/40",
  };
  return <Badge variant="outline" className={`${styles[outcome] ?? ""} text-[10px]`}>{outcome.replace(/_/g, " ")}</Badge>;
}
