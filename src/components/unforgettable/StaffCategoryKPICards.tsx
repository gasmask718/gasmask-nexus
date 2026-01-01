import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Users, Calendar, DollarSign, Star, ArrowRight, TrendingUp } from "lucide-react";
import { useStaffCategoriesWithKPIs, StaffCategoryWithKPI } from "@/hooks/useUnforgettableStaff";
import { Skeleton } from "@/components/ui/skeleton";

interface StaffCategoryKPICardProps {
  category: StaffCategoryWithKPI;
}

function StaffCategoryKPICard({ category }: StaffCategoryKPICardProps) {
  const navigate = useNavigate();
  const kpi = category.kpi;

  // Format currency
  const formatRevenue = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return `$${amount}`;
  };

  return (
    <Card className="border-border/50 hover:border-pink-500/30 transition-colors bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-pink-500/10">
              <Users className="h-4 w-4 text-pink-500" />
            </div>
            {category.name}
          </CardTitle>
          <Badge 
            variant="outline" 
            className={kpi?.status === 'active' 
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs' 
              : 'bg-gray-500/10 text-gray-600 border-gray-500/30 text-xs'}
          >
            {kpi?.status || 'active'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Staff</span>
            </div>
            <div className="text-lg font-bold">{kpi?.total_staff ?? 0}</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Active Shifts</span>
            </div>
            <div className="text-lg font-bold">{kpi?.active_shifts ?? 0}</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1.5 mb-0.5">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Events</span>
            </div>
            <div className="text-lg font-bold">{kpi?.completed_events ?? 0}</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1.5 mb-0.5">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Revenue</span>
            </div>
            <div className="text-lg font-bold">{formatRevenue(kpi?.revenue_generated ?? 0)}</div>
          </div>
        </div>
        
        {kpi?.performance_score !== null && kpi?.performance_score !== undefined && (
          <div className="flex items-center gap-2 pt-1">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            <span className="text-sm font-medium">{kpi.performance_score.toFixed(1)} rating</span>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full h-8 text-xs text-pink-500 hover:text-pink-600 hover:bg-pink-500/10"
          onClick={() => navigate(`/os/unforgettable/staff?category_id=${category.id}`)}
        >
          View Staff <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

function KPICardSkeleton() {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-2 rounded-lg bg-muted/50">
              <Skeleton className="h-3 w-16 mb-1" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

export function StaffCategoryKPICards() {
  const { data: categories, isLoading, error } = useStaffCategoriesWithKPIs();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/30 bg-red-500/5">
        <CardContent className="p-6 text-center">
          <p className="text-red-600">Failed to load staff category KPIs</p>
        </CardContent>
      </Card>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/30">
        <CardContent className="p-6 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No staff categories yet</p>
          <p className="text-sm text-muted-foreground">Create a staff category to see KPI cards here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {categories.map((category) => (
        <StaffCategoryKPICard key={category.id} category={category} />
      ))}
    </div>
  );
}

export default StaffCategoryKPICards;
