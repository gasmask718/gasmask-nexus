import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line } from 'recharts';
import { ConfidenceBand } from '@/hooks/useAnalyticsData';
import { Badge } from '@/components/ui/badge';
import { Lightbulb } from 'lucide-react';

interface ConfidenceBandsChartProps {
  data: ConfidenceBand[];
}

export function ConfidenceBandsChart({ data }: ConfidenceBandsChartProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');

  // Filter out unscored for chart display
  const chartData = data.filter(d => d.band !== 'Unscored').map(d => ({
    ...d,
    bandLabel: d.band,
  }));

  // Find recommended threshold
  const profitableBands = data.filter(b => b.roi > 0 && b.band !== 'Unscored' && b.entries >= 3);
  const recommendedThreshold = profitableBands.length > 0 
    ? Math.max(...profitableBands.map(b => b.minScore))
    : null;

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Confidence Band Analysis</CardTitle>
          <CardDescription className="text-xs">Performance breakdown by AI confidence score</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground text-sm py-12">
            No confidence-scored entries available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Confidence Band Analysis</CardTitle>
            <CardDescription className="text-xs">Performance breakdown by AI confidence score</CardDescription>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as 'chart' | 'table')}>
            <TabsList className="h-8">
              <TabsTrigger value="chart" className="text-xs px-3 h-7">Chart</TabsTrigger>
              <TabsTrigger value="table" className="text-xs px-3 h-7">Table</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {recommendedThreshold && (
          <div className="flex items-center gap-2 mt-3 p-2 bg-primary/10 rounded-md">
            <Lightbulb className="h-4 w-4 text-primary" />
            <span className="text-xs">
              Recommended min confidence: <strong>{recommendedThreshold}%</strong>
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {view === 'chart' ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="bandLabel" 
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${v}`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'winRate') return [`${value.toFixed(1)}%`, 'Win Rate'];
                  if (name === 'roi') return [`${value.toFixed(1)}%`, 'ROI'];
                  if (name === 'totalPL') return [`$${value.toFixed(2)}`, 'P/L'];
                  return [value, name];
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px' }}
                formatter={(value) => {
                  if (value === 'winRate') return 'Win Rate';
                  if (value === 'roi') return 'ROI';
                  if (value === 'totalPL') return 'P/L';
                  return value;
                }}
              />
              <Bar 
                yAxisId="left"
                dataKey="winRate" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
                name="winRate"
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="roi" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
                name="roi"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Band</TableHead>
                <TableHead className="text-xs text-right">Entries</TableHead>
                <TableHead className="text-xs text-right">Wins</TableHead>
                <TableHead className="text-xs text-right">Win%</TableHead>
                <TableHead className="text-xs text-right">Staked</TableHead>
                <TableHead className="text-xs text-right">P/L</TableHead>
                <TableHead className="text-xs text-right">ROI%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((band) => (
                <TableRow key={band.band}>
                  <TableCell className="font-medium text-xs">
                    {band.band}
                    {recommendedThreshold && band.minScore >= recommendedThreshold && band.band !== 'Unscored' && (
                      <Badge variant="secondary" className="ml-2 text-[10px] px-1 py-0">
                        Recommended
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-right">{band.entries}</TableCell>
                  <TableCell className="text-xs text-right">{band.wins}</TableCell>
                  <TableCell className="text-xs text-right">{band.winRate.toFixed(1)}%</TableCell>
                  <TableCell className="text-xs text-right">${band.totalStaked.toFixed(2)}</TableCell>
                  <TableCell className={`text-xs text-right font-medium ${band.totalPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {band.totalPL >= 0 ? '+' : ''}${band.totalPL.toFixed(2)}
                  </TableCell>
                  <TableCell className={`text-xs text-right font-medium ${band.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {band.roi >= 0 ? '+' : ''}{band.roi.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
