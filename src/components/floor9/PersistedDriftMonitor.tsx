import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, TrendingDown, Activity, CheckCircle, RefreshCw, Database } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, ComposedChart } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useChartReadyDriftData, useAcknowledgeDriftAlert, useCalculateDriftAlerts } from '@/hooks/useDriftAlerts';
import { ImmutableLogNotice } from './ShadowModeEnforcement';

/**
 * PHASE 9.1: Persisted Drift Monitor
 * 
 * Uses REAL database data, not mock/random values.
 * Drift alerts persist and require human acknowledgment.
 * Never auto-resolves.
 */
export function PersistedDriftMonitor() {
  const { chartData, alerts, isLoading, hasRealData } = useChartReadyDriftData();
  const acknowledgeMutation = useAcknowledgeDriftAlert();
  const calculateMutation = useCalculateDriftAlerts();

  // Calculate drift metrics
  const latestData = chartData[chartData.length - 1];
  const previousData = chartData[chartData.length - 2];
  
  const confidenceDrift = latestData && previousData && previousData.confidence > 0
    ? ((latestData.confidence - previousData.confidence) / previousData.confidence * 100).toFixed(1)
    : '0';
  
  const acceptanceDrift = latestData && previousData && previousData.acceptanceRate > 0
    ? ((latestData.acceptanceRate - previousData.acceptanceRate) / previousData.acceptanceRate * 100).toFixed(1)
    : '0';

  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && a.status === 'open');
  const warningAlerts = alerts.filter(a => a.severity === 'warning' && a.status === 'open');
  const openAlerts = alerts.filter(a => a.status === 'open');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[300px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Source Indicator */}
      <Card className="border-primary/20">
        <CardContent className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {hasRealData ? 'Using Real Database Metrics' : 'No Drift Data Yet'}
            </span>
            <Badge variant={hasRealData ? 'default' : 'secondary'} className="text-xs">
              {hasRealData ? 'Live Data' : 'Awaiting Data'}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => calculateMutation.mutate()}
            disabled={calculateMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${calculateMutation.isPending ? 'animate-spin' : ''}`} />
            Recalculate Drift
          </Button>
        </CardContent>
      </Card>

      {/* Critical Drift Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <Card className="border-red-500 bg-red-500/10">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-500">Critical Confidence Drift Detected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {criticalAlerts.length} critical alert(s) require immediate human attention
                </p>
                <div className="mt-3 space-y-2">
                  {criticalAlerts.slice(0, 3).map(alert => (
                    <div key={alert.id} className="p-2 bg-red-500/20 rounded text-sm flex items-center justify-between">
                      <div>
                        <span className="font-medium">{alert.message}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          AI: {alert.confidence}% | Human: {alert.humanRate}%
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => acknowledgeMutation.mutate({ alertId: alert.id })}
                        disabled={acknowledgeMutation.isPending}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Acknowledge
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confidence vs Acceptance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Confidence vs Human Acceptance
          </CardTitle>
          <CardDescription>
            Detects when AI confidence diverges from human agreement — trust erosion indicator
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasRealData ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    domain={[0, 100]}
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="acceptanceRate" 
                    fill="hsl(142.1, 76.2%, 36.3%)" 
                    fillOpacity={0.2}
                    stroke="hsl(142.1, 76.2%, 36.3%)"
                    name="Human Acceptance %"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="confidence" 
                    stroke="hsl(221.2, 83.2%, 53.3%)" 
                    strokeWidth={2}
                    dot={false}
                    name="AI Confidence %"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No confidence data available yet</p>
                <p className="text-sm mt-1">Data will appear after AI actions with confidence scores are processed</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confidence vs Rejection Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Confidence vs Human Rejection
          </CardTitle>
          <CardDescription>
            High confidence + high rejection = overconfident AI reasoning
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasRealData ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    domain={[0, 100]}
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="rejectionRate" 
                    fill="hsl(0, 84.2%, 60.2%)" 
                    fillOpacity={0.3}
                    stroke="hsl(0, 84.2%, 60.2%)"
                    name="Human Rejection %"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="confidence" 
                    stroke="hsl(221.2, 83.2%, 53.3%)" 
                    strokeWidth={2}
                    dot={false}
                    name="AI Confidence %"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[150px] flex items-center justify-center text-muted-foreground">
              <p>Awaiting rejection data</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drift Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={Math.abs(Number(confidenceDrift)) > 10 ? 'border-yellow-500/30' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Confidence Drift</p>
              {Number(confidenceDrift) > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className={`text-2xl font-bold ${
              Math.abs(Number(confidenceDrift)) > 10 ? 'text-yellow-500' : ''
            }`}>
              {hasRealData ? `${Number(confidenceDrift) > 0 ? '+' : ''}${confidenceDrift}%` : 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">vs previous period</p>
          </CardContent>
        </Card>

        <Card className={Number(acceptanceDrift) < -10 ? 'border-red-500/30' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Acceptance Drift</p>
              {Number(acceptanceDrift) > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className={`text-2xl font-bold ${
              Number(acceptanceDrift) < -10 ? 'text-red-500' : ''
            }`}>
              {hasRealData ? `${Number(acceptanceDrift) > 0 ? '+' : ''}${acceptanceDrift}%` : 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">human approval rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Open Alerts</p>
              <AlertTriangle className={`h-4 w-4 ${
                criticalAlerts.length > 0 ? 'text-red-500' :
                warningAlerts.length > 0 ? 'text-yellow-500' : 'text-green-500'
              }`} />
            </div>
            <p className="text-2xl font-bold">
              {openAlerts.length}
            </p>
            <div className="flex gap-2 mt-1">
              {criticalAlerts.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {criticalAlerts.length} critical
                </Badge>
              )}
              {warningAlerts.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {warningAlerts.length} warning
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Open Alerts List */}
      {openAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Drift Alerts (Require Human Acknowledgment)</CardTitle>
            <CardDescription>
              These alerts persist in the database and never auto-resolve
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImmutableLogNotice />
            <div className="space-y-3 mt-4">
              {openAlerts.map(alert => (
                <div 
                  key={alert.id}
                  className={`p-4 rounded-lg border ${
                    alert.severity === 'critical' 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : 'bg-yellow-500/10 border-yellow-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                        alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                      }`} />
                      <div>
                        <p className="font-medium">{alert.message}</p>
                        <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                          <span>AI Confidence: {alert.confidence}%</span>
                          <span>Human Rate: {alert.humanRate}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Detected: {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {alert.severity}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => acknowledgeMutation.mutate({ alertId: alert.id })}
                        disabled={acknowledgeMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Acknowledge
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
