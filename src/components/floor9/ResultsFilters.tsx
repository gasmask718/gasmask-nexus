// Floor 9 - Results Filters Component
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Filter, X, RefreshCw } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { AIResultFilters } from '@/hooks/useAIResults';
import { cn } from '@/lib/utils';

interface ResultsFiltersProps {
  filters: AIResultFilters;
  onFiltersChange: (filters: AIResultFilters) => void;
  taskTypes: string[];
  entityTypes: string[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'blocked', label: 'Blocked' },
];

const EXECUTION_MODES = [
  { value: 'draft_only', label: 'Draft Only' },
  { value: 'execute_with_approval', label: 'Execute w/ Approval' },
  { value: 'recommendation_only', label: 'Recommendation Only' },
];

const HUMAN_DECISIONS = [
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'modified', label: 'Modified' },
  { value: 'pending', label: 'Pending' },
];

const DEPARTMENTS = [
  'Sales/CRM',
  'Operations',
  'Wholesale',
  'Finance',
  'Intelligence',
  'Delivery',
  'Communication',
  'Ambassadors',
];

export function ResultsFilters({
  filters,
  onFiltersChange,
  taskTypes,
  entityTypes,
  isLoading,
  onRefresh,
}: ResultsFiltersProps) {
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value !== undefined && key !== 'dateRange' && key !== 'limit'
  ).length;

  const handleClearFilters = () => {
    onFiltersChange({
      dateRange: { from: subDays(new Date(), 30), to: new Date() },
      limit: 100,
    });
  };

  const updateFilter = (key: keyof AIResultFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value === 'all' ? undefined : value });
  };

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary">{activeFilterCount} active</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
                <RefreshCw className={cn("h-3 w-3 mr-1", isLoading && "animate-spin")} />
                Refresh
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Date Range */}
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateRange?.from ? (
                    filters.dateRange.to ? (
                      <>
                        {format(filters.dateRange.from, 'MMM d, yyyy')} - {format(filters.dateRange.to, 'MMM d, yyyy')}
                      </>
                    ) : (
                      format(filters.dateRange.from, 'MMM d, yyyy')
                    )
                  ) : (
                    'Select dates'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{
                    from: filters.dateRange?.from,
                    to: filters.dateRange?.to,
                  }}
                  onSelect={(range) =>
                    updateFilter('dateRange', range ? { from: range.from, to: range.to || range.from } : undefined)
                  }
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
            <Select value={filters.status || 'all'} onValueChange={(v) => updateFilter('status', v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Task Type */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Task Type</Label>
            <Select value={filters.taskType || 'all'} onValueChange={(v) => updateFilter('taskType', v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {taskTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entity Type */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Entity Type</Label>
            <Select value={filters.entityType || 'all'} onValueChange={(v) => updateFilter('entityType', v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {entityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Execution Mode */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Execution Mode</Label>
            <Select value={filters.executionMode || 'all'} onValueChange={(v) => updateFilter('executionMode', v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                {EXECUTION_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Human Decision */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Human Decision</Label>
            <Select value={filters.humanDecision || 'all'} onValueChange={(v) => updateFilter('humanDecision', v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Decisions</SelectItem>
                {HUMAN_DECISIONS.map((dec) => (
                  <SelectItem key={dec.value} value={dec.value}>
                    {dec.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Department</Label>
            <Select value={filters.department || 'all'} onValueChange={(v) => updateFilter('department', v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Confidence Range */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Min Confidence</Label>
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="0"
              className="h-9"
              value={filters.confidenceMin || ''}
              onChange={(e) => updateFilter('confidenceMin', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Max Confidence</Label>
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="100"
              className="h-9"
              value={filters.confidenceMax || ''}
              onChange={(e) => updateFilter('confidenceMax', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        </div>

        {/* Date Range Info */}
        <div className="mt-3 text-xs text-muted-foreground">
          Showing results for{' '}
          {filters.dateRange?.from && filters.dateRange?.to ? (
            <>
              {format(filters.dateRange.from, 'MMMM d, yyyy')} — {format(filters.dateRange.to, 'MMMM d, yyyy')}
            </>
          ) : (
            'the last 30 days'
          )}
        </div>
      </CardContent>
    </Card>
  );
}
