import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  Truck,
  Bike,
  Users,
  AlertTriangle,
  Radio,
  RefreshCw,
  Filter,
  X,
  MapPin,
} from "lucide-react";

export interface MapFilters {
  search: string;
  roles: string[];
  statuses: string[];
  showAlerts: boolean;
  showCriticalOnly: boolean;
  showSLABreached: boolean;
  showStores: boolean;
}

interface MapFiltersBarProps {
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastRefresh: Date | null;
  stats: {
    totalRoutes: number;
    totalWorkers: number;
    totalAlerts: number;
    criticalAlerts: number;
    totalStores: number;
  };
  onGeocodeStores?: () => void;
  isGeocoding?: boolean;
}

export function MapFiltersBar({
  filters,
  onFiltersChange,
  onRefresh,
  isRefreshing,
  lastRefresh,
  stats,
  onGeocodeStores,
  isGeocoding,
}: MapFiltersBarProps) {
  const toggleRole = (role: string) => {
    const roles = filters.roles.includes(role)
      ? filters.roles.filter(r => r !== role)
      : [...filters.roles, role];
    onFiltersChange({ ...filters, roles });
  };

  const toggleStatus = (status: string) => {
    const statuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      roles: [],
      statuses: [],
      showAlerts: true,
      showCriticalOnly: false,
      showSLABreached: false,
      showStores: true,
    });
  };

  const hasActiveFilters = filters.search || filters.roles.length > 0 || filters.statuses.length > 0 || filters.showCriticalOnly || filters.showSLABreached;

  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search worker, store, route..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-9 bg-background/95 backdrop-blur border-border/50"
        />
      </div>

      {/* Role Filters */}
      <div className="flex items-center gap-1 bg-background/95 backdrop-blur rounded-lg p-1 border border-border/50">
        <Button
          size="sm"
          variant={filters.roles.includes('driver') ? 'default' : 'ghost'}
          className="h-8 px-2"
          onClick={() => toggleRole('driver')}
        >
          <Truck className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Drivers</span>
        </Button>
        <Button
          size="sm"
          variant={filters.roles.includes('biker') ? 'default' : 'ghost'}
          className="h-8 px-2"
          onClick={() => toggleRole('biker')}
        >
          <Bike className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Bikers</span>
        </Button>
        <Button
          size="sm"
          variant={filters.roles.includes('ambassador') ? 'default' : 'ghost'}
          className="h-8 px-2"
          onClick={() => toggleRole('ambassador')}
        >
          <Users className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Ambassadors</span>
        </Button>
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-1 bg-background/95 backdrop-blur rounded-lg p-1 border border-border/50">
        <Button
          size="sm"
          variant={filters.statuses.includes('active') ? 'default' : 'ghost'}
          className="h-8 px-2"
          onClick={() => toggleStatus('active')}
        >
          Active
        </Button>
        <Button
          size="sm"
          variant={filters.statuses.includes('planned') ? 'default' : 'ghost'}
          className="h-8 px-2"
          onClick={() => toggleStatus('planned')}
        >
          Planned
        </Button>
        <Button
          size="sm"
          variant={filters.statuses.includes('paused') ? 'default' : 'ghost'}
          className="h-8 px-2"
          onClick={() => toggleStatus('paused')}
        >
          Paused
        </Button>
      </div>

      {/* Store & Alert Filters */}
      <div className="flex items-center gap-1 bg-background/95 backdrop-blur rounded-lg p-1 border border-border/50">
        <Button
          size="sm"
          variant={filters.showStores ? 'default' : 'ghost'}
          className="h-8 px-2"
          onClick={() => onFiltersChange({ ...filters, showStores: !filters.showStores })}
        >
          <MapPin className="h-4 w-4 mr-1" />
          Stores
          {stats.totalStores > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1">
              {stats.totalStores}
            </Badge>
          )}
        </Button>
        <Button
          size="sm"
          variant={filters.showCriticalOnly ? 'destructive' : 'ghost'}
          className="h-8 px-2"
          onClick={() => onFiltersChange({ ...filters, showCriticalOnly: !filters.showCriticalOnly })}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Critical
          {stats.criticalAlerts > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 px-1">
              {stats.criticalAlerts}
            </Badge>
          )}
        </Button>
        <Button
          size="sm"
          variant={filters.showSLABreached ? 'destructive' : 'ghost'}
          className="h-8 px-2"
          onClick={() => onFiltersChange({ ...filters, showSLABreached: !filters.showSLABreached })}
        >
          SLA
        </Button>
      </div>

      {/* Geocode Button */}
      {onGeocodeStores && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2"
          onClick={onGeocodeStores}
          disabled={isGeocoding}
        >
          {isGeocoding ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <MapPin className="h-4 w-4 mr-1" />}
          Geocode
        </Button>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onClick={clearFilters}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      {/* Live Indicator & Refresh */}
      <div className="flex items-center gap-2 bg-background/95 backdrop-blur rounded-lg px-3 py-1.5 border border-border/50">
        <Radio className="h-4 w-4 text-green-500 animate-pulse" />
        <span className="text-sm font-medium">Live</span>
        {lastRefresh && (
          <span className="text-xs text-muted-foreground">
            {Math.round((Date.now() - lastRefresh.getTime()) / 1000)}s ago
          </span>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
