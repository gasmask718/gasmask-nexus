import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessStore } from "@/stores/businessStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Clock, Building2, AlertTriangle, CheckCircle2, Save, Sun, Moon, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// Common timezones for US businesses
const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "Asia/Manila", label: "Philippines (PHT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "UTC", label: "UTC" },
];

const DAYS_OF_WEEK = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = i % 2 === 0 ? "00" : "30";
  const time = `${hours.toString().padStart(2, "0")}:${minutes}`;
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const display = `${displayHours}:${minutes} ${ampm}`;
  return { value: time, label: display };
});

interface DaySchedule {
  open: string;
  close: string;
  enabled: boolean;
}

interface BusinessHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

const DEFAULT_HOURS: BusinessHours = {
  monday: { open: "09:00", close: "18:00", enabled: true },
  tuesday: { open: "09:00", close: "18:00", enabled: true },
  wednesday: { open: "09:00", close: "18:00", enabled: true },
  thursday: { open: "09:00", close: "18:00", enabled: true },
  friday: { open: "09:00", close: "18:00", enabled: true },
  saturday: { open: "10:00", close: "16:00", enabled: false },
  sunday: { open: "10:00", close: "16:00", enabled: false },
};

export default function BusinessHoursPage() {
  const { selectedBusiness } = useBusinessStore();
  const queryClient = useQueryClient();
  
  const [timezone, setTimezone] = useState("America/New_York");
  const [hours, setHours] = useState<BusinessHours>(DEFAULT_HOURS);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch business settings
  const { data: business, isLoading, error } = useQuery({
    queryKey: ["business-hours", selectedBusiness?.id],
    queryFn: async () => {
      if (!selectedBusiness?.id) return null;
      
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, timezone, business_hours")
        .eq("id", selectedBusiness.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBusiness?.id,
  });

  // Initialize state from fetched data
  useEffect(() => {
    if (business) {
      setTimezone(business.timezone || "America/New_York");
      if (business.business_hours && typeof business.business_hours === 'object' && !Array.isArray(business.business_hours)) {
        setHours({ ...DEFAULT_HOURS, ...(business.business_hours as unknown as BusinessHours) });
      }
      setHasChanges(false);
    }
  }, [business]);

  const formatTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHours = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHours}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  // Check current open/closed status
  const currentStatus = (() => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const dayName = parts.find(p => p.type === "weekday")?.value?.toLowerCase() || "monday";
      const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
      const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0");
      const currentTime = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

      const daySchedule = hours[dayName as keyof BusinessHours];
      if (!daySchedule?.enabled) {
        return { isOpen: false, message: `Closed (${dayName} disabled)` };
      }

      const openTime = daySchedule.open;
      const closeTime = daySchedule.close;

      if (currentTime >= openTime && currentTime < closeTime) {
        return { isOpen: true, message: `Open until ${formatTime(closeTime)}` };
      } else if (currentTime < openTime) {
        return { isOpen: false, message: `Opens at ${formatTime(openTime)}` };
      } else {
        return { isOpen: false, message: `Closed (opens tomorrow)` };
      }
    } catch {
      return { isOpen: false, message: "Status unknown" };
    }
  })();

  // Validate schedule
  const validateSchedule = () => {
    const errors: Record<string, string> = {};
    
    if (!timezone) {
      errors.timezone = "Timezone is required";
    }

    DAYS_OF_WEEK.forEach(({ key }) => {
      const day = hours[key as keyof BusinessHours];
      if (day.enabled) {
        if (!day.open || !day.close) {
          errors[key] = "Open and close times required";
        } else if (day.open >= day.close) {
          errors[key] = "Close time must be after open time";
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBusiness?.id) throw new Error("No business selected");
      if (!validateSchedule()) throw new Error("Validation failed");

      const { error } = await supabase
        .from("businesses")
        .update({
          timezone,
          business_hours: hours as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedBusiness.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Business hours saved successfully");
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["business-hours"] });
    },
    onError: (error: Error) => {
      if (error.message === "Validation failed") {
        toast.error("Please fix validation errors before saving");
      } else {
        toast.error(`Failed to save: ${error.message}`);
      }
    },
  });

  const handleDayToggle = (day: string, enabled: boolean) => {
    setHours(prev => ({
      ...prev,
      [day]: { ...prev[day as keyof BusinessHours], enabled },
    }));
    setHasChanges(true);
  };

  const handleTimeChange = (day: string, field: "open" | "close", value: string) => {
    setHours(prev => ({
      ...prev,
      [day]: { ...prev[day as keyof BusinessHours], [field]: value },
    }));
    setHasChanges(true);
  };

  const handleTimezoneChange = (value: string) => {
    setTimezone(value);
    setHasChanges(true);
  };

  const applyWeekdayDefaults = () => {
    const defaultSchedule = { open: "09:00", close: "18:00", enabled: true };
    setHours(prev => ({
      ...prev,
      monday: defaultSchedule,
      tuesday: defaultSchedule,
      wednesday: defaultSchedule,
      thursday: defaultSchedule,
      friday: defaultSchedule,
      saturday: { open: "10:00", close: "16:00", enabled: false },
      sunday: { open: "10:00", close: "16:00", enabled: false },
    }));
    setHasChanges(true);
    toast.info("Applied Mon-Fri 9AM-6PM defaults");
  };

  if (!selectedBusiness) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Business Selected</AlertTitle>
          <AlertDescription>
            Please select a business from the top navigation to configure hours.
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
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
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
          <div className="p-2 rounded-lg bg-primary/10">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Business Hours</h1>
            <p className="text-muted-foreground">
              Configure when your business is open for calls
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
        <span>Configuring hours for:</span>
        <Badge variant="outline">{selectedBusiness.name}</Badge>
      </div>

      {/* Current Status Card */}
      <Card className={cn(
        "border-2",
        currentStatus.isOpen ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
      )}>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            {currentStatus.isOpen ? (
              <Sun className="h-6 w-6 text-green-600" />
            ) : (
              <Moon className="h-6 w-6 text-orange-600" />
            )}
            <div>
              <p className="font-semibold">
                Currently: {currentStatus.isOpen ? "Open" : "Closed"}
              </p>
              <p className="text-sm text-muted-foreground">{currentStatus.message}</p>
            </div>
            <Badge 
              variant={currentStatus.isOpen ? "default" : "secondary"}
              className={cn(
                "ml-auto",
                currentStatus.isOpen ? "bg-green-600" : "bg-orange-600"
              )}
            >
              {currentStatus.isOpen ? "🟢 OPEN" : "🔴 CLOSED"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Timezone Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timezone</CardTitle>
          <CardDescription>
            All business hours will be interpreted in this timezone
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={timezone} onValueChange={handleTimezoneChange}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.timezone && (
              <span className="text-sm text-destructive">{validationErrors.timezone}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Schedule */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Weekly Schedule</CardTitle>
              <CardDescription>
                Set open and close times for each day
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={applyWeekdayDefaults}>
              Apply Weekday Defaults
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {DAYS_OF_WEEK.map(({ key, label }) => {
            const dayHours = hours[key as keyof BusinessHours];
            const hasError = !!validationErrors[key];
            
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-lg border transition-colors",
                  dayHours.enabled ? "bg-muted/30" : "bg-muted/10 opacity-60",
                  hasError && "border-destructive"
                )}
              >
                <div className="w-28">
                  <Label className="font-medium">{label}</Label>
                </div>
                
                <Switch
                  checked={dayHours.enabled}
                  onCheckedChange={(checked) => handleDayToggle(key, checked)}
                />
                
                {dayHours.enabled ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Select
                        value={dayHours.open}
                        onValueChange={(value) => handleTimeChange(key, "open", value)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time.value} value={time.value}>
                              {time.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground">to</span>
                      <Select
                        value={dayHours.close}
                        onValueChange={(value) => handleTimeChange(key, "close", value)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time.value} value={time.value}>
                              {time.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Open
                    </Badge>
                  </>
                ) : (
                  <Badge variant="secondary">Closed</Badge>
                )}
                
                {hasError && (
                  <span className="text-sm text-destructive">{validationErrors[key]}</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How Business Hours Affect Calls</AlertTitle>
        <AlertDescription>
          When calls arrive during business hours, they follow your normal inbound routing rules.
          When calls arrive outside business hours, they are handled according to your After-Hours Routing configuration.
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
