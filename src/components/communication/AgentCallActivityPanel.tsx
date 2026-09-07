/**
 * AgentCallActivityPanel — real per-agent call records.
 *
 * Source (existing tables only, no new tables, no invented numbers):
 *   public.va_call_logs   — one row per real call: va_id, disposition, duration, status, lead
 *   public.va_sessions    — real shift windows per agent (last active)
 *   public.profiles       — agent display name
 *
 * Shows only what is recorded: calls, connected calls, talk time, dispositions,
 * last activity. No revenue, no commission, no team/manager grouping.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Headphones, ChevronDown, ChevronRight } from "lucide-react";

const CONNECTED = new Set(["completed", "answered", "in-progress"]);

function fmtDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m ${s}s`;
}

export function AgentCallActivityPanel() {
  const [days, setDays] = useState("30");
  const [openAgent, setOpenAgent] = useState<string | null>(null);

  const { data: calls = [], isLoading, error } = useQuery({
    queryKey: ["agent-call-activity", days],
    queryFn: async () => {
      const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
      const { data, error } = await (supabase as any)
        .from("va_call_logs")
        .select(
          "id, va_id, called_at, call_status, disposition, direction, duration_seconds, to_number, call_summary, follow_up_at, lead_id",
        )
        .gte("called_at", since)
        .order("called_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
  });

  const agentIds = useMemo(
    () => Array.from(new Set(calls.map((c: any) => c.va_id).filter(Boolean))) as string[],
    [calls],
  );

  const { data: names } = useQuery({
    queryKey: ["agent-call-activity-names", agentIds.sort().join(",")],
    enabled: agentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, name, email").in("id", agentIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = (p.name || "").trim() || p.email || p.id.slice(0, 8);
      });
      return map;
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["agent-call-activity-sessions", agentIds.sort().join(",")],
    enabled: agentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("va_sessions")
        .select("va_id, started_at, ended_at, is_active, last_seen_at")
        .in("va_id", agentIds)
        .order("started_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const map: Record<string, { lastSeen: string | null; active: boolean }> = {};
      (data || []).forEach((s: any) => {
        if (!map[s.va_id]) map[s.va_id] = { lastSeen: s.last_seen_at || s.started_at, active: !!s.is_active };
      });
      return map;
    },
  });

  const byAgent = useMemo(() => {
    const m = new Map<string, any[]>();
    calls.forEach((c: any) => {
      const k = c.va_id || "unattributed";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    });
    return Array.from(m.entries())
      .map(([key, list]) => {
        const connected = list.filter((c) => CONNECTED.has((c.call_status || "").toLowerCase()));
        const talk = list.reduce((s, c) => s + (Number(c.duration_seconds) || 0), 0);
        const dispositions = list.reduce((acc: Record<string, number>, c) => {
          if (c.disposition) acc[c.disposition] = (acc[c.disposition] || 0) + 1;
          return acc;
        }, {});
        return {
          key,
          list,
          calls: list.length,
          connected: connected.length,
          talk,
          dispositions,
          followUps: list.filter((c) => c.follow_up_at).length,
          last: list[0]?.called_at || null,
        };
      })
      .sort((a, b) => b.calls - a.calls);
  }, [calls]);

  const label = (key: string) =>
    key === "unattributed" ? "Unattributed / automated" : names?.[key] || key.slice(0, 8);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Headphones className="h-5 w-5" /> Agent call records (real)
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Recorded calls per agent — calls, connected, talk time, dispositions. No revenue or
            commission is recorded against calls anywhere, so none is shown.
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading agent calls…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : byAgent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No recorded agent calls in this window.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Connected</TableHead>
                <TableHead className="text-right">Talk time</TableHead>
                <TableHead className="text-right">Follow-ups set</TableHead>
                <TableHead>Top outcomes</TableHead>
                <TableHead>Last call</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byAgent.map((a) => (
                <>
                  <TableRow
                    key={a.key}
                    className="cursor-pointer"
                    onClick={() => setOpenAgent(openAgent === a.key ? null : a.key)}
                  >
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1">
                        {openAgent === a.key ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {label(a.key)}
                        {sessions?.[a.key]?.active && (
                          <Badge className="ml-1 text-[10px]">on shift</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{a.calls}</TableCell>
                    <TableCell className="text-right text-emerald-600">{a.connected}</TableCell>
                    <TableCell className="text-right">{fmtDuration(a.talk)}</TableCell>
                    <TableCell className="text-right">{a.followUps}</TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {Object.entries(a.dispositions)
                          .sort((x, y) => (y[1] as number) - (x[1] as number))
                          .slice(0, 3)
                          .map(([d, n]) => (
                            <Badge key={d} variant="outline" className="text-[10px] capitalize">
                              {d.replace(/_/g, " ")} {n as number}
                            </Badge>
                          ))}
                        {Object.keys(a.dispositions).length === 0 && (
                          <span className="text-xs text-muted-foreground">none recorded</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.last ? new Date(a.last).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                  {openAgent === a.key && (
                    <TableRow key={`${a.key}-detail`}>
                      <TableCell colSpan={7} className="bg-muted/30">
                        <ul className="max-h-80 space-y-1 overflow-y-auto text-xs">
                          {a.list.slice(0, 100).map((c: any) => (
                            <li key={c.id} className="flex flex-wrap items-center gap-2 border-b border-border/40 py-1">
                              <span className="text-muted-foreground">
                                {new Date(c.called_at).toLocaleString()}
                              </span>
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {c.direction || "outbound"}
                              </Badge>
                              <Badge
                                variant={CONNECTED.has((c.call_status || "").toLowerCase()) ? "outline" : "destructive"}
                                className="text-[10px]"
                              >
                                {c.call_status || "unknown"}
                              </Badge>
                              {c.disposition && (
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {String(c.disposition).replace(/_/g, " ")}
                                </Badge>
                              )}
                              <span>{fmtDuration(Number(c.duration_seconds) || 0)}</span>
                              <span className="text-muted-foreground">{c.to_number || "—"}</span>
                              <span className="max-w-[280px] truncate">{c.call_summary || ""}</span>
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default AgentCallActivityPanel;
