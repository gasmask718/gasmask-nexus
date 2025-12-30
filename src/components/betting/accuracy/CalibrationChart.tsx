import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  Area,
} from 'recharts';
import { CalibrationPoint } from '@/hooks/useAccuracyMetrics';
import { Target, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface CalibrationChartProps {
  data: CalibrationPoint[];
}

export function CalibrationChart({ data }: CalibrationChartProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Calibration Analysis
          </CardTitle>
          <CardDescription className="text-xs">
            Compares predicted probabilities to actual win rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground text-sm py-12">
            No calibration data available yet
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate overall calibration quality
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);
  const weightedError = data.reduce((sum, d) => sum + d.calibrationError * d.count, 0) / totalCount;
  const calibrationQuality = 
    weightedError < 5 ? 'Excellent' :
    weightedError < 10 ? 'Good' :
    weightedError < 15 ? 'Fair' :
    'Poor';

  // Prepare chart data with perfect calibration line
  const chartData = data.map(d => ({
    ...d,
    perfectCalibration: d.avgPredictedProb, // y = x line
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Calibration Analysis
            </CardTitle>
            <CardDescription className="text-xs">
              If 70% confident predictions actually win ~70%, the model is well-calibrated
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={
              calibrationQuality === 'Excellent' ? 'default' :
              calibrationQuality === 'Good' ? 'secondary' :
              'destructive'
            } className="text-xs">
              {calibrationQuality} Calibration
            </Badge>
            <Tabs value={view} onValueChange={(v) => setView(v as 'chart' | 'table')}>
              <TabsList className="h-8">
                <TabsTrigger value="chart" className="text-xs px-3 h-7">Chart</TabsTrigger>
                <TabsTrigger value="table" className="text-xs px-3 h-7">Table</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {view === 'chart' ? (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="avgPredictedProb" 
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  label={{ value: 'Predicted Probability', position: 'bottom', fontSize: 11 }}
                  domain={[0, 100]}
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  label={{ value: 'Actual Win Rate', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'actualWinRate') return [`${value.toFixed(1)}%`, 'Actual Win Rate'];
                    if (name === 'perfectCalibration') return [`${value.toFixed(1)}%`, 'Perfect Calibration'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Predicted: ${Number(label).toFixed(0)}%`}
                />
                {/* Perfect calibration line (y = x) */}
                <Line
                  type="monotone"
                  dataKey="perfectCalibration"
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  name="perfectCalibration"
                />
                {/* Actual win rate */}
                <Line
                  type="monotone"
                  dataKey="actualWinRate"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 5 }}
                  name="actualWinRate"
                />
              </ComposedChart>
            </ResponsiveContainer>
            
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-primary" />
                <span>Actual Win Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 border-t-2 border-dashed border-muted-foreground" />
                <span>Perfect Calibration</span>
              </div>
            </div>

            {/* Interpretation */}
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs">
              <div className="flex items-start gap-2">
                {calibrationQuality === 'Excellent' || calibrationQuality === 'Good' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                )}
                <div>
                  <span className="font-medium">Interpretation:</span>
                  {weightedError < 10 ? (
                    <span className="text-muted-foreground"> Model probabilities closely match actual outcomes. When the model predicts 70% confidence, games are won approximately 70% of the time.</span>
                  ) : (
                    <span className="text-muted-foreground"> Model probabilities deviate from actual outcomes. Consider adjusting confidence thresholds or reviewing model calibration.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Probability Band</TableHead>
                <TableHead className="text-xs text-right">Count</TableHead>
                <TableHead className="text-xs text-right">Predicted Avg</TableHead>
                <TableHead className="text-xs text-right">Actual Win%</TableHead>
                <TableHead className="text-xs text-right">Gap</TableHead>
                <TableHead className="text-xs text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => {
                const gap = row.actualWinRate - row.avgPredictedProb;
                const absGap = Math.abs(gap);
                const status = absGap < 5 ? 'good' : absGap < 10 ? 'fair' : 'poor';
                
                return (
                  <TableRow key={row.predictedBand}>
                    <TableCell className="font-medium text-xs">{row.predictedBand}</TableCell>
                    <TableCell className="text-xs text-right">{row.count}</TableCell>
                    <TableCell className="text-xs text-right">{row.avgPredictedProb.toFixed(1)}%</TableCell>
                    <TableCell className="text-xs text-right font-medium">{row.actualWinRate.toFixed(1)}%</TableCell>
                    <TableCell className={`text-xs text-right font-medium ${
                      gap >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {gap >= 0 ? '+' : ''}{gap.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      <Badge variant={
                        status === 'good' ? 'default' :
                        status === 'fair' ? 'secondary' :
                        'destructive'
                      } className="text-[10px] px-1.5 py-0">
                        {status === 'good' ? '✓' : status === 'fair' ? '~' : '!'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
