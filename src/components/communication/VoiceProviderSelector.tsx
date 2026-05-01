import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Mic } from "lucide-react";

export type VoiceProviderOption = "auto" | "aws_polly";
export type VoiceModeOption = "balanced" | "cost_optimized" | "quality_optimized";

interface VoiceProviderSelectorProps {
  provider: string;
  onProviderChange: (value: string) => void;
  mode?: string;
  onModeChange?: (value: string) => void;
  showMode?: boolean;
  compact?: boolean;
  label?: string;
}

const providerOptions: { value: VoiceProviderOption; label: string }[] = [
  { value: "auto", label: "Auto (System Decides)" },
  { value: "aws_polly", label: "AWS Polly" },
];

const modeOptions: { value: VoiceModeOption; label: string }[] = [
  { value: "balanced", label: "Balanced" },
  { value: "cost_optimized", label: "Cost Optimized" },
  { value: "quality_optimized", label: "Quality Optimized" },
];

export function VoiceProviderSelector({
  provider,
  onProviderChange,
  mode = "balanced",
  onModeChange,
  showMode = true,
  compact = false,
  label = "Voice Provider",
}: VoiceProviderSelectorProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Mic className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={provider || "auto"} onValueChange={onProviderChange}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providerOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Mic className="h-4 w-4" />
          {label}
        </Label>
        <Select value={provider || "auto"} onValueChange={onProviderChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providerOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showMode && onModeChange && (
        <div className="space-y-2">
          <Label>Voice Mode</Label>
          <Select value={mode || "balanced"} onValueChange={onModeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

/** Small badge showing which provider is active during a call */
export function VoiceProviderBadge({ provider, wasFallback }: { provider: string; wasFallback?: boolean }) {
  const label = provider === "aws_polly" ? "AWS Polly" : "Auto";

  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted border">
      <Mic className="h-3 w-3" />
      🎙 {label}
      {wasFallback && <span className="text-warning ml-1">(Fallback)</span>}
    </span>
  );
}
