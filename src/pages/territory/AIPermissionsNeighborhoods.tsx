import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Shield, CheckCircle, XCircle, Bot, UserCheck } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 9 UI — Neighborhood Permission Matrix
// One row per neighborhood. Drill-down to permission detail.
// ═══════════════════════════════════════════════════════════════════════════════

const COMMITMENT_COLORS: Record<string, string> = {
  dominate: 'bg-green-500',
  maintain: 'bg-blue-500',
  observe: 'bg-amber-500',
  freeze: 'bg-cyan-500',
  exit: 'bg-destructive',
};

interface PermissionDetail {
  id: string;
  action_key: string;
  allowed: boolean;
  reason: string;
  source: string;
  effective_from: string;
  effective_until: string | null;
  created_by: string | null;
  commitment_id: string;
}

export default function AIPermissionsNeighborhoods() {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<any>(null);

  // Active commitments with neighborhood info
  const { data: commitments } = useQuery({
    queryKey: ['ai-perm-nh-commitments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_commitments')
        .select('*, neighborhood:territory_neighborhoods(id, name, city, state)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // All permissions
  const { data: permissions } = useQuery({
    queryKey: ['ai-perm-nh-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_ai_permissions')
        .select('*')
        .order('action_key');
      if (error) throw error;
      return data || [];
    },
  });

  // Build per-neighborhood summary
  const neighborhoodRows = (commitments || []).map((c: any) => {
    const nhPerms = (permissions || []).filter((p: any) => p.neighborhood_id === c.neighborhood_id && p.commitment_id === c.id);
    const allowed = nhPerms.filter((p: any) => p.allowed).length;
    const denied = nhPerms.filter((p: any) => !p.allowed).length;
    return {
      ...c,
      permissionDetails: nhPerms,
      allowedCount: allowed,
      deniedCount: denied,
    };
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Neighborhood Permission Matrix
        </h1>
        <p className="text-muted-foreground text-sm">
          Per-neighborhood AI permission state. Click any row for detail.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Neighborhood</TableHead>
                <TableHead>Commitment</TableHead>
                <TableHead className="text-center">AI Allowed</TableHead>
                <TableHead className="text-center">Human Only</TableHead>
                <TableHead className="text-center">Allowed</TableHead>
                <TableHead className="text-center">Denied</TableHead>
                <TableHead>Review Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {neighborhoodRows.length > 0 ? neighborhoodRows.map((row: any) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedNeighborhood(row)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{(row.neighborhood as any)?.name}</p>
                      <p className="text-xs text-muted-foreground">{(row.neighborhood as any)?.city}, {(row.neighborhood as any)?.state}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${COMMITMENT_COLORS[row.commitment_type] || 'bg-muted'} text-white text-xs`}>
                      {row.commitment_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {row.ai_allowed ? (
                      <Bot className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.human_only ? (
                      <UserCheck className="h-4 w-4 text-amber-500 mx-auto" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-green-500 font-medium">{row.allowedCount}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-destructive font-medium">{row.deniedCount}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{row.review_date}</span>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No commitments with resolved permissions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Permission Detail Drawer */}
      <Drawer open={!!selectedNeighborhood} onOpenChange={(open) => !open && setSelectedNeighborhood(null)}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>
              {(selectedNeighborhood?.neighborhood as any)?.name} — Permission Detail
            </DrawerTitle>
            <DrawerDescription>
              Commitment: <Badge className={`${COMMITMENT_COLORS[selectedNeighborhood?.commitment_type] || ''} text-white text-xs ml-1`}>
                {selectedNeighborhood?.commitment_type}
              </Badge>
              {' '}· Source: commitment · Review: {selectedNeighborhood?.review_date}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-2 overflow-y-auto max-h-[60vh]">
            {(selectedNeighborhood?.permissionDetails || []).map((p: PermissionDetail) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded border border-border/30">
                {p.allowed ? (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <code className="text-xs font-mono font-medium">{p.action_key}</code>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.reason}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <p>Source: {p.source}</p>
                  <p>From: {new Date(p.effective_from).toLocaleDateString()}</p>
                  {p.effective_until && <p>Until: {new Date(p.effective_until).toLocaleDateString()}</p>}
                </div>
              </div>
            ))}
            {(selectedNeighborhood?.permissionDetails || []).length === 0 && (
              <p className="text-center text-muted-foreground py-8">No permissions resolved for this commitment.</p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
