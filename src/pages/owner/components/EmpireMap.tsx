import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  TrendingUp, 
  TrendingDown,
  ChevronRight,
  Flame,
  Heart,
  Sparkles,
  ShoppingBag,
  Car,
  PartyPopper,
  Home,
  CreditCard,
  Trophy,
  Gamepad2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface BusinessUnit {
  id: string;
  name: string;
  icon: React.ElementType;
  revenue: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  status: 'healthy' | 'watch' | 'critical';
  path: string;
  color: string;
}

const businessUnits: BusinessUnit[] = [
  { id: 'gasmask', name: 'GasMask OS', icon: Flame, revenue: '$128,450', change: '+12%', changeType: 'positive', status: 'healthy', path: '/gasmask/driver', color: 'red' },
  { id: 'hotmama', name: 'HotMama', icon: Heart, revenue: '$24,980', change: '+8%', changeType: 'positive', status: 'watch', path: '/brand/hotmama', color: 'rose' },
  { id: 'scalati', name: 'Hot Scalati', icon: Sparkles, revenue: '$18,200', change: '+15%', changeType: 'positive', status: 'healthy', path: '/brand/scalati', color: 'orange' },
  { id: 'grabba-r-us', name: 'Grabba R Us', icon: ShoppingBag, revenue: '$22,100', change: '+5%', changeType: 'positive', status: 'healthy', path: '/brand/grabba-r-us', color: 'green' },
  { id: 'toptier', name: 'TopTier Experience', icon: Car, revenue: '$58,320', change: '+22%', changeType: 'positive', status: 'healthy', path: '/os/toptier', color: 'blue' },
  { id: 'unforgettable', name: 'Unforgettable Times', icon: PartyPopper, revenue: '$32,740', change: '-3%', changeType: 'negative', status: 'watch', path: '/os/unforgettable', color: 'purple' },
  { id: 'iclean', name: 'iClean WeClean', icon: Home, revenue: '$21,560', change: '+7%', changeType: 'positive', status: 'healthy', path: '/os/iclean', color: 'cyan' },
  { id: 'funding', name: 'Funding Company', icon: CreditCard, revenue: '$39,200', change: '+18%', changeType: 'positive', status: 'watch', path: '/os/funding', color: 'emerald' },
  { id: 'grants', name: 'Grant Company', icon: Trophy, revenue: '$18,400', change: '+10%', changeType: 'positive', status: 'healthy', path: '/os/grants', color: 'yellow' },
  { id: 'playboxxx', name: 'PlayBoxxx', icon: Gamepad2, revenue: '$76,910', change: '+25%', changeType: 'positive', status: 'healthy', path: '/os/playboxxx', color: 'pink' },
];

const statusColors = {
  healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  watch: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const iconBgColors: Record<string, string> = {
  red: 'bg-red-500/10 border-red-500/30 text-red-400',
  rose: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
  orange: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  green: 'bg-green-500/10 border-green-500/30 text-green-400',
  blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
  cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  pink: 'bg-pink-500/10 border-pink-500/30 text-pink-400',
};

export function EmpireMap() {
  const navigate = useNavigate();

  return (
    <Card className="rounded-xl shadow-lg border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Empire Map</CardTitle>
              <CardDescription className="text-xs">Performance across all business units</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            View All
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {businessUnits.map((unit) => (
            <div
              key={unit.id}
              className="p-3 rounded-xl border border-border/50 bg-gradient-to-br from-card to-muted/20 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => navigate(unit.path)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("p-1.5 rounded-lg border", iconBgColors[unit.color])}>
                  <unit.icon className="h-3 w-3" />
                </div>
                <span className="text-xs font-medium truncate flex-1">{unit.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{unit.revenue}</span>
                <div className="flex items-center gap-1">
                  {unit.changeType === 'positive' ? (
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-400" />
                  )}
                  <span className={cn(
                    "text-[10px] font-medium",
                    unit.changeType === 'positive' ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {unit.change}
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", statusColors[unit.status])}>
                  {unit.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default EmpireMap;
