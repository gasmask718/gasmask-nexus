import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Shield, Eye, Snowflake, LogOut } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 8 — Commitment History (Immutable Audit Trail)
// ═══════════════════════════════════════════════════════════════════════════════

const COMMITMENT_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  dominate: { label: 'Dominate', icon: Target, color: 'bg-green-500' },
  maintain: { label: 'Maintain', icon: Shield, color: 'bg-blue-500' },
  observe: { label: 'Observe', icon: Eye, color: 'bg-amber-500' },
  freeze: { label: 'Freeze', icon: Snowflake, color: 'bg-cyan-500' },
  exit: { label: 'Exit', icon: LogOut, color: 'bg-destructive' },
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  created: { label: 'Created', color: 'bg-green-500' },
  superseded: { label: 'Superseded', color: 'bg-amber-500' },
  expired: { label: 'Expired', color: 'bg-muted-foreground' },
};

export default function CommitmentHistory() {
  const { data: auditLog, isLoading } = useQuery({
    queryKey: ['territory-commitment-audit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_commitment_audit')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all commitments for context (neighborhood names)
  const { data: commitments } = useQuery({
    queryKey: ['territory-commitments-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_commitments')
        .select('id, commitment_type, neighborhood:territory_neighborhoods(name, city, state), reason, created_by');
      if (error) throw error;
      return data || [];
    },
  });

  const commitmentMap = new Map((commitments || []).map((c: any) => [c.id, c]));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Commitment History</h1>
        <p className="text-muted-foreground text-sm">
          Immutable audit trail of all territory planning decisions. Read-only.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (auditLog || []).length > 0 ? (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {(auditLog || []).map((entry: any) => {
                const commitment = commitmentMap.get(entry.commitment_id);
                const actionCfg = ACTION_LABELS[entry.action] || ACTION_LABELS.created;
                const newState = entry.new_state as any;
                const commitType = newState?.commitment_type;
                const typeCfg = commitType ? COMMITMENT_LABELS[commitType] : null;

                return (
                  <div key={entry.id} className="flex items-start gap-4 p-4 rounded-lg border border-border/50">
                    <Badge className={`${actionCfg.color} text-white text-xs mt-1`}>{actionCfg.label}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {(commitment?.neighborhood as any)?.name || 'Unknown Neighborhood'}
                        </p>
                        {typeCfg && (
                          <Badge variant="outline" className="text-xs">{typeCfg.label}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {(commitment?.neighborhood as any)?.city}, {(commitment?.neighborhood as any)?.state}
                      </p>
                      {entry.reason && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{entry.reason}"</p>
                      )}
                    </div>
                    <div className="text-right min-w-[140px]">
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No commitment history yet. Decisions will appear here once commitments are created.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
