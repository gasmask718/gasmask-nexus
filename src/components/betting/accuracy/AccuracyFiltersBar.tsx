import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AccuracyFilters } from '@/hooks/useAccuracyMetrics';
import { Filter, RotateCcw } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface AccuracyFiltersBarProps {
  filters: AccuracyFilters;
  onChange: (filters: AccuracyFilters) => void;
}

export function AccuracyFiltersBar({ filters, onChange }: AccuracyFiltersBarProps) {
  const handleReset = () => {
    onChange({
      sport: 'NBA',
      dateFrom: format(subDays(new Date(), 90), 'yyyy-MM-dd'),
      dateTo: format(new Date(), 'yyyy-MM-dd'),
      marketType: 'all',
      modelVersion: 'all',
    });
  };

  const handleQuickDate = (days: number) => {
    onChange({
      ...filters,
      dateFrom: format(subDays(new Date(), days), 'yyyy-MM-dd'),
      dateTo: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleReset}
            className="h-8 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
          {/* Sport */}
          <div className="space-y-1.5">
            <Label className="text-xs">Sport</Label>
            <Select 
              value={filters.sport} 
              onValueChange={(v) => onChange({ ...filters, sport: v as 'NBA' | 'all' })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NBA">NBA</SelectItem>
                <SelectItem value="all">All Sports</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
              className="h-9 text-xs"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
              className="h-9 text-xs"
            />
          </div>

          {/* Market Type */}
          <div className="space-y-1.5">
            <Label className="text-xs">Market Type</Label>
            <Select 
              value={filters.marketType} 
              onValueChange={(v) => onChange({ ...filters, marketType: v as any })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                <SelectItem value="moneyline">Moneyline</SelectItem>
                <SelectItem value="player_prop">Player Props</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Model Version */}
          <div className="space-y-1.5">
            <Label className="text-xs">Model Version</Label>
            <Select 
              value={filters.modelVersion} 
              onValueChange={(v) => onChange({ ...filters, modelVersion: v })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Versions</SelectItem>
                <SelectItem value="v1">v1</SelectItem>
                <SelectItem value="v2">v2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick Date Buttons */}
          <div className="space-y-1.5">
            <Label className="text-xs">Quick Select</Label>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs px-2 flex-1"
                onClick={() => handleQuickDate(7)}
              >
                7D
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs px-2 flex-1"
                onClick={() => handleQuickDate(30)}
              >
                30D
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs px-2 flex-1"
                onClick={() => handleQuickDate(90)}
              >
                90D
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
