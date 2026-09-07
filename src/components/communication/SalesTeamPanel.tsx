/**
 * SalesTeamPanel — Stage 3 manager → team → agent view for Dynasty Connect.
 *
 * Structure: public.sales_teams + public.sales_team_members (roster only),
 * read through public.v_sales_team_roster. Performance numbers come from the
 * SAME Stage 2 shared rollup (useSalesActivity / v_sales_activity), so team,
 * agent and Caller Activity figures always agree.
 *
 * Company/vertical membership (business_members) is untouched: an agent can
 * work across approved businesses without changing team ownership.
 * No revenue, commissions, or invented history.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { Users, ChevronDown, ChevronRight, Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  formatTalkTime,
  useSalesActivity,
  type SalesActivityRow,
  type SalesActorRollup,
} from "@/hooks/useSalesActivity";

interface RosterRow {
  team_id: string;
  team_name: string;
  manager_user_id: string;
  manager_name: string | null;
  manager_email: string | null;
  team_active: boolean;
  membership_id: string | null;
  agent_user_id: string | null;
  agent_name: string | null;
  agent_email: string | null;
  team_role: string | null;
  membership_active: boolean | null;
  assigned_at: string | null;
}

const EMPTY_AGENT = {
  callsPlaced: 0,
  callsConnected: 0,
  talkTimeSeconds: 0,
  textsSent: 0,
  accountsTouched: 0,
  accountsCompleted: 0,
  followUpsCreated: 0,
  latestActivityAt: null as string | null,
  dispositions: {} as Record<string, number>,
  rows: [] as SalesActivityRow[],
};

export function SalesTeamPanel() {
  const qc = useQueryClient();
  const [days, setDays] = useState("30");
  const [openAgent, setOpenAgent] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newManagerId, setNewManagerId] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { agents, isLoading: loadingActivity } = useSalesActivity(Number(days));

  const { data: roster = [], isLoading: loadingRoster } = useQuery({
    queryKey: ["sales-team-roster"],
    queryFn: async (): Promise<RosterRow[]> => {
      const { data, error } = await (supabase as any)
        .from("v_sales_team_roster")
        .select("*")
        .order("team_name");
      if (error) throw error;
      return data || [];
    },
  });

  const teams = useMemo(() => {
    const m = new Map<string, { id: string; name: string; manager: string; active: boolean; members: RosterRow[] }>();
    roster.forEach((r) => {
      if (!m.has(r.team_id)) {
        m.set(r.team_id, {
          id: r.team_id,
          name: r.team_name,
          manager: r.manager_name || r.manager_email || r.manager_user_id.slice(0, 8),
          active: r.team_active,
          members: [],
        });
      }
      if (r.membership_id && r.membership_active) m.get(r.team_id)!.members.push(r);
    });
    return Array.from(m.values());
  }, [roster]);

  const activeTeam = teams.find((t) => t.id === selectedTeam) || teams[0] || null;

  const metricsByAgent = useMemo(() => {
    const m = new Map<string, SalesActorRollup>();
    agents.forEach((a) => a.agentId && m.set(a.agentId, a));
    return m;
  }, [agents]);

  const memberMetrics = useMemo(
    () =>
      (activeTeam?.members || []).map((mem) => ({
        member: mem,
        stats: (metricsByAgent.get(mem.agent_user_id!) as any) || EMPTY_AGENT,
      })),
    [activeTeam, metricsByAgent],
  );

  const totals = useMemo(
    () =>
      memberMetrics.reduce(
        (acc, { stats }) => ({
          callsPlaced: acc.callsPlaced + stats.callsPlaced,
          callsConnected: acc.callsConnected + stats.callsConnected,
          talkTimeSeconds: acc.talkTimeSeconds + stats.talkTimeSeconds,
          textsSent: acc.textsSent + stats.textsSent,
          accountsTouched: acc.accountsTouched + stats.accountsTouched,
          accountsCompleted: acc.accountsCompleted + stats.accountsCompleted,
          followUpsCreated: acc.followUpsCreated + stats.followUpsCreated,
        }),
        { callsPlaced: 0, callsConnected: 0, talkTimeSeconds: 0, textsSent: 0, accountsTouched: 0, accountsCompleted: 0, followUpsCreated: 0 },
      ),
    [memberMetrics],
  );

  // People picker — profiles, searched by name/email. No assignment is inferred.
  const { data: people = [] } = useQuery({
    queryKey: ["sales-team-people", search],
    enabled: addOpen || createOpen,
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, name, email").limit(25);
      if (search.trim()) q = q.or(`name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const createTeam = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("sales_teams").insert({
        name: newTeamName.trim(),
        manager_user_id: newManagerId,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Team created");
      setCreateOpen(false);
      setNewTeamName("");
      setNewManagerId("");
      qc.invalidateQueries({ queryKey: ["sales-team-roster"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("sales_team_members").insert({
        team_id: activeTeam!.id,
        user_id: userId,
        assigned_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agent assigned");
      qc.invalidateQueries({ queryKey: ["sales-team-roster"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await (supabase as any)
        .from("sales_team_members")
        .update({ is_active: false, removed_at: new Date().toISOString() })
        .eq("id", membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agent removed from team");
      qc.invalidateQueries({ queryKey: ["sales-team-roster"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" /> Sales teams
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Team roster and totals from the same shared rollup as Caller Activity. Team membership is
            separate from company access — assigning an agent here does not change which businesses
            they can work.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">New team</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create a sales team</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Team name</Label>
                  <Input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="e.g. Ren's team" />
                </div>
                <div>
                  <Label>Manager</Label>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" />
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                    {people.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setNewManagerId(p.id)}
                        className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-muted ${newManagerId === p.id ? "bg-muted" : ""}`}
                      >
                        <span>{p.name || p.email}</span>
                        {newManagerId === p.id && <Badge className="text-[10px]">manager</Badge>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!newTeamName.trim() || !newManagerId || createTeam.isPending}
                  onClick={() => createTeam.mutate()}
                >
                  {createTeam.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create team
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingRoster ? (
          <p className="text-sm text-muted-foreground">Loading teams…</p>
        ) : teams.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No sales teams yet. Create one and assign agents — nothing is assigned automatically.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {teams.map((t) => (
                <Button
                  key={t.id}
                  size="sm"
                  variant={activeTeam?.id === t.id ? "default" : "outline"}
                  onClick={() => setSelectedTeam(t.id)}
                >
                  {t.name}
                  <Badge variant="secondary" className="ml-2 text-[10px]">{t.members.length}</Badge>
                </Button>
              ))}
            </div>

            {activeTeam && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Manager: <span className="font-medium text-foreground">{activeTeam.manager}</span> ·{" "}
                    {activeTeam.members.length} agent{activeTeam.members.length === 1 ? "" : "s"}
                  </p>
                  <Dialog open={addOpen} onOpenChange={setAddOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <UserPlus className="mr-2 h-4 w-4" /> Assign agent
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Assign an agent to {activeTeam.name}</DialogTitle></DialogHeader>
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" />
                      <div className="max-h-64 space-y-1 overflow-y-auto">
                        {people.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted">
                            <span>{p.name || p.email}</span>
                            <Button size="sm" variant="ghost" disabled={addMember.isPending} onClick={() => addMember.mutate(p.id)}>
                              {addMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                            </Button>
                          </div>
                        ))}
                        {people.length === 0 && <p className="p-2 text-xs text-muted-foreground">No matches.</p>}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: "Calls placed", value: totals.callsPlaced },
                    { label: "Connected", value: totals.callsConnected },
                    { label: "Talk time", value: formatTalkTime(totals.talkTimeSeconds) },
                    { label: "Texts sent", value: totals.textsSent },
                    { label: "Accounts touched", value: totals.accountsTouched },
                    { label: "Accounts completed", value: totals.accountsCompleted },
                    { label: "Follow-ups", value: totals.followUpsCreated },
                    { label: "Agents", value: activeTeam.members.length },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg border p-3">
                      <p className="text-xl font-bold">{c.value}</p>
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                    </div>
                  ))}
                </div>

                {loadingActivity && <p className="text-xs text-muted-foreground">Loading agent activity…</p>}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Connected</TableHead>
                      <TableHead className="text-right">Talk time</TableHead>
                      <TableHead className="text-right">Texts</TableHead>
                      <TableHead className="text-right">Accounts</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Follow-ups</TableHead>
                      <TableHead>Latest activity</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberMetrics.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="py-6 text-center text-sm text-muted-foreground">
                          No agents assigned to this team yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {memberMetrics.map(({ member, stats }) => {
                      const key = member.membership_id!;
                      return (
                        <>
                          <TableRow key={key} className="cursor-pointer" onClick={() => setOpenAgent(openAgent === key ? null : key)}>
                            <TableCell className="font-medium">
                              <span className="inline-flex items-center gap-1">
                                {openAgent === key ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                {member.agent_name || member.agent_email || member.agent_user_id!.slice(0, 8)}
                                {member.team_role === "team_lead" && <Badge variant="outline" className="ml-1 text-[10px]">lead</Badge>}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{stats.callsPlaced}</TableCell>
                            <TableCell className="text-right text-emerald-600">{stats.callsConnected}</TableCell>
                            <TableCell className="text-right">{formatTalkTime(stats.talkTimeSeconds)}</TableCell>
                            <TableCell className="text-right">{stats.textsSent}</TableCell>
                            <TableCell className="text-right">{stats.accountsTouched}</TableCell>
                            <TableCell className="text-right">{stats.accountsCompleted}</TableCell>
                            <TableCell className="text-right">{stats.followUpsCreated}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {stats.latestActivityAt ? new Date(stats.latestActivityAt).toLocaleString() : "no recorded activity"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={removeMember.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeMember.mutate(key);
                                }}
                              >
                                {removeMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {openAgent === key && (
                            <TableRow key={`${key}-detail`}>
                              <TableCell colSpan={10} className="bg-muted/30">
                                {stats.rows.length === 0 ? (
                                  <p className="py-2 text-xs text-muted-foreground">
                                    Nothing recorded for this agent in this window.
                                  </p>
                                ) : (
                                  <ul className="max-h-80 space-y-1 overflow-y-auto text-xs">
                                    {stats.rows.slice(0, 100).map((c: SalesActivityRow) => (
                                      <li key={c.activity_id} className="flex flex-wrap items-center gap-2 border-b border-border/40 py-1">
                                        <span className="text-muted-foreground">{new Date(c.occurred_at).toLocaleString()}</span>
                                        <Badge variant="outline" className="text-[10px] capitalize">{c.channel}</Badge>
                                        <Badge variant="secondary" className="text-[10px] capitalize">{c.direction || "outbound"}</Badge>
                                        {c.outcome && <Badge variant="outline" className="text-[10px]">{c.outcome}</Badge>}
                                        <span className="max-w-[240px] truncate">{c.summary || ""}</span>
                                        {c.store_id ? (
                                          <Button asChild size="sm" variant="link" className="h-5 px-1 text-[11px]">
                                            <Link to={`/stores/${c.store_id}`}>Open account</Link>
                                          </Button>
                                        ) : (
                                          <Badge variant="outline" className="text-[10px]">no account linked</Badge>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default SalesTeamPanel;
