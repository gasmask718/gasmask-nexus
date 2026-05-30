// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND CONTROLS BAR — Territory, Date, Prediction Mode
// Phase 3.6 enhancements + Phase 4 prediction toggle
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import {
  CalendarIcon,
  MapPin,
  BrainCircuit,
  Gauge,
  ChevronDown,
} from "lucide-react";
import { useBoroughs } from "@/hooks/useBoroughs";
import { cn } from "@/lib/utils";

interface CommandControlsBarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  selectedTerritory: string;
  onTerritoryChange: (territory: string) => void;
  predictionMode: boolean;
  onPredictionModeChange: (enabled: boolean) => void;
  stats?: {
    avgRiskScore: number;
    routesAtRisk: number;
    stopsLikelyLate: number;
  };
}

export function CommandControlsBar({
  selectedDate,
  onDateChange,
  selectedTerritory,
  onTerritoryChange,
  predictionMode,
  onPredictionModeChange,
  stats,
}: CommandControlsBarProps) {
  const { data: boroughs = [] } = useBoroughs();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const territories = [
    { id: 'all', name: 'All Territories' },
    ...boroughs.map(b => ({ id: b.id, name: b.name })),
  ];

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const isTomorrow = format(selectedDate, 'yyyy-MM-dd') === format(
    new Date(Date.now() + 86400000), 'yyyy-MM-dd'
  );

  const getRiskColor = (score: number) => {
    if (score >= 75) return 'text-red-500';
    if (score >= 50) return 'text-orange-500';
    if (score >= 25) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="flex items-center gap-3 bg-background/95 backdrop-blur rounded-lg p-2 border border-border/50">
      {/* Date Selector */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={isToday ? 'default' : 'ghost'}
          className="h-8 px-3"
          onClick={() => onDateChange(new Date())}
        >
          Today
        </Button>
        <Button
          size="sm"
          variant={isTomorrow ? 'default' : 'ghost'}
          className="h-8 px-3"
          onClick={() => onDateChange(new Date(Date.now() + 86400000))}
        >
          Tomorrow
        </Button>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={!isToday && !isTomorrow ? 'default' : 'ghost'}
              className="h-8 px-3"
            >
              <CalendarIcon className="h-4 w-4 mr-1" />
              {!isToday && !isTomorrow ? format(selectedDate, 'MMM d, yyyy') : 'Custom'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  onDateChange(date);
                  setCalendarOpen(false);
                }
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Territory Selector */}
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <Select value={selectedTerritory} onValueChange={onTerritoryChange}>
          <SelectTrigger className="h-8 w-[160px] border-0 bg-transparent">
            <SelectValue placeholder="All Territories" />
          </SelectTrigger>
          <SelectContent>
            {territories.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Prediction Mode Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className={`h-4 w-4 ${predictionMode ? 'text-primary' : 'text-muted-foreground'}`} />
          <Label htmlFor="prediction-mode" className="text-sm cursor-pointer">
            Predictions
          </Label>
          <Switch
            id="prediction-mode"
            checked={predictionMode}
            onCheckedChange={onPredictionModeChange}
          />
        </div>

        {/* Risk Summary (when prediction mode active) */}
        {predictionMode && stats && (
          <>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <Gauge className={`h-4 w-4 ${getRiskColor(stats.avgRiskScore)}`} />
                <span className={getRiskColor(stats.avgRiskScore)}>
                  Risk: {stats.avgRiskScore}
                </span>
              </div>
              {stats.routesAtRisk > 0 && (
                <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
                  {stats.routesAtRisk} routes at risk
                </Badge>
              )}
              {stats.stopsLikelyLate > 0 && (
                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
                  {stats.stopsLikelyLate} stops late
                </Badge>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
