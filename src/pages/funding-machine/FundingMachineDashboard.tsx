import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurplusVisibilityPanel, RealEstateVisibilityPanel } from "@/components/funding/CrossSystemPanels";
import {
  Users, TrendingUp, CreditCard, Building2, FileText,
  Shield, Landmark, Clock, AlertTriangle, Plus, RefreshCw
} from "lucide-react";

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
    </div>
  );
}
