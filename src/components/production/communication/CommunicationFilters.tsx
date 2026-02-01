/**
 * COMMUNICATION FILTERS
 * 
 * Filter bar for communications - channel, date range, status, worker.
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  Search, 
  Filter, 
  Calendar as CalendarIcon,
  LayoutList,
  Users
} from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface CommunicationFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  channelFilter: string;
  onChannelChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  workerFilter: string;
  onWorkerChange: (value: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  viewMode: 'grouped' | 'timeline';
  onViewModeChange: (mode: 'grouped' | 'timeline') => void;
  workers: Array<{ id: string; full_name: string }>;
}

export function CommunicationFilters({
  searchTerm,
  onSearchChange,
  channelFilter,
  onChannelChange,
  statusFilter,
  onStatusChange,
  workerFilter,
  onWorkerChange,
  dateRange,
  onDateRangeChange,
  viewMode,
  onViewModeChange,
  workers,
}: CommunicationFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Primary filters row */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages, workers, phones..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* View mode toggle */}
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-9 rounded-r-none"
            onClick={() => onViewModeChange('grouped')}
          >
            <Users className="h-4 w-4 mr-1" />
            Grouped
          </Button>
          <Button
            variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-9 rounded-l-none"
            onClick={() => onViewModeChange('timeline')}
          >
            <LayoutList className="h-4 w-4 mr-1" />
            Timeline
          </Button>
        </div>
      </div>

      {/* Secondary filters row */}
      <div className="flex flex-wrap gap-2">
        {/* Channel filter */}
        <Select value={channelFilter} onValueChange={onChannelChange}>
          <SelectTrigger className="w-[130px] h-8">
            <Filter className="h-3 w-3 mr-2" />
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="call">Call</SelectItem>
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[130px] h-8">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>

        {/* Worker filter */}
        <Select value={workerFilter} onValueChange={onWorkerChange}>
          <SelectTrigger className="w-[160px] h-8">
            <SelectValue placeholder="All Workers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Workers</SelectItem>
            {workers.map((worker) => (
              <SelectItem key={worker.id} value={worker.id}>
                {worker.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-3 w-3" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={onDateRangeChange}
              numberOfMonths={2}
            />
            {dateRange && (
              <div className="p-2 border-t">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full"
                  onClick={() => onDateRangeChange(undefined)}
                >
                  Clear dates
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
