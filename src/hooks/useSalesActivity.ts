import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * useSalesActivity — Stage 2 shared sales activity rollup.
 *
 * ONE source: public.v_sales_activity (read-only union of va_call_logs +
 * communication_logs, deduped on the Twilio SID). Aggregation lives here so
 * every performance screen produces identical numbers.
 *
 * Attribution is never guessed. Rows without a real user id stay in their own
 * bucket: automated | inbound_unattributed | system_unattributed.
 */

export type Attribution = "agent" | "automated" | "inbound_unattributed" | "system_unattributed";

export interface SalesActivityRow {
  activity_id: string;
  source_table: string;
  source_id: string;
  occurred_at: string;
  channel: "call" | "sms";
  direction: string | null;
  agent_id: string | null;
  store_id: string | null;
  contact_id: string | null;
  status: string | null;
  outcome: string | null;
  duration_seconds: number | null;
  follow_up_at: string | null;
  completed_at: string | null;
  phone: string | null;
  summary: string | null;
  provider_sid: string | null;
  business_id: string | null;
  attribution: Attribution;
  is_connected: boolean;
}

export interface SalesActorRollup {
  key: string;
  agentId: string | null;
  attribution: Attribution;
  rows: SalesActivityRow[];
  callsPlaced: number;
  callsTotal: number;
  callsConnected: number;
  callsMissed: number;
  talkTimeSeconds: number;
  textsSent: number;
  textsReceived: number;
  accountsTouched: number;
  accountsCompleted: number;
  contactsTouched: number;
  followUpsCreated: number;
  dispositions: Record<string, number>;
  latestActivityAt: string | null;
}

export const ATTRIBUTION_LABEL: Record<Attribution, string> = {
  agent: "Agent",
  automated: "Automated / AI (no agent recorded)",
  inbound_unattributed: "Inbound — handler not recorded",
  system_unattributed: "Historical system-stamped (no agent recorded)",
};

export function formatTalkTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m ${s}s`;
}

export function rollupSalesActivity(rows: SalesActivityRow[]): SalesActorRollup[] {
  const groups = new Map<string, SalesActivityRow[]>();
  for (const r of rows) {
    const key = r.agent_id ? `agent:${r.agent_id}` : `bucket:${r.attribution}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return Array.from(groups.entries())
    .map(([key, list]) => {
      const calls = list.filter((r) => r.channel === "call");
      const texts = list.filter((r) => r.channel === "sms");
      const dispositions: Record<string, number> = {};
      for (const r of list) if (r.outcome) dispositions[r.outcome] = (dispositions[r.outcome] || 0) + 1;

      const distinct = (pick: (r: SalesActivityRow) => string | null, filter?: (r: SalesActivityRow) => boolean) =>
        new Set(list.filter((r) => (filter ? filter(r) : true)).map(pick).filter(Boolean) as string[]).size;

      return {
        key,
        agentId: list[0].agent_id,
        attribution: list[0].attribution,
        rows: list,
        callsPlaced: calls.filter((r) => (r.direction || "").toLowerCase() === "outbound").length,
        callsTotal: calls.length,
        callsConnected: calls.filter((r) => r.is_connected).length,
        callsMissed: calls.filter((r) => !r.is_connected).length,
        talkTimeSeconds: calls.reduce((s, r) => s + (Number(r.duration_seconds) || 0), 0),
        textsSent: texts.filter((r) => (r.direction || "").toLowerCase() === "outbound").length,
        textsReceived: texts.filter((r) => (r.direction || "").toLowerCase() === "inbound").length,
        accountsTouched: distinct((r) => r.store_id),
        accountsCompleted: distinct((r) => r.store_id, (r) => !!r.completed_at),
        contactsTouched: distinct((r) => r.contact_id),
        followUpsCreated: list.filter((r) => r.follow_up_at).length,
        dispositions,
        latestActivityAt: list.reduce<string | null>(
          (acc, r) => (!acc || r.occurred_at > acc ? r.occurred_at : acc),
          null,
        ),
      };
    })
    .sort((a, b) => b.rows.length - a.rows.length);
}

export function useSalesActivity(days: number, opts: { limit?: number } = {}) {
  const { limit = 5000 } = opts;

  const query = useQuery({
    queryKey: ["sales-activity", days, limit],
    queryFn: async (): Promise<SalesActivityRow[]> => {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data, error } = await (supabase as any)
        .from("v_sales_activity")
        .select("*")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as SalesActivityRow[];
    },
    staleTime: 15_000,
  });

  const rows = useMemo(() => query.data || [], [query.data]);
  const rollup = useMemo(() => rollupSalesActivity(rows), [rows]);
  const agents = useMemo(() => rollup.filter((r) => r.attribution === "agent"), [rollup]);
  const unattributed = useMemo(() => rollup.filter((r) => r.attribution !== "agent"), [rollup]);

  return { ...query, rows, rollup, agents, unattributed };
}

/** Display names for the agent ids present in a rollup. */
export function useAgentNames(agentIds: string[]) {
  const ids = Array.from(new Set(agentIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ["sales-activity-agent-names", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, name, email").in("id", ids);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = (p.name || "").trim() || p.email || p.id.slice(0, 8);
      });
      return map;
    },
  });
}
