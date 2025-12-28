import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw, Filter } from 'lucide-react';
import { AnalyticsFilters as FilterType, DEFAULT_FILTERS } from '@/hooks/useAnalyticsData';
import { useStateCompliance, SupportedState, FormatTag, FORMAT_LABELS, STATE_LABELS } from '@/hooks/useStateCompliance';

interface AnalyticsFiltersProps {
  filters: FilterType;
  onChange: (filters: FilterType) => void;
}

const SPORTS = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'Soccer', 'Tennis', 'Golf'];
const MARKETS = ['PTS', 'REB', 'AST', 'PRA', '3PM', 'BLK', 'STL', 'TO', 'Moneyline', 'Spread', 'Total', 'FG', 'FT'];

export function AnalyticsFilters({ filters, onChange }: AnalyticsFiltersProps) {
  const { platforms, currentStateRules } = useStateCompliance();

  const update = (key: keyof FilterType, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const reset = () => {
    onChange(DEFAULT_FILTERS);
  };

  // Count active filters
  const activeCount = [
    filters.state !== 'all',
    filters.platform !== 'all',
    filters.sport !== '',
    filters.formatTag !== 'all',
    filters.decisionSource !== 'all',
    filters.market !== '',
    filters.selection !== 'all',
  ].filter(Boolean).length;

  // Get platforms based on current state filter
  const filteredPlatforms = platforms || [];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
            {activeCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeCount} active
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={reset} className="text-xs">
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-9">
          {/* Date From */}
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input 
              type="date" 
              value={filters.dateFrom} 
              onChange={(e) => update('dateFrom', e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input 
              type="date" 
              value={filters.dateTo} 
              onChange={(e) => update('dateTo', e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* State */}
          <div className="space-y-1.5">
            <Label className="text-xs">State</Label>
            <Select value={filters.state} onValueChange={(v) => update('state', v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {(['NY', 'GA', 'CA'] as SupportedState[]).map(state => (
                  <SelectItem key={state} value={state}>{STATE_LABELS[state]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Platform */}
          <div className="space-y-1.5">
            <Label className="text-xs">Platform</Label>
            <Select value={filters.platform} onValueChange={(v) => update('platform', v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {filteredPlatforms.map(p => (
                  <SelectItem key={p.platform_key} value={p.platform_key}>
                    {p.platform_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sport */}
          <div className="space-y-1.5">
            <Label className="text-xs">Sport</Label>
            <Select value={filters.sport} onValueChange={(v) => update('sport', v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Sports</SelectItem>
                {SPORTS.map(sport => (
                  <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <Label className="text-xs">Format</Label>
            <Select value={filters.formatTag} onValueChange={(v) => update('formatTag', v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Formats</SelectItem>
                {(Object.keys(FORMAT_LABELS) as FormatTag[]).map(fmt => (
                  <SelectItem key={fmt} value={fmt}>{FORMAT_LABELS[fmt]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Decision Source */}
          <div className="space-y-1.5">
            <Label className="text-xs">Source</Label>
            <Select value={filters.decisionSource} onValueChange={(v) => update('decisionSource', v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="AI">AI Signals</SelectItem>
                <SelectItem value="USER">User Picks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Market */}
          <div className="space-y-1.5">
            <Label className="text-xs">Market</Label>
            <Select value={filters.market} onValueChange={(v) => update('market', v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Markets</SelectItem>
                {MARKETS.map(market => (
                  <SelectItem key={market} value={market}>{market}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs">Selection</Label>
            <Select value={filters.selection} onValueChange={(v) => update('selection', v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="MORE">▲ MORE</SelectItem>
                <SelectItem value="LESS">▼ LESS</SelectItem>
                <SelectItem value="over">Over</SelectItem>
                <SelectItem value="under">Under</SelectItem>
                <SelectItem value="home">Home</SelectItem>
                <SelectItem value="away">Away</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
