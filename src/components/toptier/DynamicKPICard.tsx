/**
 * Dynamic KPI Card Component
 * Renders a KPI card based on configuration from the database
 */
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { CalculatedKPI } from "@/hooks/useDynamicKPIs";
import { cn } from "@/lib/utils";

// Icon mapping
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
};

// Color mapping
const COLOR_MAP: Record<string, string> = {
  amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  green: "bg-green-500/10 text-green-500 border-green-500/20",
  red: "bg-red-500/10 text-red-500 border-red-500/20",
  purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  cyan: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  pink: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  teal: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  gray: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

interface DynamicKPICardProps {
  kpi: CalculatedKPI;
  isLoading?: boolean;
}

export function DynamicKPICard({ kpi, isLoading }: DynamicKPICardProps) {
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
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-4 w-32 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-lg",
        kpi.drilldown_path && "cursor-pointer hover:scale-[1.02]",
        kpi.value === 0 && "opacity-70"
      )}
      onClick={handleClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className={cn("p-2 rounded-lg border", colorClasses)}>
            <IconComponent className="h-5 w-5" />
          </div>
          {kpi.value > 0 && (
            <Badge variant="secondary" className="text-xs">
              Active
            </Badge>
          )}
        </div>
        <CardTitle className="text-sm font-medium mt-2 line-clamp-2">
          {kpi.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold">{kpi.value}</span>
            {kpi.drilldown_path && (
              <span className="text-xs text-muted-foreground">Click to view →</span>
            )}
          </div>
          {kpi.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {kpi.description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default DynamicKPICard;
