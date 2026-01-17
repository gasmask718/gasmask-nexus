import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { LucideIcon, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';

export interface MetricItem {
  id: string;
  label: string;
  value: string | number;
  sublabel?: string;
  date?: string;
  status?: 'positive' | 'negative' | 'neutral';
  onClick?: () => void;
}

interface MetricDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  mainValue: string | number;
  mainLabel: string;
  trend?: 'up' | 'down' | 'stable';
  trendLabel?: string;
  items: MetricItem[];
  emptyMessage?: string;
}

export function MetricDetailDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  icon: Icon,
  iconColor = 'text-primary',
  mainValue,
  mainLabel,
  trend,
  trendLabel,
  items,
  emptyMessage = 'No data available',
}: MetricDetailDrawerProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-400" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status?: 'positive' | 'negative' | 'neutral') => {
    switch (status) {
      case 'positive': return 'text-green-400';
      case 'negative': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl bg-muted/50 ${iconColor}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <SheetTitle className="text-xl">{title}</SheetTitle>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Main Metric Display */}
          <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <div className="text-center">
              <p className="text-4xl font-bold">{mainValue}</p>
              <p className="text-sm text-muted-foreground mt-1">{mainLabel}</p>
              {trend && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  {getTrendIcon()}
                  {trendLabel && (
                    <span className="text-xs text-muted-foreground">{trendLabel}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Detail List */}
        <div className="mt-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Breakdown ({items.length} items)
          </p>
          
          <ScrollArea className="h-[calc(100vh-380px)]">
            <div className="space-y-2 pr-4">
              {items.length > 0 ? (
                items.map((item) => (
                  <div
                    key={item.id}
                    onClick={item.onClick}
                    className={`
                      flex items-center justify-between p-3 rounded-lg bg-muted/30 
                      ${item.onClick ? 'cursor-pointer hover:bg-muted/50 transition-colors group' : ''}
                    `}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.label}</p>
                      {item.sublabel && (
                        <p className="text-xs text-muted-foreground">{item.sublabel}</p>
                      )}
                      {item.date && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(item.date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getStatusColor(item.status)}`}>
                        {item.value}
                      </span>
                      {item.onClick && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
