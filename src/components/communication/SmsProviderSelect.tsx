import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface SmsProviderSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  showLabel?: boolean;
}

export function SmsProviderSelect({ value, onChange, className, showLabel = true }: SmsProviderSelectProps) {
  const [systemDefault, setSystemDefault] = useState<string>("biztext");

  useEffect(() => {
    supabase
      .from("messaging_settings")
      .select("default_sms_provider")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.default_sms_provider) {
          setSystemDefault(data.default_sms_provider);
        }
      });
  }, []);

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center gap-2 mb-1.5">
          <Label className="text-xs">SMS Provider</Label>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Default: {systemDefault === "twilio" ? "Twilio" : "BizText"}
          </Badge>
        </div>
      )}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs bg-background">
          <SelectValue placeholder="System Default" />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          <SelectItem value="default">System Default</SelectItem>
          <SelectItem value="twilio">Twilio</SelectItem>
          <SelectItem value="biztext">BizText</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
