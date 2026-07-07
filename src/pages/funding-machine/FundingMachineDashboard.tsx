import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurplusVisibilityPanel, RealEstateVisibilityPanel } from "@/components/funding/CrossSystemPanels";
import {
  Users, TrendingUp, CreditCard, Building2, FileText,
  Shield, Landmark, Clock, AlertTriangle, Plus, RefreshCw,
  Bell, GitBranch, Trophy
} from "lucide-react";

// ============ Dashboard Widgets ============

function TodaysReminders() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['dashboard-todays-reminders', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_reminders')
        .select('id, client_id, title, due_date, priority, funding_clients(first_name, last_name)')
        .eq('is_completed', false)
        .lte('due_date', today)
        .order('due_date', { ascending: true })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card className="border-[#C9A84C]/30 bg-gradient-to-br from-background to-[#C9A84C]/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-[#C9A84C]" />
          Today's Reminders
          {reminders.length > 0 && (
            <Badge className="ml-auto bg-[#C9A84C] text-black">{reminders.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[280px] overflow-y-auto">
        {isLoading ? (
          <>
            <div className="h-12 rounded-md bg-muted/40 animate-pulse" />
            <div className="h-12 rounded-md bg-muted/40 animate-pulse" />
            <div className="h-12 rounded-md bg-muted/40 animate-pulse" />
          </>
        ) : reminders.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">All caught up</p>
          </div>
        ) : (
          reminders.map((r: any) => (
            <div
              key={r.id}
              onClick={() => navigate(`/funding-machine/client/${r.client_id}`)}
              className="flex items-start justify-between p-2 rounded-md border border-border/50 hover:border-[#C9A84C]/40 hover:bg-[#C9A84C]/5 cursor-pointer transition-all"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.funding_clients?.first_name} {r.funding_clients?.last_name} · {r.due_date}
                </p>
              </div>
              {r.priority === 'high' && (
                <Badge variant="outline" className="border-red-500/40 text-red-500 text-[10px] ml-2">HIGH</Badge>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ClientPipeline() {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['dashboard-client-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funding_clients')
        .select('stage, status');
      if (error) throw error;
      return data || [];
    },
  });

  const stages = [
    { key: 'intake', label: 'Intake', color: 'bg-gray-500' },
    { key: 'credit_repair', label: 'Credit Repair', color: 'bg-amber-500' },
    { key: 'credit_ready', label: 'Credit Ready', color: 'bg-yellow-500' },
    { key: 'funding_active', label: 'Funding Active', color: 'bg-blue-500' },
    { key: 'funded', label: 'Funded', color: 'bg-[#C9A84C]' },
    { key: 'grant_eligible', label: 'Grant Eligible', color: 'bg-purple-500' },
    { key: 'complete', label: 'Complete', color: 'bg-emerald-500' },
  ];

  const counts = stages.map(s => ({
    ...s,
    count: clients.filter((c: any) => (c.stage || 'intake') === s.key).length,
  }));
  const total = clients.length || 1;

  return (
    <Card className="border-[#C9A84C]/30 bg-gradient-to-br from-background to-[#C9A84C]/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4 text-[#C9A84C]" />
          Client Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <div className="h-8 rounded-md bg-muted/40 animate-pulse" />
            <div className="h-8 rounded-md bg-muted/40 animate-pulse" />
            <div className="h-8 rounded-md bg-muted/40 animate-pulse" />
            <div className="h-8 rounded-md bg-muted/40 animate-pulse" />
          </>
        ) : clients.length === 0 ? (
          <div className="text-center py-8">
            <GitBranch className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No clients in pipeline</p>
          </div>
        ) : (
          counts.map(s => (
            <div key={s.key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
              <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                <div
                  className={`h-full ${s.color} transition-all`}
                  style={{ width: `${(s.count / total) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ScoreWins() {
  const { data: wins = [], isLoading } = useQuery({
    queryKey: ['dashboard-score-wins'],
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('client_score_history')
        .select(`
          id, client_id, score_date,
          score_tu, score_eq, score_ex,
          funding_clients!inner(first_name, last_name, id)
        `)
        .gte('score_date', monthStart.toISOString().split('T')[0])
        .order('score_date', { ascending: true });
      if (error) throw error;

      const byClient: Record<string, any[]> = {};
      (data ?? []).forEach((r: any) => {
        const cid = r.client_id;
        if (!byClient[cid]) byClient[cid] = [];
        byClient[cid].push(r);
      });

      const results: any[] = [];
      Object.entries(byClient).forEach(([_, rows]) => {
        if (rows.length < 2) return;
        const first = rows[0];
        const last = rows[rows.length - 1];
        const tuGain = (last.score_tu ?? 0) - (first.score_tu ?? 0);
        const eqGain = (last.score_eq ?? 0) - (first.score_eq ?? 0);
        const exGain = (last.score_ex ?? 0) - (first.score_ex ?? 0);
        const totalGain =
          Math.max(tuGain, 0) + Math.max(eqGain, 0) + Math.max(exGain, 0);
        if (totalGain < 20) return;
        results.push({
          client_id: rows[0].client_id,
          full_name:
            (last.funding_clients as any)?.first_name +
            ' ' +
            (last.funding_clients as any)?.last_name,
          total_gain: totalGain,
          tu_gain: Math.max(tuGain, 0),
          eq_gain: Math.max(eqGain, 0),
          ex_gain: Math.max(exGain, 0),
        });
      });

      return results.sort((a, b) => b.total_gain - a.total_gain).slice(0, 5);
    },
  });

  return (
    <Card className="border-[#C9A84C]/30 bg-gradient-to-br from-background to-[#C9A84C]/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-[#C9A84C]" />
          Score Wins (MTD)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[280px] overflow-y-auto">
        {isLoading ? (
          <>
            <div className="h-12 rounded-md bg-muted/40 animate-pulse" />
            <div className="h-12 rounded-md bg-muted/40 animate-pulse" />
            <div className="h-12 rounded-md bg-muted/40 animate-pulse" />
          </>
        ) : wins.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No score gains yet</p>
          </div>
        ) : (
          wins.map((w: any) => (
            <div key={w.client_id} className="flex items-center justify-between p-2 rounded-md border border-border/50">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{w.full_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {[
                    w.tu_gain > 0 ? `TU+${w.tu_gain}` : null,
                    w.eq_gain > 0 ? `EQ+${w.eq_gain}` : null,
                    w.ex_gain > 0 ? `EX+${w.ex_gain}` : null,
                  ].filter(Boolean).join(' ')}
                </p>
              </div>
              <div className="text-right ml-2">
                <p className="text-sm font-bold text-emerald-500">+{w.total_gain} pts</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function FundingMachineDashboard() {
  const navigate = useNavigate();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['funding-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funding_clients')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: taskCards = [] } = useQuery({
    queryKey: ['funding-task-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funding_task_cards')
        .select('status')
      if (error) throw error;
      return data || [];
    },
  });

  const activeClients = clients.filter(c => c.status !== 'completed' && c.status !== 'cancelled');
  const pendingTasks = taskCards.filter(t => t.status === 'pending').length;
  const completedTasks = taskCards.filter(t => t.status === 'completed').length;
  const avgDFS = activeClients.length > 0
    ? Math.round(activeClients.reduce((sum, c) => sum + (c.current_dfs_score || 0), 0) / activeClients.length)
    : 0;

  const stats = [
    { label: "Active Clients", value: clients.length.toString(), icon: Users, sub: `${activeClients.length} in pipeline`, color: "text-amber-500" },
    { label: "Avg DFS Score", value: avgDFS.toString(), icon: TrendingUp, sub: "of 100", color: "text-emerald-500" },
    { label: "Pending Tasks", value: pendingTasks.toString(), icon: Clock, sub: `${completedTasks} completed`, color: "text-blue-500" },
    { label: "Total Pipeline", value: `$${(activeClients.reduce((s, c) => s + Number(c.target_funding_amount || 0), 0) / 1000).toFixed(0)}K`, icon: Landmark, sub: "target funding", color: "text-purple-500" },
  ];

  const modules = [
    { label: "Client Intake", desc: "Onboard new clients & calculate DFS", icon: Plus, path: "/funding-machine/intake", color: "from-amber-600 to-yellow-500" },
    { label: "Credit Repair", desc: "Dispute management & letter generation", icon: Shield, path: "/funding-machine/credit-repair", color: "from-red-600 to-rose-500" },
    { label: "Business Builder", desc: "Tradeline sequencing & Paydex tracker", icon: Building2, path: "/funding-machine/business-builder", color: "from-blue-600 to-cyan-500" },
    { label: "Bureau Intelligence", desc: "Card stacking & bureau optimization", icon: CreditCard, path: "/funding-machine/bureau-intel", color: "from-purple-600 to-violet-500" },
    { label: "Funding Matrix", desc: "Lender matching & product pipeline", icon: Landmark, path: "/funding-machine/funding-matrix", color: "from-emerald-600 to-green-500" },
    { label: "Velocity Calculator", desc: "90-day banking activity planner", icon: TrendingUp, path: "/funding-machine/velocity", color: "from-cyan-600 to-teal-500" },
    { label: "Tradeline Vault", desc: "AU slot management & matching", icon: FileText, path: "/funding-machine/tradeline-vault", color: "from-orange-600 to-amber-500" },
    { label: "Task Cards", desc: "All client action items & progress", icon: AlertTriangle, path: "/funding-machine/tasks", color: "from-pink-600 to-rose-500" },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-yellow-400 bg-clip-text text-transparent">
            Dynasty Funding Machine
          </h1>
          <p className="text-muted-foreground mt-1">End-to-end credit optimization & funding acquisition</p>
        </div>
        <Button
          onClick={() => navigate('/funding-machine/intake')}
          className="bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-700 hover:to-yellow-600 text-black font-semibold"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Client
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-amber-500/20 bg-gradient-to-br from-background to-amber-500/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  <p className="text-xs text-amber-500 mt-1">{stat.sub}</p>
                </div>
                <div className={`p-3 rounded-xl bg-muted/50 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <TodaysReminders />
        <ClientPipeline />
        <ScoreWins />
      </div>

      {/* Module Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-amber-400">Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((mod, i) => (
            <Card
              key={i}
              className="border-border/50 hover:border-amber-500/40 transition-all cursor-pointer group"
              onClick={() => navigate(mod.path)}
            >
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mod.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <mod.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg">{mod.label}</h3>
                <p className="text-sm text-muted-foreground mt-1">{mod.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Clients */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-500" />
            Recent Clients
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No clients yet</h3>
              <p className="text-muted-foreground mt-1">Click "New Client" to onboard your first funding client</p>
              <Button
                className="mt-4 bg-gradient-to-r from-amber-600 to-yellow-500 text-black"
                onClick={() => navigate('/funding-machine/intake')}
              >
                <Plus className="h-4 w-4 mr-2" /> Add First Client
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Client</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Business</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">DFS Score</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Target</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.slice(0, 10).map((client) => (
                    <tr
                      key={client.id}
                      className="border-b border-border/30 hover:bg-amber-500/5 transition-colors cursor-pointer"
                      onClick={() => navigate(`/funding-machine/client/${client.id}`)}
                    >
                      <td className="p-3 font-medium">{client.first_name} {client.last_name}</td>
                      <td className="p-3 text-muted-foreground">{client.business_name || '—'}</td>
                      <td className="p-3">
                        <span className={`font-bold ${
                          (client.current_dfs_score || 0) >= 70 ? 'text-emerald-500' :
                          (client.current_dfs_score || 0) >= 40 ? 'text-amber-500' : 'text-red-500'
                        }`}>
                          {client.current_dfs_score || 0}
                        </span>
                        <span className="text-muted-foreground text-sm">/100</span>
                      </td>
                      <td className="p-3 font-semibold text-amber-500">
                        ${Number(client.target_funding_amount || 0).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={
                          client.status === 'active' ? 'border-emerald-500/30 text-emerald-500' :
                          client.status === 'intake' ? 'border-amber-500/30 text-amber-500' :
                          'border-muted-foreground/30 text-muted-foreground'
                        }>
                          {client.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cross-System Visibility (Read-Only) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SurplusVisibilityPanel />
        <RealEstateVisibilityPanel />
      </div>
    </div>
  );
}
