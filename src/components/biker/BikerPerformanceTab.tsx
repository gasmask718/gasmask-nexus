import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, TrendingDown, CheckCircle, XCircle, Clock, 
  AlertTriangle, RefreshCw, Save, Star
} from 'lucide-react';
import { useBikerPerformance, useBikerLatestPerformance, useComputeBikerPerformance, useUpdateCoachingNotes } from '@/hooks/useBikerPerformance';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BikerPerformanceTabProps {
  bikerId: string;
}

export const BikerPerformanceTab: React.FC<BikerPerformanceTabProps> = ({ bikerId }) => {
  const [coachingNotes, setCoachingNotes] = useState('');
  
  const { data: performanceHistory = [], isLoading } = useBikerPerformance(bikerId, 14);
  const { data: latestPerformance } = useBikerLatestPerformance(bikerId);
  const computePerformance = useComputeBikerPerformance();
  const updateNotes = useUpdateCoachingNotes();

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return { label: 'Excellent', variant: 'default' as const };
    if (score >= 80) return { label: 'Good', variant: 'secondary' as const };
    if (score >= 60) return { label: 'Needs Improvement', variant: 'outline' as const };
    return { label: 'At Risk', variant: 'destructive' as const };
  };

  const handleRecompute = () => {
    computePerformance.mutate({ bikerId });
  };

  const handleSaveNotes = () => {
    if (latestPerformance?.id) {
      updateNotes.mutate({ performanceId: latestPerformance.id, notes: coachingNotes });
    }
  };

  const chartData = performanceHistory.map(p => ({
    date: format(new Date(p.date), 'MMM d'),
    score: p.score,
    approved: p.tasks_approved,
    rejected: p.tasks_rejected
  }));

  const currentScore = latestPerformance?.score ?? 0;
  const scoreBadge = getScoreBadge(currentScore);
  const approvalRate = latestPerformance 
    ? (latestPerformance.tasks_submitted > 0 
        ? Math.round((latestPerformance.tasks_approved / latestPerformance.tasks_submitted) * 100)
        : 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Current Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="col-span-1 md:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Performance Score</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-5xl font-bold ${getScoreColor(currentScore)}`}>
                    {currentScore.toFixed(0)}
                  </span>
                  <div className="flex flex-col">
                    <Badge variant={scoreBadge.variant}>{scoreBadge.label}</Badge>
                    <span className="text-xs text-muted-foreground mt-1">out of 100</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleRecompute}
                  disabled={computePerformance.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${computePerformance.isPending ? 'animate-spin' : ''}`} />
                  Recompute
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvalRate}%</p>
                <p className="text-sm text-muted-foreground">Approval Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {latestPerformance?.avg_time_to_submit_minutes?.toFixed(0) || '-'}m
                </p>
                <p className="text-sm text-muted-foreground">Avg Submit Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Tasks Assigned', value: latestPerformance?.tasks_assigned || 0, icon: Star, color: 'text-purple-500' },
          { label: 'Submitted', value: latestPerformance?.tasks_submitted || 0, icon: CheckCircle, color: 'text-blue-500' },
          { label: 'Approved', value: latestPerformance?.tasks_approved || 0, icon: CheckCircle, color: 'text-green-500' },
          { label: 'Rejected', value: latestPerformance?.tasks_rejected || 0, icon: XCircle, color: 'text-red-500' },
          { label: 'Issues Reported', value: latestPerformance?.issues_reported || 0, icon: AlertTriangle, color: 'text-orange-500' }
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Score Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Score Trend (Last 14 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No performance data available yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Coaching Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Coaching Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Add coaching notes, feedback, or improvement suggestions..."
            value={coachingNotes || latestPerformance?.coaching_notes || ''}
            onChange={(e) => setCoachingNotes(e.target.value)}
            rows={4}
          />
          <Button onClick={handleSaveNotes} disabled={updateNotes.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Save Notes
          </Button>
        </CardContent>
      </Card>

      {/* Score Explanation */}
      <Card>
        <CardHeader>
          <CardTitle>Score Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Base Score</span>
                <span>100</span>
              </div>
              <Progress value={100} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-red-500">Rejection Penalty (-{((latestPerformance?.tasks_rejected || 0) / Math.max(latestPerformance?.tasks_submitted || 1, 1) * 30).toFixed(0)})</span>
                <span>Based on rejection rate × 30</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-orange-500">Late Penalty (-{((latestPerformance?.tasks_late || 0) / Math.max(latestPerformance?.tasks_submitted || 1, 1) * 25).toFixed(0)})</span>
                <span>Based on late rate × 25</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-green-500">Approval Bonus (+{(latestPerformance?.tasks_approved || 0) * 2})</span>
                <span>+2 per approved task</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BikerPerformanceTab;
