import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VoiceProviderSelector } from "@/components/communication/VoiceProviderSelector";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Activity, DollarSign } from "lucide-react";
import { useBusiness } from "@/contexts/BusinessContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export function VoiceSystemSettings() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["voice-provider-settings", currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_provider_settings")
        .select("*")
        .eq("business_id", currentBusiness!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentBusiness?.id,
  });

  const [defaultProvider, setDefaultProvider] = useState("elevenlabs");
  const [fallbackProvider, setFallbackProvider] = useState("aws_polly");
  const [maxLatency, setMaxLatency] = useState(1200);
  const [autoFallback, setAutoFallback] = useState(true);

  useEffect(() => {
    if (settings) {
      setDefaultProvider(settings.default_tts_provider || "elevenlabs");
      setFallbackProvider(settings.fallback_tts_provider || "aws_polly");
      setMaxLatency(settings.max_tts_latency_ms || 1200);
      setAutoFallback((settings as any).enable_auto_fallback !== false);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentBusiness?.id) throw new Error("No business");
      const payload = {
        business_id: currentBusiness.id,
        default_tts_provider: defaultProvider as "elevenlabs" | "aws_polly",
        fallback_tts_provider: fallbackProvider as "elevenlabs" | "aws_polly",
        max_tts_latency_ms: maxLatency,
        updated_at: new Date().toISOString(),
      };

      if (settings) {
        const { error } = await supabase
          .from("voice_provider_settings")
          .update(payload)
          .eq("business_id", currentBusiness.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("voice_provider_settings")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Voice system settings saved");
      queryClient.invalidateQueries({ queryKey: ["voice-provider-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Cost summary
  const { data: costData } = useQuery({
    queryKey: ["voice-cost-summary", currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_cost_events")
        .select("provider, estimated_cost, characters_generated")
        .eq("business_id", currentBusiness!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const summary = { elevenlabs: 0, aws_polly: 0, totalChars: 0 };
      (data || []).forEach((row: any) => {
        if (row.provider === "elevenlabs") summary.elevenlabs += row.estimated_cost || 0;
        else summary.aws_polly += row.estimated_cost || 0;
        summary.totalChars += row.characters_generated || 0;
      });
      return summary;
    },
    enabled: !!currentBusiness?.id,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Provider Configuration
          </CardTitle>
          <CardDescription>Default and fallback voice providers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <VoiceProviderSelector
            provider={defaultProvider}
            onProviderChange={setDefaultProvider}
            showMode={false}
            label="Primary Provider"
          />
          <VoiceProviderSelector
            provider={fallbackProvider}
            onProviderChange={setFallbackProvider}
            showMode={false}
            label="Fallback Provider"
          />
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label>Automatic Fallback</Label>
              <p className="text-xs text-muted-foreground">Switch to fallback on error or high latency</p>
            </div>
            <Switch checked={autoFallback} onCheckedChange={setAutoFallback} />
          </div>
          <div className="space-y-2">
            <Label>Max Latency Threshold (ms)</Label>
            <Input
              type="number"
              min={500}
              max={5000}
              step={100}
              value={maxLatency}
              onChange={(e) => setMaxLatency(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              If primary provider exceeds this, fallback is triggered
            </p>
          </div>
          <Button
            className="w-full gap-2"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving..." : "Save Voice Settings"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Cost Monitor
          </CardTitle>
          <CardDescription>Recent voice generation costs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border rounded-lg text-center">
              <p className="text-xs text-muted-foreground">ElevenLabs</p>
              <p className="text-lg font-bold">${(costData?.elevenlabs || 0).toFixed(4)}</p>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <p className="text-xs text-muted-foreground">AWS Polly</p>
              <p className="text-lg font-bold">${(costData?.aws_polly || 0).toFixed(4)}</p>
            </div>
          </div>
          <div className="p-3 border rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Total Characters Generated</p>
            <p className="text-lg font-bold">{(costData?.totalChars || 0).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
