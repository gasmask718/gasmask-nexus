import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Lightbulb, 
  RefreshCw, 
  AlertTriangle, 
  TrendingDown, 
  Package,
  ArrowRight,
  Search,
  Filter,
  AlertCircle,
  Clock,
  Warehouse,
  ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  recalculateInventoryInsights,
  fetchInventoryForecasts,
  fetchInventoryRiskFlags,
  getInsightsSummary,
} from '@/lib/inventory/calculateInventoryInsights';

const getRiskBadgeVariant = (risk: string | null) => {
  switch (risk) {
    case 'critical': return 'destructive';
    case 'high': return 'destructive';
    case 'medium': return 'secondary';
    case 'low': return 'outline';
    default: return 'outline';
  }
};

const getSeverityBadgeVariant = (severity: string) => {
  switch (severity) {
    case 'critical': return 'destructive';
    case 'high': return 'destructive';
    case 'medium': return 'secondary';
    case 'low': return 'outline';
    default: return 'outline';
  }
};

export default function InsightsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');

  // Fetch warehouses for filter
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch summary counts
  const { data: summary = { atRiskCount: 0, deadStockCount: 0, overstockCount: 0 } } = useQuery({
    queryKey: ['inventory-insights-summary'],
    queryFn: () => getInsightsSummary(),
  });

  // Fetch forecasts
  const { data: forecasts = [], isLoading: forecastsLoading } = useQuery({
    queryKey: ['inventory-forecasts', warehouseFilter, riskFilter, searchTerm],
    queryFn: () => fetchInventoryForecasts({
      warehouseId: warehouseFilter !== 'all' ? warehouseFilter : undefined,
      riskLevel: riskFilter !== 'all' ? riskFilter : undefined,
      searchTerm: searchTerm || undefined,
    }),
  });

  // Fetch risk flags
  const { data: deadStockFlags = [], isLoading: deadStockLoading } = useQuery({
    queryKey: ['inventory-risk-flags-dead', warehouseFilter],
    queryFn: () => fetchInventoryRiskFlags({
      warehouseId: warehouseFilter !== 'all' ? warehouseFilter : undefined,
      flagType: 'DEAD_STOCK',
    }),
  });

  const { data: overstockFlags = [], isLoading: overstockLoading } = useQuery({
    queryKey: ['inventory-risk-flags-overstock', warehouseFilter],
    queryFn: () => fetchInventoryRiskFlags({
      warehouseId: warehouseFilter !== 'all' ? warehouseFilter : undefined,
      flagType: 'OVERSTOCK',
    }),
  });

  // Recalculate mutation
  const recalculateMutation = useMutation({
    mutationFn: () => recalculateInventoryInsights({
      warehouseId: warehouseFilter !== 'all' ? warehouseFilter : undefined,
    }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Insights refreshed: ${result.forecasts} forecasts, ${result.flags} flags`);
        queryClient.invalidateQueries({ queryKey: ['inventory-forecasts'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-risk-flags-dead'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-risk-flags-overstock'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-insights-summary'] });
      } else {
        toast.error(result.message);
      }
    },
    onError: (error) => {
      toast.error('Failed to recalculate insights');
      console.error(error);
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Lightbulb className="h-8 w-8 text-primary" />
            Inventory Insights
          </h1>
          <p className="text-muted-foreground mt-1">
            Risk, forecast, and dead stock analysis across all warehouses.
          </p>
        </div>
        <Button 
          onClick={() => recalculateMutation.mutate()}
          disabled={recalculateMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh Insights
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              At-Risk SKUs (High/Critical)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-destructive">
                {summary.atRiskCount}
              </span>
              <AlertTriangle className="h-8 w-8 text-destructive/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dead Stock SKUs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-orange-500">
                {summary.deadStockCount}
              </span>
              <Clock className="h-8 w-8 text-orange-500/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overstock SKUs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-yellow-600">
                {summary.overstockCount}
              </span>
              <Package className="h-8 w-8 text-yellow-600/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stockout" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stockout">Stockout Risk</TabsTrigger>
          <TabsTrigger value="deadstock">Dead Stock</TabsTrigger>
          <TabsTrigger value="overstock">Overstock</TabsTrigger>
        </TabsList>

        {/* Stockout Risk Tab */}
        <TabsContent value="stockout" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="w-[180px]">
                <Warehouse className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Warehouses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stockout Risk Table */}
          <Card>
            <CardContent className="p-0">
              {forecastsLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading forecasts...</div>
              ) : forecasts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No insights yet. Click "Refresh Insights" to analyze inventory.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Avg Daily Usage</TableHead>
                      <TableHead className="text-right">Days Until Runout</TableHead>
                      <TableHead>Suggestion</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forecasts.map((forecast: any) => (
                      <TableRow key={forecast.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{forecast.product_name}</div>
                            <div className="text-sm text-muted-foreground">{forecast.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell>{forecast.warehouse_name}</TableCell>
                        <TableCell>
                          <Badge variant={getRiskBadgeVariant(forecast.risk_level)}>
                            {forecast.risk_level || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {forecast.metadata?.available ?? '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {forecast.avg_daily_usage ? Number(forecast.avg_daily_usage).toFixed(1) : '0'}
                        </TableCell>
                        <TableCell className="text-right">
                          {forecast.days_until_runout !== null ? (
                            <span className={forecast.days_until_runout <= 7 ? 'text-destructive font-medium' : ''}>
                              {forecast.days_until_runout}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <span className="text-sm text-muted-foreground line-clamp-2">
                            {forecast.suggestion}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/os/inventory/products/${forecast.product_id}`)}>
                                View Product
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/os/inventory/warehouses/${forecast.warehouse_id}`)}>
                                View Warehouse
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dead Stock Tab */}
        <TabsContent value="deadstock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                Dead Stock Items
              </CardTitle>
              <CardDescription>
                Products with no movement in 90+ days that may need attention.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {deadStockLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : deadStockFlags.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No dead stock detected.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead className="text-right">Days Without Movement</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deadStockFlags.map((flag: any) => (
                      <TableRow key={flag.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{flag.product_name}</div>
                            <div className="text-sm text-muted-foreground">{flag.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell>{flag.warehouse_name}</TableCell>
                        <TableCell>
                          <Badge variant={getSeverityBadgeVariant(flag.severity)}>
                            {flag.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-orange-500">
                          {flag.days_without_movement || '—'}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <span className="text-sm text-muted-foreground line-clamp-2">
                            {flag.message}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overstock Tab */}
        <TabsContent value="overstock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-yellow-600" />
                Overstock Items
              </CardTitle>
              <CardDescription>
                Products with inventory significantly exceeding forecasted demand.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {overstockLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : overstockFlags.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No overstock detected.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overstockFlags.map((flag: any) => (
                      <TableRow key={flag.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{flag.product_name}</div>
                            <div className="text-sm text-muted-foreground">{flag.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell>{flag.warehouse_name}</TableCell>
                        <TableCell>
                          <Badge variant={getSeverityBadgeVariant(flag.severity)}>
                            {flag.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <span className="text-sm text-muted-foreground line-clamp-2">
                            {flag.message}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
