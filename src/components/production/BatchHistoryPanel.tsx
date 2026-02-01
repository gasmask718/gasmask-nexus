/**
 * BATCH HISTORY PANEL
 * 
 * Calendar-navigable batch history with filtering.
 * Supports date ranges, quick filters, and CSV export.
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
import { 
  useProductionBatches, 
  useBatchOutputs,
  ProductionBatch 
} from '@/hooks/useProductionPortal';
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
  Download
} from 'lucide-react';
import { format, addDays, subDays, startOfDay, isToday, subWeeks, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface BatchHistoryPanelProps {
  officeId: string;
}

const BRANDS = [
  { id: 'all', label: 'All Brands' },
  { id: 'gasmask', label: 'Gasmask', color: 'bg-emerald-500' },
  { id: 'hotmama', label: 'HotMama', color: 'bg-pink-500' },
  { id: 'hotscolati', label: 'HotScolati', color: 'bg-amber-500' },
  { id: 'grabba-rus', label: 'GrabbaRus', color: 'bg-purple-500' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
};

const QUICK_FILTERS = [
  { label: 'Today', getValue: () => ({ start: new Date(), end: new Date() }) },
  { label: 'Last 7 Days', getValue: () => ({ start: subWeeks(new Date(), 1), end: new Date() }) },
  { label: 'Last 30 Days', getValue: () => ({ start: subMonths(new Date(), 1), end: new Date() }) },
  { label: 'This Month', getValue: () => ({ start: startOfMonth(new Date()), end: new Date() }) },
];

export function BatchHistoryPanel({ officeId }: BatchHistoryPanelProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRangeMode, setDateRangeMode] = useState<'single' | 'range'>('single');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);
  
  const { data: batches = [], isLoading } = useProductionBatches(officeId, selectedDate);
  
  // Apply client-side filters
  const filteredBatches = batches.filter(batch => {
    if (brandFilter !== 'all' && batch.brand !== brandFilter) return false;
    if (statusFilter !== 'all' && batch.status !== statusFilter) return false;
    return true;
  });

  // Calculate daily summary
  const dailySummary = {
    totalBatches: filteredBatches.length,
    totalBoxes: filteredBatches.reduce((sum, b) => sum + (b.boxes_produced || 0), 0),
    totalTubes: filteredBatches.reduce((sum, b) => sum + (b.total_tubes_used || 0), 0),
    totalDefects: filteredBatches.reduce((sum, b) => sum + (b.total_defects || 0), 0),
    totalTobacco: filteredBatches.reduce((sum, b) => sum + (Number(b.tobacco_lbs) || 0), 0),
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => 
      direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1)
    );
  };

  const goToToday = () => setSelectedDate(new Date());

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Batch History
            </CardTitle>
            
            {/* Date Navigation */}
            <div className="flex items-center gap-2">
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
                <PopoverContent className="w-auto p-0" align="end">
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
          </div>
          
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
            
            {/* Export Button */}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={filteredBatches.length === 0}
              onClick={() => {
                const exportRows = filteredBatches.map(b => ({
                  date: b.batch_date,
                  brand: b.brand,
                  shift: b.shift_label,
                  status: b.status,
                  tobacco_lbs: b.tobacco_lbs,
                  tubes_total: b.tubes_total,
                  tubes_used: b.total_tubes_used,
                  boxes_produced: b.boxes_produced,
                  defects: b.total_defects,
                  efficiency: b.efficiency_pct,
                }));
                exportData({
                  filename: `production-batches-${format(selectedDate, 'yyyy-MM-dd')}`,
                  format: 'csv',
                  data: exportRows,
                });
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Daily Summary */}
          <div className="grid grid-cols-5 gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold">{dailySummary.totalBatches}</p>
              <p className="text-xs text-muted-foreground">Batches</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{dailySummary.totalBoxes}</p>
              <p className="text-xs text-muted-foreground">Boxes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{dailySummary.totalTubes.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Tubes Used</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{dailySummary.totalTobacco.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Tobacco (lbs)</p>
            </div>
            <div className="text-center">
              <p className={cn(
                "text-2xl font-bold",
                dailySummary.totalDefects > 0 ? "text-destructive" : "text-emerald-600"
              )}>
                {dailySummary.totalDefects}
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
              <p>No batches found for {format(selectedDate, 'MMMM d, yyyy')}</p>
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
                  const statusConfig = STATUS_CONFIG[batch.status];
                  const defectRate = batch.total_tubes_used > 0 
                    ? ((batch.total_defects || 0) / batch.total_tubes_used * 100).toFixed(1)
                    : '0';
                  
                  return (
                    <div 
                      key={batch.id}
                      className={cn(
                        "p-4 rounded-lg border cursor-pointer transition-colors",
                        "hover:border-primary/50 hover:bg-muted/50",
                        !isToday(selectedDate) && "opacity-90"
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
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
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
                          <p>{format(new Date(batch.created_at), 'h:mm a')}</p>
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
      
      {/* Batch Detail Modal (read-only for past days) */}
      {selectedBatch && (
        <BatchHistoryDetailModal 
          batch={selectedBatch}
          isReadOnly={!isToday(selectedDate)}
          onClose={() => setSelectedBatch(null)}
        />
      )}
    </>
  );
}

// ============================================================
// BATCH HISTORY DETAIL MODAL (Read-only for past days)
// ============================================================

interface BatchHistoryDetailModalProps {
  batch: ProductionBatch;
  isReadOnly: boolean;
  onClose: () => void;
}

function BatchHistoryDetailModal({ batch, isReadOnly, onClose }: BatchHistoryDetailModalProps) {
  const { data: outputs = [] } = useBatchOutputs(batch.id);
  
  // Calculate totals
  const totalBoxes = outputs.reduce((sum, o) => sum + o.boxes_completed, 0);
  const totalTubes = outputs.reduce((sum, o) => sum + o.tubes_used, 0);
  const totalStickersUsed = outputs.reduce((sum, o) => sum + o.stickers_used, 0);
  const totalEmptyBoxesUsed = outputs.reduce((sum, o) => sum + o.empty_boxes_used, 0);
  const totalDefects = outputs.reduce((sum, o) => sum + o.defects_count, 0);
  
  const totalStickersIssued = Object.values((batch.stickers_issued as Record<string, number>) || {}).reduce((a, b) => a + b, 0);
  const totalEmptyBoxesIssued = Object.values((batch.empty_boxes_issued as Record<string, number>) || {}).reduce((a, b) => a + b, 0);

  const defectRate = totalTubes > 0 ? (totalDefects / totalTubes * 100).toFixed(2) : '0';

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Batch Details
            <Badge className={cn(STATUS_CONFIG[batch.status]?.color)}>
              {STATUS_CONFIG[batch.status]?.label}
            </Badge>
            {isReadOnly && (
              <Badge variant="outline" className="ml-2">Read Only</Badge>
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
              <p className="font-medium">{format(new Date(batch.batch_date), 'MMM d, yyyy')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{format(new Date(batch.created_at), 'h:mm a')}</p>
            </div>
          </div>

          {/* Time & Motion Metrics (if recorded) */}
          {(batch.tobacco_heatup_minutes || batch.avg_tube_fill_seconds || batch.avg_sticker_apply_seconds) && (
            <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
              <h4 className="font-medium text-violet-800 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time & Motion Metrics
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                {batch.tobacco_heatup_minutes && (
                  <div>
                    <p className="text-muted-foreground">Heat-up Time</p>
                    <p className="text-lg font-bold">{batch.tobacco_heatup_minutes} min</p>
                  </div>
                )}
                {batch.avg_tube_fill_seconds && (
                  <div>
                    <p className="text-muted-foreground">Avg Tube Fill</p>
                    <p className="text-lg font-bold">{batch.avg_tube_fill_seconds} sec</p>
                  </div>
                )}
                {batch.avg_sticker_apply_seconds && (
                  <div>
                    <p className="text-muted-foreground">Avg Sticker Apply</p>
                    <p className="text-lg font-bold">{batch.avg_sticker_apply_seconds} sec</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Issued vs Used */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Issued to Office
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tobacco</span>
                  <span className="font-medium">{batch.tobacco_lbs ?? 0} lbs</span>
                </div>
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

            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <h4 className="font-medium text-emerald-800 mb-3 flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Used in Production
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Boxes Completed</span>
                  <span className="font-medium text-primary">{totalBoxes.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tubes Used</span>
                  <span className="font-medium">{totalTubes.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stickers Used</span>
                  <span className="font-medium">{totalStickersUsed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empty Boxes Used</span>
                  <span className="font-medium">{totalEmptyBoxesUsed.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Defect Summary */}
          {totalDefects > 0 && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <h4 className="font-medium text-red-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Defect Summary
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-destructive">{totalDefects}</p>
                  <p className="text-xs text-muted-foreground">Total Defects</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{defectRate}%</p>
                  <p className="text-xs text-muted-foreground">Defect Rate</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{(totalTubes - totalDefects).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Good Tubes</p>
                </div>
              </div>
              
              {/* Per-output defect reasons */}
              <div className="mt-3 space-y-1">
                {outputs.filter(o => o.defects_count > 0).map(output => (
                  <div key={output.id} className="text-sm flex items-center justify-between p-2 bg-background rounded">
                    <span>{output.brand}: {output.defects_count} defects</span>
                    {output.defect_reason && (
                      <span className="text-muted-foreground italic">{output.defect_reason}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outputs by Brand */}
          <div>
            <h4 className="font-medium mb-2">Outputs by Brand</h4>
            {outputs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outputs recorded.</p>
            ) : (
              <div className="space-y-2">
                {outputs.map(output => {
                  const brandConfig = BRANDS.find(b => b.id === output.brand);
                  return (
                    <div key={output.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', brandConfig?.color)} />
                        <span className="font-medium">{brandConfig?.label}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>{output.boxes_completed} boxes</span>
                        <span>{output.tubes_used} tubes</span>
                        <span>{output.stickers_used} stickers</span>
                        {output.defects_count > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {output.defects_count} defects
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
