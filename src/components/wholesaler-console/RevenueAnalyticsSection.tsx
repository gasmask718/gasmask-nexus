import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RevenueDataPoint } from '@/services/wholesaler/useWholesalerAnalytics';

interface Props {
  revenueData: RevenueDataPoint[];
  disputeTrend: { date: string; disputes: number }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur-sm p-2.5 shadow-xl text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="flex justify-between gap-4">
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">
            {p.name === 'Revenue' ? `$${p.value.toLocaleString()}` : p.value}
          </span>
        </p>
      ))}
    </div>
  );
};

type ChartView = 'revenue' | 'orders' | 'disputes';

export function RevenueAnalyticsSection({ revenueData, disputeTrend }: Props) {
  const [view, setView] = useState<ChartView>('revenue');

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Analytics</CardTitle>
          <Tabs value={view} onValueChange={(v) => setView(v as ChartView)}>
            <TabsList className="h-7">
              <TabsTrigger value="revenue" className="text-[11px] h-6 px-2.5">Revenue</TabsTrigger>
              <TabsTrigger value="orders" className="text-[11px] h-6 px-2.5">Orders</TabsTrigger>
              <TabsTrigger value="disputes" className="text-[11px] h-6 px-2.5">Disputes</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            {view === 'revenue' ? (
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            ) : view === 'orders' ? (
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="orders" name="Orders" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={disputeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="disputes" name="Disputes" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
