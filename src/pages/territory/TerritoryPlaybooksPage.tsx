/**
 * Floor 11 — Territory Playbooks (Human-Owned Autopilot)
 * Only humans can create/approve playbooks.
 * AI can only execute active, approved playbooks via Floor 10 guard.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Plus, BookOpen, Play, Pause, Shield, CheckCircle, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Playbook {
  id: string;
  neighborhood_id: string | null;
  playbook_name: string;
  ordered_action_keys: string[];
  conditions: any;
  created_by: string;
  approved_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PlaybookRun {
  id: string;
  playbook_id: string;
  triggered_by: string;
  status: string;
  current_step: number;
  total_steps: number;
  step_results: any;
  halted_at_step: number | null;
  halt_reason: string | null;
  started_at: string;
  completed_at: string | null;
}

export default function TerritoryPlaybooksPage() {
  const { user } = useAuth();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [runs, setRuns] = useState<PlaybookRun[]>([]);
  const [actionKeys, setActionKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newNeighborhood, setNewNeighborhood] = useState('');
  const [newKeys, setNewKeys] = useState('');
  const [newConditions, setNewConditions] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pbRes, runRes, regRes] = await Promise.all([
        (supabase as any).from('territory_playbooks').select('*').order('created_at', { ascending: false }),
        (supabase as any).from('territory_playbook_runs').select('*').order('started_at', { ascending: false }).limit(50),
        supabase.from('ai_action_registry').select('action_key').order('action_key'),
      ]);

      setPlaybooks(pbRes.data || []);
      setRuns(runRes.data || []);
      setActionKeys((regRes.data || []).map((r: any) => r.action_key));
    } catch (err) {
      console.error('Failed to fetch playbooks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleCreate() {
    if (!newName.trim() || !newKeys.trim()) {
      toast.error('Name and action keys are required');
      return;
    }
    if (!user?.id) {
      toast.error('Authentication required');
      return;
    }

    const keys = newKeys.split(',').map(k => k.trim()).filter(Boolean);
    const invalidKeys = keys.filter(k => !actionKeys.includes(k));
    if (invalidKeys.length > 0) {
      toast.error(`Invalid action keys: ${invalidKeys.join(', ')}`);
      return;
    }

    setCreating(true);
    try {
      let conditions = {};
      if (newConditions.trim()) {
        try { conditions = JSON.parse(newConditions); } catch {
          toast.error('Invalid JSON in conditions');
          setCreating(false);
          return;
        }
      }

      const { error } = await (supabase as any).from('territory_playbooks').insert({
        playbook_name: newName.trim(),
        neighborhood_id: newNeighborhood.trim() || null,
        ordered_action_keys: keys,
        conditions,
        created_by: user.id,
        is_active: false,
      });

      if (error) throw error;
      toast.success('Playbook created. Requires approval before activation.');
      setShowCreate(false);
      setNewName('');
      setNewKeys('');
      setNewConditions('');
      setNewNeighborhood('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create playbook');
    } finally {
      setCreating(false);
    }
  }

  async function handleApprove(pb: Playbook) {
    if (!user?.id) return;
    try {
      const { error } = await (supabase as any)
        .from('territory_playbooks')
        .update({ approved_by: user.id })
        .eq('id', pb.id);
      if (error) throw error;
      toast.success('Playbook approved');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    }
  }

  async function handleToggleActive(pb: Playbook) {
    if (!pb.approved_by && !pb.is_active) {
      toast.error('Playbook must be approved before activation');
      return;
    }
    try {
      const { error } = await (supabase as any)
        .from('territory_playbooks')
        .update({ is_active: !pb.is_active })
        .eq('id', pb.id);
      if (error) throw error;
      toast.success(pb.is_active ? 'Playbook deactivated' : 'Playbook activated');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle');
    }
  }

  async function handleDelete(pb: Playbook) {
    if (!confirm(`Delete playbook "${pb.playbook_name}"?`)) return;
    try {
      const { error } = await (supabase as any)
        .from('territory_playbooks')
        .delete()
        .eq('id', pb.id);
      if (error) throw error;
      toast.success('Playbook deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  }

  const activeCount = playbooks.filter(p => p.is_active).length;
  const approvedCount = playbooks.filter(p => p.approved_by).length;
  const pendingCount = playbooks.filter(p => !p.approved_by).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Floor 11 — Territory Playbooks
          </h1>
          <p className="text-muted-foreground mt-1">
            Human-owned automation. AI executes only active, approved playbooks via Floor 10.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create Playbook
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-sm text-muted-foreground">Total Playbooks</p>
          <p className="text-2xl font-bold">{playbooks.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold">{activeCount}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-sm text-muted-foreground">Approved</p>
          <p className="text-2xl font-bold">{approvedCount}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-sm text-muted-foreground">Pending Approval</p>
          <p className="text-2xl font-bold">{pendingCount}</p>
        </CardContent></Card>
      </div>

      <Separator />

      {/* Playbook Cards */}
      {playbooks.length === 0 && !loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No playbooks yet. Create one to define a human-owned automation sequence.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {playbooks.map(pb => (
            <Card key={pb.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{pb.playbook_name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {pb.is_active ? (
                      <Badge className="bg-primary/20 text-primary border-primary/30">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                    {pb.approved_by ? (
                      <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" />Approved</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3 w-3" />Pending</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {pb.neighborhood_id && (
                  <p className="text-xs text-muted-foreground">
                    Neighborhood: <span className="font-mono">{pb.neighborhood_id.slice(0, 8)}…</span>
                  </p>
                )}
                <div>
                  <p className="text-xs font-medium mb-1">Action Sequence ({pb.ordered_action_keys.length} steps):</p>
                  <div className="flex flex-wrap gap-1">
                    {pb.ordered_action_keys.map((key, i) => (
                      <Badge key={i} variant="outline" className="text-xs font-mono">
                        {i + 1}. {key}
                      </Badge>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Created: {new Date(pb.created_at).toLocaleDateString()}
                </p>
                <div className="flex gap-2 pt-2">
                  {!pb.approved_by && (
                    <Button size="sm" variant="outline" onClick={() => handleApprove(pb)}>
                      <Shield className="h-3 w-3 mr-1" />
                      Approve
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleToggleActive(pb)}>
                    {pb.is_active ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                    {pb.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(pb)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Execution Runs */}
      {runs.length > 0 && (
        <>
          <Separator />
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Playbook Runs</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2 font-medium">Started</th>
                      <th className="p-2 font-medium">Playbook</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">Progress</th>
                      <th className="p-2 font-medium">Halt Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map(run => {
                      const pb = playbooks.find(p => p.id === run.playbook_id);
                      return (
                        <tr key={run.id} className="border-b border-muted/50">
                          <td className="p-2 text-xs">{new Date(run.started_at).toLocaleString()}</td>
                          <td className="p-2 text-xs">{pb?.playbook_name || run.playbook_id.slice(0, 8)}</td>
                          <td className="p-2">
                            <Badge variant={run.status === 'completed' ? 'secondary' : run.status === 'halted' ? 'destructive' : 'outline'}>
                              {run.status}
                            </Badge>
                          </td>
                          <td className="p-2 text-xs">{run.current_step}/{run.total_steps}</td>
                          <td className="p-2 text-xs text-destructive">{run.halt_reason || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Create Playbook Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Territory Playbook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Playbook Name</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Dominate Neighborhood Alpha" />
            </div>
            <div>
              <Label>Neighborhood ID (optional)</Label>
              <Input value={newNeighborhood} onChange={e => setNewNeighborhood(e.target.value)} placeholder="UUID" />
            </div>
            <div>
              <Label>Action Keys (comma-separated, in execution order)</Label>
              <Textarea value={newKeys} onChange={e => setNewKeys(e.target.value)}
                placeholder="scout_store, qualify_lead, schedule_visit" rows={3} />
              {actionKeys.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Available: {actionKeys.slice(0, 10).join(', ')}{actionKeys.length > 10 ? ` (+${actionKeys.length - 10} more)` : ''}
                </p>
              )}
            </div>
            <div>
              <Label>Conditions (optional JSON)</Label>
              <Textarea value={newConditions} onChange={e => setNewConditions(e.target.value)}
                placeholder='{"min_stores": 5}' rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
