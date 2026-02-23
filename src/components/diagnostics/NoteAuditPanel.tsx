import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Play, RefreshCw, FileSearch } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface AuditFlag {
  id: string;
  title: string;
  description: string;
  flag_type: string;
  severity: string;
  confidence_score: number;
  status: string;
  store_id: string | null;
  created_at: string;
  event_id: string | null;
}

export function NoteAuditPanel() {
  const [isRunning, setIsRunning] = useState(false);

  const { data: flags = [], isLoading, refetch } = useQuery({
    queryKey: ["audit-flags-missing-invoice"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_flags")
        .select("*")
        .eq("flag_type", "MISSING_INVOICE")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AuditFlag[];
    },
  });

  // Join store names for display
  const { data: storeMap = {} } = useQuery({
    queryKey: ["audit-flag-stores", flags.map((f) => f.store_id).filter(Boolean)],
    queryFn: async () => {
      const storeIds = [...new Set(flags.map((f) => f.store_id).filter(Boolean))] as string[];
      if (storeIds.length === 0) return {};
      const { data } = await supabase
        .from("store_master")
        .select("id, store_name")
        .in("id", storeIds);
      const map: Record<string, string> = {};
      data?.forEach((s) => { map[s.id] = s.store_name || "Unknown"; });
      return map;
    },
    enabled: flags.length > 0,
  });

  const handleRunAudit = async () => {
    setIsRunning(true);
    try {
      const { error } = await supabase.functions.invoke("audit-note-parser", {
        body: { mode: "scan" },
      });
      if (error) throw error;
      toast.success("Audit scan initiated — results will appear shortly");
      // Delay refetch to allow processing
      setTimeout(() => refetch(), 3000);
    } catch (err: any) {
      toast.error(`Audit failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const severityColor = (sev: string) => {
    switch (sev) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const openCount = flags.filter((f) => f.status === "open").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSearch className="h-5 w-5 text-amber-600" />
          AI Note Audit — Missing Invoices
          {openCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {openCount} open
            </Badge>
          )}
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleRunAudit} disabled={isRunning}>
            <Play className="h-3.5 w-3.5 mr-1" />
            {isRunning ? "Running..." : "Run Audit"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : flags.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No missing invoice flags found.</p>
            <p className="text-xs mt-1">Run an audit to scan store notes for unmatched deliveries.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">Store</th>
                  <th className="text-left p-2 font-medium">Title</th>
                  <th className="text-left p-2 font-medium">Description</th>
                  <th className="text-center p-2 font-medium">Confidence</th>
                  <th className="text-center p-2 font-medium">Severity</th>
                  <th className="text-center p-2 font-medium">Status</th>
                  <th className="text-right p-2 font-medium">Flagged</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-2 font-medium">
                      {flag.store_id ? storeMap[flag.store_id] || flag.store_id.slice(0, 8) : "—"}
                    </td>
                    <td className="p-2">{flag.title}</td>
                    <td className="p-2 text-muted-foreground max-w-[300px] truncate">
                      {flag.description}
                    </td>
                    <td className="p-2 text-center">
                      <span className={`font-mono ${flag.confidence_score >= 0.7 ? "text-green-600" : flag.confidence_score >= 0.4 ? "text-amber-600" : "text-red-500"}`}>
                        {(flag.confidence_score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant={severityColor(flag.severity) as any}>
                        {flag.severity}
                      </Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant={flag.status === "open" ? "destructive" : "outline"}>
                        {flag.status}
                      </Badge>
                    </td>
                    <td className="p-2 text-right text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(flag.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
