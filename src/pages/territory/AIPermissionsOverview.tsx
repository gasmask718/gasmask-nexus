import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle, XCircle, MapPin, Clock } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 9 UI — AI Permissions Overview
// Read-only truth visualization. No mutations. No overrides.
// ═══════════════════════════════════════════════════════════════════════════════

export default function AIPermissionsOverview() {
  // All registered actions
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

  // Effective permissions (allowed only)
  const { data: permissions } = useQuery({
    queryKey: ['ai-effective-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_ai_effective_permissions')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // All permission rows (allowed + denied) for full picture
  const { data: allPermissions } = useQuery({
    queryKey: ['ai-all-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_ai_permissions')
        .select('*, neighborhood:territory_neighborhoods(id, name), commitment:territory_commitments(id, commitment_type)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Active commitments for context
  const { data: commitments } = useQuery({
    queryKey: ['ai-perm-commitments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_commitments')
        .select('id, neighborhood_id, commitment_type, ai_allowed, human_only, is_active')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const totalActions = registry?.length || 0;
  const allowedEntries = (allPermissions || []).filter((p: any) => p.allowed);
  const deniedEntries = (allPermissions || []).filter((p: any) => !p.allowed);

  // Unique neighborhoods with AI enabled (has at least one allowed permission)
  const enabledNeighborhoods = new Set(allowedEntries.map((p: any) => p.neighborhood_id));
  // Neighborhoods that are frozen/exited (commitment type)
  const frozenNeighborhoods = (commitments || []).filter(
    (c: any) => ['freeze', 'exit'].includes(c.commitment_type)
  );

  // Last permission update
  const lastUpdate = (allPermissions || []).length > 0
    ? new Date((allPermissions as any[])[0].created_at).toLocaleString()
    : 'Never';

  const isLoading = !registry || !allPermissions;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          AI Permission Matrix
        </h1>
        <p className="text-muted-foreground text-sm">
          Read-only governance view. AI reads policy — never infers intent.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPICard label="Registered Actions" value={totalActions} icon={<Shield className="h-4 w-4" />} />
            <KPICard label="Allowed Grants" value={allowedEntries.length} icon={<CheckCircle className="h-4 w-4 text-green-500" />} variant="success" />
            <KPICard label="Denied Rules" value={deniedEntries.length} icon={<XCircle className="h-4 w-4 text-destructive" />} variant="danger" />
            <KPICard label="AI-Enabled Areas" value={enabledNeighborhoods.size} icon={<MapPin className="h-4 w-4 text-blue-500" />} />
            <KPICard label="Frozen / Exited" value={frozenNeighborhoods.length} icon={<XCircle className="h-4 w-4 text-muted-foreground" />} variant="muted" />
            <KPICard label="Last Update" value={lastUpdate} icon={<Clock className="h-4 w-4" />} isText />
          </div>

          {/* Action Registry */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AI Action Registry (Finite Vocabulary)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {(registry || []).map((action: any) => {
                  const allowedCount = allowedEntries.filter((p: any) => p.action_key === action.action_key).length;
                  const deniedCount = deniedEntries.filter((p: any) => p.action_key === action.action_key).length;
                  return (
                    <div key={action.action_key} className="p-3 rounded-lg border border-border/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <code className="text-xs font-mono font-medium">{action.action_key}</code>
                        {action.is_destructive && (
                          <Badge variant="destructive" className="text-[10px]">Destructive</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-muted text-muted-foreground text-[10px]">{action.category}</Badge>
                        {action.requires_human_review && (
                          <Badge variant="outline" className="text-[10px]">Human Review</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs pt-1 border-t border-border/30">
                        <span className="text-green-500">✓ {allowedCount} areas</span>
                        <span className="text-destructive">✕ {deniedCount} areas</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent Permission Changes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Permission Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {(allPermissions || []).slice(0, 30).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded border border-border/30 text-sm">
                    {p.allowed ? (
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <code className="text-xs font-mono w-36 shrink-0">{p.action_key}</code>
                    <span className="text-muted-foreground truncate flex-1">
                      {(p.neighborhood as any)?.name || '—'}
                    </span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={p.reason}>
                      {p.reason}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{p.source}</Badge>
                  </div>
                ))}
                {(allPermissions || []).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No permissions resolved yet. Create territory commitments first.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KPICard({ label, value, icon, variant, isText }: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  variant?: 'success' | 'danger' | 'muted';
  isText?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`${isText ? 'text-xs' : 'text-2xl'} font-bold`}>{value}</p>
      </CardContent>
    </Card>
  );
}
