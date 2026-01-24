import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, XCircle, AlertTriangle, Rocket, Phone, Clock, 
  Moon, Users, Zap, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface GoLiveReadinessCardProps {
  businessId: string;
  businessName: string;
}

interface ReadinessCheck {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  fixLink?: string;
  icon: React.ElementType;
}

export function GoLiveReadinessCard({ businessId, businessName }: GoLiveReadinessCardProps) {
  // Fetch all required data
  const { data: businessConfig } = useQuery({
    queryKey: ["readiness-business", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select(`
          id, timezone, business_hours,
          after_hours_route_type, after_hours_route_role, after_hours_route_user_id
        `)
        .eq("id", businessId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: phoneNumbers = [] } = useQuery({
    queryKey: ["readiness-phones", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_phone_numbers")
        .select("id")
        .eq("business_id", businessId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: routes = [] } = useQuery({
    queryKey: ["readiness-routes", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_call_routes")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: callableUsers = [] } = useQuery({
    queryKey: ["readiness-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("user_id, phone, is_callable")
        .eq("is_callable", true)
        .not("phone", "is", null);
      if (error) throw error;
      return data || [];
    },
  });

  // Compute checks
  const checks: ReadinessCheck[] = [
    {
      id: "caller_id",
      label: "Caller ID Assigned",
      description: "At least one phone number is configured for this business",
      passed: phoneNumbers.length > 0,
      fixLink: "/communication/business-numbers",
      icon: Phone,
    },
    {
      id: "business_hours",
      label: "Business Hours Set",
      description: "Timezone and weekly schedule are configured",
      passed: !!businessConfig?.timezone && !!businessConfig?.business_hours,
      fixLink: "/communication/business-hours",
      icon: Clock,
    },
    {
      id: "after_hours",
      label: "After-Hours Route Configured",
      description: "Calls outside business hours have a defined path",
      passed: !!businessConfig?.after_hours_route_type,
      fixLink: "/communication/after-hours",
      icon: Moon,
    },
    {
      id: "callable_users",
      label: "At Least One Callable User",
      description: "Someone can receive calls with a valid phone number",
      passed: callableUsers.length > 0,
      fixLink: "/communication/user-call-settings",
      icon: Users,
    },
    {
      id: "inbound_route",
      label: "Inbound Route Configured",
      description: "At least one route or default route exists",
      passed: routes.length > 0,
      fixLink: "/communication/business-numbers",
      icon: Zap,
    },
  ];

  const passedCount = checks.filter(c => c.passed).length;
  const totalCount = checks.length;
  const allPassed = passedCount === totalCount;
  const readinessPercent = Math.round((passedCount / totalCount) * 100);

  return (
    <Card className={cn(
      "border-2",
      allPassed 
        ? "border-green-500 bg-green-50 dark:bg-green-950/20" 
        : "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
    )}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rocket className={cn(
              "h-6 w-6",
              allPassed ? "text-green-600" : "text-amber-600"
            )} />
            <div>
              <CardTitle className="text-lg">Go-Live Readiness</CardTitle>
              <CardDescription>{businessName}</CardDescription>
            </div>
          </div>
          <Badge 
            variant={allPassed ? "default" : "secondary"}
            className={cn(
              "text-lg px-3 py-1",
              allPassed ? "bg-green-600" : "bg-amber-600"
            )}
          >
            {readinessPercent}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checks.map((check) => {
            const Icon = check.icon;
            return (
              <div 
                key={check.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  check.passed 
                    ? "bg-white dark:bg-background border-green-200" 
                    : "bg-white dark:bg-background border-red-200"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg",
                  check.passed ? "bg-green-100" : "bg-red-100"
                )}>
                  <Icon className={cn(
                    "h-4 w-4",
                    check.passed ? "text-green-600" : "text-red-600"
                  )} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {check.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={cn(
                      "font-medium text-sm",
                      check.passed ? "text-green-700" : "text-red-700"
                    )}>
                      {check.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{check.description}</p>
                </div>
                {!check.passed && check.fixLink && (
                  <Link 
                    to={check.fixLink}
                    className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                  >
                    Fix <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className={cn(
          "mt-4 p-4 rounded-lg text-center",
          allPassed ? "bg-green-100" : "bg-amber-100"
        )}>
          {allPassed ? (
            <div className="flex items-center justify-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Ready for Production</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-semibold">{totalCount - passedCount} items need attention</span>
            </div>
          )}
          <p className="text-xs mt-1 text-muted-foreground">
            {allPassed 
              ? "All checks passed. Your call system is production-ready." 
              : "Complete all checks before going live to ensure calls route correctly."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
