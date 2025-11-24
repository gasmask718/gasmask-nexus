import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, MessageSquare, Mail, TrendingUp, AlertCircle, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import CallCenterLayout from "./CallCenterLayout";

export default function CallCenterDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['callcenter-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const [calls, messages, emails, alerts] = await Promise.all([
        supabase.from('call_center_logs').select('*', { count: 'exact', head: true }),
        supabase.from('call_center_messages').select('*', { count: 'exact', head: true }),
        supabase.from('call_center_emails').select('*', { count: 'exact', head: true }),
        supabase.from('call_center_alerts').select('*').eq('acknowledged', false)
      ]);

      return {
        totalCalls: calls.count || 0,
        totalMessages: messages.count || 0,
        totalEmails: emails.count || 0,
        activeAlerts: alerts.data?.length || 0
      };
    }
  });

  const { data: recentCalls } = useQuery({
    queryKey: ['recent-calls'],
    queryFn: async () => {
      const { data } = await supabase
        .from('call_center_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    }
  });

  return (
    <CallCenterLayout title="Dashboard">
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Call Center Cloud</h1>
        <p className="text-muted-foreground">Multi-business AI telephony command center</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCalls || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Text Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMessages || 0}</div>
            <p className="text-xs text-muted-foreground">All conversations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEmails || 0}</div>
            <p className="text-xs text-muted-foreground">All departments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeAlerts || 0}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
            <CardDescription>Latest incoming and outgoing calls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCalls?.slice(0, 5).map((call) => (
                <div key={call.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{call.caller_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {call.business_name} • {call.direction}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(call.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              {(!recentCalls || recentCalls.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No calls yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Agents Status</CardTitle>
            <CardDescription>Active AI agents across all businesses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {['GasMask Support', 'Wholesale AI', 'Real Estate AI', 'POD AI'].map((agent) => (
                <div key={agent} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">{agent}</p>
                      <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </CallCenterLayout>
  );
}