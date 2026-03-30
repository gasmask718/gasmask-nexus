import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Globe, Users, Phone, PhoneCall, Eye, FileText,
  DollarSign, TrendingUp, Target, BarChart3,
  AlertTriangle, RefreshCw, Bot, Send, Headset,
  Activity, MessageSquare, Zap, ArrowRight
} from "lucide-react";

function StatCard({ title, value, icon: Icon, accent = "text-primary", subtitle, onClick }: {
  title: string; value: string | number; icon: any; accent?: string; subtitle?: string; onClick?: () => void;
}) {
  return (
    <Card className={`bg-card border-border transition-all ${onClick ? "cursor-pointer hover:border-primary/50" : ""}`} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${accent}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <Icon className={`h-6 w-6 ${accent} opacity-50`} />
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ label, icon: Icon, accent, onClick }: { label: string; icon: any; accent: string; onClick: () => void }) {
  return (
    <Button variant="outline" className="h-auto py-3 px-4 flex flex-col items-center gap-1.5 border-border hover:border-primary/50" onClick={onClick}>
      <Icon className={`h-5 w-5 ${accent}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </Button>
  );
}

export default function BrandaroDashboard() {
  const navigate = useNavigate();

  const { data: rawCount } = useQuery({
    queryKey: ["brandaro-raw-count"],
    queryFn: async () => {
      const { count } = await supabase.from("brandaro_raw_leads").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: qualifiedLeads } = useQuery({
    queryKey: ["brandaro-qualified-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("brandaro_qualified_leads").select("lead_status, priority_tier, demo_status, proposal_status");
      return data || [];
    },
  });

  const { data: masterLeads } = useQuery({
    queryKey: ["brandaro-master-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("brandaro_leads_master").select("status, language, assigned_va_id, region");
      return data || [];
    },
  });

  const { data: aiCallStats } = useQuery({
    queryKey: ["brandaro-ai-call-stats-dash"],
    queryFn: async () => {
      const { data } = await supabase.from("brandaro_ai_calls").select("status, interest_level, language");
      const total = data?.length || 0;
      const completed = data?.filter((c: any) => c.status === "completed").length || 0;
      const interested = data?.filter((c: any) => ["medium", "high"].includes(c.interest_level)).length || 0;
      return { total, completed, interested };
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["brandaro-clients-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("brandaro_clients").select("website_package_price, monthly_recurring, onboarding_status, maintenance_status");
      return data || [];
    },
  });

  const { data: messageLogs } = useQuery({
    queryKey: ["brandaro-message-stats"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("brandaro_message_log").select("send_status");
      return data || [];
    },
  });

  const { data: vaPerf } = useQuery({
    queryKey: ["brandaro-va-perf-dash"],
    queryFn: async () => {
      const { data } = await supabase.from("brandaro_va_performance").select("*").order("total_closes", { ascending: false }).limit(5);
      return data || [];
    },
  });

  // Derived metrics
  const totalMaster = masterLeads?.length || 0;
  const unassigned = masterLeads?.filter((l: any) => !l.assigned_va_id).length || 0;
  const spanishLeads = masterLeads?.filter((l: any) => l.language === "spanish").length || 0;
  const englishLeads = masterLeads?.filter((l: any) => l.language === "english" || !l.language).length || 0;
  const interestedMaster = masterLeads?.filter((l: any) => l.status === "interested").length || 0;
  const closedMaster = masterLeads?.filter((l: any) => l.status === "closed").length || 0;

  const noWebsite = qualifiedLeads?.filter((l: any) => l.priority_tier === "tier_1").length || 0;
  const dealsClosed = qualifiedLeads?.filter((l: any) => l.lead_status === "sold").length || 0;

  const mrr = clients?.reduce((sum: number, c: any) => sum + (Number(c.monthly_recurring) || 0), 0) || 0;
  const oneTimeRev = clients?.reduce((sum: number, c: any) => sum + (Number(c.website_package_price) || 0), 0) || 0;
  const messagesSent = messageLogs?.filter((m: any) => m.send_status === "sent").length || 0;

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <Globe className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Brandaro Command Center</h1>
            <p className="text-sm text-muted-foreground">Full system overview — leads, VAs, AI, revenue</p>
          </div>
        </div>
        <Badge variant="outline" className="text-cyan-400 border-cyan-500/30">Live</Badge>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <QuickAction label="AI Calls" icon={Bot} accent="text-violet-400" onClick={() => navigate("/os/brandaro/ai-calling")} />
        <QuickAction label="Distribute" icon={Zap} accent="text-amber-400" onClick={() => navigate("/os/brandaro/distribution")} />
        <QuickAction label="VA Center" icon={Headset} accent="text-cyan-400" onClick={() => navigate("/os/brandaro/va-center")} />
        <QuickAction label="Leads" icon={Target} accent="text-emerald-400" onClick={() => navigate("/os/brandaro/leads")} />
        <QuickAction label="Messages" icon={MessageSquare} accent="text-blue-400" onClick={() => navigate("/os/brandaro/conversations")} />
        <QuickAction label="Revenue" icon={DollarSign} accent="text-green-400" onClick={() => navigate("/os/brandaro/revenue")} />
      </div>

      {/* Pipeline Overview */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Pipeline</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard title="Total Leads" value={rawCount || 0} icon={Users} accent="text-blue-400" />
          <StatCard title="Master Pipeline" value={totalMaster} icon={Target} accent="text-cyan-400" />
          <StatCard title="Unassigned" value={unassigned} icon={AlertTriangle} accent={unassigned > 10 ? "text-destructive" : "text-amber-400"} />
          <StatCard title="Interested" value={interestedMaster} icon={PhoneCall} accent="text-emerald-400" />
          <StatCard title="Closed" value={closedMaster + dealsClosed} icon={DollarSign} accent="text-green-400" />
          <StatCard title="No Website" value={noWebsite} icon={Eye} accent="text-pink-400" />
        </div>
      </div>

      {/* AI + SMS Activity */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">AI & Communication</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="AI Calls Made" value={aiCallStats?.total || 0} icon={Bot} accent="text-violet-400" onClick={() => navigate("/os/brandaro/ai-calling")} />
          <StatCard title="AI Interested" value={aiCallStats?.interested || 0} icon={PhoneCall} accent="text-emerald-400" />
          <StatCard title="SMS Sent" value={messagesSent} icon={Send} accent="text-blue-400" onClick={() => navigate("/os/brandaro/conversations")} />
          <StatCard title="English / Spanish" value={`${englishLeads} / ${spanishLeads}`} icon={Globe} accent="text-cyan-400" />
        </div>
      </div>

      {/* Revenue */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Revenue</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard title="Monthly Recurring" value={`$${mrr.toLocaleString()}`} icon={BarChart3} accent="text-emerald-400" />
          <StatCard title="One-Time Revenue" value={`$${oneTimeRev.toLocaleString()}`} icon={DollarSign} accent="text-blue-400" />
          <StatCard title="Total Revenue" value={`$${(mrr + oneTimeRev).toLocaleString()}`} icon={TrendingUp} accent="text-cyan-400" />
        </div>
      </div>

      {/* VA Performance + System Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2"><Headset className="h-4 w-4 text-cyan-400" /> Top VAs</span>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/os/brandaro/va-center")}>
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {vaPerf.length === 0 ? (
              <p className="text-sm text-muted-foreground">No VA data yet.</p>
            ) : (
              vaPerf.map((va: any, i: number) => (
                <div key={va.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">#{i + 1} VA</span>
                  <div className="flex gap-3">
                    <span className="text-foreground">{va.total_calls || 0} calls</span>
                    <Badge variant="secondary" className="text-xs">{va.total_closes || 0} closes</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" /> System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{messagesSent}</p>
                <p className="text-xs text-muted-foreground">Messages Sent</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{aiCallStats?.completed || 0}</p>
                <p className="text-xs text-muted-foreground">AI Calls Done</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${unassigned > 10 ? "text-destructive" : "text-foreground"}`}>{unassigned}</p>
                <p className="text-xs text-muted-foreground">Unassigned Leads</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">
                  {unassigned === 0 ? "✅" : "⚡"}
                </p>
                <p className="text-xs text-muted-foreground">Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lead Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Lead Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {["new", "contacted", "interested", "not_interested", "callback", "form_sent", "closed"].map((status) => {
              const count = masterLeads?.filter((l: any) => l.status === status).length || 0;
              if (count === 0) return null;
              return (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted-foreground">{status.replace(/_/g, " ")}</span>
                  <Badge variant="secondary" className="text-xs">{count}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Region Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {(() => {
              const regions: Record<string, number> = {};
              masterLeads?.forEach((l: any) => {
                const r = l.region || "Unknown";
                regions[r] = (regions[r] || 0) + 1;
              });
              return Object.entries(regions).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([region, count]) => (
                <div key={region} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{region}</span>
                  <Badge variant="secondary" className="text-xs">{count}</Badge>
                </div>
              ));
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
