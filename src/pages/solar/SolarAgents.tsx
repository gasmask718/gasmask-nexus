import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Users, Plus, Bot, Phone, Trophy, TrendingUp, DollarSign } from 'lucide-react';

const AMBER = '#E8A317';

export default function SolarAgents() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', role: 'VA' });

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['solar-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_agents')
        .select('*')
        .order('total_revenue_generated', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addAgent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('solar_agents').insert({
        name: form.name,
        role: form.role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solar-agents'] });
      toast.success('Agent added');
      setShowAdd(false);
      setForm({ name: '', role: 'VA' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const aiAgents = agents.filter((a: any) => a.role === 'AI');
  const vaAgents = agents.filter((a: any) => a.role === 'VA');
  const closers = agents.filter((a: any) => a.role === 'closer');
  const totalRevenue = agents.reduce((sum: number, a: any) => sum + (a.total_revenue_generated || 0), 0);

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      AI: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      VA: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      closer: 'bg-green-500/20 text-green-400 border-green-500/30',
    };
    return styles[role] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" style={{ color: AMBER }} />
            Floor 8 — Agent Command Center
          </h1>
          <p className="text-muted-foreground">Manage AI agents, VAs, and closers</p>
        </div>
        <Button style={{ backgroundColor: AMBER, color: '#000' }} onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Agent
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'AI Agents', value: aiAgents.length, icon: Bot, color: 'text-purple-400' },
          { label: 'VAs', value: vaAgents.length, icon: Phone, color: 'text-blue-400' },
          { label: 'Closers', value: closers.length, icon: Trophy, color: 'text-green-400' },
          { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-yellow-400' },
        ].map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Leaderboard */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" style={{ color: AMBER }} />
            Agent Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Close Rate</TableHead>
                <TableHead className="text-right">Performance</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : !agents.length ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No agents yet — add your first agent</TableCell></TableRow>
              ) : (
                agents.map((agent: any, i: number) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-bold text-lg" style={{ color: i < 3 ? AMBER : undefined }}>
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>
                      <Badge className={`${getRoleBadge(agent.role)} border`}>{agent.role}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {((agent.close_rate || 0) * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(agent.performance_score || 0)}%`,
                              backgroundColor: AMBER,
                            }}
                          />
                        </div>
                        <span className="text-xs w-8">{agent.performance_score || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold" style={{ color: AMBER }}>
                      ${(agent.total_revenue_generated || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Agent Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Agent name" />
            </div>
            <div>
              <Label>Role</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="AI">AI Agent</option>
                <option value="VA">Virtual Assistant</option>
                <option value="closer">Closer</option>
              </select>
            </div>
            <Button
              className="w-full"
              style={{ backgroundColor: AMBER, color: '#000' }}
              disabled={!form.name}
              onClick={() => addAgent.mutate()}
            >
              Add Agent
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
