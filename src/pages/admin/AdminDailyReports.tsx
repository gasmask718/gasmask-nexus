import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { RefreshCw, Mail, MessageSquare, Eye } from "lucide-react";

interface DailyReport {
  id: string;
  report_date: string;
  metrics: any;
  email_body: string | null;
  sms_body: string | null;
  sent_to: string[] | null;
  generated_at: string;
}

export default function AdminDailyReports() {
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<DailyReport | null>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ["daily-ops-reports"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("daily_ops_reports")
        .select("*")
        .order("report_date", { ascending: false })
        .limit(90);
      if (error) throw error;
      return (data || []) as DailyReport[];
    },
  });

  const resend = useMutation({
    mutationFn: async (report_date?: string) => {
      const { data, error } = await supabase.functions.invoke("generate-daily-ops-report", {
        body: report_date ? { report_date } : {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Report regenerated and sent");
      qc.invalidateQueries({ queryKey: ["daily-ops-reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📊 Daily Ops Reports</h1>
          <p className="text-muted-foreground">Automated 7 AM digest of empire-wide TopTier metrics</p>
        </div>
        <Button onClick={() => resend.mutate(undefined)} disabled={resend.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${resend.isPending ? "animate-spin" : ""}`} />
          Resend Yesterday's Report
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : !reports?.length ? (
            <p className="text-muted-foreground text-sm">No reports yet. The first will generate tomorrow at 7 AM UTC, or click Resend to generate now.</p>
          ) : (
            <div className="divide-y">
              {reports.map((r) => {
                const m = r.metrics || {};
                const sms = (r.sent_to || []).some(s => s.startsWith("sms:"));
                const email = (r.sent_to || []).some(s => s.startsWith("email:"));
                return (
                  <div key={r.id} className="flex items-center justify-between py-3 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{format(new Date(r.report_date + "T00:00:00"), "EEE, MMM d, yyyy")}</div>
                      <div className="text-sm text-muted-foreground">
                        {m.bookings?.total ?? 0} bookings · ${Number(m.revenue || 0).toLocaleString()} revenue
                        {m.alerts?.sla_breaches > 0 && <span className="text-red-500 ml-2">· ⚠ {m.alerts.sla_breaches} SLA</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {sms && <Badge variant="secondary" className="gap-1"><MessageSquare className="h-3 w-3" />SMS</Badge>}
                      {email && <Badge variant="secondary" className="gap-1"><Mail className="h-3 w-3" />Email</Badge>}
                      <Button size="sm" variant="outline" onClick={() => setViewing(r)}>
                        <Eye className="h-4 w-4 mr-1" />View
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => resend.mutate(r.report_date)} disabled={resend.isPending}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Daily Report — {viewing?.report_date}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              {viewing.sms_body && (
                <div>
                  <h3 className="text-sm font-semibold mb-1 text-muted-foreground">SMS Summary</h3>
                  <pre className="bg-muted p-3 rounded text-sm whitespace-pre-wrap font-mono">{viewing.sms_body}</pre>
                </div>
              )}
              {viewing.email_body && (
                <div>
                  <h3 className="text-sm font-semibold mb-1 text-muted-foreground">Email Digest</h3>
                  <iframe
                    title="Email preview"
                    srcDoc={viewing.email_body}
                    className="w-full border rounded"
                    style={{ height: "600px" }}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
