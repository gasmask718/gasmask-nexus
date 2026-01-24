import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessStore } from "@/stores/businessStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Moon, Building2, AlertTriangle, Save, User, Users, Voicemail, 
  MessageSquare, Phone, Info, CheckCircle2, XCircle 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CallableCountBadge } from "@/components/communication/CallableCountBadge";

const ROUTE_TYPE_OPTIONS = [
  { 
    value: "role", 
    label: "Route to Role", 
    description: "Ring all users with a specific role (e.g., On-Call, Admin)",
    icon: Users 
  },
  { 
    value: "user", 
    label: "Route to User", 
    description: "Ring a specific user for all after-hours calls",
    icon: User 
  },
  { 
    value: "voicemail", 
    label: "Send to Voicemail", 
    description: "Record a voicemail and notify the team",
    icon: Voicemail 
  },
  { 
    value: "kiosk", 
    label: "Kiosk Fallback", 
    description: "Play a generic message and hang up",
    icon: Phone 
  },
  { 
    value: "message", 
    label: "Custom Message", 
    description: "Play a custom after-hours message",
    icon: MessageSquare 
  },
];

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "va", label: "Virtual Assistant" },
  { value: "csr", label: "Customer Service" },
  { value: "on_call", label: "On-Call" },
  { value: "employee", label: "Employee" },
  { value: "staff", label: "Staff" },
];

export default function AfterHoursRoutingPage() {
  const { selectedBusiness } = useBusinessStore();
  const queryClient = useQueryClient();
  
  const [routeType, setRouteType] = useState("voicemail");
  const [targetRole, setTargetRole] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch business settings
  const { data: business, isLoading } = useQuery({
    queryKey: ["after-hours-routing", selectedBusiness?.id],
    queryFn: async () => {
      if (!selectedBusiness?.id) return null;
      
      const { data, error } = await supabase
        .from("businesses")
        .select(`
          id, 
          name, 
          after_hours_route_type,
          after_hours_route_user_id,
          after_hours_route_role,
          after_hours_message
        `)
        .eq("id", selectedBusiness.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBusiness?.id,
  });

  // Fetch callable users for role selection
  const { data: usersByRole } = useQuery({
    queryKey: ["users-by-role", selectedBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("user_id, full_name, primary_role, phone, is_callable");
      
      if (error) throw error;
      
      // Group by role and count callable
      const roleStats: Record<string, { total: number; callable: number }> = {};
      (data || []).forEach(user => {
        const role = user.primary_role || "unknown";
        if (!roleStats[role]) {
          roleStats[role] = { total: 0, callable: 0 };
        }
        roleStats[role].total++;
        if (user.is_callable && user.phone) {
          roleStats[role].callable++;
        }
      });
      
      return { users: data || [], roleStats };
    },
  });

  // Fetch individual users for user selection
  const { data: callableUsers } = useQuery({
    queryKey: ["callable-users"],
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

  // Initialize state from fetched data
  useEffect(() => {
    if (business) {
      setRouteType(business.after_hours_route_type || "voicemail");
      setTargetRole(business.after_hours_route_role || "");
      setTargetUserId(business.after_hours_route_user_id || "");
      setCustomMessage(business.after_hours_message || "");
      setHasChanges(false);
    }
  }, [business]);

  // Compute warnings
  const warnings = (() => {
    const msgs: string[] = [];
    
    if (routeType === "role" && targetRole && usersByRole?.roleStats) {
      const stats = usersByRole.roleStats[targetRole];
      if (!stats || stats.callable === 0) {
        msgs.push(`No callable users found for role "${targetRole}". Calls will fall back to kiosk.`);
      }
    }
    
    if (routeType === "user" && targetUserId) {
      const user = callableUsers?.find(u => u.user_id === targetUserId);
      if (!user) {
        msgs.push("Selected user is not callable or has no phone number.");
      }
    }
    
    return msgs;
  })();

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBusiness?.id) throw new Error("No business selected");

      const updateData: any = {
        after_hours_route_type: routeType,
        after_hours_route_role: routeType === "role" ? targetRole : null,
        after_hours_route_user_id: routeType === "user" ? targetUserId : null,
        after_hours_message: routeType === "message" ? customMessage : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("businesses")
        .update(updateData)
        .eq("id", selectedBusiness.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("After-hours routing saved successfully");
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["after-hours-routing"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleRouteTypeChange = (value: string) => {
    setRouteType(value);
    setHasChanges(true);
  };

  const handleRoleChange = (value: string) => {
    setTargetRole(value);
    setHasChanges(true);
  };

  const handleUserChange = (value: string) => {
    setTargetUserId(value);
    setHasChanges(true);
  };

  const handleMessageChange = (value: string) => {
    setCustomMessage(value);
    setHasChanges(true);
  };

  if (!selectedBusiness) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Business Selected</AlertTitle>
          <AlertDescription>
            Please select a business from the top navigation to configure after-hours routing.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950/30">
            <Moon className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">After-Hours Routing</h1>
            <p className="text-muted-foreground">
              Configure how calls are handled outside business hours
            </p>
          </div>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!hasChanges || saveMutation.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Business indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>Configuring for:</span>
        <Badge variant="outline">{selectedBusiness.name}</Badge>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration Warning</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {warnings.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Route Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Routing Behavior</CardTitle>
          <CardDescription>
            Choose how to handle calls that arrive outside business hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={routeType} onValueChange={handleRouteTypeChange} className="space-y-3">
            {ROUTE_TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = routeType === option.value;
              
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors",
                    isSelected ? "border-primary bg-primary/5" : "border-muted hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Icon className={cn("h-5 w-5 mt-0.5", isSelected && "text-primary")} />
                  <div className="flex-1">
                    <p className={cn("font-medium", isSelected && "text-primary")}>{option.label}</p>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </label>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Role-specific Configuration */}
      {routeType === "role" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Target Role</CardTitle>
            <CardDescription>
              Calls will ring all callable users with this role
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={targetRole} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => {
                  const stats = usersByRole?.roleStats?.[role.value];
                  return (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex items-center gap-2">
                        <span>{role.label}</span>
                        {stats && (
                          <Badge 
                            variant={stats.callable > 0 ? "outline" : "destructive"}
                            className="text-xs"
                          >
                            {stats.callable}/{stats.total} callable
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {targetRole && usersByRole?.roleStats?.[targetRole] && (
              <div className="flex items-center gap-2">
                <CallableCountBadge 
                  callableCount={usersByRole.roleStats[targetRole].callable}
                  totalCount={usersByRole.roleStats[targetRole].total}
                  role={targetRole}
                />
                {usersByRole.roleStats[targetRole].callable === 0 && (
                  <span className="text-sm text-destructive">
                    ⚠️ No callable users - will fall back to kiosk
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* User-specific Configuration */}
      {routeType === "user" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Target User</CardTitle>
            <CardDescription>
              All after-hours calls will ring this user
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={targetUserId} onValueChange={handleUserChange}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {callableUsers?.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{user.full_name}</span>
                      <Badge variant="outline" className="text-xs">{user.primary_role}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {targetUserId && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>User is callable and will receive after-hours calls</span>
              </div>
            )}

            {callableUsers?.length === 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  No callable users available. Configure phone numbers in User Call Settings first.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Custom Message Configuration */}
      {routeType === "message" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Custom Message</CardTitle>
            <CardDescription>
              This message will be read to callers using text-to-speech
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={customMessage}
              onChange={(e) => handleMessageChange(e.target.value)}
              placeholder="Thank you for calling. We are currently closed and will return your call during normal business hours."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Keep it brief and professional. The message will be played, then the call will end.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How After-Hours Routing Works</AlertTitle>
        <AlertDescription>
          When a call arrives outside your configured business hours:
          <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
            <li>The system checks your business hours schedule</li>
            <li>If closed, it applies your after-hours routing rule</li>
            <li>If the after-hours route fails (e.g., no callable users), it falls back to kiosk/voicemail</li>
            <li>All decisions are logged for transparency</li>
          </ol>
        </AlertDescription>
      </Alert>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 p-4 bg-card border rounded-lg shadow-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span>You have unsaved changes</span>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Save Now
          </Button>
        </div>
      )}
    </div>
  );
}
