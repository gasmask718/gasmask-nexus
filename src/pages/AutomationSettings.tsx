import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Zap, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AutomationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['automation-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('*');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: vaUsers } = useQuery({
    queryKey: ['va-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .in('role', ['admin', 'csr']);
      
      if (error) throw error;
      return data;
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ scope, updates }: { scope: string; updates: any }) => {
      const { error } = await supabase
        .from('automation_settings')
        .upsert({ scope, ...updates }, { onConflict: 'scope' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-settings'] });
      toast({ title: "Automation settings updated" });
    },
  });

  const scopes = [
    { 
      key: 'global', 
      title: 'Global Automation', 
      description: 'Master control for all automation features'
    },
    { 
      key: 'routes', 
      title: 'Route Automation', 
      description: 'Auto-generate and optimize daily routes'
    },
    { 
      key: 'missions', 
      title: 'Mission Automation', 
      description: 'Auto-assign missions to field workers'
    },
    { 
      key: 'influencers', 
      title: 'Influencer Automation', 
      description: 'Auto-suggest and activate influencer campaigns'
    },
    { 
      key: 'alerts', 
      title: 'Alert Automation', 
      description: 'Auto-respond to fraud and inventory alerts'
    },
  ];

  const getModeColor = (mode: string) => {
    if (mode === 'full_auto') return "bg-primary/10 text-primary border-primary/30";
    if (mode === 'hybrid_va') return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const getModeLabel = (mode: string) => {
    if (mode === 'full_auto') return 'Full Auto';
    if (mode === 'hybrid_va') return 'Hybrid VA';
    return 'Manual';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Automation Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Configure how GasMask automates operations: Manual, Hybrid VA, or Full Auto
          </p>
        </div>

        <div className="space-y-4">
          {scopes.map((scope) => {
            const setting = settings?.find(s => s.scope === scope.key);
            const mode = setting?.mode || 'manual';
            const isEnabled = setting?.is_enabled ?? true;

            return (
              <Card key={scope.key} className="p-6 border-border/50">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-1">{scope.title}</h3>
                    <p className="text-sm text-muted-foreground">{scope.description}</p>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => {
                      updateSetting.mutate({
                        scope: scope.key,
                        updates: { is_enabled: checked, mode: setting?.mode || 'manual' }
                      });
                    }}
                  />
                </div>

                {isEnabled && (
                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Automation Mode</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['manual', 'hybrid_va', 'full_auto'].map((modeOption) => (
                          <Button
                            key={modeOption}
                            variant={mode === modeOption ? 'default' : 'outline'}
                            className="w-full"
                            onClick={() => {
                              updateSetting.mutate({
                                scope: scope.key,
                                updates: { 
                                  mode: modeOption, 
                                  is_enabled: true,
                                  va_owner_id: setting?.va_owner_id 
                                }
                              });
                            }}
                          >
                            {getModeLabel(modeOption)}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {mode === 'hybrid_va' && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">VA Owner</label>
                        <Select
                          value={setting?.va_owner_id || ''}
                          onValueChange={(value) => {
                            updateSetting.mutate({
                              scope: scope.key,
                              updates: { 
                                mode: 'hybrid_va', 
                                is_enabled: true,
                                va_owner_id: value 
                              }
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select VA" />
                          </SelectTrigger>
                          <SelectContent>
                            {vaUsers?.map(user => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="p-3 rounded bg-muted/50 text-sm">
                      {mode === 'manual' && '✋ System suggests actions. Admins must approve.'}
                      {mode === 'hybrid_va' && '🤝 AI suggests → VA reviews → Auto-executes'}
                      {mode === 'full_auto' && '⚡ System executes automatically with notifications'}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}