import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Hammer, Clock, CheckCircle2, XCircle, Loader2,
  Globe, Cpu, Zap, BarChart3, RefreshCw, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface BuildJob {
  id: string;
  client_id: string;
  project_id: string;
  build_engine: string;
  build_status: string;
  progress_stage: string;
  package_tier: string;
  pages_built: number;
  total_pages: number;
  content_generated: boolean;
  deployed_url: string | null;
  domain_connected: boolean;
  quality_score: number | null;
  retry_count: number;
  error_log: any[];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  initial_engine: string | null;
  final_engine: string | null;
  standardization_applied: boolean | null;
  engine_switched: boolean | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  queued: { label: "Queued", color: "bg-muted text-muted-foreground", icon: Clock },
  extracting_demo: { label: "Extracting Demo", color: "bg-blue-500/10 text-blue-500", icon: Cpu },
  generating_content: { label: "Generating Content", color: "bg-violet-500/10 text-violet-500", icon: Zap },
  building: { label: "Building", color: "bg-amber-500/10 text-amber-500", icon: Hammer },
  deploying: { label: "Deploying", color: "bg-cyan-500/10 text-cyan-500", icon: Globe },
  quality_check: { label: "Quality Check", color: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 },
  completed: { label: "Completed", color: "bg-green-500/10 text-green-500", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

export default function BuildPipelinePage() {
  const { data: buildJobs = [], isLoading, refetch } = useQuery({
    queryKey: ["brandaro-build-jobs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_build_jobs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BuildJob[];
    },
    refetchInterval: 10000, // Poll every 10s for active builds
  });

  const queued = buildJobs.filter(j => j.build_status === "queued");
  const inProgress = buildJobs.filter(j => 
    !["queued", "completed", "failed"].includes(j.build_status)
  );
  const completed = buildJobs.filter(j => j.build_status === "completed");
  const failed = buildJobs.filter(j => j.build_status === "failed");

  const avgBuildTime = completed.length > 0
    ? completed.reduce((sum, j) => {
        if (!j.started_at || !j.completed_at) return sum;
        return sum + (new Date(j.completed_at).getTime() - new Date(j.started_at).getTime());
      }, 0) / completed.length / 1000 / 60 // minutes
    : 0;

  const successRate = buildJobs.length > 0
    ? ((completed.length / buildJobs.length) * 100).toFixed(0)
    : "—";

  const nativeCount = completed.filter(j => j.build_engine === "native").length;
  const durableCount = completed.filter(j => j.build_engine === "durable").length;

  const retryBuild = async (jobId: string) => {
    try {
      const job = buildJobs.find(j => j.id === jobId);
      if (!job) return;
      await (supabase as any).from("brandaro_build_jobs").update({
        build_status: "queued",
        progress_stage: "manual_retry",
        retry_count: (job.retry_count || 0) + 1,
      }).eq("id", jobId);
      toast.success("Build re-queued");
      refetch();
    } catch (err) {
      toast.error("Failed to retry build");
    }
  };

  const getProgress = (job: BuildJob) => {
    const stages = ["queued", "extracting_demo", "generating_content", "building", "deploying", "quality_check", "completed"];
    const idx = stages.indexOf(job.build_status);
    return idx >= 0 ? Math.round((idx / (stages.length - 1)) * 100) : 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Hammer className="h-8 w-8 text-amber-500" />
            Build Pipeline
          </h1>
          <p className="text-muted-foreground mt-1">Automated website manufacturing — demo to production</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Pipeline Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{queued.length}</p>
            <p className="text-xs text-muted-foreground">Queued</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-amber-500">{inProgress.length}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-green-500">{completed.length}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-destructive">{failed.length}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-foreground">{avgBuildTime > 0 ? `${avgBuildTime.toFixed(1)}m` : "—"}</p>
            <p className="text-xs text-muted-foreground">Avg Build Time</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-foreground">{successRate}%</p>
            <p className="text-xs text-muted-foreground">Success Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Engine Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Engine Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <Zap className="h-3 w-3 text-cyan-500" /> Native Builder
                </span>
                <Badge variant="secondary">{nativeCount} builds</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <Cpu className="h-3 w-3 text-violet-500" /> Durable Engine
                </span>
                <Badge variant="secondary">{durableCount} builds</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${
                failed.length === 0 && inProgress.length === 0 ? "bg-green-500" :
                failed.length > 0 ? "bg-destructive" : "bg-amber-500"
              } animate-pulse`} />
              <span className="text-sm font-medium">
                {failed.length === 0 && inProgress.length === 0
                  ? "All Systems Operational"
                  : failed.length > 0
                  ? `${failed.length} Failed Build${failed.length > 1 ? "s" : ""}`
                  : `${inProgress.length} Build${inProgress.length > 1 ? "s" : ""} Active`}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Build Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">All Build Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {buildJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No build jobs yet. Complete a sale to trigger the auto-build pipeline.
            </p>
          ) : (
            <div className="space-y-3">
              {buildJobs.map((job) => {
                const config = statusConfig[job.build_status] || statusConfig.queued;
                const StatusIcon = config.icon;
                const progress = getProgress(job);

                return (
                  <div key={job.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusIcon className="h-5 w-5" />
                        <div>
                          <p className="text-sm font-medium">
                            Build #{job.id.slice(0, 8)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {job.package_tier?.toUpperCase()} • {job.build_engine} engine
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={config.color}>{config.label}</Badge>
                        {job.quality_score && (
                          <Badge variant="outline">{job.quality_score}/100</Badge>
                        )}
                      </div>
                    </div>

                    {!["completed", "failed", "queued"].includes(job.build_status) && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{job.progress_stage?.replace(/_/g, " ")}</span>
                          <span>{job.pages_built}/{job.total_pages} pages</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {job.started_at 
                          ? `Started ${new Date(job.started_at).toLocaleString()}`
                          : `Created ${new Date(job.created_at).toLocaleString()}`
                        }
                      </span>
                      <div className="flex items-center gap-2">
                        {job.deployed_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={job.deployed_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3 mr-1" /> View Site
                            </a>
                          </Button>
                        )}
                        {job.build_status === "failed" && job.retry_count < 3 && (
                          <Button variant="outline" size="sm" onClick={() => retryBuild(job.id)}>
                            <RefreshCw className="h-3 w-3 mr-1" /> Retry
                          </Button>
                        )}
                      </div>
                    </div>

                    {job.build_status === "failed" && job.error_log?.length > 0 && (
                      <div className="bg-destructive/5 rounded p-2 text-xs text-destructive">
                        {(job.error_log as any[]).slice(-1)[0]?.message || "Unknown error"}
                        {job.retry_count > 0 && (
                          <span className="ml-2 opacity-60">
                            (Retry {job.retry_count}/3)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
