import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Globe, Users, Phone, PhoneCall, Eye, FileText, 
  DollarSign, Rocket, Wrench, TrendingUp, Target, BarChart3 
} from "lucide-react";

function StatCard({ title, value, icon: Icon, color = "text-primary", subtitle }: {
  title: string; value: string | number; icon: any; color?: string; subtitle?: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <Icon className={`h-8 w-8 ${color} opacity-60`} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function BrandaroDashboard() {
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

  const { data: clients } = useQuery({
    queryKey: ["brandaro-clients-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("brandaro_clients").select("website_package_price, monthly_recurring, onboarding_status, maintenance_status");
      return data || [];
    },
  });

  const noWebsite = qualifiedLeads?.filter(l => l.priority_tier === "tier_1").length || 0;
  const callsAttempted = qualifiedLeads?.filter(l => l.lead_status !== "new" && l.lead_status !== "queued").length || 0;
  const interested = qualifiedLeads?.filter(l => ["interested", "hot_lead", "sold"].includes(l.lead_status || "")).length || 0;
  const demosGenerated = qualifiedLeads?.filter(l => l.demo_status && l.demo_status !== "pending").length || 0;
  const demosViewed = qualifiedLeads?.filter(l => l.demo_status === "viewed").length || 0;
  const proposalsSent = qualifiedLeads?.filter(l => l.proposal_status && l.proposal_status !== "draft").length || 0;
  const dealsClosed = qualifiedLeads?.filter(l => l.lead_status === "sold").length || 0;
  const activeBuilds = clients?.filter(c => c.onboarding_status && !["launched", "pending"].includes(c.onboarding_status)).length || 0;
  const activeMaintenance = clients?.filter(c => c.maintenance_status === "active").length || 0;
  const mrr = clients?.reduce((sum, c) => sum + (Number(c.monthly_recurring) || 0), 0) || 0;
  const oneTimeRev = clients?.reduce((sum, c) => sum + (Number(c.website_package_price) || 0), 0) || 0;
  const closeRate = callsAttempted > 0 ? ((dealsClosed / callsAttempted) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-8 w-8 text-cyan-500" />
            Brandaro Digital — Command Center
          </h1>
          <p className="text-muted-foreground mt-1">Agency automation engine — lead to revenue pipeline</p>
        </div>
        <Badge variant="outline" className="text-cyan-500 border-cyan-500/30 px-3 py-1">
          Phase 1 — Discovery Engine
        </Badge>
      </div>

      {/* Pipeline Funnel */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard title="Total Leads Imported" value={rawCount || 0} icon={Users} color="text-blue-500" />
        <StatCard title="Qualified (No Website)" value={noWebsite} icon={Target} color="text-amber-500" />
        <StatCard title="Calls Attempted" value={callsAttempted} icon={Phone} color="text-violet-500" />
        <StatCard title="Interested Prospects" value={interested} icon={PhoneCall} color="text-emerald-500" />
        <StatCard title="Demos Generated" value={demosGenerated} icon={Rocket} color="text-cyan-500" />
        <StatCard title="Demos Viewed" value={demosViewed} icon={Eye} color="text-pink-500" />
      </div>

      {/* Revenue & Closing */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Proposals Sent" value={proposalsSent} icon={FileText} color="text-orange-500" />
        <StatCard title="Deals Closed" value={dealsClosed} icon={DollarSign} color="text-green-500" />
        <StatCard title="Close Rate" value={`${closeRate}%`} icon={TrendingUp} color="text-blue-400" />
        <StatCard title="Websites Building" value={activeBuilds} icon={Wrench} color="text-purple-500" />
      </div>

      {/* Revenue */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard 
          title="Monthly Recurring Revenue" 
          value={`$${mrr.toLocaleString()}`} 
          icon={BarChart3} 
          color="text-emerald-500" 
          subtitle={`${activeMaintenance} active maintenance clients`}
        />
        <StatCard 
          title="One-Time Revenue" 
          value={`$${oneTimeRev.toLocaleString()}`} 
          icon={DollarSign} 
          color="text-blue-500"
          subtitle={`${dealsClosed} website projects`}
        />
        <StatCard 
          title="Total Revenue" 
          value={`$${(mrr + oneTimeRev).toLocaleString()}`} 
          icon={TrendingUp} 
          color="text-cyan-500"
        />
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Lead Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {["new","queued","calling","no_answer","voicemail","callback","interested","hot_lead","sold","not_interested"].map(status => {
                const count = qualifiedLeads?.filter(l => l.lead_status === status).length || 0;
                if (count === 0) return null;
                return (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{status.replace(/_/g, " ")}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                );
              })}
              {(!qualifiedLeads || qualifiedLeads.length === 0) && (
                <p className="text-sm text-muted-foreground">No qualified leads yet. Import leads to get started.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Production Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {["pending","content_gathering","design_phase","draft_ready","client_review","revisions","final_approval","launched"].map(status => {
                const count = clients?.filter(c => c.onboarding_status === status).length || 0;
                if (count === 0) return null;
                return (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{status.replace(/_/g, " ")}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                );
              })}
              {(!clients || clients.length === 0) && (
                <p className="text-sm text-muted-foreground">No active clients yet. Close deals to populate the pipeline.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
