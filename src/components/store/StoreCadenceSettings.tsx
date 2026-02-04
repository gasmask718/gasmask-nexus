// ═══════════════════════════════════════════════════════════════════════════════
// STORE CADENCE SETTINGS — Configure outreach cadence policy for a store
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CalendarClock, 
  MessageSquare, 
  Phone, 
  Clock, 
  Settings2,
  Zap,
  Save,
  RefreshCw
} from 'lucide-react';
import { useStoreCadence, type CadencePolicyInput } from '@/hooks/useStoreCadence';
import { useStoreOutreachPlans, useGenerateOutreachPlan } from '@/hooks/useOutreachPlans';
import { cn } from '@/lib/utils';

interface StoreCadenceSettingsProps {
  storeId: string;
  storeName?: string;
}

export function StoreCadenceSettings({ storeId, storeName }: StoreCadenceSettingsProps) {
  const { policy, isLoading, upsertPolicy, toggleEnabled, isSaving } = useStoreCadence(storeId);
  const { data: recentPlans = [] } = useStoreOutreachPlans(storeId);
  const generatePlan = useGenerateOutreachPlan();

  // Local form state
  const [isExpanded, setIsExpanded] = useState(false);
  const [formState, setFormState] = useState<CadencePolicyInput>({
    cadence_days: 7,
    text_first: true,
    max_texts_per_window: 3,
    max_calls_per_window: 2,
    allowed_hours_start: '09:00',
    allowed_hours_end: '18:00',
  });

  // Sync form state with loaded policy
  useEffect(() => {
    if (policy) {
      setFormState({
        cadence_days: policy.cadence_days,
        text_first: policy.text_first,
        max_texts_per_window: policy.max_texts_per_window,
        max_calls_per_window: policy.max_calls_per_window,
        allowed_hours_start: policy.allowed_hours_start,
        allowed_hours_end: policy.allowed_hours_end,
      });
    }
  }, [policy]);

  const handleToggleEnabled = async () => {
    await toggleEnabled(!policy?.enabled);
  };

  const handleSaveSettings = async () => {
    await upsertPolicy({ ...formState, enabled: policy?.enabled ?? true });
  };

  const handleGeneratePlan = async () => {
    await generatePlan.mutateAsync(storeId);
  };

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" />
            Communication Cadence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isEnabled = policy?.enabled ?? false;
  const hasDraftPlan = recentPlans.some(p => p.status === 'draft');
  const hasActivePlan = recentPlans.some(p => ['approved', 'running'].includes(p.status));

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4" />
              Communication Cadence
            </CardTitle>
            <CardDescription>
              Automated outreach scheduling with human approval
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {isEnabled && (
              <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                Active
              </Badge>
            )}
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggleEnabled}
              disabled={isSaving}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Summary */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Every {formState.cadence_days} days
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {formState.max_texts_per_window} texts
          </div>
          <div className="flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" />
            {formState.max_calls_per_window} calls
          </div>
        </div>

        {/* Plan Status */}
        {isEnabled && (
          <div className="flex items-center gap-2">
            {hasDraftPlan && (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                Draft Plan Pending
              </Badge>
            )}
            {hasActivePlan && (
              <Badge variant="outline" className="text-blue-500 border-blue-500/30">
                Plan Running
              </Badge>
            )}
            {!hasDraftPlan && !hasActivePlan && (
              <Badge variant="outline" className="text-muted-foreground">
                No Active Plans
              </Badge>
            )}
          </div>
        )}

        {/* Expand/Collapse Settings */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Settings2 className="h-4 w-4 mr-2" />
          {isExpanded ? 'Hide Settings' : 'Configure Settings'}
        </Button>

        {isExpanded && (
          <>
            <Separator />

            <div className="space-y-4">
              {/* Cadence Frequency */}
              <div className="space-y-2">
                <Label>Outreach Frequency</Label>
                <Select
                  value={String(formState.cadence_days)}
                  onValueChange={(v) => setFormState(s => ({ ...s, cadence_days: parseInt(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Weekly (Every 7 days)</SelectItem>
                    <SelectItem value="10">Every 10 days</SelectItem>
                    <SelectItem value="14">Bi-weekly (Every 14 days)</SelectItem>
                    <SelectItem value="21">Every 3 weeks</SelectItem>
                    <SelectItem value="30">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Channel Priority */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Text First Strategy</Label>
                  <p className="text-xs text-muted-foreground">
                    Send texts before calling non-responders
                  </p>
                </div>
                <Switch
                  checked={formState.text_first}
                  onCheckedChange={(v) => setFormState(s => ({ ...s, text_first: v }))}
                />
              </div>

              {/* Attempt Caps */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Max Texts
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={formState.max_texts_per_window}
                    onChange={(e) => setFormState(s => ({ 
                      ...s, 
                      max_texts_per_window: parseInt(e.target.value) || 1 
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    Max Calls
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={formState.max_calls_per_window}
                    onChange={(e) => setFormState(s => ({ 
                      ...s, 
                      max_calls_per_window: parseInt(e.target.value) || 1 
                    }))}
                  />
                </div>
              </div>

              {/* Allowed Hours */}
              <div className="space-y-2">
                <Label>Allowed Contact Hours</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={formState.allowed_hours_start}
                    onChange={(e) => setFormState(s => ({ 
                      ...s, 
                      allowed_hours_start: e.target.value 
                    }))}
                    className="w-28"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={formState.allowed_hours_end}
                    onChange={(e) => setFormState(s => ({ 
                      ...s, 
                      allowed_hours_end: e.target.value 
                    }))}
                    className="w-28"
                  />
                </div>
              </div>

              {/* Save Button */}
              <Button 
                onClick={handleSaveSettings} 
                disabled={isSaving}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </>
        )}

        {/* Generate Plan Button (only if enabled and no active plan) */}
        {isEnabled && !hasActivePlan && (
          <>
            <Separator />
            <Button
              variant="outline"
              onClick={handleGeneratePlan}
              disabled={generatePlan.isPending || hasDraftPlan}
              className="w-full"
            >
              {generatePlan.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              {hasDraftPlan ? 'Draft Plan Exists' : 'Generate Outreach Plan'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
