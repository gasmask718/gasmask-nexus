import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp, Store, Package, Users, DollarSign, Clock, Settings } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ExecutiveReports() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("reports");

  const { data: scheduleSettings } = useQuery({
    queryKey: ['report-schedule-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_schedule_settings')
        .select('*')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const { data: deliveryLogs } = useQuery({
    queryKey: ['executive-report-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('executive_report_logs')
        .select('*')
        .order('delivered_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  const updateSchedule = useMutation({
    mutationFn: async (settings: any) => {
      const { data: existing } = await supabase
        .from('report_schedule_settings')
        .select('id')
        .limit(1)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('report_schedule_settings')
          .update(settings)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('report_schedule_settings')
          .insert(settings);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Schedule settings updated');
      queryClient.invalidateQueries({ queryKey: ['report-schedule-settings'] });
    },
    onError: (error) => {
      toast.error('Failed to update schedule: ' + error.message);
    },
  });

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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="reports">
              <FileText className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="schedule">
              <Settings className="h-4 w-4 mr-2" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="logs">
              <Clock className="h-4 w-4 mr-2" />
              Delivery Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-4 mt-6">
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
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Report Schedule Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Daily Reports</Label>
                      <p className="text-sm text-muted-foreground">
                        Generate and send daily reports at {scheduleSettings?.daily_time || '07:00'}
                      </p>
                    </div>
                    <Switch
                      checked={scheduleSettings?.daily_enabled || false}
                      onCheckedChange={(checked) => 
                        updateSchedule.mutate({ ...scheduleSettings, daily_enabled: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Weekly Reports</Label>
                      <p className="text-sm text-muted-foreground">
                        Generate weekly reports every {scheduleSettings?.weekly_day || 'Monday'}
                      </p>
                    </div>
                    <Switch
                      checked={scheduleSettings?.weekly_enabled || false}
                      onCheckedChange={(checked) => 
                        updateSchedule.mutate({ ...scheduleSettings, weekly_enabled: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Monthly Reports</Label>
                      <p className="text-sm text-muted-foreground">
                        Generate monthly reports on day {scheduleSettings?.monthly_day || 1}
                      </p>
                    </div>
                    <Switch
                      checked={scheduleSettings?.monthly_enabled || false}
                      onCheckedChange={(checked) => 
                        updateSchedule.mutate({ ...scheduleSettings, monthly_enabled: checked })
                      }
                    />
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <Button
                    onClick={() => generateReport.mutate('daily')}
                    disabled={generateReport.isPending}
                    className="w-full"
                  >
                    Send Test Report Now
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    This will generate and deliver a report immediately
                  </p>
                </div>

                {scheduleSettings && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Next Scheduled Delivery</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {scheduleSettings.daily_enabled && (
                        <p>Daily: Tomorrow at {scheduleSettings.daily_time}</p>
                      )}
                      {scheduleSettings.weekly_enabled && (
                        <p>Weekly: Next {scheduleSettings.weekly_day} at {scheduleSettings.weekly_time}</p>
                      )}
                      {scheduleSettings.monthly_enabled && (
                        <p>Monthly: Day {scheduleSettings.monthly_day} at {scheduleSettings.monthly_time}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Delivery History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deliveryLogs?.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div>
                        <p className="font-medium capitalize">{log.period} Report</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(log.delivered_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="capitalize">
                          {log.delivery_method}
                        </Badge>
                        <Badge variant={log.status === 'sent' ? 'default' : 'secondary'}>
                          {log.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {(!deliveryLogs || deliveryLogs.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No delivery logs yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
