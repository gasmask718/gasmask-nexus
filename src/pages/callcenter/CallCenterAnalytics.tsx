import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Phone, Users, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import CallCenterLayout from "./CallCenterLayout";

export default function CallCenterAnalytics() {
  const { currentBusiness } = useBusiness();

  const { data: callStats } = useQuery({
    queryKey: ['call-center-analytics', currentBusiness?.id],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('call_center_logs')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString());
      
      if (error) throw error;

      // Calculate metrics
      const totalCalls = data.length;
      const avgSentiment = data.reduce((acc, log) => acc + (log.sentiment_score || 50), 0) / (totalCalls || 1);
      const avgDuration = data.reduce((acc, log) => acc + (log.duration || 0), 0) / (totalCalls || 1);

      // Calls per day
      const callsByDay = data.reduce((acc: Record<string, number>, log) => {
        const day = new Date(log.created_at || '').toISOString().split('T')[0];
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {});

      // Emotions distribution
      const emotionCounts = data.reduce((acc: Record<string, number>, log) => {
        const emotion = log.emotion_detected || 'unknown';
        acc[emotion] = (acc[emotion] || 0) + 1;
        return acc;
      }, {});

      // Outcomes distribution
      const outcomeCounts = data.reduce((acc: Record<string, number>, log) => {
        const outcome = log.outcome || 'unknown';
        acc[outcome] = (acc[outcome] || 0) + 1;
        return acc;
      }, {});

      // AI agent performance
      const agentPerformance = data.reduce((acc: Record<string, any>, log) => {
        if (log.ai_agent_id) {
          if (!acc[log.ai_agent_id]) {
            acc[log.ai_agent_id] = {
              calls: 0,
              totalSentiment: 0,
              completed: 0
            };
          }
          acc[log.ai_agent_id].calls += 1;
          acc[log.ai_agent_id].totalSentiment += log.sentiment_score || 50;
          if (log.outcome === 'completed') acc[log.ai_agent_id].completed += 1;
        }
        return acc;
      }, {});

      return {
        totalCalls,
        avgSentiment,
        avgDuration,
        callsByDay,
        emotionCounts,
        outcomeCounts,
        agentPerformance
      };
    },
    enabled: !!currentBusiness
  });

  const { data: aiAgents } = useQuery({
    queryKey: ['call-center-ai-agents-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_center_ai_agents')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

  const getPerformanceScore = (agentId: string) => {
    if (!callStats?.agentPerformance[agentId]) return 0;
    const perf = callStats.agentPerformance[agentId];
    const avgSentiment = perf.totalSentiment / perf.calls;
    const completionRate = (perf.completed / perf.calls) * 100;
    return Math.round((avgSentiment * 0.6) + (completionRate * 0.4));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <CallCenterLayout title="Analytics">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Call Center Analytics</h1>
          <p className="text-muted-foreground">Performance metrics and insights</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls (30d)</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{callStats?.totalCalls || 0}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Sentiment</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(callStats?.avgSentiment || 0)}/100</div>
              <p className="text-xs text-muted-foreground">Customer satisfaction</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.floor((callStats?.avgDuration || 0) / 60)}:{String(Math.floor((callStats?.avgDuration || 0) % 60)).padStart(2, '0')}
              </div>
              <p className="text-xs text-muted-foreground">Minutes per call</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aiAgents?.filter(a => a.is_active).length || 0}</div>
              <p className="text-xs text-muted-foreground">AI agents online</p>
            </CardContent>
          </Card>
        </div>

        {/* Emotion Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Emotion Distribution</CardTitle>
            <CardDescription>Customer emotions detected during calls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {callStats?.emotionCounts && Object.entries(callStats.emotionCounts).map(([emotion, count]) => (
                <div key={emotion} className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {emotion}
                  </Badge>
                  <span className="text-sm font-medium">{count as number}</span>
                </div>
              ))}
              {(!callStats?.emotionCounts || Object.keys(callStats.emotionCounts).length === 0) && (
                <p className="text-sm text-muted-foreground">No emotion data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Outcome Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Call Outcomes</CardTitle>
            <CardDescription>How calls are resolved</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {callStats?.outcomeCounts && Object.entries(callStats.outcomeCounts).map(([outcome, count]) => (
                <div key={outcome} className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {outcome}
                  </Badge>
                  <span className="text-sm font-medium">{count as number}</span>
                </div>
              ))}
              {(!callStats?.outcomeCounts || Object.keys(callStats.outcomeCounts).length === 0) && (
                <p className="text-sm text-muted-foreground">No outcome data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Agent Performance */}
        <Card>
          <CardHeader>
            <CardTitle>AI Agent Performance</CardTitle>
            <CardDescription>Performance scores based on sentiment and completion rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiAgents?.map((agent) => {
                const score = getPerformanceScore(agent.id);
                const calls = callStats?.agentPerformance[agent.id]?.calls || 0;
                return (
                  <div key={agent.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {calls} calls • {agent.business_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${getScoreColor(score)}`}>
                        {score}
                      </p>
                      <p className="text-xs text-muted-foreground">Performance Score</p>
                    </div>
                  </div>
                );
              })}
              {(!aiAgents || aiAgents.length === 0) && (
                <p className="text-center text-muted-foreground py-4">No AI agents configured</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </CallCenterLayout>
  );
}
