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
import {
  ATTRIBUTION_LABEL,
  useAgentNames,
  useSalesActivity,
  type SalesActivityRow,
} from "@/hooks/useSalesActivity";

/**
 * RepActivityBoard — caller activity from the shared Stage 2 rollup
 * (public.v_sales_activity). No second source, no invented revenue.
 * Drill-down: caller → activity → exact canonical account.
 */
export function RepActivityBoard() {
  const [days, setDays] = useState("7");
  const [openRep, setOpenRep] = useState<string | null>(null);

  const { rollup, rows, isLoading, error } = useSalesActivity(Number(days));

  const { data: names } = useAgentNames(rollup.map((r) => r.agentId).filter(Boolean) as string[]);

  const storeIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.store_id).filter(Boolean))) as string[],
    [rows],
  );

  const { data: stores } = useQuery({
    queryKey: ["rep-activity-stores", storeIds.sort().join(",")],
    enabled: storeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_master")
        .select("id, store_name")
        .in("id", storeIds.slice(0, 500));
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => {
        map[s.id] = s.store_name;
      });
      return map;
    },
  });

  const repLabel = (r: (typeof rollup)[number]) =>
    r.agentId ? names?.[r.agentId] || r.agentId.slice(0, 8) : ATTRIBUTION_LABEL[r.attribution];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5" /> Caller Activity (shared sales rollup)
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Calls and texts from one shared read-only rollup. Traffic with no recorded person stays
            in its own row and is never credited to an agent.
          </p>
        </div>
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
        ) : rollup.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No logged activity in this window.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caller</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Connected</TableHead>
                <TableHead className="text-right">Missed</TableHead>
                <TableHead className="text-right">Texts sent</TableHead>
                <TableHead className="text-right">Replies</TableHead>
                <TableHead className="text-right">Accounts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rollup.map((r) => (
                <>
                  <TableRow
                    key={r.key}
                    className="cursor-pointer"
                    onClick={() => setOpenRep(openRep === r.key ? null : r.key)}
                  >
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1">
                        {openRep === r.key ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {repLabel(r)}
                        {!r.agentId && (
                          <Badge variant="outline" className="ml-1 text-[10px]">unattributed</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{r.callsTotal}</TableCell>
                    <TableCell className="text-right text-emerald-600">{r.callsConnected}</TableCell>
                    <TableCell className="text-right text-destructive">{r.callsMissed}</TableCell>
                    <TableCell className="text-right">{r.textsSent}</TableCell>
                    <TableCell className="text-right">{r.textsReceived}</TableCell>
                    <TableCell className="text-right">{r.accountsTouched}</TableCell>
                  </TableRow>
                  {openRep === r.key && (
                    <TableRow key={`${r.key}-detail`}>
                      <TableCell colSpan={7} className="bg-muted/30">
                        <ul className="max-h-80 space-y-1 overflow-y-auto text-xs">
                          {r.rows.slice(0, 100).map((e: SalesActivityRow) => (
                            <li key={e.activity_id} className="flex flex-wrap items-center gap-2 border-b border-border/40 py-1">
                              <span className="text-muted-foreground">{new Date(e.occurred_at).toLocaleString()}</span>
                              <Badge variant="outline" className="text-[10px] capitalize">{e.channel}</Badge>
                              <Badge variant="secondary" className="text-[10px] capitalize">{e.direction}</Badge>
                              {e.channel === "call" && (
                                <Badge variant={e.is_connected ? "outline" : "destructive"} className="text-[10px]">
                                  {e.is_connected ? "connected" : "no connect"}
                                </Badge>
                              )}
                              {e.outcome && <Badge variant="outline" className="text-[10px]">{e.outcome}</Badge>}
                              <span className="max-w-[280px] truncate">{e.summary || "—"}</span>
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
