import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  Area,
} from 'recharts';
import { DailyAccuracy } from '@/hooks/useAccuracyMetrics';
import { TrendingUp, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface DailyAccuracyChartProps {
  data: DailyAccuracy[];
}

export function DailyAccuracyChart({ data }: DailyAccuracyChartProps) {
  const [view, setView] = useState<'daily' | 'cumulative'>('cumulative');

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Daily Accuracy Trend
          </CardTitle>
          <CardDescription className="text-xs">
            Win rate over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground text-sm py-12">
            No daily data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format data for chart
  const chartData = data.map(d => ({
    ...d,
    dateLabel: format(parseISO(d.date), 'MMM d'),
    shortDate: format(parseISO(d.date), 'MM/dd'),
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Accuracy Trend
            </CardTitle>
            <CardDescription className="text-xs">
              {data.length} days of predictions
            </CardDescription>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as 'daily' | 'cumulative')}>
            <TabsList className="h-8">
              <TabsTrigger value="cumulative" className="text-xs px-3 h-7">Cumulative</TabsTrigger>
              <TabsTrigger value="daily" className="text-xs px-3 h-7">Daily</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="dateLabel" 
              tick={{ fontSize: 10 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
            />
            {view === 'daily' && (
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
            )}
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'cumulativeWinRate') return [`${value.toFixed(1)}%`, 'Cumulative Win Rate'];
                if (name === 'winRate') return [`${value.toFixed(1)}%`, 'Daily Win Rate'];
                if (name === 'total') return [value, 'Picks'];
                if (name === 'wins') return [value, 'Wins'];
                return [value, name];
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '11px' }}
              formatter={(value) => {
                if (value === 'cumulativeWinRate') return 'Cumulative Win Rate';
                if (value === 'winRate') return 'Daily Win Rate';
                if (value === 'total') return 'Picks';
                return value;
              }}
            />
            
            {/* 50% reference line */}
            <ReferenceLine 
              yAxisId="left" 
              y={50} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="3 3" 
              label={{ value: '50%', fontSize: 10, position: 'right' }}
            />

            {view === 'cumulative' ? (
              <>
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="cumulativeWinRate"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.1}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="cumulativeWinRate"
                />
              </>
            ) : (
              <>
                <Bar
                  yAxisId="right"
                  dataKey="total"
                  fill="hsl(var(--muted))"
                  radius={[4, 4, 0, 0]}
                  name="total"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="winRate"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                  name="winRate"
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Quick stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Best Day</p>
            <p className="font-medium text-sm">
              {data.reduce((a, b) => a.winRate > b.winRate ? a : b).winRate.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {format(parseISO(data.reduce((a, b) => a.winRate > b.winRate ? a : b).date), 'MMM d')}
            </p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Busiest Day</p>
            <p className="font-medium text-sm">
              {data.reduce((a, b) => a.total > b.total ? a : b).total} picks
            </p>
            <p className="text-xs text-muted-foreground">
              {format(parseISO(data.reduce((a, b) => a.total > b.total ? a : b).date), 'MMM d')}
            </p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Avg Daily</p>
            <p className="font-medium text-sm">
              {(data.reduce((sum, d) => sum + d.total, 0) / data.length).toFixed(1)} picks
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
