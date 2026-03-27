import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Target, MapPin, TrendingUp, Zap, Brain, RefreshCw, Loader2, Search, Play,
  Pause, RotateCcw, CheckCircle2, AlertTriangle, Globe, BarChart3, Users,
  ChevronRight, Phone, Shield, Database, List, Filter
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTerritoryStats, useTerritoryJobs, useStateCoverage, TerritoryJob, StateCoverage } from "@/hooks/useUTTerritoryJobs";
import { useTerritoryHeatmap, useRunAIScoring } from "@/hooks/useUTTerritoryIntelligence";
import { useUTPartnerLeads, useUTLeadStats, UTPartnerLead } from "@/hooks/useUTPartnerLeads";
import { toast } from "sonner";

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  running: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  queued: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  failed: "bg-red-500/10 text-red-400 border-red-500/30",
  paused: "bg-muted text-muted-foreground border-border",
};

export default function UTIntelligenceCommandCenter() {
  const [tab, setTab] = useState<"overview" | "queue" | "quality" | "territory" | "leads">("overview");
  const { data: stats, isLoading: statsLoading } = useTerritoryStats();
  const { data: leadStats } = useUTLeadStats();
  const { data: states = [] } = useStateCoverage();
  const { data: recentJobs = [], isLoading: jobsLoading } = useTerritoryJobs({});
  const { data: heatmap = [] } = useTerritoryHeatmap();
  const scoring = useRunAIScoring();

  const handleRunScoring = async () => {
    try {
      const count = await scoring.mutateAsync();
      toast.success(`AI scored ${count} leads`);
    } catch { toast.error("Scoring failed"); }
  };

  const priorityStates = states.filter(s => s.priority_tier === "priority");
  const activeStates = states.filter(s => s.status === "in_progress");
  const completedStates = states.filter(s => s.status === "completed");

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🧠 Intelligence Command Center</h1>
          <p className="text-sm text-muted-foreground">Nationwide vendor sourcing & territory expansion engine</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRunScoring} disabled={scoring.isPending} className="gap-1.5">
            {scoring.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
            Run AI Scoring
          </Button>
          <Link to="/os/unforgettable/territory">
            <Button size="sm" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Territory Control
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "Total Leads", value: stats?.totalLeads ?? 0, icon: Database, color: "text-blue-400" },
          { label: "New Today", value: "—", icon: Zap, color: "text-yellow-400" },
          { label: "Ready for Outreach", value: stats?.totalEnriched ?? 0, icon: Phone, color: "text-emerald-400" },
          { label: "Onboarded", value: states.reduce((s, st) => s + (st.total_onboarded || 0), 0), icon: CheckCircle2, color: "text-green-400" },
          { label: "Duplicate Rate", value: `${stats?.dupeRate ?? 0}%`, icon: Shield, color: "text-orange-400" },
          { label: "States Covered", value: `${stats?.statesCovered ?? 0}/50`, icon: Globe, color: "text-purple-400" },
          { label: "Categories", value: stats?.categoriesCovered ?? 0, icon: BarChart3, color: "text-pink-400" },
          { label: "Jobs Queued", value: stats?.queuedJobs ?? 0, icon: Target, color: "text-cyan-400" },
        ].map((kpi, i) => (
          <Card key={i} className="bg-card/50 border-border/50">
            <CardContent className="p-3 text-center">
              <kpi.icon className={`h-4 w-4 mx-auto mb-1 ${kpi.color}`} />
              <div className="text-lg font-bold">{kpi.value}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">{kpi.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 border-b border-border/50">
        {(["overview", "queue", "quality", "territory"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors rounded-t-md ${
              tab === t
                ? "bg-primary/10 text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {t === "overview" ? "Overview" : t === "queue" ? "Search Queue" : t === "quality" ? "Lead Quality" : "State Grid"}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search Campaign Control */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" /> Search Campaign Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Link to="/os/unforgettable/territory">
                  <Button variant="outline" className="w-full gap-1.5 h-10">
                    <Play className="h-3.5 w-3.5 text-emerald-400" /> Run Single State
                  </Button>
                </Link>
                <Link to="/os/unforgettable/territory">
                  <Button variant="outline" className="w-full gap-1.5 h-10">
                    <Globe className="h-3.5 w-3.5 text-blue-400" /> Multi-State Queue
                  </Button>
                </Link>
                <Button variant="outline" className="w-full gap-1.5 h-10" disabled>
                  <Pause className="h-3.5 w-3.5 text-yellow-400" /> Pause Automation
                </Button>
                <Button variant="outline" className="w-full gap-1.5 h-10" disabled>
                  <RotateCcw className="h-3.5 w-3.5 text-red-400" /> Retry Failed
                </Button>
              </div>

              {/* Recent Jobs */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">RECENT SEARCH JOBS</h4>
                {jobsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : recentJobs.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">No search jobs yet. Start a territory search.</div>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {recentJobs.slice(0, 10).map(job => (
                      <div key={job.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="text-sm font-medium">{job.city}, {job.state}</div>
                            <div className="text-xs text-muted-foreground capitalize">{job.category.replace(/_/g, " ")}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span>{job.leads_found} leads</span>
                          <Badge variant="outline" className={STATUS_STYLE[job.status] || ""}>{job.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Priority States */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-400" /> Priority States
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {priorityStates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No priority states set</p>
                ) : priorityStates.map(s => (
                  <div key={s.state} className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/30">
                    <div>
                      <div className="text-sm font-medium">{s.state}</div>
                      <div className="text-xs text-muted-foreground">{s.total_leads} leads • {s.cities_covered} cities</div>
                    </div>
                    <Badge variant="outline" className={STATUS_STYLE[s.status] || "text-muted-foreground"}>
                      {s.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" /> Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(stats?.failedJobs ?? 0) > 0 ? (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm">
                    <span className="font-medium text-red-400">{stats?.failedJobs}</span> failed jobs need retry
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-3">No alerts</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Queue Tab */}
      {tab === "queue" && <QueueTab jobs={recentJobs} isLoading={jobsLoading} />}

      {/* Quality Tab */}
      {tab === "quality" && <QualityTab stats={stats} />}

      {/* Territory Tab */}
      {tab === "territory" && <StateGridTab states={states} />}

      {/* Floor Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border/30">
        <Link to="/os/unforgettable/places">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer p-4">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-pink-500" />
              <div>
                <div className="text-sm font-medium">Google Places Finder</div>
                <div className="text-xs text-muted-foreground">Search vendors by category & location</div>
              </div>
              <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </div>
          </Card>
        </Link>
        <Link to="/os/unforgettable/territory">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer p-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-pink-500" />
              <div>
                <div className="text-sm font-medium">Territory Control</div>
                <div className="text-xs text-muted-foreground">50-state expansion board</div>
              </div>
              <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </div>
          </Card>
        </Link>
        <Card className="border-dashed p-4">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">CSV / Outscraper Import</div>
              <div className="text-xs text-muted-foreground">Bulk import from external sources</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Queue Tab ──────────────────────────────────────────────────
function QueueTab({ jobs, isLoading }: { jobs: TerritoryJob[]; isLoading: boolean }) {

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (jobs.length === 0) return (
    <Card className="p-12 text-center">
      <Search className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
      <p className="text-muted-foreground">No search jobs in queue. Go to Territory Control to create jobs.</p>
      <Link to="/os/unforgettable/territory">
        <Button className="mt-4 gap-1.5"><Globe className="h-3.5 w-3.5" /> Open Territory Control</Button>
      </Link>
    </Card>
  );

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>State</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Leads</TableHead>
              <TableHead className="text-center">Dupes</TableHead>
              <TableHead className="text-center">Enriched</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map(job => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.state}</TableCell>
                <TableCell>{job.city}</TableCell>
                <TableCell className="capitalize">{job.category.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-xs">{job.source}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={STATUS_STYLE[job.status] || ""}>{job.status}</Badge>
                </TableCell>
                <TableCell className="text-center">{job.leads_found}</TableCell>
                <TableCell className="text-center">{job.duplicates_skipped}</TableCell>
                <TableCell className="text-center">{job.enriched_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Quality Tab ────────────────────────────────────────────────
function QualityTab({ stats }: { stats: any }) {
  const withPhone = stats?.totalEnriched ?? 0;
  const total = stats?.totalLeads ?? 1;
  const phoneRate = total > 0 ? Math.round((withPhone / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lead Quality Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "With Phone", value: withPhone, total, color: "bg-emerald-500" },
            { label: "Enriched", value: stats?.totalEnriched ?? 0, total, color: "bg-blue-500" },
            { label: "Duplicates Skipped", value: stats?.totalDupes ?? 0, total: total + (stats?.totalDupes ?? 0), color: "bg-orange-500" },
          ].map((item, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm mb-1">
                <span>{item.label}</span>
                <span className="text-muted-foreground">{item.value} / {item.total}</span>
              </div>
              <Progress value={item.total > 0 ? (item.value / item.total) * 100 : 0} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pipeline Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Ready for Outreach", value: stats?.totalEnriched ?? 0, icon: Phone, color: "text-emerald-400" },
              { label: "Needs Enrichment", value: Math.max(0, (stats?.totalLeads ?? 0) - (stats?.totalEnriched ?? 0)), icon: Search, color: "text-yellow-400" },
              { label: "Duplicates", value: stats?.totalDupes ?? 0, icon: Shield, color: "text-orange-400" },
              { label: "Total Imported", value: stats?.totalLeads ?? 0, icon: Database, color: "text-blue-400" },
            ].map((item, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/30 text-center">
                <item.icon className={`h-5 w-5 mx-auto mb-1 ${item.color}`} />
                <div className="text-lg font-bold">{item.value}</div>
                <div className="text-[10px] text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── State Grid Tab ─────────────────────────────────────────────
function StateGridTab({ states }: { states: StateCoverage[] }) {
  const STATUS_BG: Record<string, string> = {
    not_started: "bg-muted/30 border-border/30",
    queued: "bg-yellow-500/5 border-yellow-500/20",
    in_progress: "bg-blue-500/5 border-blue-500/20",
    completed: "bg-emerald-500/5 border-emerald-500/20",
    needs_review: "bg-orange-500/5 border-orange-500/20",
  };

  const TIER_DOT: Record<string, string> = {
    priority: "bg-red-500",
    secondary: "bg-yellow-500",
    hold: "bg-muted-foreground",
    complete: "bg-emerald-500",
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
      {states.map(s => (
        <Link key={s.state} to={`/os/unforgettable/territory?state=${encodeURIComponent(s.state)}`}>
          <div className={`p-3 rounded-lg border cursor-pointer hover:border-primary/50 transition-colors ${STATUS_BG[s.status] || STATUS_BG.not_started}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-2 h-2 rounded-full ${TIER_DOT[s.priority_tier] || TIER_DOT.hold}`} />
              <span className="text-xs font-medium truncate">{s.state}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {s.total_leads} leads • {s.cities_covered} cities
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
