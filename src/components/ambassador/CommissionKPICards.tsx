import { Card, CardContent } from "@/components/ui/card";
import { Store, Package, Users, UserPlus, TrendingUp, Clock, CheckCircle } from "lucide-react";
import type { CommissionSummary, CommissionCategory } from "@/hooks/useAmbassadorCommissions";

interface CommissionKPICardsProps {
  summaries: CommissionSummary[];
  onCategoryClick?: (category: CommissionCategory) => void;
  isLoading?: boolean;
}

const categoryConfig: Record<CommissionCategory, { 
  label: string; 
  icon: typeof Store; 
  color: string;
  description: string;
}> = {
  store: {
    label: 'Store Commissions',
    icon: Store,
    color: 'cyan',
    description: 'Earnings from store orders',
  },
  wholesaler: {
    label: 'Wholesaler Commissions',
    icon: Package,
    color: 'amber',
    description: 'Earnings from wholesaler purchases',
  },
  influencer: {
    label: 'Influencer Commissions',
    icon: Users,
    color: 'purple',
    description: 'Earnings from influencer campaigns',
  },
  ambassador: {
    label: 'Override Commissions',
    icon: UserPlus,
    color: 'green',
    description: 'Earnings from recruited ambassadors',
  },
};

export function CommissionKPICards({ summaries, onCategoryClick, isLoading }: CommissionKPICardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse bg-muted/50">
            <CardContent className="p-4 h-32" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {(['store', 'wholesaler', 'influencer', 'ambassador'] as CommissionCategory[]).map(category => {
        const config = categoryConfig[category];
        const summary = summaries.find(s => s.category === category) || {
          category,
          lifetime: 0,
          currentPeriod: 0,
          pending: 0,
          approved: 0,
          paid: 0,
          count: 0,
        };
        const Icon = config.icon;

        return (
          <Card
            key={category}
            className={`cursor-pointer hover:scale-[1.02] transition-all bg-gradient-to-br from-${config.color}-500/10 to-${config.color}-900/5 border-${config.color}-500/20 hover:border-${config.color}-500/40`}
            onClick={() => onCategoryClick?.(category)}
          >
            <CardContent className="p-4">
              <div className={`flex items-center gap-2 text-${config.color}-400 mb-2`}>
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{config.label}</span>
              </div>
              
              <div className="text-2xl font-bold text-foreground">
                ${summary.lifetime.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              
              <div className="text-xs text-muted-foreground mt-1">
                {config.description}
              </div>

              <div className="flex items-center gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">This month:</span>
                  <span className="font-medium">${summary.currentPeriod.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-2 text-xs">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-yellow-500" />
                  <span className="text-yellow-500">${summary.pending.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">${summary.paid.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
