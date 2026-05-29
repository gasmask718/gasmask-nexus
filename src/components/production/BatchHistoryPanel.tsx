/**
 * BATCH HISTORY PANEL
 * 
 * Calendar-navigable batch history with filtering.
 * Supports date ranges, quick filters, and CSV export.
 * Fetches ALL batches (not just current date) for history view.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  useBatchOutputs,
  ProductionBatch 
} from '@/hooks/useProductionPortal';
import { useProductionWorkers } from '@/hooks/useWorkerPerformance';
import { exportData } from '@/utils/exportUtils';
import { 
  CalendarDays, 
  Filter, 
  Package, 
  ChevronLeft, 
  ChevronRight,
  Scale,
  Clock,
  AlertTriangle,
  TrendingUp,
  Download,
  User,
  Lock,
} from 'lucide-react';
import { format, addDays, subDays, isToday, subWeeks, subMonths, startOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface BatchHistoryPanelProps {
  officeId: string;
}

const BRANDS = [
  { id: 'all', label: 'All Brands' },
  { id: 'gasmask', label: 'Gasmask', color: 'bg-emerald-500' },
  { id: 'hotmama', label: 'HotMama', color: 'bg-pink-500' },
  { id: 'hotscolati', label: 'Hotscolatti', color: 'bg-amber-500' },
  { id: 'grabba-rus', label: 'GrabbaRus', color: 'bg-purple-500' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
};

type DateRangeMode = 'single' | 'range' | 'all';

const QUICK_FILTERS = [
  { label: 'Today', getValue: () => ({ start: new Date(), end: new Date() }) },
  { label: 'Last 7 Days', getValue: () => ({ start: subWeeks(new Date(), 1), end: new Date() }) },
  { label: 'Last 30 Days', getValue: () => ({ start: subMonths(new Date(), 1), end: new Date() }) },
  { label: 'This Month', getValue: () => ({ start: startOfMonth(new Date()), end: new Date() }) },
];

// Hook to fetch ALL batches for history (no date filter)
function useAllBatches(officeId: string | undefined) {
  return useQuery({
    queryKey: ['production-batches-all', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      
      const { data, error } = await supabase
        .from('production_batches')
        .select('*, office:production_offices(id, name)')
        .eq('office_id', officeId)
        .order('created_at', { ascending: false })
        .limit(500); // Get last 500 batches
      
      if (error) throw error;
      return (data || []) as ProductionBatch[];
    },
    enabled: !!officeId,
    staleTime: 1000 * 60, // 1 minute
  });
}

export function BatchHistoryPanel({ officeId }: BatchHistoryPanelProps) {
  const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>('single');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startDate, setStartDate] = useState<Date>(subWeeks(new Date(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);
  
  const { data: allBatches = [], isLoading } = useAllBatches(officeId);
  
  // Filter batches based on date range mode and filters
  const filteredBatches = useMemo(() => {
    return allBatches.filter(batch => {
      // Date filter
      if (dateRangeMode === 'single') {
        const batchDate = batch.batch_date ? new Date(batch.batch_date) : null;
        if (!batchDate) return false;
        const targetDateStr = format(selectedDate, 'yyyy-MM-dd');
        const batchDateStr = format(batchDate, 'yyyy-MM-dd');
        if (targetDateStr !== batchDateStr) return false;
      } else if (dateRangeMode === 'range') {
        const batchDate = batch.batch_date ? new Date(batch.batch_date) : null;
        if (!batchDate) return false;
        if (!isWithinInterval(batchDate, { 
          start: startOfDay(startDate), 
          end: endOfDay(endDate) 
        })) return false;
      }
      // 'all' mode shows everything
      
      // Brand filter
      if (brandFilter !== 'all' && batch.brand !== brandFilter) return false;
      
      // Status filter
      if (statusFilter !== 'all' && batch.status !== statusFilter) return false;
      
      return true;
    });
  }, [allBatches, dateRangeMode, selectedDate, startDate, endDate, brandFilter, statusFilter]);

  // Calculate summary for visible batches
  const summary = useMemo(() => ({
    totalBatches: filteredBatches.length,
    totalBoxes: filteredBatches.reduce((sum, b) => sum + (b.boxes_produced || 0), 0),
    totalTubes: filteredBatches.reduce((sum, b) => sum + (b.total_tubes_used || 0), 0),
    totalDefects: filteredBatches.reduce((sum, b) => sum + (b.total_defects || 0), 0),
    totalTobacco: filteredBatches.reduce((sum, b) => sum + (Number(b.tobacco_lbs) || 0), 0),
  }), [filteredBatches]);

  const navigateDate = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => 
      direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1)
    );
  };

  const goToToday = () => setSelectedDate(new Date());

  const applyQuickFilter = (filter: typeof QUICK_FILTERS[0]) => {
    const range = filter.getValue();
    setStartDate(range.start);
    setEndDate(range.end);
    setDateRangeMode('range');
  };

  const handleExport = () => {
    const exportRows = filteredBatches.map(b => ({
      date: b.batch_date,
      brand: b.brand,
      shift: b.shift_label,
      status: b.status,
      tobacco_lbs: b.tobacco_lbs,
      tubes_issued: b.tubes_total,
      tubes_used: b.total_tubes_used,
      boxes_produced: b.boxes_produced,
      defects: b.total_defects,
      efficiency_pct: b.efficiency_pct,
      is_locked: b.is_locked ? 'Yes' : 'No',
    }));
    
    const filename = dateRangeMode === 'single' 
      ? `production-batches-${format(selectedDate, 'yyyy-MM-dd')}`
      : dateRangeMode === 'range'
        ? `production-batches-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}`
        : `production-batches-all`;
    
    exportData({
      filename,
      format: 'csv',
      data: exportRows,
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Batch History
            </CardTitle>
            
            {/* Export Button */}
            <Button
              variant="outline"
              size="sm"
              disabled={filteredBatches.length === 0}
              onClick={handleExport}
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
          
          {/* Date Mode Selector */}
          <Tabs value={dateRangeMode} onValueChange={(v) => setDateRangeMode(v as DateRangeMode)} className="mt-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="single">Single Day</TabsTrigger>
              <TabsTrigger value="range">Date Range</TabsTrigger>
              <TabsTrigger value="all">All History</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Date Navigation - Single Mode */}
          {dateRangeMode === 'single' && (
            <div className="flex items-center gap-2 mt-3">
              <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-[180px]">
                    <CalendarDays className="h-4 w-4 mr-2" />
                    {format(selectedDate, 'MMM d, yyyy')}
                    {isToday(selectedDate) && (
                      <Badge variant="secondary" className="ml-2 text-xs">Today</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => navigateDate('next')}
                disabled={isToday(selectedDate)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              {!isToday(selectedDate) && (
                <Button variant="ghost" size="sm" onClick={goToToday}>
                  Today
                </Button>
              )}
            </div>
          )}

          {/* Date Range - Range Mode */}
          {dateRangeMode === 'range' && (
            <div className="space-y-3 mt-3">
              <div className="flex flex-wrap gap-2">
                {QUICK_FILTERS.map(filter => (
                  <Button
                    key={filter.label}
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickFilter(filter)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      {format(startDate, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      {format(endDate, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
          
          {/* Filters */}
          <div className="flex items-center gap-3 mt-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                {BRANDS.map(brand => (
                  <SelectItem key={brand.id} value={brand.id}>
                    <div className="flex items-center gap-2">
                      {brand.color && <div className={cn('w-2 h-2 rounded-full', brand.color)} />}
                      {brand.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {(brandFilter !== 'all' || statusFilter !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => { setBrandFilter('all'); setStatusFilter('all'); }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Summary Stats */}
          <div className="grid grid-cols-5 gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold">{summary.totalBatches}</p>
              <p className="text-xs text-muted-foreground">Batches</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{summary.totalBoxes}</p>
              <p className="text-xs text-muted-foreground">Boxes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{summary.totalTubes.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Tubes Used</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{summary.totalTobacco.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Tobacco (lbs)</p>
            </div>
            <div className="text-center">
              <p className={cn(
                "text-2xl font-bold",
                summary.totalDefects > 0 ? "text-destructive" : "text-emerald-600"
              )}>
                {summary.totalDefects}
              </p>
              <p className="text-xs text-muted-foreground">Defects</p>
            </div>
          </div>
          
          {/* Batch List */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No batches found for the selected criteria</p>
              {(brandFilter !== 'all' || statusFilter !== 'all') && (
                <Button variant="link" onClick={() => { setBrandFilter('all'); setStatusFilter('all'); }}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {filteredBatches.map(batch => {
                  const brandConfig = BRANDS.find(b => b.id === batch.brand);
                  const statusConfig = STATUS_CONFIG[batch.status || 'open'];
                  const defectRate = batch.total_tubes_used && batch.total_tubes_used > 0 
                    ? ((batch.total_defects || 0) / batch.total_tubes_used * 100).toFixed(1)
                    : '0';
                  const batchDate = batch.batch_date ? new Date(batch.batch_date) : null;
                  
                  return (
                    <div 
                      key={batch.id}
                      className={cn(
                        "p-4 rounded-lg border cursor-pointer transition-colors",
                        "hover:border-primary/50 hover:bg-muted/50",
                        batch.is_locked && "bg-muted/30"
                      )}
                      onClick={() => setSelectedBatch(batch)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-3 h-3 rounded-full', brandConfig?.color)} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{brandConfig?.label}</span>
                              <Badge variant="outline" className="text-xs">{batch.shift_label}</Badge>
                              <Badge className={cn('text-xs', statusConfig?.color)}>{statusConfig?.label}</Badge>
                              {batch.is_locked && (
                                <Lock className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              {batchDate && (
                                <span className="font-medium">
                                  {format(batchDate, 'MMM d, yyyy')}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Scale className="h-3 w-3" />
                                {batch.tobacco_lbs ?? 0} lbs
                              </span>
                              <span>{(batch.tubes_total || 0).toLocaleString()} tubes</span>
                              <span className="text-primary font-medium">{batch.boxes_produced || 0} boxes</span>
                              {(batch.total_defects || 0) > 0 && (
                                <span className="text-destructive flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {batch.total_defects} defects ({defectRate}%)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right text-sm text-muted-foreground">
                          <p>{batch.created_at && format(new Date(batch.created_at), 'h:mm a')}</p>
                          {batch.efficiency_pct && (
                            <p className="flex items-center gap-1 text-emerald-600">
                              <TrendingUp className="h-3 w-3" />
                              {batch.efficiency_pct}%
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      {/* Batch Detail Modal */}
      {selectedBatch && (
        <BatchHistoryDetailModal 
          batch={selectedBatch}
          officeId={officeId}
          isReadOnly={selectedBatch.is_locked || false}
          onClose={() => setSelectedBatch(null)}
        />
      )}
    </>
  );
}

// ============================================================
// BATCH HISTORY DETAIL MODAL (Read-only for locked batches)
// ============================================================

interface BatchHistoryDetailModalProps {
  batch: ProductionBatch;
  officeId: string;
  isReadOnly: boolean;
  onClose: () => void;
}

function BatchHistoryDetailModal({ batch, officeId, isReadOnly, onClose }: BatchHistoryDetailModalProps) {
  const { data: outputs = [] } = useBatchOutputs(batch.id);
  const { data: workers = [] } = useProductionWorkers(officeId);
  
  // Calculate totals
  const totalBoxes = outputs.reduce((sum, o) => sum + o.boxes_completed, 0);
  const totalTubes = outputs.reduce((sum, o) => sum + o.tubes_used, 0);
  const totalStickersUsed = outputs.reduce((sum, o) => sum + o.stickers_used, 0);
  const totalEmptyBoxesUsed = outputs.reduce((sum, o) => sum + o.empty_boxes_used, 0);
  const totalDefects = outputs.reduce((sum, o) => sum + o.defects_count, 0);
  
  const totalStickersIssued = Object.values((batch.stickers_issued as Record<string, number>) || {}).reduce((a, b) => a + b, 0);
  const totalEmptyBoxesIssued = Object.values((batch.empty_boxes_issued as Record<string, number>) || {}).reduce((a, b) => a + b, 0);

  const defectRate = totalTubes > 0 ? (totalDefects / totalTubes * 100).toFixed(2) : '0';

  const workerMap = new Map(workers.map(w => [w.id, w.full_name]));

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Batch Details
            <Badge className={cn(STATUS_CONFIG[batch.status || 'open']?.color)}>
              {STATUS_CONFIG[batch.status || 'open']?.label}
            </Badge>
            {isReadOnly && (
              <Badge variant="outline" className="ml-2 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Read Only
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Batch Info */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Brand</p>
              <p className="font-medium">{batch.brand}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Shift</p>
              <p className="font-medium">{batch.shift_label}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="font-medium">
                {batch.batch_date && format(new Date(batch.batch_date), 'MMM d, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">
                {batch.created_at && format(new Date(batch.created_at), 'h:mm a')}
              </p>
            </div>
          </div>

          {/* Issued vs Used - Material Reconciliation */}
          <div className="grid grid-cols-2 gap-4">
            {/* Issued Column */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Issued
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tubes</span>
                  <span className="font-medium">{(batch.tubes_total || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stickers</span>
                  <span className="font-medium">{totalStickersIssued.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empty Boxes</span>
                  <span className="font-medium">{totalEmptyBoxesIssued.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Used Column */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <h4 className="font-medium text-emerald-800 dark:text-emerald-200 mb-3 flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Used
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tubes</span>
                  <span className="font-medium">{totalTubes.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stickers</span>
                  <span className="font-medium">{totalStickersUsed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empty Boxes</span>
                  <span className="font-medium">{totalEmptyBoxesUsed.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Variance Summary */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2 text-sm">Variance (Issued - Used)</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className={cn(
                  "text-lg font-bold",
                  (batch.tubes_total || 0) - totalTubes === 0 ? "text-emerald-600" : 
                  (batch.tubes_total || 0) - totalTubes > 0 ? "text-amber-600" : "text-red-600"
                )}>
                  {((batch.tubes_total || 0) - totalTubes) >= 0 ? '+' : ''}{(batch.tubes_total || 0) - totalTubes}
                </p>
                <p className="text-xs text-muted-foreground">Tubes</p>
              </div>
              <div>
                <p className={cn(
                  "text-lg font-bold",
                  totalStickersIssued - totalStickersUsed === 0 ? "text-emerald-600" : 
                  totalStickersIssued - totalStickersUsed > 0 ? "text-amber-600" : "text-red-600"
                )}>
                  {(totalStickersIssued - totalStickersUsed) >= 0 ? '+' : ''}{totalStickersIssued - totalStickersUsed}
                </p>
                <p className="text-xs text-muted-foreground">Stickers</p>
              </div>
              <div>
                <p className={cn(
                  "text-lg font-bold",
                  totalEmptyBoxesIssued - totalEmptyBoxesUsed === 0 ? "text-emerald-600" : 
                  totalEmptyBoxesIssued - totalEmptyBoxesUsed > 0 ? "text-amber-600" : "text-red-600"
                )}>
                  {(totalEmptyBoxesIssued - totalEmptyBoxesUsed) >= 0 ? '+' : ''}{totalEmptyBoxesIssued - totalEmptyBoxesUsed}
                </p>
                <p className="text-xs text-muted-foreground">Empty Boxes</p>
              </div>
            </div>
          </div>

          {/* Defects Summary */}
          {totalDefects > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <h4 className="font-medium text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Defects: {totalDefects} ({defectRate}%)
              </h4>
              <div className="space-y-1">
                {outputs.filter(o => o.defects_count > 0).map(o => (
                  <div key={o.id} className="text-sm flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">{o.defects_count}</Badge>
                    {o.defect_category && (
                      <Badge variant="outline" className="text-xs">{o.defect_category}</Badge>
                    )}
                    <span className="text-muted-foreground">{o.brand}</span>
                    {o.defect_reason && (
                      <span className="text-muted-foreground">— {o.defect_reason}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Time & Motion Metrics */}
          {(batch.avg_tube_fill_seconds || batch.avg_sticker_apply_seconds) && (
            <div className="p-4 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800">
              <h4 className="font-medium text-violet-800 dark:text-violet-200 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time & Motion
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {batch.avg_tube_fill_seconds && (
                  <div>
                    <p className="text-muted-foreground">Avg Tube Fill</p>
                    <p className="text-lg font-bold">{batch.avg_tube_fill_seconds}s</p>
                  </div>
                )}
                {batch.avg_sticker_apply_seconds && (
                  <div>
                    <p className="text-muted-foreground">Avg Sticker Apply</p>
                    <p className="text-lg font-bold">{batch.avg_sticker_apply_seconds}s</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Output Records with Worker Attribution */}
          <div>
            <h4 className="font-medium mb-2">Output Records</h4>
            {outputs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outputs recorded.</p>
            ) : (
              <div className="space-y-2">
                {outputs.map(output => {
                  const brandConfig = BRANDS.find(b => b.id === output.brand);
                  const workerName = output.worker_id ? workerMap.get(output.worker_id) : null;
                  
                  return (
                    <div key={output.id} className="p-3 bg-muted/50 rounded border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2 h-2 rounded-full', brandConfig?.color)} />
                          <span className="font-medium">{brandConfig?.label}</span>
                          {workerName && (
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {workerName}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-medium">{output.boxes_completed} boxes</span>
                          {output.defects_count > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {output.defects_count} defects
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <span>{output.tubes_used} tubes</span>
                        <span>{output.stickers_used} stickers</span>
                        <span>{output.empty_boxes_used} boxes</span>
                        {output.defect_category && (
                          <span className="text-destructive">{output.defect_category}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Output Results */}
          <div className="p-3 bg-primary/5 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{totalBoxes}</p>
                <p className="text-xs text-muted-foreground">Boxes Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{batch.efficiency_pct || 0}%</p>
                <p className="text-xs text-muted-foreground">Efficiency</p>
              </div>
              <div>
                <p className={cn(
                  "text-2xl font-bold",
                  totalDefects > 0 ? "text-destructive" : "text-emerald-600"
                )}>
                  {defectRate}%
                </p>
                <p className="text-xs text-muted-foreground">Defect Rate</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
