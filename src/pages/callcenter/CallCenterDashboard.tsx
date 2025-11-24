import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, MessageSquare, Mail, TrendingUp, AlertCircle, Users, Brain } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import CallCenterLayout from "./CallCenterLayout";

export default function CallCenterDashboard() {
  const { currentBusiness } = useBusiness();

  const { data: stats } = useQuery({
    queryKey: ['callcenter-stats', currentBusiness?.id],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const [allCalls, todayCalls, messages, emails, alerts, agents] = await Promise.all([
        supabase.from('call_center_logs').select('*', { count: 'exact', head: true }),
        supabase.from('call_center_logs').select('*').gte('created_at', today.toISOString()),
        supabase.from('call_center_messages').select('*', { count: 'exact', head: true }),
        supabase.from('call_center_emails').select('*', { count: 'exact', head: true }),
        supabase.from('call_center_alerts').select('*').eq('acknowledged', false),
        supabase.from('call_center_ai_agents').select('*').eq('is_active', true)
      ]);

      const aiHandled = todayCalls.data?.filter(c => c.ai_agent_id !== null).length || 0;
      const humanHandled = todayCalls.data?.filter(c => c.ai_agent_id === null && c.answered_by !== null).length || 0;
      const missedCalls = todayCalls.data?.filter(c => c.outcome === 'missed' || c.outcome === 'voicemail').length || 0;
      const avgSentiment = todayCalls.data?.reduce((acc, call) => acc + (call.sentiment_score || 0), 0) / (todayCalls.data?.length || 1);

      return {
        totalCalls: allCalls.count || 0,
        todayCalls: todayCalls.data?.length || 0,
        aiHandled,
        humanHandled,
        missedCalls,
        avgSentiment: Math.round(avgSentiment || 0),
        totalMessages: messages.count || 0,
        totalEmails: emails.count || 0,
        activeAlerts: alerts.data?.length || 0,
        activeAgents: agents.data?.length || 0
      };
    },
    enabled: !!currentBusiness
  });

  const { data: recentCalls } = useQuery({
    queryKey: ['recent-calls', currentBusiness?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('call_center_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!currentBusiness
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
            <CardTitle className="text-sm font-medium">Calls Today</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayCalls || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.totalCalls || 0} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Handled</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.aiHandled || 0}</div>
            <p className="text-xs text-muted-foreground">Human: {stats?.humanHandled || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missed Calls</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.missedCalls || 0}</div>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Sentiment</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgSentiment || 0}/100</div>
            <p className="text-xs text-muted-foreground">Customer satisfaction</p>
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