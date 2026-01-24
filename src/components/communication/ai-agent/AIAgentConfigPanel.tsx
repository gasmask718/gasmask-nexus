import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings2, ShieldAlert, Bot, AlertTriangle } from "lucide-react";
import { AICallAgentConfig, useUpdateAIConfig } from "@/hooks/useAICallAgent";
import { cn } from "@/lib/utils";

interface AIAgentConfigPanelProps {
  config: AICallAgentConfig | null;
  businessId: string;
  isLoading?: boolean;
}

export function AIAgentConfigPanel({ config, businessId, isLoading }: AIAgentConfigPanelProps) {
  const updateConfig = useUpdateAIConfig();
  
  const [localConfig, setLocalConfig] = useState<{
    enabled: boolean;
    mode: 'off' | 'shadow' | 'assisted' | 'canary' | 'live';
    confidence_threshold: number;
    require_callable_fallback: boolean;
    require_resolved_queue: boolean;
    max_consecutive_failures: number;
    auto_downgrade_on_failure: boolean;
  }>({
    enabled: false,
    mode: 'shadow',
    confidence_threshold: 85,
    require_callable_fallback: true,
    require_resolved_queue: true,
    max_consecutive_failures: 3,
    auto_downgrade_on_failure: true,
  });

  useEffect(() => {
    if (config) {
      setLocalConfig({
        enabled: config.enabled,
        mode: config.mode,
        confidence_threshold: config.confidence_threshold,
        require_callable_fallback: config.require_callable_fallback,
        require_resolved_queue: config.require_resolved_queue,
        max_consecutive_failures: config.max_consecutive_failures,
        auto_downgrade_on_failure: config.auto_downgrade_on_failure,
      });
    }
  }, [config]);

  const handleSave = () => {
    updateConfig.mutate({ businessId, updates: localConfig });
  };

  const hasChanges = config ? (
    config.enabled !== localConfig.enabled ||
    config.mode !== localConfig.mode ||
    config.confidence_threshold !== localConfig.confidence_threshold ||
    config.require_callable_fallback !== localConfig.require_callable_fallback ||
    config.require_resolved_queue !== localConfig.require_resolved_queue ||
    config.max_consecutive_failures !== localConfig.max_consecutive_failures ||
    config.auto_downgrade_on_failure !== localConfig.auto_downgrade_on_failure
  ) : true;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            AI Agent Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              AI Agent Configuration
            </CardTitle>
            <CardDescription>Control how the AI handles incoming calls</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="ai-enabled" className="text-sm font-medium">
              {localConfig.enabled ? 'Enabled' : 'Disabled'}
            </Label>
            <Switch
              id="ai-enabled"
              checked={localConfig.enabled}
              onCheckedChange={(enabled) => setLocalConfig(prev => ({ ...prev, enabled }))}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode Selection */}
        <div className="space-y-2">
          <Label>Operating Mode</Label>
          <Select
            value={localConfig.mode}
            onValueChange={(mode: any) => setLocalConfig(prev => ({ ...prev, mode }))}
            disabled={!localConfig.enabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shadow">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Shadow</Badge>
                  <span className="text-muted-foreground">— Observe only</span>
                </div>
              </SelectItem>
              <SelectItem value="assisted">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/20 text-blue-600 text-xs">Assisted</Badge>
                  <span className="text-muted-foreground">— Suggest responses</span>
                </div>
              </SelectItem>
              <SelectItem value="canary">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/20 text-amber-600 text-xs">Canary</Badge>
                  <span className="text-muted-foreground">— Limited answering</span>
                </div>
              </SelectItem>
              <SelectItem value="live">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/20 text-green-600 text-xs">Live</Badge>
                  <span className="text-muted-foreground">— Full AI answering</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          {(localConfig.mode === 'canary' || localConfig.mode === 'live') && (
            <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 text-amber-700 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {localConfig.mode === 'live' 
                  ? 'Live mode allows AI to answer all eligible calls. Ensure safety checks are enabled.'
                  : 'Canary mode answers calls only when confidence threshold is met.'}
              </span>
            </div>
          )}
        </div>

        {/* Confidence Threshold */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Confidence Threshold</Label>
            <span className="text-sm font-medium">{localConfig.confidence_threshold}%</span>
          </div>
          <Slider
            value={[localConfig.confidence_threshold]}
            onValueChange={([value]) => setLocalConfig(prev => ({ ...prev, confidence_threshold: value }))}
            min={50}
            max={100}
            step={5}
            disabled={!localConfig.enabled}
          />
          <p className="text-xs text-muted-foreground">
            AI will only answer in Canary/Live mode if confidence exceeds this threshold
          </p>
        </div>

        {/* Safety Checks */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Safety Checks</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require Callable Fallback</Label>
              <p className="text-xs text-muted-foreground">AI won't answer if no human is available</p>
            </div>
            <Switch
              checked={localConfig.require_callable_fallback}
              onCheckedChange={(require_callable_fallback) => 
                setLocalConfig(prev => ({ ...prev, require_callable_fallback }))}
              disabled={!localConfig.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require Empty Resolution Queue</Label>
              <p className="text-xs text-muted-foreground">AI won't answer if unresolved calls exist</p>
            </div>
            <Switch
              checked={localConfig.require_resolved_queue}
              onCheckedChange={(require_resolved_queue) => 
                setLocalConfig(prev => ({ ...prev, require_resolved_queue }))}
              disabled={!localConfig.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Downgrade on Failures</Label>
              <p className="text-xs text-muted-foreground">
                Demote after {localConfig.max_consecutive_failures} consecutive failures
              </p>
            </div>
            <Switch
              checked={localConfig.auto_downgrade_on_failure}
              onCheckedChange={(auto_downgrade_on_failure) => 
                setLocalConfig(prev => ({ ...prev, auto_downgrade_on_failure }))}
              disabled={!localConfig.enabled}
            />
          </div>

          {localConfig.auto_downgrade_on_failure && (
            <div className="space-y-2 pl-4">
              <Label className="text-xs">Max Consecutive Failures</Label>
              <Slider
                value={[localConfig.max_consecutive_failures]}
                onValueChange={([value]) => 
                  setLocalConfig(prev => ({ ...prev, max_consecutive_failures: value }))}
                min={1}
                max={10}
                step={1}
                disabled={!localConfig.enabled}
              />
              <p className="text-xs text-muted-foreground text-right">
                {localConfig.max_consecutive_failures} failures
              </p>
            </div>
          )}
        </div>

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || updateConfig.isPending}
          className="w-full"
        >
          {updateConfig.isPending ? 'Saving...' : 'Save Configuration'}
        </Button>
      </CardContent>
    </Card>
  );
}
