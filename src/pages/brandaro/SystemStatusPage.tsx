import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Activity } from "lucide-react";

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "skip";
  message: string;
  detail?: string;
}

interface HealthResponse {
  timestamp: string;
  overall: "operational" | "degraded";
  fail_count: number;
  total_count: number;
  api_checks: CheckResult[];
  edge_function_checks: CheckResult[];
}

export default function SystemStatusPage() {
  const [manualKey, setManualKey] = useState(0);

  const { data, isLoading, isFetching, refetch } = useQuery<HealthResponse>({
    queryKey: ["system-health-check", manualKey],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("system-health-check", {
        method: "POST",
        body: {},
      });
      if (error) throw error;
      return data as HealthResponse;
    },
    staleTime: 60_000,
    retry: 0,
  });

  const handleRefresh = () => {
    setManualKey((k) => k + 1);
    refetch();
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "pass") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (status === "fail") return <XCircle className="h-5 w-5 text-red-500" />;
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  };

  const CheckRow = ({ check }: { check: CheckResult }) => (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <StatusIcon status={check.status} />
        <span className="font-medium">{check.name}</span>
      </div>
      <span className={`text-sm ${check.status === "pass" ? "text-green-400" : "text-red-400"}`}>
        {check.message}
      </span>
    </div>
  );

  const LoadingRow = () => (
    <div className="flex items-center justify-between py-3 border-b border-border/50">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-4 w-24" />
    </div>
  );

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            System Status
          </h1>
          <p className="text-muted-foreground mt-1">
            Brandaro API & Edge Function health checks
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data?.timestamp && (
            <span className="text-xs text-muted-foreground">
              Last checked: {new Date(data.timestamp).toLocaleTimeString()}
            </span>
          )}
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Banner */}
      {data && (
        <div
          className={`rounded-lg p-4 text-center font-semibold text-lg ${
            data.overall === "operational"
              ? "bg-green-500/10 text-green-400 border border-green-500/30"
              : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
          }`}
        >
          {data.overall === "operational"
            ? "✅ All systems operational"
            : `⚠️ ${data.fail_count} system${data.fail_count > 1 ? "s" : ""} need attention`}
        </div>
      )}

      {/* API Checks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            API Connections
            {data && (
              <Badge variant={data.api_checks.every((c) => c.status === "pass") ? "default" : "destructive"}>
                {data.api_checks.filter((c) => c.status === "pass").length}/{data.api_checks.length} passing
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <LoadingRow key={i} />)
            : data?.api_checks.map((check) => <CheckRow key={check.name} check={check} />)}
        </CardContent>
      </Card>

      {/* Edge Function Checks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Edge Functions
            {data && (
              <Badge variant={data.edge_function_checks.every((c) => c.status === "pass") ? "default" : "destructive"}>
                {data.edge_function_checks.filter((c) => c.status === "pass").length}/{data.edge_function_checks.length} deployed
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <LoadingRow key={i} />)
            : data?.edge_function_checks.map((check) => <CheckRow key={check.name} check={check} />)}
        </CardContent>
      </Card>

      {/* Booking Links */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            📅 Booking Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Website Strategy Call", url: "https://calendly.com/brandarodigital-sales/website-strategy-call" },
            { label: "Funding Consultation", url: "https://calendly.com/brandarodigital-sales/funding-consultation" },
          ].map((link) => (
            <div key={link.label} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <span className="font-medium">{link.label}</span>
                  <p className="text-xs text-muted-foreground">{link.url}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(link.url);
                    window.alert("Copied!");
                  }}
                >
                  Copy Link
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={link.url} target="_blank" rel="noreferrer">Open</a>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
