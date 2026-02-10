import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Shield, Target, Eye, Snowflake, LogOut, MapPin, Bot, UserCheck, PhoneOff, Ban, Factory } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 8 — Territory Planning Dashboard
// Human strategic intent over territory. No execution. Only declarations.
// ═══════════════════════════════════════════════════════════════════════════════

const COMMITMENT_CONFIG: Record<string, { label: string; icon: any; color: string; description: string }> = {
  dominate: { label: 'Dominate', icon: Target, color: 'bg-green-500', description: 'Aggressively pursue full coverage' },
  maintain: { label: 'Maintain', icon: Shield, color: 'bg-blue-500', description: 'Hold current position, no expansion' },
  observe: { label: 'Observe', icon: Eye, color: 'bg-amber-500', description: 'Monitor only, no active engagement' },
  freeze: { label: 'Freeze', icon: Snowflake, color: 'bg-cyan-500', description: 'All activity suspended' },
  exit: { label: 'Exit', icon: LogOut, color: 'bg-destructive', description: 'Planned withdrawal from area' },
};

export default function TerritoryPlanning() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('');
  const [commitmentType, setCommitmentType] = useState<string>('');
  const [reviewDate, setReviewDate] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [aiAllowed, setAiAllowed] = useState(false);
  const [humanOnly, setHumanOnly] = useState(false);
  const [noOutbound, setNoOutbound] = useState(false);
  const [noPromotions, setNoPromotions] = useState(false);
  const [wholesalerOnly, setWholesalerOnly] = useState(false);

  // Active commitments
  const { data: commitments, isLoading: loadingCommitments } = useQuery({
    queryKey: ['territory-commitments-active'],
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

  // Gap intelligence context
  const { data: neighborhoods } = useQuery({
    queryKey: ['territory-planning-neighborhoods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_territory_neighborhood_kpis')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Neighborhood list for selector
  const { data: neighborhoodList } = useQuery({
    queryKey: ['territory-neighborhoods-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_neighborhoods')
        .select('id, name, city, state')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Create commitment mutation
  const createCommitment = useMutation({
    mutationFn: async () => {
      // If there's an existing active commitment for this neighborhood, supersede it
      const existing = (commitments || []).find(
        (c: any) => c.neighborhood_id === selectedNeighborhood && c.is_active
      );

      const { data: newCommitment, error: insertError } = await supabase
        .from('territory_commitments')
        .insert({
          neighborhood_id: selectedNeighborhood,
          commitment_type: commitmentType as any,
          ai_allowed: aiAllowed,
          human_only: humanOnly,
          no_outbound_contact: noOutbound,
          no_new_promotions: noPromotions,
          wholesaler_only_verification: wholesalerOnly,
          review_date: reviewDate,
          reason,
          notes: notes || null,
          created_by: user?.id,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // Supersede old commitment
      if (existing) {
        const { error: updateError } = await supabase
          .from('territory_commitments')
          .update({ is_active: false, superseded_by: newCommitment.id })
          .eq('id', (existing as any).id);
        if (updateError) throw updateError;
      }

      return newCommitment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territory-commitments-active'] });
      toast.success('Commitment recorded');
      resetEditor();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetEditor = () => {
    setEditorOpen(false);
    setSelectedNeighborhood('');
    setCommitmentType('');
    setReviewDate('');
    setReason('');
    setNotes('');
    setAiAllowed(false);
    setHumanOnly(false);
    setNoOutbound(false);
    setNoPromotions(false);
    setWholesalerOnly(false);
  };

  const canSubmit = selectedNeighborhood && commitmentType && reviewDate && reason.trim().length > 0;

  // Map neighborhood_id → gap data
  const gapMap = new Map((neighborhoods || []).map((n: any) => [n.neighborhood_id, n]));

  // Committed neighborhood IDs
  const committedIds = new Set((commitments || []).map((c: any) => c.neighborhood_id));

  // Uncommitted neighborhoods (gap)
  const uncommitted = (neighborhoods || []).filter((n: any) => !committedIds.has(n.neighborhood_id));

  const isLoading = loadingCommitments;

  // Stale data detection
  const oldestCommitment = (commitments || []).reduce((oldest: string | null, c: any) => {
    if (!oldest) return c.created_at;
    return new Date(c.created_at) < new Date(oldest) ? c.created_at : oldest;
  }, null);
  const dataAge = oldestCommitment ? Math.round((Date.now() - new Date(oldestCommitment).getTime()) / 86400000) : 0;
  const isStale = dataAge > 30;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Territory Planning</h1>
          <p className="text-muted-foreground text-sm">
            Strategic commitments and constraints. Declares intent — never executes.
          </p>
        </div>
        <Button onClick={() => setEditorOpen(true)}>New Commitment</Button>
      </div>

      {/* Stale data warning */}
      {isStale && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/50 bg-amber-500/10 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="font-medium text-amber-600">Stale Intelligence Warning</p>
            <p className="text-muted-foreground text-xs">
              Oldest commitment is {dataAge} days old. Coverage data may not reflect current ground truth. Consider re-scouting before making new commitments.
            </p>
          </div>
        </div>
      )}

      {/* Coverage at decision time */}
      {neighborhoods && neighborhoods.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Coverage Snapshot</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">
                  {(() => {
                    const total = (neighborhoods || []).reduce((s: number, n: any) => s + (n.total_addresses || 0), 0);
                    const unknown = (neighborhoods || []).reduce((s: number, n: any) => s + (n.unknown_count || 0), 0);
                    return total > 0 ? Math.round(((total - unknown) / total) * 100) : 0;
                  })()}% coverage
                </p>
                <p className="text-xs text-muted-foreground">across {neighborhoods.length} neighborhoods</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* ── Summary KPIs ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(COMMITMENT_CONFIG).map(([key, cfg]) => {
              const count = (commitments || []).filter((c: any) => c.commitment_type === key).length;
              return (
                <Card key={key}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <cfg.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{cfg.label}</span>
                    </div>
                    <p className="text-2xl font-bold">{count}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Active Commitments ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Active Commitments</CardTitle>
            </CardHeader>
            <CardContent>
              {(commitments || []).length > 0 ? (
                <div className="space-y-3">
                  {(commitments || []).map((c: any) => {
                    const cfg = COMMITMENT_CONFIG[c.commitment_type] || COMMITMENT_CONFIG.observe;
                    const gap = gapMap.get(c.neighborhood_id);
                    const reviewSoon = c.review_date && new Date(c.review_date) <= new Date(Date.now() + 14 * 86400000);
                    return (
                      <div key={c.id} className="flex items-start gap-4 p-4 rounded-lg border border-border/50 hover:bg-muted/30">
                        <Badge className={`${cfg.color} text-white text-xs mt-1`}>{cfg.label}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{(c.neighborhood as any)?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">
                            {(c.neighborhood as any)?.city}, {(c.neighborhood as any)?.state}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 italic">"{c.reason}"</p>
                          {/* Constraint badges */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {c.ai_allowed && <ConstraintBadge icon={Bot} label="AI Allowed" variant="positive" />}
                            {c.human_only && <ConstraintBadge icon={UserCheck} label="Human Only" variant="neutral" />}
                            {c.no_outbound_contact && <ConstraintBadge icon={PhoneOff} label="No Outbound" variant="warning" />}
                            {c.no_new_promotions && <ConstraintBadge icon={Ban} label="No Promotions" variant="warning" />}
                            {c.wholesaler_only_verification && <ConstraintBadge icon={Factory} label="Wholesaler Verify" variant="neutral" />}
                          </div>
                        </div>
                        {/* Gap context */}
                        {gap && (
                          <div className="text-right min-w-[100px]">
                            <div className="flex items-center gap-2">
                              <Progress value={Number(gap.coverage_percentage) || 0} className="h-2 w-16" />
                              <span className="text-xs">{gap.coverage_percentage}%</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{gap.total_addresses} addr</p>
                          </div>
                        )}
                        <div className="text-right min-w-[90px]">
                          <p className={`text-xs ${reviewSoon ? 'text-amber-500 font-medium' : 'text-muted-foreground'}`}>
                            Review: {c.review_date}
                          </p>
                          {reviewSoon && <p className="text-xs text-amber-500">⚠ Soon</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No active commitments. Create one to declare strategic intent for a territory.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Uncommitted Neighborhoods ── */}
          {uncommitted.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-amber-500">Uncommitted Neighborhoods ({uncommitted.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-3">Neighborhood</th>
                        <th className="text-left py-2 px-3">City</th>
                        <th className="text-right py-2 px-3">Addresses</th>
                        <th className="text-right py-2 px-3">Unknown</th>
                        <th className="py-2 px-3 w-32">Coverage</th>
                        <th className="text-center py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uncommitted.map((n: any) => (
                        <tr key={n.neighborhood_id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-3 font-medium">{n.name}</td>
                          <td className="py-2 px-3 text-muted-foreground">{n.city}, {n.state}</td>
                          <td className="py-2 px-3 text-right">{n.total_addresses}</td>
                          <td className="py-2 px-3 text-right text-muted-foreground">{n.unknown_count}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <Progress value={Number(n.coverage_percentage) || 0} className="h-2 flex-1" />
                              <span className="text-xs w-10 text-right">{n.coverage_percentage}%</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="outline" className="text-xs text-muted-foreground">No Plan</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Commitment Editor Modal ── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Territory Commitment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Neighborhood */}
            <div className="space-y-1">
              <Label>Neighborhood *</Label>
              <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood}>
                <SelectTrigger><SelectValue placeholder="Select neighborhood" /></SelectTrigger>
                <SelectContent>
                  {(neighborhoodList || []).map((n: any) => (
                    <SelectItem key={n.id} value={n.id}>{n.name} — {n.city}, {n.state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Commitment type */}
            <div className="space-y-1">
              <Label>Commitment Type *</Label>
              <Select value={commitmentType} onValueChange={setCommitmentType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COMMITMENT_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label} — {cfg.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Review date */}
            <div className="space-y-1">
              <Label>Review Date *</Label>
              <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
            </div>

            {/* Reason */}
            <div className="space-y-1">
              <Label>Reason / Justification *</Label>
              <Textarea
                placeholder="Why is this commitment being made? What intelligence supports it?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Additional context..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Constraints */}
            <div className="space-y-3 border-t pt-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Operational Constraints</Label>
              <ConstraintToggle label="AI Allowed" description="Allow AI agents to operate in this area" checked={aiAllowed} onChange={setAiAllowed} />
              <ConstraintToggle label="Human Only" description="All actions require human execution" checked={humanOnly} onChange={setHumanOnly} />
              <ConstraintToggle label="No Outbound Contact" description="No calls, texts, or outreach" checked={noOutbound} onChange={setNoOutbound} />
              <ConstraintToggle label="No New Promotions" description="Block store promotions to CRM" checked={noPromotions} onChange={setNoPromotions} />
              <ConstraintToggle label="Wholesaler-Only Verification" description="Only wholesaler data can verify stores" checked={wholesalerOnly} onChange={setWholesalerOnly} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetEditor}>Cancel</Button>
            <Button
              onClick={() => createCommitment.mutate()}
              disabled={!canSubmit || createCommitment.isPending}
            >
              {createCommitment.isPending ? 'Recording...' : 'Record Commitment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ──

function ConstraintBadge({ icon: Icon, label, variant }: { icon: any; label: string; variant: 'positive' | 'warning' | 'neutral' }) {
  const colors = {
    positive: 'border-green-500/30 text-green-500 bg-green-500/10',
    warning: 'border-amber-500/30 text-amber-500 bg-amber-500/10',
    neutral: 'border-border text-muted-foreground bg-muted/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${colors[variant]}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function ConstraintToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
