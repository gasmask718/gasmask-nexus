// Dynasty Direct — Email Queue admin panel
// Reads from public.email_jobs. Status is derived from sent_at/skipped_at/attempts.
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const MAX_ATTEMPTS = 5;

type Job = {
  id: string;
  template: string;
  recipient_email: string;
  scheduled_for: string;
  sent_at: string | null;
  skipped_at: string | null;
  skipped_reason: string | null;
  attempts: number;
  last_error: string | null;
};

type DerivedStatus = "queued" | "sent" | "failed" | "permanently_failed" | "skipped";

function deriveStatus(j: Job): DerivedStatus {
  if (j.sent_at) return "sent";
  if (j.skipped_at) return "skipped";
  if (j.attempts >= MAX_ATTEMPTS) return "permanently_failed";
  if (j.attempts > 0 && j.last_error) return "failed";
  return "queued";
}

const STATUS_STYLES: Record<DerivedStatus, string> = {
  queued: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  sent: "bg-green-500/15 text-green-700 dark:text-green-300",
  failed: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  permanently_failed: "bg-red-500/15 text-red-700 dark:text-red-300",
  skipped: "bg-muted text-muted-foreground",
};

export default function EmailQueueAdmin() {
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["dd-email-queue-stats"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayIso = startOfDay.toISOString();

      const [queued, sentToday, failed, permFailed] = await Promise.all([
        (supabase as any)
          .from("email_jobs")
          .select("id", { count: "exact", head: true })
          .is("sent_at", null)
          .is("skipped_at", null)
          .lt("attempts", MAX_ATTEMPTS),
        (supabase as any)
          .from("email_jobs")
          .select("id", { count: "exact", head: true })
          .not("sent_at", "is", null)
          .gte("sent_at", todayIso),
        (supabase as any)
          .from("email_jobs")
          .select("id", { count: "exact", head: true })
          .is("sent_at", null)
          .is("skipped_at", null)
          .gt("attempts", 0)
          .lt("attempts", MAX_ATTEMPTS)
          .not("last_error", "is", null),
        (supabase as any)
          .from("email_jobs")
          .select("id", { count: "exact", head: true })
          .is("sent_at", null)
          .is("skipped_at", null)
          .gte("attempts", MAX_ATTEMPTS),
      ]);

      return {
        queued: queued.count ?? 0,
        sentToday: sentToday.count ?? 0,
        failed: failed.count ?? 0,
        permanentlyFailed: permFailed.count ?? 0,
      };
    },
    refetchInterval: 30_000,
  });

  const { data: jobs } = useQuery({
    queryKey: ["dd-email-queue-recent"],
    queryFn: async (): Promise<Job[]> => {
      const { data, error } = await (supabase as any)
        .from("email_jobs")
        .select("id,template,recipient_email,scheduled_for,sent_at,skipped_at,skipped_reason,attempts,last_error")
        .order("scheduled_for", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as Job[];
    },
    refetchInterval: 30_000,
  });

  const retry = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any)
        .from("email_jobs")
        .update({ attempts: 0, last_error: null, scheduled_for: new Date().toISOString() })
        .is("sent_at", null)
        .is("skipped_at", null)
        .gt("attempts", 0)
        .lt("attempts", MAX_ATTEMPTS)
        .not("last_error", "is", null)
        .select("id");
      if (error) throw error;
      return (data ?? []).length;
    },
    onSuccess: (n) => {
      toast.success(`${n} job${n === 1 ? "" : "s"} re-queued`);
      qc.invalidateQueries({ queryKey: ["dd-email-queue-stats"] });
      qc.invalidateQueries({ queryKey: ["dd-email-queue-recent"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Retry failed"),
  });

  const rows = useMemo(() => (jobs ?? []).map((j) => ({ ...j, status: deriveStatus(j) })), [jobs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-5 w-5" /> ✉️ Email Queue
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Queued" value={stats?.queued ?? 0} tone="blue" />
          <Stat label="Sent Today" value={stats?.sentToday ?? 0} tone="green" />
          <Stat label="Failed" value={stats?.failed ?? 0} tone="amber" />
          <Stat label="Perm. Failed" value={stats?.permanentlyFailed ?? 0} tone="red" />
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => retry.mutate()}
            disabled={retry.isPending || (stats?.failed ?? 0) === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${retry.isPending ? "animate-spin" : ""}`} />
            Retry Failed
          </Button>
        </div>

        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-sm">
                    No email jobs yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">{j.recipient_email}</TableCell>
                    <TableCell className="text-xs">{j.template}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLES[j.status]} variant="outline">
                        {j.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(j.scheduled_for).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {j.sent_at ? new Date(j.sent_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">{j.attempts}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Processor runs every 5 minutes via <code>dd-process-email-jobs</code>. Permanently failed = attempts ≥ {MAX_ATTEMPTS}.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "blue" | "green" | "amber" | "red" }) {
  const toneMap: Record<string, string> = {
    blue: "text-blue-600 dark:text-blue-300",
    green: "text-green-600 dark:text-green-300",
    amber: "text-amber-600 dark:text-amber-300",
    red: "text-red-600 dark:text-red-300",
  };
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${toneMap[tone]}`}>{value}</div>
    </div>
  );
}
