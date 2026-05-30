/**
 * Phase 5 Dashboard — Shadow Mode Monitoring
 * 
 * Displays Phase 5 status, recommendations, agreement rates, and patterns.
 * All controls are admin-only.
 */

import { useState, useEffect } from 'react';
import { usePhase5 } from '@/contexts/Phase5Context';
import {
  fetchRecentRecommendations,
  fetchPatterns,
  getAgreementStats,
  Phase5Recommendation,
  Phase5Pattern,
} from '@/lib/phase5Engine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Brain,
  Eye,
  EyeOff,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Activity,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function Phase5Dashboard() {
  const {
    mode,
    enabled,
    killSwitchActive,
    isLoading,
    setMode,
    toggleKillSwitch,
    canControl,
    stats,
    isShadowMode,
    refreshStats,
  } = usePhase5();

  const [recommendations, setRecommendations] = useState<Phase5Recommendation[]>([]);
  const [patterns, setPatterns] = useState<Phase5Pattern[]>([]);
  const [agreementStats, setAgreementStats] = useState<{
    total: number;
    agreed: number;
    disagreed: number;
    rate: number;
    byType: Record<string, { agreed: number; total: number }>;
  } | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const [recs, pats, agStats] = await Promise.all([
        fetchRecentRecommendations(50),
        fetchPatterns(),
        getAgreementStats(),
      ]);
      setRecommendations(recs);
      setPatterns(pats);
      setAgreementStats(agStats);
      await refreshStats();
    } catch (err) {
      console.error('Failed to fetch Phase 5 data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleModeChange = async (newMode: string) => {
    if (newMode === 'active') {
      toast.error('Active mode is not yet implemented');
      return;
    }
    const success = await setMode(newMode as 'off' | 'shadow' | 'active');
    if (success) {
      toast.success(`Phase 5 mode set to ${newMode}`);
    } else {
      toast.error('Failed to change mode');
    }
  };

  const handleKillSwitch = async () => {
    const success = await toggleKillSwitch();
    if (success) {
      toast.success(killSwitchActive ? 'Kill switch deactivated' : 'Kill switch ACTIVATED');
    } else {
      toast.error('Failed to toggle kill switch');
    }
  };

  const getRecommendationBadge = (type: string) => {
    switch (type) {
      case 'approve':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Approve</Badge>;
      case 'reject':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Reject</Badge>;
      case 'escalate':
        return <Badge className="bg-yellow-500"><AlertOctagon className="h-3 w-3 mr-1" />Escalate</Badge>;
      case 'amend':
        return <Badge variant="secondary"><Activity className="h-3 w-3 mr-1" />Amend</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getPatternBadge = (type: string) => {
    switch (type) {
      case 'conflict_pattern':
        return <Badge variant="destructive">Conflict</Badge>;
      case 'approval_pattern':
        return <Badge className="bg-green-500">Approval</Badge>;
      case 'escalation_pattern':
        return <Badge className="bg-yellow-500">Escalation</Badge>;
      case 'drift_pattern':
        return <Badge variant="secondary">Drift</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Mode Control */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Phase 5: Shadow Mode</h2>
            <p className="text-muted-foreground">Predictive Autonomy & Adaptive Governance</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {canControl && (
            <>
              <Select value={mode} onValueChange={handleModeChange} disabled={killSwitchActive}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="shadow">Shadow</SelectItem>
                  <SelectItem value="active" disabled>Active (Future)</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={killSwitchActive ? 'destructive' : 'outline'}
                onClick={handleKillSwitch}
              >
                <Zap className="h-4 w-4 mr-2" />
                Kill Switch {killSwitchActive ? 'ON' : 'OFF'}
              </Button>
            </>
          )}
          <Button variant="outline" onClick={fetchData} disabled={loadingData}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingData ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      {killSwitchActive ? (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertOctagon className="h-6 w-6 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">KILL SWITCH ACTIVATED</p>
                <p className="text-sm text-muted-foreground">
                  Phase 5 is completely disabled. No recommendations are being generated.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isShadowMode ? (
        <Card className="border-primary bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Eye className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold text-primary">SHADOW MODE ACTIVE</p>
                <p className="text-sm text-muted-foreground">
                  Phase 5 is observing and generating recommendations. No actions are being taken automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-muted">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <EyeOff className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="font-semibold text-muted-foreground">PHASE 5 DISABLED</p>
                <p className="text-sm text-muted-foreground">
                  Enable Shadow Mode to start observing intent flow and generating recommendations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalRecommendations || 0}</p>
          </CardContent>
        </Card>
        <Card className={agreementStats && agreementStats.rate >= 80 ? 'border-green-500' : ''}>
          <CardHeader className="pb-2">
            <CardDescription>Agreement Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{agreementStats?.rate.toFixed(1) || 0}%</p>
            <Progress 
              value={agreementStats?.rate || 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.pendingReview || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Patterns Detected</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.patternsDetected || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="agreement">Agreement Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Recommendations</CardTitle>
              <CardDescription>
                What Phase 5 would have recommended for each intent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Recommendation</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Reasoning</TableHead>
                    <TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendations.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(rec.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>{getRecommendationBadge(rec.recommendation_type)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={rec.confidence_score * 100} 
                            className="w-16 h-2"
                          />
                          <span className="text-sm">{(rec.confidence_score * 100).toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={rec.reasoning}>
                        {rec.reasoning}
                      </TableCell>
                      <TableCell>
                        {rec.actual_outcome ? (
                          <div className="flex items-center gap-2">
                            {rec.human_agreed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                            <span className="text-sm capitalize">{rec.actual_outcome}</span>
                          </div>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {recommendations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No recommendations yet. Phase 5 will generate recommendations as intents flow through the system.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detected Patterns</CardTitle>
              <CardDescription>
                Recurring behaviors and anomalies observed by Phase 5
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pattern Type</TableHead>
                    <TableHead>Observations</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>First Seen</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patterns.map((pattern) => (
                    <TableRow key={pattern.id}>
                      <TableCell>{getPatternBadge(pattern.pattern_type)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{pattern.observation_count}x</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={pattern.confidence * 100} 
                            className="w-16 h-2"
                          />
                          <span className="text-sm">{(pattern.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(pattern.first_observed_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(pattern.last_observed_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {pattern.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {patterns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No patterns detected yet. Patterns emerge as the system observes more intent flow.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agreement" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Agreement Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-3xl font-bold text-green-500">{agreementStats?.agreed || 0}</p>
                    <p className="text-sm text-muted-foreground">Agreed</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-destructive">{agreementStats?.disagreed || 0}</p>
                    <p className="text-sm text-muted-foreground">Disagreed</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{agreementStats?.total || 0}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>
                <div className="pt-4">
                  <p className="text-sm text-muted-foreground mb-2">Overall Agreement Rate</p>
                  <Progress value={agreementStats?.rate || 0} className="h-3" />
                  <p className="text-right text-sm mt-1">{agreementStats?.rate.toFixed(1) || 0}%</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Agreement by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {agreementStats?.byType && Object.entries(agreementStats.byType).map(([type, data]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="capitalize">{type}</span>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={(data.agreed / data.total) * 100} 
                          className="w-24 h-2"
                        />
                        <span className="text-sm text-muted-foreground">
                          {data.agreed}/{data.total}
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!agreementStats?.byType || Object.keys(agreementStats.byType).length === 0) && (
                    <p className="text-center text-muted-foreground py-4">
                      No agreement data yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
