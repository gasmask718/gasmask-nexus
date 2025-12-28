import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { DailyPerformance } from '@/hooks/useAnalyticsData';
import { format, parseISO } from 'date-fns';

interface DailyPerformanceChartProps {
  data: DailyPerformance[];
}

export function DailyPerformanceChart({ data }: DailyPerformanceChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Cumulative P/L Curve</CardTitle>
          <CardDescription className="text-xs">Daily performance over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground text-sm py-12">
            No data available for selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate drawdown data
  let peak = 0;
  const chartData = data.map(d => {
    if (d.cumulativePL > peak) peak = d.cumulativePL;
    const drawdown = peak - d.cumulativePL;
    return {
      ...d,
      drawdown: -drawdown,
      formattedDate: format(parseISO(d.date), 'MMM d'),
    };
  });

  const minPL = Math.min(...chartData.map(d => Math.min(d.cumulativePL, d.drawdown)));
  const maxPL = Math.max(...chartData.map(d => d.cumulativePL));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Cumulative P/L Curve</CardTitle>
        <CardDescription className="text-xs">Daily performance and drawdown visualization</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorPL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="formattedDate" 
              tick={{ fontSize: 11 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis 
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
              tickLine={false}
              axisLine={false}
              domain={[minPL * 1.1, maxPL * 1.1]}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'cumulativePL') return [`$${value.toFixed(2)}`, 'Cumulative P/L'];
                if (name === 'totalPL') return [`$${value.toFixed(2)}`, 'Daily P/L'];
                if (name === 'drawdown') return [`$${Math.abs(value).toFixed(2)}`, 'Drawdown'];
                return [value, name];
              }}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <Area 
              type="monotone" 
              dataKey="cumulativePL" 
              stroke="#10b981" 
              strokeWidth={2}
              fill="url(#colorPL)"
              name="cumulativePL"
            />
            <Area 
              type="monotone" 
              dataKey="drawdown" 
              stroke="#ef4444" 
              strokeWidth={1}
              strokeDasharray="3 3"
              fill="url(#colorDrawdown)"
              name="drawdown"
            />
          </AreaChart>
        </ResponsiveContainer>
        
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Days</div>
            <div className="text-sm font-medium">{data.length}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Total Entries</div>
            <div className="text-sm font-medium">{data.reduce((sum, d) => sum + d.entries, 0)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Best Day</div>
            <div className="text-sm font-medium text-green-500">
              +${Math.max(...data.map(d => d.totalPL)).toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Worst Day</div>
            <div className="text-sm font-medium text-red-500">
              ${Math.min(...data.map(d => d.totalPL)).toFixed(2)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
