import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Database, BarChart3, Loader2, RefreshCw, Table2, FileSpreadsheet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { FloorExportConfig, FloorTableConfig } from '@/config/floorExportConfig';

interface TableStats {
  table: string;
  label: string;
  rowCount: number;
  data: Record<string, unknown>[];
  computedMetrics: { label: string; value: string | number }[];
  loading: boolean;
  error: string | null;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 200 70% 50%))',
  'hsl(var(--chart-3, 150 60% 45%))',
  'hsl(var(--chart-4, 40 80% 55%))',
  'hsl(var(--chart-5, 280 65% 55%))',
  'hsl(var(--accent))',
];

export default function FloorExportPage({ config }: { config: FloorExportConfig }) {
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchAllData = useCallback(async () => {
    const stats: TableStats[] = config.tables.map(t => ({
      table: t.table,
      label: t.label,
      rowCount: 0,
      data: [],
      computedMetrics: [],
      loading: true,
      error: null,
    }));
    setTableStats([...stats]);

    const results = await Promise.allSettled(
      config.tables.map(async (tConfig, idx) => {
        try {
          const { data, error, count } = await (supabase as any)
            .from(tConfig.table)
            .select('*', { count: 'exact' })
            .limit(5000);

          if (error) throw error;

          const rows = data || [];
          const metrics = computeMetrics(tConfig, rows);

          stats[idx] = {
            ...stats[idx],
            rowCount: count || rows.length,
            data: rows,
            computedMetrics: metrics,
            loading: false,
          };
        } catch (err: any) {
          stats[idx] = {
            ...stats[idx],
            loading: false,
            error: err.message || 'Failed to fetch',
          };
        }
      })
    );

    setTableStats([...stats]);
    setLastRefreshed(new Date());
  }, [config]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  function computeMetrics(tConfig: FloorTableConfig, rows: Record<string, unknown>[]) {
    if (!tConfig.analyticsColumns || rows.length === 0) return [];
    return tConfig.analyticsColumns.map(col => {
      let value: string | number = 0;
      switch (col.type) {
        case 'count':
          value = rows.length;
          break;
        case 'sum':
          value = rows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
          if (typeof value === 'number' && col.label.toLowerCase().includes('$') || col.label.toLowerCase().includes('revenue') || col.label.toLowerCase().includes('amount') || col.label.toLowerCase().includes('owed') || col.label.toLowerCase().includes('paid') || col.label.toLowerCase().includes('invoiced') || col.label.toLowerCase().includes('commission')) {
            value = `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          } else {
            value = Number(value).toLocaleString();
          }
          break;
        case 'avg': {
          const nums = rows.map(r => Number(r[col.key]) || 0).filter(n => n > 0);
          value = nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
          break;
        }
        case 'latest':
          value = rows.length > 0 ? String(rows[0][col.key] || 'N/A') : 'N/A';
          break;
      }
      return { label: col.label, value };
    });
  }

  async function handleExportAll() {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      let sheetsAdded = 0;

      for (const stat of tableStats) {
        if (stat.data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(stat.data);
          XLSX.utils.book_append_sheet(wb, ws, stat.label.slice(0, 31));
          sheetsAdded++;
        }
      }

      // Summary sheet
      const summaryData = tableStats.map(s => ({
        Table: s.label,
        'Row Count': s.rowCount,
        Status: s.error ? `Error: ${s.error}` : 'OK',
      }));
      const summaryWs = XLSX.utils.json_to_sheet([
        ...summaryData,
        { Table: '', 'Row Count': '', Status: '' },
        { Table: 'Exported At', 'Row Count': new Date().toISOString(), Status: '' },
        { Table: 'Floor', 'Row Count': config.name, Status: '' },
      ]);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${config.name.replace(/[^a-zA-Z0-9]/g, '_')}_Export_${timestamp}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success(`Exported ${sheetsAdded} sheets to ${filename}`);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportTable(stat: TableStats) {
    if (stat.data.length === 0) {
      toast.error('No data to export');
      return;
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(stat.data);
    XLSX.utils.book_append_sheet(wb, ws, stat.label.slice(0, 31));
    const timestamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${stat.label.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.xlsx`);
    toast.success(`Exported ${stat.label}`);
  }

  const totalRows = tableStats.reduce((a, s) => a + s.rowCount, 0);
  const isLoading = tableStats.some(s => s.loading);

  // Chart data for row distribution
  const chartData = tableStats
    .filter(s => s.rowCount > 0)
    .map(s => ({ name: s.label, value: s.rowCount }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-3xl">{config.emoji}</span>
            {config.name} — Export & Analytics
          </h1>
          <p className="text-muted-foreground mt-1">{config.description}</p>
          {lastRefreshed && (
            <p className="text-xs text-muted-foreground mt-1">
              Last refreshed: {lastRefreshed.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAllData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExportAll} disabled={isExporting || isLoading} className="gap-2">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export All to Excel
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Database className="h-4 w-4" />
              Tables
            </div>
            <p className="text-2xl font-bold mt-1">{config.tables.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Table2 className="h-4 w-4" />
              Total Records
            </div>
            <p className="text-2xl font-bold mt-1">{isLoading ? '...' : totalRows.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <FileSpreadsheet className="h-4 w-4" />
              Export Sheets
            </div>
            <p className="text-2xl font-bold mt-1">{tableStats.filter(s => s.rowCount > 0).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <BarChart3 className="h-4 w-4" />
              Status
            </div>
            <p className="text-2xl font-bold mt-1">
              {isLoading ? (
                <Badge variant="secondary">Loading...</Badge>
              ) : tableStats.some(s => s.error) ? (
                <Badge variant="destructive">Errors</Badge>
              ) : (
                <Badge variant="secondary">Ready</Badge>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {!isLoading && chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Separator />

      {/* Per-Table Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tableStats.map((stat) => (
          <Card key={stat.table} className="relative overflow-hidden">
            {stat.loading && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{stat.label}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExportTable(stat)}
                  disabled={stat.loading || stat.data.length === 0}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
              </div>
              <p className="text-xs text-muted-foreground font-mono">{stat.table}</p>
            </CardHeader>
            <CardContent>
              {stat.error ? (
                <p className="text-sm text-destructive">{stat.error}</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Records</span>
                    <span className="text-lg font-bold">{stat.rowCount.toLocaleString()}</span>
                  </div>
                  {stat.computedMetrics.map((m, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{m.label}</span>
                      <span className="text-sm font-semibold">{m.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
