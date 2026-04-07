import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Settings2, Percent } from 'lucide-react';

export default function ThingsToDoMarkup() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['experience_markup_rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('experience_markup_rules')
        .select('*')
        .order('priority', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('experience_markup_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rule deleted');
      queryClient.invalidateQueries({ queryKey: ['experience_markup_rules'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('experience_markup_rules').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['experience_markup_rules'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Percent className="h-6 w-6 text-amber-500" />
            Markup Control Panel
          </h1>
          <p className="text-sm text-muted-foreground">Set markup rules by category, city, and demand level</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Rule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Markup Rule</DialogTitle></DialogHeader>
            <MarkupRuleForm
              onSave={() => {
                setShowCreate(false);
                queryClient.invalidateQueries({ queryKey: ['experience_markup_rules'] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Rules Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Rules</p>
            <p className="text-2xl font-bold">{rules.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Active Rules</p>
            <p className="text-2xl font-bold text-emerald-500">
              {rules.filter((r: any) => r.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Avg Markup</p>
            <p className="text-2xl font-bold">
              {rules.length ? (rules.reduce((s: number, r: any) => s + Number(r.markup_pct), 0) / rules.length).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Demand</TableHead>
                <TableHead>Markup %</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : rules.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No markup rules. The default 15% markup on each experience applies.</TableCell></TableRow>
              ) : (
                rules.map((r: any) => (
                  <TableRow key={r.id} className={!r.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{r.rule_name}</TableCell>
                    <TableCell>{r.category || <span className="text-muted-foreground">All</span>}</TableCell>
                    <TableCell>{r.city || <span className="text-muted-foreground">All</span>}</TableCell>
                    <TableCell>
                      <Badge variant={r.demand_level === 'high' ? 'destructive' : r.demand_level === 'low' ? 'secondary' : 'outline'} className="text-xs">
                        {r.demand_level}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold">{r.markup_pct}%</TableCell>
                    <TableCell>{r.priority}</TableCell>
                    <TableCell>
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: r.id, is_active: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* How Markup Rules Work */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Settings2 className="h-4 w-4" /> How Markup Rules Work</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Rules are applied by <strong>priority</strong> (highest first). The first matching rule wins.</p>
          <p>• If no rule matches, the per-experience markup_pct (default 15%) is used.</p>
          <p>• Leave Category or City blank to match <strong>all</strong>.</p>
          <p>• Demand levels: <strong>low</strong> (off-season), <strong>normal</strong>, <strong>high</strong> (peak/events).</p>
          <p>• <strong>display_price = base_price × (1 + markup%)</strong></p>
        </CardContent>
      </Card>
    </div>
  );
}

function MarkupRuleForm({ onSave }: { onSave: () => void }) {
  const [form, setForm] = useState({
    rule_name: '',
    category: '',
    city: '',
    demand_level: 'normal',
    markup_pct: 15,
    priority: 0,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('experience_markup_rules').insert({
        rule_name: form.rule_name,
        category: form.category || null,
        city: form.city || null,
        demand_level: form.demand_level,
        markup_pct: form.markup_pct,
        priority: form.priority,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rule created');
      onSave();
    },
    onError: () => toast.error('Failed to create rule'),
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Rule Name</Label>
        <Input value={form.rule_name} onChange={(e) => setForm({ ...form, rule_name: e.target.value })} placeholder="e.g. NYC Peak Season" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Category (optional)</Label>
          <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Adventure" />
        </div>
        <div>
          <Label>City (optional)</Label>
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. New York" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Demand Level</Label>
          <Select value={form.demand_level} onValueChange={(v) => setForm({ ...form, demand_level: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Markup %</Label>
          <Input type="number" value={form.markup_pct} onChange={(e) => setForm({ ...form, markup_pct: parseFloat(e.target.value) })} />
        </div>
        <div>
          <Label>Priority</Label>
          <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })} />
        </div>
      </div>
      <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!form.rule_name || createMutation.isPending}>
        Create Rule
      </Button>
    </div>
  );
}
