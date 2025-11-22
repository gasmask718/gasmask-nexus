import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, TrendingUp, Store, Package, Users, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

export default function ExecutiveReports() {
  const queryClient = useQueryClient();

  const { data: reports, isLoading } = useQuery({
    queryKey: ['executive-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('executive_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  // Mark all reports as read when the page loads
  useEffect(() => {
    const markAllAsRead = async () => {
      if (reports && reports.length > 0) {
        const unreadReports = reports.filter((r: any) => !r.is_read);
        if (unreadReports.length > 0) {
          await supabase
            .from('executive_reports')
            .update({ is_read: true })
            .eq('is_read', false);
          
          queryClient.invalidateQueries({ queryKey: ['executive-reports'] });
        }
      }
    };

    markAllAsRead();
  }, [reports, queryClient]);

  const generateReport = useMutation({
    mutationFn: async (period: 'daily' | 'weekly' | 'monthly') => {
      const { data, error } = await supabase.functions.invoke('executive-reports', {
        body: { action: 'generateReport', period, date: new Date().toISOString() },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Executive report generated successfully');
      queryClient.invalidateQueries({ queryKey: ['executive-reports'] });
    },
    onError: (error) => {
      toast.error('Failed to generate report: ' + error.message);
    },
  });

  const getPeriodBadge = (period: string) => {
    const colors: Record<string, string> = {
      daily: 'bg-primary/20 text-primary',
      weekly: 'bg-accent/20 text-accent-foreground',
      monthly: 'bg-secondary/20 text-secondary-foreground',
    };
    return colors[period] || 'bg-muted';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Executive Reports</h1>
            <p className="text-muted-foreground">Automated KPI summaries and insights</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => generateReport.mutate('daily')}
              disabled={generateReport.isPending}
            >
              Generate Daily Report
            </Button>
            <Button
              onClick={() => generateReport.mutate('weekly')}
              disabled={generateReport.isPending}
              variant="outline"
            >
              Generate Weekly Report
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {reports?.map((report) => {
            const data = report.data as any;
            
            return (
              <Card key={report.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <CardTitle>
                          {new Date(report.report_date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Generated {new Date(report.generated_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge className={getPeriodBadge(report.period)}>
                      {report.period}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
                      <DollarSign className="h-8 w-8 text-primary" />
                      <div>
                        <p className="text-2xl font-bold">
                          ${data.summary?.totalRevenue?.toLocaleString() || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Revenue</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
                      <Store className="h-8 w-8 text-accent" />
                      <div>
                        <p className="text-2xl font-bold">{data.summary?.activeStores || 0}</p>
                        <p className="text-xs text-muted-foreground">Active Stores</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
                      <TrendingUp className="h-8 w-8 text-secondary" />
                      <div>
                        <p className="text-2xl font-bold">{data.summary?.completedRoutes || 0}</p>
                        <p className="text-xs text-muted-foreground">Routes Completed</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{data.summary?.completedMissions || 0}</p>
                        <p className="text-xs text-muted-foreground">Missions Complete</p>
                      </div>
                    </div>
                  </div>

                  {data.topPerformers && data.topPerformers.length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Top Performers
                      </h4>
                      <div className="space-y-2">
                        {data.topPerformers.slice(0, 3).map((performer: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span>{performer.profiles?.name || 'Unknown'}</span>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">Level {performer.level}</Badge>
                              <span className="text-muted-foreground">
                                {performer.xp_total} XP
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {(!reports || reports.length === 0) && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No reports generated yet</p>
                <Button onClick={() => generateReport.mutate('daily')}>
                  Generate Your First Report
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
