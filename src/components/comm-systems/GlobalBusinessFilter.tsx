import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Building2, 
  Globe, 
  Lock, 
  Unlock, 
  RefreshCw, 
  BarChart3,
  ChevronDown,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface BusinessContext {
  mode: 'all' | 'single' | 'brand';
  businessId: string | null;
  businessName: string | null;
  brandId: string | null;
  isLocked: boolean;
}

interface GlobalBusinessFilterProps {
  context: BusinessContext;
  onContextChange: (context: BusinessContext) => void;
  onCompare?: () => void;
  showCompare?: boolean;
}

export function GlobalBusinessFilter({ 
  context, 
  onContextChange, 
  onCompare,
  showCompare = true 
}: GlobalBusinessFilterProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: businesses } = useQuery({
    queryKey: ['global-businesses-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, slug, theme_config')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: brands } = useQuery({
    queryKey: ['global-brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_verticals')
        .select('id, name, slug')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const handleBusinessChange = (value: string) => {
    if (value === 'all') {
      onContextChange({
        mode: 'all',
        businessId: null,
        businessName: null,
        brandId: null,
        isLocked: context.isLocked,
      });
    } else {
      const business = businesses?.find(b => b.id === value);
      onContextChange({
        mode: 'single',
        businessId: value,
        businessName: business?.name || null,
        brandId: null,
        isLocked: context.isLocked,
      });
    }
  };

  const handleLockToggle = () => {
    onContextChange({
      ...context,
      isLocked: !context.isLocked,
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Trigger any refresh logic here
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsRefreshing(false);
  };

  const displayValue = context.mode === 'all' 
    ? '🌐 All Businesses' 
    : context.businessName || 'Select Business';

  return (
    <div className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg">
      {/* Lock Status Indicator */}
      <div className={cn(
        "p-2 rounded-md",
        context.isLocked ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground"
      )}>
        {context.isLocked ? (
          <Lock className="h-4 w-4" />
        ) : (
          <Unlock className="h-4 w-4" />
        )}
      </div>

      {/* Business Selector */}
      <Select 
        value={context.businessId || 'all'} 
        onValueChange={handleBusinessChange}
        disabled={context.isLocked}
      >
        <SelectTrigger className="w-[220px]">
          <div className="flex items-center gap-2">
            {context.mode === 'all' ? (
              <Globe className="h-4 w-4 text-primary" />
            ) : (
              <Building2 className="h-4 w-4" />
            )}
            <SelectValue placeholder="Select context" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <span>🌐 All Businesses</span>
            </div>
          </SelectItem>
          <DropdownMenuSeparator />
          {businesses?.map((business) => {
            const config = business.theme_config as { primary?: string; icon?: string } | null;
            const color = config?.primary || '#6366f1';
            const icon = config?.icon || '🏢';
            return (
              <SelectItem key={business.id} value={business.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="h-3 w-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: color }}
                  />
                  <span className="mr-1">{icon}</span>
                  <span>{business.name}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Context Mode Badge */}
      <Badge 
        variant={context.mode === 'all' ? 'default' : 'secondary'}
        className="hidden md:flex"
      >
        {context.mode === 'all' ? 'Aggregate View' : 'Single Business'}
      </Badge>

      {/* Warning for All Businesses */}
      {context.mode === 'all' && (
        <Badge variant="outline" className="hidden lg:flex gap-1 text-amber-500 border-amber-500/30">
          <AlertTriangle className="h-3 w-3" />
          Read-Only Cross-Business
        </Badge>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-1 ml-auto">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh Context"
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>

        {showCompare && (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onCompare}
            title="Compare Businesses"
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
        )}

        <Button 
          variant={context.isLocked ? "default" : "outline"}
          size="sm"
          onClick={handleLockToggle}
          className="gap-1"
        >
          {context.isLocked ? (
            <>
              <Lock className="h-3 w-3" />
              <span className="hidden sm:inline">Locked</span>
            </>
          ) : (
            <>
              <Unlock className="h-3 w-3" />
              <span className="hidden sm:inline">Lock</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Hook for managing business context state
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CommBusinessContextStore {
  context: BusinessContext;
  setContext: (context: BusinessContext) => void;
  lockBusiness: (businessId: string, businessName: string) => void;
  unlockBusiness: () => void;
  setAllBusinesses: () => void;
}

export const useCommBusinessContext = create<CommBusinessContextStore>()(
  persist(
    (set) => ({
      context: {
        mode: 'all',
        businessId: null,
        businessName: null,
        brandId: null,
        isLocked: false,
      },
      setContext: (context) => set({ context }),
      lockBusiness: (businessId, businessName) => set({
        context: {
          mode: 'single',
          businessId,
          businessName,
          brandId: null,
          isLocked: true,
        }
      }),
      unlockBusiness: () => set((state) => ({
        context: { ...state.context, isLocked: false }
      })),
      setAllBusinesses: () => set({
        context: {
          mode: 'all',
          businessId: null,
          businessName: null,
          brandId: null,
          isLocked: false,
        }
      }),
    }),
    {
      name: 'comm-business-context',
    }
  )
);
