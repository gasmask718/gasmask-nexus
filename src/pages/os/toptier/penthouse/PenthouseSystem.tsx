import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, patchTopTierData, logPenthouseAction } from '@/lib/toptierApi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Settings2, AlertTriangle, Shield, Zap } from 'lucide-react';

export default function PenthouseSystem() {
  const queryClient = useQueryClient();

  const { data: controls = [], isLoading } = useQuery({
    queryKey: ['ph-system-controls'],
    queryFn: () => fetchTopTierData('tt_system_controls', { select: '*', order: 'category' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled, controlKey }: { id: string; enabled: boolean; controlKey: string }) => {
      const result = await patchTopTierData('tt_system_controls', { id: `eq.${id}` }, { enabled, updated_at: new Date().toISOString() });
      const { data } = await supabase.auth.getUser();
      await logPenthouseAction({
        action: enabled ? 'enable_control' : 'disable_control',
        target_type: 'tt_system_controls',
        target_id: id,
        actor_user_id: data.user?.id || 'unknown',
        reason: `${enabled ? 'Enabled' : 'Disabled'} system control: ${controlKey}`,
        after: { control_key: controlKey, enabled },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-system-controls'] });
      toast.success('Control updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const groupedControls = controls.reduce((acc: Record<string, any[]>, c: any) => {
    const cat = c.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case 'emergency': return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'services': return <Zap className="h-4 w-4 text-amber-400" />;
      case 'system': return <Settings2 className="h-4 w-4 text-blue-400" />;
      default: return <Shield className="h-4 w-4 text-[#C9A84C]" />;
    }
  };

  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'emergency': return 'border-red-500/20';
      case 'services': return 'border-amber-500/20';
      case 'system': return 'border-blue-500/20';
      default: return 'border-[#C9A84C]/20';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">System Controls</h1>
        <p className="text-white/40 text-sm mt-1">Platform-wide toggles — all changes audit-logged</p>
      </div>

      {controls.some((c: any) => c.category === 'emergency' && c.enabled) && (
        <Card className="bg-red-500/5 border-red-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <p className="text-red-400 text-sm font-medium">Emergency controls are active — some services may be disabled</p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Card key={i} className="bg-[#111] border-white/5 h-32 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedControls).map(([category, items]) => {
            const controlItems = items as any[];
            return (
              <Card key={category} className={`bg-[#111] ${categoryColor(category)}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-white/70 flex items-center gap-2">
                    {categoryIcon(category)}
                    <span className="capitalize">{category}</span>
                    <Badge variant="outline" className="text-[9px] border-white/10 text-white/40 ml-auto">{controlItems.length} controls</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {controlItems.map((ctrl: any) => (
                    <div key={ctrl.id} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/5">
                      <div className="flex-1">
                        <p className="text-sm text-white/80 font-medium">{ctrl.description || ctrl.control_key}</p>
                        <p className="text-xs text-white/30 font-mono mt-0.5">{ctrl.control_key}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={`text-[9px] ${ctrl.enabled ? (ctrl.category === 'emergency' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400') : 'bg-white/10 text-white/30'}`}>
                          {ctrl.enabled ? 'ON' : 'OFF'}
                        </Badge>
                        <Switch
                          checked={ctrl.enabled}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: ctrl.id, enabled: checked, controlKey: ctrl.control_key })}
                          className={ctrl.category === 'emergency' ? 'data-[state=checked]:bg-red-500' : 'data-[state=checked]:bg-[#C9A84C]'}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {controls.length === 0 && !isLoading && (
        <Card className="bg-[#111] border-white/5">
          <CardContent className="p-8 text-center text-white/30">
            No system controls configured
          </CardContent>
        </Card>
      )}
    </div>
  );
}