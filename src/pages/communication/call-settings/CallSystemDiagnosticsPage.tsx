import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessStore } from "@/stores/businessStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Activity, Building2, Phone, Clock, Users, AlertTriangle, 
  CheckCircle2, XCircle, RefreshCw, ArrowRight, Info, Sun, Moon,
  Zap, Shield, Route, UserCog
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GoLiveReadinessCard } from "@/components/communication/GoLiveReadinessCard";
import { TestRingButton } from "@/components/communication/TestRingButton";

interface DiagnosticStep {
  label: string;
  status: "success" | "warning" | "error" | "pending";
  value: string;
  details?: string;
  fixLink?: string;
}

export default function CallSystemDiagnosticsPage() {
  const { selectedBusiness } = useBusinessStore();
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>("");
  const [diagnostics, setDiagnostics] = useState<DiagnosticStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Fetch business phone numbers
  const { data: phoneNumbers = [], isLoading: loadingPhones } = useQuery({
    queryKey: ["business-phone-numbers", selectedBusiness?.id],
    queryFn: async () => {
      if (!selectedBusiness?.id) return [];
      const { data, error } = await supabase
        .from("business_phone_numbers")
        .select("id, phone_number, label, is_default")
        .eq("business_id", selectedBusiness.id)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedBusiness?.id,
  });

  // Fetch business config (hours, timezone, after-hours)
  const { data: businessConfig } = useQuery({
    queryKey: ["business-config", selectedBusiness?.id],
    queryFn: async () => {
      if (!selectedBusiness?.id) return null;
      const { data, error } = await supabase
        .from("businesses")
        .select(`
          id, name, timezone, business_hours,
          after_hours_route_type, after_hours_route_role, 
          after_hours_route_user_id, after_hours_message
        `)
        .eq("id", selectedBusiness.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBusiness?.id,
  });

  // Fetch inbound routes
  const { data: routes = [] } = useQuery({
    queryKey: ["inbound-routes", selectedBusiness?.id],
    queryFn: async () => {
      if (!selectedBusiness?.id) return [];
      const { data, error } = await supabase
        .from("inbound_call_routes")
        .select("*")
        .eq("business_id", selectedBusiness.id)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedBusiness?.id,
  });

  // Fetch callable users
  const { data: callableUsers = [] } = useQuery({
    queryKey: ["callable-users-diag"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("user_id, full_name, primary_role, phone, is_callable")
        .eq("is_callable", true)
        .not("phone", "is", null);
      if (error) throw error;
      return data || [];
    },
  });

  // Run diagnostics when phone number changes
  const runDiagnostics = () => {
    if (!businessConfig || !selectedPhoneId) return;

    setIsRunning(true);
    const steps: DiagnosticStep[] = [];

    // Step 1: Business resolved
    steps.push({
      label: "Business Resolution",
      status: "success",
      value: businessConfig.name,
      details: `Business ID: ${businessConfig.id}`,
    });

    // Step 2: Caller ID
    const phone = phoneNumbers.find(p => p.id === selectedPhoneId);
    steps.push({
      label: "Caller ID",
      status: phone ? "success" : "error",
      value: phone ? phone.phone_number : "Not found",
      details: phone?.label || undefined,
    });

    // Step 3: Timezone
    const hasTimezone = !!businessConfig.timezone;
    steps.push({
      label: "Timezone",
      status: hasTimezone ? "success" : "error",
      value: businessConfig.timezone || "NOT SET",
      details: hasTimezone ? undefined : "Timezone is required for time-aware routing",
      fixLink: hasTimezone ? undefined : "/communication/business-hours",
    });

    // Step 4: Local Time & Business Hours Status
    let isOpen = false;
    let localTimeStr = "Unknown";
    if (hasTimezone && businessConfig.business_hours) {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: businessConfig.timezone,
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        localTimeStr = formatter.format(now);
        
        const partsFormatter = new Intl.DateTimeFormat("en-US", {
          timeZone: businessConfig.timezone,
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const parts = partsFormatter.formatToParts(now);
        const dayName = parts.find(p => p.type === "weekday")?.value?.toLowerCase() || "monday";
        const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
        const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0");
        const currentTime = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

        const hours = businessConfig.business_hours as Record<string, any>;
        const daySchedule = hours[dayName];
        if (daySchedule?.enabled) {
          isOpen = currentTime >= daySchedule.open && currentTime < daySchedule.close;
        }
      } catch {
        localTimeStr = "Error calculating";
      }
    }

    steps.push({
      label: "Local Time",
      status: "success",
      value: localTimeStr,
      details: businessConfig.timezone,
    });

    steps.push({
      label: "Business Hours Status",
      status: isOpen ? "success" : "warning",
      value: isOpen ? "🟢 OPEN" : "🔴 CLOSED",
      details: isOpen ? "Using standard routing" : "Using after-hours routing",
    });

    // Step 5: Route resolution
    const phoneRoute = routes.find(r => r.phone_number_id === selectedPhoneId);
    const defaultRoute = routes.find(r => r.is_default);
    const activeRoute = phoneRoute || defaultRoute;

    if (activeRoute) {
      steps.push({
        label: "Route Selected",
        status: "success",
        value: activeRoute.route_type === "user" ? "Specific User" : 
               activeRoute.route_type === "role" ? `Role: ${activeRoute.route_target_role}` : 
               "Voicemail",
        details: phoneRoute ? "Phone-specific route" : "Default route",
      });
    } else {
      steps.push({
        label: "Route Selected",
        status: "error",
        value: "NO ROUTE FOUND",
        details: "Will fall back to kiosk/voicemail",
        fixLink: "/communication/business-numbers",
      });
    }

    // Step 6: After-hours configuration (if closed)
    if (!isOpen) {
      const hasAfterHours = !!businessConfig.after_hours_route_type;
      steps.push({
        label: "After-Hours Route",
        status: hasAfterHours ? "success" : "warning",
        value: hasAfterHours ? 
          businessConfig.after_hours_route_type === "role" ? `Role: ${businessConfig.after_hours_route_role}` :
          businessConfig.after_hours_route_type === "user" ? "Specific User" :
          businessConfig.after_hours_route_type : 
          "NOT CONFIGURED",
        details: hasAfterHours ? undefined : "Calls will fall back to kiosk",
        fixLink: hasAfterHours ? undefined : "/communication/after-hours",
      });
    }

    // Step 7: Callable users
    const roleToCheck = isOpen 
      ? activeRoute?.route_target_role 
      : businessConfig.after_hours_route_role;
    
    let callableCount = 0;
    let totalForRole = 0;

    if (roleToCheck) {
      const usersWithRole = callableUsers.filter(u => u.primary_role === roleToCheck);
      callableCount = usersWithRole.length;
      totalForRole = usersWithRole.length;
    } else if (activeRoute?.route_type === "user" || businessConfig.after_hours_route_user_id) {
      callableCount = 1;
      totalForRole = 1;
    } else {
      callableCount = callableUsers.length;
      totalForRole = callableUsers.length;
    }

    steps.push({
      label: "Callable Users",
      status: callableCount > 0 ? "success" : "error",
      value: `${callableCount} / ${totalForRole} users callable`,
      details: callableCount === 0 ? "No users can receive calls!" : undefined,
      fixLink: callableCount === 0 ? "/communication/user-call-settings" : undefined,
    });

    // Step 8: Final outcome
    const willRing = callableCount > 0 && (activeRoute || businessConfig.after_hours_route_type);
    steps.push({
      label: "Final Outcome",
      status: willRing ? "success" : "error",
      value: willRing ? "📞 WILL RING" : "❌ WILL NOT RING",
      details: willRing 
        ? `Call will ring ${callableCount} user(s)` 
        : "Call will fall back to kiosk/voicemail",
    });

    setDiagnostics(steps);
    setTimeout(() => setIsRunning(false), 500);
  };

  // Auto-run when phone changes
  useEffect(() => {
    if (selectedPhoneId && businessConfig) {
      runDiagnostics();
    }
  }, [selectedPhoneId, businessConfig, routes, callableUsers]);

  // Auto-select first phone
  useEffect(() => {
    if (phoneNumbers.length > 0 && !selectedPhoneId) {
      const defaultPhone = phoneNumbers.find(p => p.is_default);
      setSelectedPhoneId(defaultPhone?.id || phoneNumbers[0].id);
    }
  }, [phoneNumbers]);

  if (!selectedBusiness) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Business Selected</AlertTitle>
          <AlertDescription>
            Please select a business from the top navigation.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Call System Diagnostics</h1>
            <p className="text-muted-foreground">
              Real-time verification of your call routing configuration
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={runDiagnostics}
          disabled={!selectedPhoneId || isRunning}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isRunning && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Business indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>Diagnosing:</span>
        <Badge variant="outline">{selectedBusiness.name}</Badge>
      </div>

      {/* Phone Number Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Select Inbound Number
          </CardTitle>
          <CardDescription>
            Choose a caller ID to simulate an incoming call
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPhones ? (
            <Skeleton className="h-10 w-80" />
          ) : phoneNumbers.length === 0 ? (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>No Phone Numbers</AlertTitle>
              <AlertDescription>
                This business has no caller IDs configured. 
                <a href="/communication/business-numbers" className="underline ml-1">Add one now →</a>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex items-center gap-4">
              <Select value={selectedPhoneId} onValueChange={setSelectedPhoneId}>
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Select phone number" />
                </SelectTrigger>
                <SelectContent>
                  {phoneNumbers.map((phone) => (
                    <SelectItem key={phone.id} value={phone.id}>
                      <div className="flex items-center gap-2">
                        <span>{phone.phone_number}</span>
                        {phone.label && (
                          <Badge variant="outline" className="text-xs">{phone.label}</Badge>
                        )}
                        {phone.is_default && (
                          <Badge className="text-xs">Default</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedPhoneId && (
                <TestRingButton 
                  phoneNumberId={selectedPhoneId}
                  businessId={selectedBusiness.id}
                  label="Test This Number"
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagnostic Results */}
      {selectedPhoneId && diagnostics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Diagnostic Results
            </CardTitle>
            <CardDescription>
              Step-by-step resolution path for incoming calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {diagnostics.map((step, index) => {
                const StatusIcon = step.status === "success" ? CheckCircle2 : 
                                  step.status === "warning" ? AlertTriangle : 
                                  step.status === "error" ? XCircle : Info;
                const statusColor = step.status === "success" ? "text-green-600" : 
                                   step.status === "warning" ? "text-amber-600" : 
                                   step.status === "error" ? "text-red-600" : "text-muted-foreground";

                return (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className={cn("p-3 rounded-lg border flex-1", 
                      step.status === "error" && "bg-red-50 border-red-200 dark:bg-red-950/20",
                      step.status === "warning" && "bg-amber-50 border-amber-200 dark:bg-amber-950/20",
                      step.status === "success" && "bg-green-50 border-green-200 dark:bg-green-950/20",
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusIcon className={cn("h-4 w-4", statusColor)} />
                          <span className="font-medium text-sm">{step.label}</span>
                        </div>
                        <Badge variant={step.status === "error" ? "destructive" : "outline"}>
                          {step.value}
                        </Badge>
                      </div>
                      {step.details && (
                        <p className="text-xs text-muted-foreground mt-1 ml-6">{step.details}</p>
                      )}
                      {step.fixLink && (
                        <a 
                          href={step.fixLink} 
                          className="text-xs text-primary underline mt-1 ml-6 inline-flex items-center gap-1"
                        >
                          Fix this now <ArrowRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {index < diagnostics.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Go-Live Readiness */}
      <GoLiveReadinessCard 
        businessId={selectedBusiness.id}
        businessName={selectedBusiness.name}
      />

      {/* Help */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>How Diagnostics Work</AlertTitle>
        <AlertDescription>
          This panel simulates the exact decision path an incoming call would take.
          Every step is logged, and failures are explained with actionable fixes.
          Use "Test Ring" to verify with a real phone call.
        </AlertDescription>
      </Alert>
    </div>
  );
}
