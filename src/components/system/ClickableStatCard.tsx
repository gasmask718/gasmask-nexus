// Phase 12 - Clickable Stat Cards that show real records

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Route, Truck, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatRecord {
  id: string;
  name: string;
  subtitle?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

interface ClickableStatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  records?: StatRecord[];
  onViewAll?: () => void;
  onSendToRoute?: (ids: string[]) => void;
  onAssignDriver?: (ids: string[]) => void;
  className?: string;
}

export function ClickableStatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendValue,
  variant = 'default',
  records = [],
  onViewAll,
  onSendToRoute,
  onAssignDriver,
  className,
}: ClickableStatCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const variantStyles = {
    default: 'bg-card',
    success: 'bg-green-500/5 border-green-500/20',
    warning: 'bg-amber-500/5 border-amber-500/20',
    danger: 'bg-red-500/5 border-red-500/20',
    info: 'bg-blue-500/5 border-blue-500/20',
  };

  const iconVariantStyles = {
    default: 'text-muted-foreground',
    success: 'text-green-500',
    warning: 'text-amber-500',
    danger: 'text-red-500',
    info: 'text-blue-500',
  };

  const handleCardClick = () => {
    if (records.length > 0) {
      setIsOpen(true);
    } else if (onViewAll) {
      onViewAll();
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === records.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map(r => r.id));
    }
  };

  return (
    <>
      <Card 
        className={cn(
          'cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md',
          variantStyles[variant],
          className
        )}
        onClick={handleCardClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
              {trendValue && (
                <p className={cn(
                  'text-xs',
                  trend === 'up' && 'text-green-500',
                  trend === 'down' && 'text-red-500',
                  trend === 'neutral' && 'text-muted-foreground'
                )}>
                  {trendValue}
                </p>
              )}
            </div>
            <div className={cn('p-2 rounded-lg bg-background/50', iconVariantStyles[variant])}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
          {records.length > 0 && (
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <span>Click to view records</span>
              <ChevronRight className="h-3 w-3 ml-1" />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className={cn('h-5 w-5', iconVariantStyles[variant])} />
              {label} ({records.length})
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
            {/* Select All */}
            <div className="flex items-center justify-between">
              <Button 
                size="sm" 
                variant="outline"
                onClick={selectAll}
              >
                {selectedIds.length === records.length ? 'Deselect All' : 'Select All'}
              </Button>
              <span className="text-xs text-muted-foreground">
                {selectedIds.length} selected
              </span>
            </div>

            {/* Records List */}
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className={cn(
                      'p-3 rounded-md border cursor-pointer transition-colors',
                      selectedIds.includes(record.id)
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-muted/50 hover:bg-muted'
                    )}
                    onClick={() => toggleSelect(record.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{record.name}</p>
                        {record.subtitle && (
                          <p className="text-xs text-muted-foreground">{record.subtitle}</p>
                        )}
                      </div>
                      {record.status && (
                        <Badge variant="secondary" className="text-[10px]">
                          {record.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t">
              {onSendToRoute && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selectedIds.length === 0}
                  onClick={() => {
                    onSendToRoute(selectedIds);
                    setIsOpen(false);
                  }}
                >
                  <Route className="h-3 w-3 mr-1" />
                  Send to Route
                </Button>
              )}
              {onAssignDriver && (
                <Button
                  size="sm"
                  disabled={selectedIds.length === 0}
                  onClick={() => {
                    onAssignDriver(selectedIds);
                    setIsOpen(false);
                  }}
                >
                  <Truck className="h-3 w-3 mr-1" />
                  Assign Driver
                </Button>
              )}
              {onViewAll && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => {
                    onViewAll();
                    setIsOpen(false);
                  }}
                >
                  View All
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
