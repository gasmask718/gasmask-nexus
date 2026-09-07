/**
 * AgentCallActivityPanel — real per-agent performance from the shared Stage 2
 * rollup (public.v_sales_activity, via useSalesActivity).
 *
 * Only rows carrying a real user id appear here. Unattributed inbound calls,
 * inbound replies, AI/automated messages and historical system-stamped rows are
 * summarised separately and clearly labelled — never credited to a person.
 *
 * No revenue, no commission, no team/manager grouping.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { Headphones, ChevronDown, ChevronRight } from "lucide-react";
import {
  ATTRIBUTION_LABEL,
  formatTalkTime,
  useAgentNames,
  useSalesActivity,
  type SalesActivityRow,
} from "@/hooks/useSalesActivity";

export function AgentCallActivityPanel() {
  const [days, setDays] = useState("30");
  const [openAgent, setOpenAgent] = useState<string | null>(null);

  const { agents, unattributed, isLoading, error } = useSalesActivity(Number(days));

  const { data: names } = useAgentNames(agents.map((a) => a.agentId!).filter(Boolean));

  const agentIds = useMemo(() => agents.map((a) => a.agentId!).filter(Boolean), [agents]);

  const { data: sessions } = useQuery({
    queryKey: ["agent-shift-sessions", agentIds.sort().join(",")],
    enabled: agentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("va_sessions")
        .select("va_id, started_at, is_active, last_seen_at")
        .in("va_id", agentIds)
        .order("started_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data || []).forEach((s: any) => {
        if (map[s.va_id] === undefined) map[s.va_id] = !!s.is_active;
      });
      return map;
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Headphones className="h-5 w-5" /> Agent performance (shared rollup)
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Calls, connects, talk time, texts, accounts touched and completed, outcomes and
            follow-ups — all from the same rollup as Caller Activity. No revenue or commission is
            recorded against calls anywhere, so none is shown.
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
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading agent activity…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : agents.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity attributed to an agent in this window.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Calls placed</TableHead>
                <TableHead className="text-right">Connected</TableHead>
                <TableHead className="text-right">Talk time</TableHead>
                <TableHead className="text-right">Texts sent</TableHead>
                <TableHead className="text-right">Accounts</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Follow-ups</TableHead>
                <TableHead>Top outcomes</TableHead>
                <TableHead>Latest activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((a) => (
                <>
                  <TableRow
                    key={a.key}
                    className="cursor-pointer"
                    onClick={() => setOpenAgent(openAgent === a.key ? null : a.key)}
                  >
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1">
                        {openAgent === a.key ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {names?.[a.agentId!] || a.agentId!.slice(0, 8)}
                        {sessions?.[a.agentId!] && <Badge className="ml-1 text-[10px]">on shift</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{a.callsPlaced}</TableCell>
                    <TableCell className="text-right text-emerald-600">{a.callsConnected}</TableCell>
                    <TableCell className="text-right">{formatTalkTime(a.talkTimeSeconds)}</TableCell>
                    <TableCell className="text-right">{a.textsSent}</TableCell>
                    <TableCell className="text-right">{a.accountsTouched}</TableCell>
                    <TableCell className="text-right">{a.accountsCompleted}</TableCell>
                    <TableCell className="text-right">{a.followUpsCreated}</TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {Object.entries(a.dispositions)
                          .sort((x, y) => y[1] - x[1])
                          .slice(0, 3)
                          .map(([d, n]) => (
                            <Badge key={d} variant="outline" className="text-[10px] capitalize">
                              {d.replace(/_/g, " ")} {n}
                            </Badge>
                          ))}
                        {Object.keys(a.dispositions).length === 0 && (
                          <span className="text-xs text-muted-foreground">none recorded</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.latestActivityAt ? new Date(a.latestActivityAt).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                  {openAgent === a.key && (
                    <TableRow key={`${a.key}-detail`}>
                      <TableCell colSpan={10} className="bg-muted/30">
                        <ul className="max-h-80 space-y-1 overflow-y-auto text-xs">
                          {a.rows.slice(0, 100).map((c: SalesActivityRow) => (
                            <li key={c.activity_id} className="flex flex-wrap items-center gap-2 border-b border-border/40 py-1">
                              <span className="text-muted-foreground">{new Date(c.occurred_at).toLocaleString()}</span>
                              <Badge variant="outline" className="text-[10px] capitalize">{c.channel}</Badge>
                              <Badge variant="secondary" className="text-[10px] capitalize">{c.direction || "outbound"}</Badge>
                              <Badge variant={c.is_connected ? "outline" : "destructive"} className="text-[10px]">
                                {c.status || (c.is_connected ? "connected" : "unknown")}
                              </Badge>
                              {c.outcome && (
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {String(c.outcome).replace(/_/g, " ")}
                                </Badge>
                              )}
                              {c.channel === "call" && <span>{formatTalkTime(Number(c.duration_seconds) || 0)}</span>}
                              <span className="text-muted-foreground">{c.phone || "—"}</span>
                              <span className="max-w-[240px] truncate">{c.summary || ""}</span>
                              {c.store_id ? (
                                <Button asChild size="sm" variant="link" className="h-5 px-1 text-[11px]">
                                  <Link to={`/stores/${c.store_id}`}>Open account</Link>
                                </Button>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">no account linked</Badge>
                              )}
                              {c.completed_at && (
                                <Badge className="text-[10px]">completed</Badge>
                              )}
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

        {unattributed.length > 0 && (
          <div className="rounded-lg border border-dashed p-3">
            <p className="text-xs font-semibold">Not attributable to a person (kept separate)</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {unattributed.map((u) => (
                <li key={u.key}>
                  {ATTRIBUTION_LABEL[u.attribution]} — {u.callsTotal} calls, {u.textsSent} texts sent,{" "}
                  {u.textsReceived} replies, {u.accountsTouched} accounts
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AgentCallActivityPanel;
