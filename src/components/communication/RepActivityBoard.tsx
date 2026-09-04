import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { Activity, ChevronDown, ChevronRight } from "lucide-react";
import { CALL_CHANNELS, isMissedCall, isUnreadMessage } from "@/hooks/useCommsAwareness";

/**
 * RepActivityBoard — real caller activity from the canonical communication log.
 * No new tables, no invented revenue. Drill-down: rep → activity → exact store.
 */
export function RepActivityBoard() {
  const [days, setDays] = useState("7");
  const [openRep, setOpenRep] = useState<string | null>(null);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["rep-activity-canonical", days],
    queryFn: async () => {
      const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
      const { data, error } = await (supabase as any)
        .from("communication_logs")
        .select(
          "id, created_at, channel, direction, status, outcome, summary, message_content, store_id, contact_id, performed_by, created_by, answered_at, duration_seconds, call_duration, read_at, handled_at, brand",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
  });

  const actorIds = useMemo(
    () => Array.from(new Set(rows.map((r: any) => r.created_by).filter(Boolean))) as string[],
    [rows],
  );

  const { data: names } = useQuery({
    queryKey: ["rep-activity-names", actorIds.sort().join(",")],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, name, email").in("id", actorIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.id] = p.name || p.email || p.id.slice(0, 8); });
      return map;
    },
  });

  const storeIds = useMemo(
    () => Array.from(new Set(rows.map((r: any) => r.store_id).filter(Boolean))) as string[],
    [rows],
  );

  const { data: stores } = useQuery({
    queryKey: ["rep-activity-stores", storeIds.sort().join(",")],
    enabled: storeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_master")
        .select("id, store_name")
        .in("id", storeIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.id] = s.store_name; });
      return map;
    },
  });

  const repKey = (r: any) => r.created_by || r.performed_by || "unattributed";
  const repLabel = (key: string) =>
    key === "unattributed" ? "Unattributed / system" : names?.[key] || key;

  const byRep = useMemo(() => {
    const m = new Map<string, any[]>();
    rows.forEach((r: any) => {
      const k = repKey(r);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    });
    return Array.from(m.entries())
      .map(([key, list]) => {
        const calls = list.filter((r) => CALL_CHANNELS.includes(r.channel));
        const texts = list.filter((r) => r.channel === "sms");
        return {
          key,
          list,
          calls: calls.length,
          answered: calls.filter((r) => !isMissedCall(r)).length,
          missed: calls.filter((r) => isMissedCall(r)).length,
          textsSent: texts.filter((r) => r.direction === "outbound").length,
          replies: texts.filter((r) => r.direction === "inbound").length,
          unread: list.filter(isUnreadMessage).length,
          stores: new Set(list.map((r) => r.store_id).filter(Boolean)).size,
          dispositions: new Set(list.map((r) => r.outcome).filter(Boolean)).size,
        };
      })
      .sort((a, b) => b.list.length - a.list.length);
  }, [rows, names]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5" /> Caller Activity (live canonical data)
        </CardTitle>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading activity…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : byRep.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No logged activity in this window.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caller</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Answered</TableHead>
                <TableHead className="text-right">Missed</TableHead>
                <TableHead className="text-right">Texts sent</TableHead>
                <TableHead className="text-right">Replies</TableHead>
                <TableHead className="text-right">Unread</TableHead>
                <TableHead className="text-right">Accounts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byRep.map((r) => (
                <>
                  <TableRow key={r.key} className="cursor-pointer" onClick={() => setOpenRep(openRep === r.key ? null : r.key)}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1">
                        {openRep === r.key ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {repLabel(r.key)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{r.calls}</TableCell>
                    <TableCell className="text-right text-emerald-600">{r.answered}</TableCell>
                    <TableCell className="text-right text-destructive">{r.missed}</TableCell>
                    <TableCell className="text-right">{r.textsSent}</TableCell>
                    <TableCell className="text-right">{r.replies}</TableCell>
                    <TableCell className="text-right">
                      {r.unread > 0 ? <Badge>{r.unread}</Badge> : 0}
                    </TableCell>
                    <TableCell className="text-right">{r.stores}</TableCell>
                  </TableRow>
                  {openRep === r.key && (
                    <TableRow key={`${r.key}-detail`}>
                      <TableCell colSpan={8} className="bg-muted/30">
                        <ul className="space-y-1 max-h-80 overflow-y-auto text-xs">
                          {r.list.slice(0, 100).map((e: any) => (
                            <li key={e.id} className="flex flex-wrap items-center gap-2 border-b border-border/40 py-1">
                              <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                              <Badge variant="outline" className="capitalize text-[10px]">{e.channel}</Badge>
                              <Badge variant="secondary" className="capitalize text-[10px]">{e.direction}</Badge>
                              {CALL_CHANNELS.includes(e.channel) && (
                                <Badge variant={isMissedCall(e) ? "destructive" : "outline"} className="text-[10px]">
                                  {isMissedCall(e) ? "missed" : "answered"}
                                </Badge>
                              )}
                              {e.outcome && <Badge variant="outline" className="text-[10px]">{e.outcome}</Badge>}
                              <span className="truncate max-w-[280px]">{e.message_content || e.summary || "—"}</span>
                              {e.store_id ? (
                                <Button asChild size="sm" variant="link" className="h-5 px-1 text-[11px]">
                                  <Link to={`/stores/${e.store_id}`}>{stores?.[e.store_id] || "Open account"}</Link>
                                </Button>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">no account linked</Badge>
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
      </CardContent>
    </Card>
  );
}

export default RepActivityBoard;
