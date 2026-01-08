/**
 * Dynamic KPI Card Component
 * Renders a KPI card based on configuration from the database
 */
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Car,
  Users,
  Calendar,
  Building2,
  UserX,
  AlertCircle,
  TrendingUp,
  Clock,
  DollarSign,
  Package,
  MapPin,
  Star,
  LucideIcon,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  BarChart,
  Briefcase,
  FileText,
  Heart,
  Home,
  Mail,
  Phone,
  Settings,
  ShoppingCart,
  Tag,
  Truck,
  User,
  Wallet,
  Zap,
} from "lucide-react";
import { CalculatedKPI } from "@/hooks/useDynamicKPIs";
import { cn } from "@/lib/utils";

// Extended icon mapping
const ICON_MAP: Record<string, LucideIcon> = {
  Car,
  Users,
  Calendar,
  Building2,
  UserX,
  AlertCircle,
  TrendingUp,
  Clock,
  DollarSign,
  Package,
  MapPin,
  Star,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  BarChart,
  Briefcase,
  FileText,
  Heart,
  Home,
  Mail,
  Phone,
  Settings,
  ShoppingCart,
  Tag,
  Truck,
  User,
  Wallet,
  Zap,
};

// Color mapping using semantic classes
const COLOR_MAP: Record<string, string> = {
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  green: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  pink: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  gray: "bg-muted text-muted-foreground border-border",
};

interface DynamicKPICardProps {
  kpi: CalculatedKPI;
  isLoading?: boolean;
  compact?: boolean;
}

export function DynamicKPICard({ kpi, isLoading, compact = false }: DynamicKPICardProps) {
  const navigate = useNavigate();
  const IconComponent = ICON_MAP[kpi.icon] || AlertCircle;
  const colorClasses = COLOR_MAP[kpi.color] || COLOR_MAP.gray;

  const handleClick = () => {
    if (kpi.drilldown_path) {
      // Build URL with filters if provided
      let url = kpi.drilldown_path;
      if (kpi.drilldown_filters && Object.keys(kpi.drilldown_filters).length > 0) {
        const params = new URLSearchParams();
        Object.entries(kpi.drilldown_filters).forEach(([key, value]) => {
          params.set(key, String(value));
        });
        url += `?${params.toString()}`;
      }
      navigate(url);
    }
  };

  if (isLoading) {
    return (
      <Card className="cursor-default">
        <CardHeader className={cn("pb-2", compact && "p-3")}>
          <div className="flex items-start justify-between">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-4 w-32 mt-2" />
        </CardHeader>
        <CardContent className={compact ? "p-3 pt-0" : undefined}>
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    );
  }

  const cardContent = (
    <Card
      className={cn(
        "transition-all hover:shadow-lg",
        kpi.drilldown_path && "cursor-pointer hover:scale-[1.02]",
        kpi.value === 0 && "opacity-70",
        kpi.error && "border-destructive/50"
      )}
      onClick={handleClick}
    >
      <CardHeader className={cn("pb-2", compact && "p-3")}>
        <div className="flex items-start justify-between">
          <div className={cn("p-2 rounded-lg border", colorClasses)}>
            <IconComponent className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-1">
            {kpi.error && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{kpi.error}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {kpi.value > 0 && !kpi.error && (
              <Badge variant="secondary" className="text-xs">
                Active
              </Badge>
            )}
          </div>
        </div>
        <CardTitle className={cn("font-medium mt-2 line-clamp-2", compact ? "text-xs" : "text-sm")}>
          {kpi.name}
        </CardTitle>
      </CardHeader>
      <CardContent className={compact ? "p-3 pt-0" : undefined}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={cn("font-bold", compact ? "text-2xl" : "text-3xl")}>
              {kpi.value.toLocaleString()}
            </span>
            {kpi.drilldown_path && (
              <span className="text-xs text-muted-foreground">Click to view →</span>
            )}
          </div>
          {!compact && kpi.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {kpi.description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Wrap in tooltip if has description and is compact
  if (compact && kpi.description) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">{kpi.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}

export default DynamicKPICard;
