import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, CheckCircle, XCircle } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 9 UI — Action-Centric View
// "Where can AI do X?" for each registered action.
// ═══════════════════════════════════════════════════════════════════════════════

export default function AIPermissionsActions() {
  const { data: registry } = useQuery({
    queryKey: ['ai-action-registry'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_action_registry')
        .select('*')
        .order('category, action_key');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: permissions } = useQuery({
    queryKey: ['ai-perm-actions-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_ai_permissions')
        .select('*, neighborhood:territory_neighborhoods(id, name)')
        .order('action_key');
      if (error) throw error;
      return data || [];
    },
  });

  const categories = [...new Set((registry || []).map((a: any) => a.category))];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Action-Centric Permissions
        </h1>
        <p className="text-muted-foreground text-sm">
          For each AI action: where is it allowed, where denied, and why.
        </p>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 text-sm">
        <Shield className="h-5 w-5 text-primary shrink-0" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Constitutional guard active.</span>{' '}
          AI actions are bounded by the finite registry below. Unregistered actions are denied by default.
        </p>
      </div>

      <Tabs defaultValue={categories[0] || 'all'}>
        <TabsList className="flex-wrap h-auto">
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat} className="text-xs">{cat}</TabsTrigger>
          ))}
        </TabsList>

        {categories.map(cat => {
          const actions = (registry || []).filter((a: any) => a.category === cat);
          return (
            <TabsContent key={cat} value={cat} className="space-y-4">
              {actions.map((action: any) => {
                const actionPerms = (permissions || []).filter((p: any) => p.action_key === action.action_key);
                const allowed = actionPerms.filter((p: any) => p.allowed);
                const denied = actionPerms.filter((p: any) => !p.allowed);

                // Aggregate denial reasons
                const denialReasons = [...new Set(denied.map((p: any) => p.reason))];

                return (
                  <Card key={action.action_key}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <code className="text-sm font-mono font-medium">{action.action_key}</code>
                          {action.is_destructive && (
                            <Badge variant="destructive" className="text-[10px]">Destructive</Badge>
                          )}
                          {action.requires_human_review && (
                            <Badge variant="outline" className="text-[10px]">Human Review</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-green-500 flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" /> {allowed.length} allowed
                          </span>
                          <span className="text-destructive flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5" /> {denied.length} denied
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Allowed neighborhoods */}
                      {allowed.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-green-500 mb-1">Allowed in:</p>
                          <div className="flex flex-wrap gap-1">
                            {allowed.map((p: any) => (
                              <Badge key={p.id} variant="outline" className="text-[10px] border-green-500/30 text-green-600">
                                {(p.neighborhood as any)?.name || '—'}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Denied neighborhoods */}
                      {denied.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-destructive mb-1">Denied in:</p>
                          <div className="flex flex-wrap gap-1">
                            {denied.map((p: any) => (
                              <Badge key={p.id} variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                                {(p.neighborhood as any)?.name || '—'}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Denial reasons */}
                      {denialReasons.length > 0 && (
                        <div className="pt-2 border-t border-border/30">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Denial reasons:</p>
                          <ul className="space-y-1">
                            {denialReasons.map((r, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <XCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {actionPerms.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">
                          No permissions resolved for this action. Default: DENY.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
