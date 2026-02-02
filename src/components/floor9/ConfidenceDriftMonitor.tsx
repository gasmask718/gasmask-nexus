import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, ComposedChart } from 'recharts';

interface DriftDataPoint {
  date: string;
  confidence: number;
  acceptanceRate: number;
  rejectionRate: number;
  totalDecisions: number;
}

interface DriftAlert {
  id: string;
  type: 'overconfident' | 'underconfident' | 'high_rejection' | 'acceptance_spike';
  severity: 'warning' | 'critical';
  message: string;
  confidence: number;
  humanRate: number;
  createdAt: string;
}

interface ConfidenceDriftMonitorProps {
  data: DriftDataPoint[];
  alerts: DriftAlert[];
  isLoading?: boolean;
}

export function ConfidenceDriftMonitor({ data, alerts, isLoading }: ConfidenceDriftMonitorProps) {
  // Calculate drift metrics
  const latestData = data[data.length - 1];
  const previousData = data[data.length - 2];
  
  const confidenceDrift = latestData && previousData 
    ? ((latestData.confidence - previousData.confidence) / previousData.confidence * 100).toFixed(1)
    : '0';
  
  const acceptanceDrift = latestData && previousData
    ? ((latestData.acceptanceRate - previousData.acceptanceRate) / previousData.acceptanceRate * 100).toFixed(1)
    : '0';

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');

  return (
    <div className="space-y-6">
      {/* Drift Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <Card className="border-red-500 bg-red-500/10">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-semibold text-red-500">Critical Confidence Drift Detected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {criticalAlerts.length} critical alert(s) require immediate attention
                </p>
                <div className="mt-3 space-y-2">
                  {criticalAlerts.map(alert => (
                    <div key={alert.id} className="p-2 bg-red-500/20 rounded text-sm">
                      <span className="font-medium">{alert.message}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        AI: {alert.confidence}% | Human: {alert.humanRate}%
                      </span>
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
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data}>
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
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data}>
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
        </CardContent>
      </Card>

      {/* Drift Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={Number(confidenceDrift) > 10 ? 'border-yellow-500/30' : ''}>
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
              {Number(confidenceDrift) > 0 ? '+' : ''}{confidenceDrift}%
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
              {Number(acceptanceDrift) > 0 ? '+' : ''}{acceptanceDrift}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">human approval rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Active Alerts</p>
              <AlertTriangle className={`h-4 w-4 ${
                criticalAlerts.length > 0 ? 'text-red-500' :
                warningAlerts.length > 0 ? 'text-yellow-500' : 'text-green-500'
              }`} />
            </div>
            <p className="text-2xl font-bold">
              {criticalAlerts.length + warningAlerts.length}
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

      {/* All Alerts List */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Drift Alerts (Never Auto-Resolve)</CardTitle>
            <CardDescription>
              These alerts require human acknowledgment — they do not clear automatically
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map(alert => (
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
                          <span>Human {alert.type.includes('rejection') ? 'Rejection' : 'Acceptance'}: {alert.humanRate}%</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Detected: {new Date(alert.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Hook to calculate drift alerts
export function calculateDriftAlerts(data: DriftDataPoint[]): DriftAlert[] {
  const alerts: DriftAlert[] = [];
  
  if (data.length < 2) return alerts;
  
  const latest = data[data.length - 1];
  
  // High confidence + high rejection = overconfident
  if (latest.confidence > 85 && latest.rejectionRate > 30) {
    alerts.push({
      id: `overconfident-${Date.now()}`,
      type: 'overconfident',
      severity: 'critical',
      message: 'AI is overconfident: High confidence but frequent human rejection',
      confidence: latest.confidence,
      humanRate: latest.rejectionRate,
      createdAt: new Date().toISOString(),
    });
  }
  
  // Low confidence + high acceptance = underconfident
  if (latest.confidence < 60 && latest.acceptanceRate > 80) {
    alerts.push({
      id: `underconfident-${Date.now()}`,
      type: 'underconfident',
      severity: 'warning',
      message: 'AI may be underconfident: Low confidence but high human acceptance',
      confidence: latest.confidence,
      humanRate: latest.acceptanceRate,
      createdAt: new Date().toISOString(),
    });
  }
  
  // Sudden rejection spike
  if (data.length >= 3) {
    const avgRejection = data.slice(-4, -1).reduce((sum, d) => sum + d.rejectionRate, 0) / 3;
    if (latest.rejectionRate > avgRejection * 1.5 && latest.rejectionRate > 25) {
      alerts.push({
        id: `rejection-spike-${Date.now()}`,
        type: 'high_rejection',
        severity: 'warning',
        message: 'Rejection rate spike detected: 50%+ increase from recent average',
        confidence: latest.confidence,
        humanRate: latest.rejectionRate,
        createdAt: new Date().toISOString(),
      });
    }
  }
  
  return alerts;
}
