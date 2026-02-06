// ═══════════════════════════════════════════════════════════════════════════════
// SUBMISSION FILTERS
// Search, time filters, and quick filter chips
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
  Search, 
  Filter, 
  Clock, 
  AlertTriangle, 
  Users,
  X,
  CalendarDays,
} from 'lucide-react';
import type { FieldSubmissionStatus, FieldEntityType } from '@/hooks/useFieldSubmissions';

export interface SubmissionFiltersState {
  search: string;
  status: FieldSubmissionStatus | 'all';
  entityType: FieldEntityType | 'all';
  timeRange: '24h' | '7d' | '30d' | 'all';
  quickFilter: 'high_risk' | 'pending_old' | 'multiple_same_user' | null;
}

interface SubmissionFiltersProps {
  filters: SubmissionFiltersState;
  onChange: (filters: SubmissionFiltersState) => void;
  stats?: {
    highRisk: number;
    pendingOld: number;
    multipleSameUser: number;
  };
}

export function SubmissionFilters({ filters, onChange, stats }: SubmissionFiltersProps) {
  const updateFilter = <K extends keyof SubmissionFiltersState>(
    key: K,
    value: SubmissionFiltersState[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onChange({
      search: '',
      status: 'all',
      entityType: 'all',
      timeRange: 'all',
      quickFilter: null,
    });
  };

  const hasActiveFilters = 
    filters.search || 
    filters.status !== 'all' || 
    filters.entityType !== 'all' || 
    filters.timeRange !== 'all' ||
    filters.quickFilter !== null;

  const quickFilters = [
    { 
      id: 'high_risk' as const, 
      label: 'High Risk', 
      icon: AlertTriangle, 
      count: stats?.highRisk,
      color: 'text-orange-600 border-orange-500/30 bg-orange-500/10'
    },
    { 
      id: 'pending_old' as const, 
      label: 'Pending >24h', 
      icon: Clock, 
      count: stats?.pendingOld,
      color: 'text-amber-600 border-amber-500/30 bg-amber-500/10'
    },
    { 
      id: 'multiple_same_user' as const, 
      label: 'Same User, Multiple', 
      icon: Users, 
      count: stats?.multipleSameUser,
      color: 'text-blue-600 border-blue-500/30 bg-blue-500/10'
    },
  ];

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Search & Dropdowns Row */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search store, submitter, entity..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status Filter */}
          <Select 
            value={filters.status} 
            onValueChange={(v) => updateFilter('status', v as FieldSubmissionStatus | 'all')}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="auto_approved">Auto-Approved</SelectItem>
            </SelectContent>
          </Select>

          {/* Entity Type Filter */}
          <Select 
            value={filters.entityType} 
            onValueChange={(v) => updateFilter('entityType', v as FieldEntityType | 'all')}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="brand_sticker">Brand Stickers</SelectItem>
              <SelectItem value="tube_inventory">Tube Inventory</SelectItem>
              <SelectItem value="invoice">Invoices</SelectItem>
              <SelectItem value="order_note">Order Notes</SelectItem>
              <SelectItem value="visit_log">Visit Logs</SelectItem>
              <SelectItem value="store_update">Store Updates</SelectItem>
              <SelectItem value="store_contact">Store Contacts</SelectItem>
              <SelectItem value="wholesaler_association">Wholesaler Associations</SelectItem>
              <SelectItem value="connected_store">Connected Stores</SelectItem>
              <SelectItem value="store_questionnaire">Questionnaires</SelectItem>
            </SelectContent>
          </Select>

          {/* Time Range */}
          <Select 
            value={filters.timeRange} 
            onValueChange={(v) => updateFilter('timeRange', v as SubmissionFiltersState['timeRange'])}
          >
            <SelectTrigger className="w-[140px]">
              <CalendarDays className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Quick Filters Row */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Quick:</span>
          </div>
          {quickFilters.map((qf) => {
            const Icon = qf.icon;
            const isActive = filters.quickFilter === qf.id;
            return (
              <Badge
                key={qf.id}
                variant="outline"
                className={`cursor-pointer transition-all ${
                  isActive 
                    ? qf.color + ' ring-2 ring-offset-1' 
                    : 'hover:bg-muted'
                }`}
                onClick={() => updateFilter('quickFilter', isActive ? null : qf.id)}
              >
                <Icon className="h-3 w-3 mr-1" />
                {qf.label}
                {qf.count !== undefined && qf.count > 0 && (
                  <span className="ml-1 text-xs opacity-75">({qf.count})</span>
                )}
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
