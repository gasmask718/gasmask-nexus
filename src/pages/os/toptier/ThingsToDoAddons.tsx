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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Package, Trash2, Link2 } from 'lucide-react';

export default function ThingsToDoAddons() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: addons = [], isLoading } = useQuery({
    queryKey: ['experience_addons_mgmt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('experience_addons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ['experience_addon_links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('experience_addon_links')
        .select('*, experiences_master(title)');
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('experience_addons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Add-on deleted');
      queryClient.invalidateQueries({ queryKey: ['experience_addons_mgmt'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('experience_addons').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['experience_addons_mgmt'] }),
  });

  const totalRevenuePotential = addons.reduce((s: number, a: any) => s + Number(a.price || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-indigo-500" />
            Add-on Management
          </h1>
          <p className="text-sm text-muted-foreground">Create and manage experience add-ons for upselling</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Create Add-on</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Add-on</DialogTitle></DialogHeader>
            <AddonForm onSave={() => {
              setShowCreate(false);
              queryClient.invalidateQueries({ queryKey: ['experience_addons_mgmt'] });
            }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Total Add-ons</p>
          <p className="text-2xl font-bold">{addons.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-emerald-500">{addons.filter((a: any) => a.is_active).length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Total Price Pool</p>
          <p className="text-2xl font-bold">${totalRevenuePotential.toFixed(2)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Linked Experiences</TableHead>
                <TableHead>Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : addons.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No add-ons created yet</TableCell></TableRow>
              ) : (
                addons.map((a: any) => {
                  const linkedCount = links.filter((l: any) => l.addon_id === a.id).length;
                  return (
                    <TableRow key={a.id} className={!a.is_active ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{a.description || '-'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{a.category || 'General'}</Badge></TableCell>
                      <TableCell className="font-semibold">${Number(a.price).toFixed(2)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Link2 className="h-3 w-3" /> {linkedCount}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch checked={a.is_active} onCheckedChange={(v) => toggleMutation.mutate({ id: a.id, is_active: v })} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(a.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AddonForm({ onSave }: { onSave: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', price: 0, category: '', type: 'addon' });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Need a category_id - get or create a default category
      let categoryId: string;
      const { data: existingCat } = await supabase
        .from('experience_addon_categories')
        .select('id')
        .eq('name', form.category || 'General')
        .single();
      
      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        const { data: newCat, error: catErr } = await supabase
          .from('experience_addon_categories')
          .insert({ name: form.category || 'General' })
          .select('id')
          .single();
        if (catErr) throw catErr;
        categoryId = newCat!.id;
      }

      const { error } = await supabase.from('experience_addons').insert({
        name: form.name,
        description: form.description || null,
        price: form.price,
        category_id: categoryId,
        type: form.type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Add-on created');
      onSave();
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Name</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. VIP Photo Package" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Price ($)</Label>
          <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })} />
        </div>
        <div>
          <Label>Category</Label>
          <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Photography" />
        </div>
      </div>
      <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
        Create Add-on
      </Button>
    </div>
  );
}
