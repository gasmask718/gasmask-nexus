// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS FILTERS — Quick Filters Row for Results Panel
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, CalendarDays, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { GRABBA_BRAND_CONFIG } from '@/config/grabbaBrands';

interface ResultsFiltersProps {
  onSearch: (term: string) => void;
  onBrandChange: (brand: string | undefined) => void;
  onStatusChange: (status: string | undefined) => void;
  onDateRangeChange: (range: { start: Date; end: Date } | undefined) => void;
  onMyStoresOnly?: (value: boolean) => void;
  currentBrand?: string;
  currentStatus?: string;
  showMyStoresFilter?: boolean;
  statusOptions?: { value: string; label: string }[];
}

export function ResultsFilters({
  onSearch,
  onBrandChange,
  onStatusChange,
  onDateRangeChange,
  onMyStoresOnly,
  currentBrand,
  currentStatus,
  showMyStoresFilter = false,
  statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'pending', label: 'Pending' },
  ],
}: ResultsFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>({});
  const [myStoresOnly, setMyStoresOnly] = useState(false);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    onSearch(value);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!dateRange.start) {
      setDateRange({ start: date });
    } else if (!dateRange.end && date && date > dateRange.start) {
      const newRange = { start: dateRange.start, end: date };
      setDateRange(newRange);
      onDateRangeChange(newRange as { start: Date; end: Date });
    } else {
      setDateRange({ start: date });
    }
  };

  const clearDateRange = () => {
    setDateRange({});
    onDateRangeChange(undefined);
  };

  const toggleMyStores = () => {
    const newValue = !myStoresOnly;
    setMyStoresOnly(newValue);
    onMyStoresOnly?.(newValue);
  };

  const activeFiltersCount = [
    currentBrand,
    currentStatus,
    dateRange.start && dateRange.end,
    myStoresOnly,
  ].filter(Boolean).length;

  return (
    <div className="border-b border-border px-4 py-3 space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search results..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Brand Filter */}
        <Select value={currentBrand || 'all'} onValueChange={(v) => onBrandChange(v === 'all' ? undefined : v)}>
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {Object.entries(GRABBA_BRAND_CONFIG).map(([id, brand]) => (
              <SelectItem key={id} value={id}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={currentStatus || 'all'} onValueChange={(v) => onStatusChange(v === 'all' ? undefined : v)}>
          <SelectTrigger className="w-[130px] h-8">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {dateRange.start && dateRange.end ? (
                <span className="text-xs">
                  {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d')}
                </span>
              ) : (
                'Date Range'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateRange.start}
              onSelect={handleDateSelect}
              initialFocus
            />
            {dateRange.start && dateRange.end && (
              <div className="p-2 border-t">
                <Button variant="ghost" size="sm" className="w-full" onClick={clearDateRange}>
                  Clear Range
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* My Stores Only Toggle */}
        {showMyStoresFilter && (
          <Button
            variant={myStoresOnly ? 'default' : 'outline'}
            size="sm"
            className="h-8"
            onClick={toggleMyStores}
          >
            My Stores Only
          </Button>
        )}

        {/* Active Filters Badge */}
        {activeFiltersCount > 0 && (
          <Badge variant="secondary" className="gap-1">
            <Filter className="h-3 w-3" />
            {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>
    </div>
  );
}

export default ResultsFilters;
