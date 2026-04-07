import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { RefreshCw, Plus, Pencil, Sparkles, Search, ExternalLink, DollarSign, Star, MapPin } from 'lucide-react';

export default function ThingsToDoExperiences() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [syncCity, setSyncCity] = useState('New York');

  const { data: experiences = [], isLoading } = useQuery({
    queryKey: ['experiences_master'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('experiences_master')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-experiences`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ city: syncCity, limit: 50 }),
        }
      );
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.synced} experiences from ${syncCity}`);
      queryClient.invalidateQueries({ queryKey: ['experiences_master'] });
    },
    onError: () => toast.error('Failed to sync experiences'),
  });

  const updateMutation = useMutation({
    mutationFn: async (exp: any) => {
      const { error } = await supabase
        .from('experiences_master')
        .update({
          title: exp.title,
          description: exp.description,
          price: exp.price,
          markup_pct: exp.markup_pct,
          tags: exp.tags,
          booking_type: exp.booking_type,
          external_url: exp.external_url,
          is_active: exp.is_active,
        })
        .eq('id', exp.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Experience updated');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['experiences_master'] });
    },
  });

  const filtered = experiences.filter(
    (e: any) =>
      e.title?.toLowerCase().includes(search.toLowerCase()) ||
      e.city?.toLowerCase().includes(search.toLowerCase()) ||
      e.category?.toLowerCase().includes(search.toLowerCase())
  );

  const totalActive = experiences.filter((e: any) => e.is_active).length;
  const avgPrice = experiences.length
    ? (experiences.reduce((s: number, e: any) => s + Number(e.display_price || 0), 0) / experiences.length).toFixed(2)
    : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-500" />
            Things To Do — Experiences
          </h1>
          <p className="text-muted-foreground text-sm">Manage marketplace experiences, pricing, and API sync</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="City to sync..."
            value={syncCity}
            onChange={(e) => setSyncCity(e.target.value)}
            className="w-40"
          />
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync Experiences
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Experiences</p>
            <p className="text-2xl font-bold">{experiences.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-emerald-500">{totalActive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Avg Display Price</p>
            <p className="text-2xl font-bold">${avgPrice}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Categories</p>
            <p className="text-2xl font-bold">
              {new Set(experiences.map((e: any) => e.category)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title, city, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Experience</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead>Markup</TableHead>
                <TableHead>Display Price</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No experiences found. Sync from Viator to get started.</TableCell></TableRow>
              ) : (
                filtered.map((exp: any) => (
                  <TableRow key={exp.id}>
                    <TableCell className="max-w-[200px]">
                      <p className="font-medium text-sm truncate">{exp.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{exp.supplier_name}</p>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" /> {exp.city}
                      </span>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{exp.category}</Badge></TableCell>
                    <TableCell>${Number(exp.price).toFixed(2)}</TableCell>
                    <TableCell>{exp.markup_pct}%</TableCell>
                    <TableCell className="font-semibold text-emerald-600">${Number(exp.display_price).toFixed(2)}</TableCell>
                    <TableCell>
                      {exp.rating && (
                        <span className="flex items-center gap-1 text-sm">
                          <Star className="h-3 w-3 text-amber-500" /> {Number(exp.rating).toFixed(1)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={exp.booking_type === 'internal' ? 'default' : 'secondary'} className="text-xs">
                        {exp.booking_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={exp.is_active ? 'default' : 'destructive'} className="text-xs">
                        {exp.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <EditExperienceDialog
                        experience={exp}
                        onSave={(updated: any) => updateMutation.mutate(updated)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function EditExperienceDialog({ experience, onSave }: { experience: any; onSave: (e: any) => void }) {
  const [form, setForm] = useState({ ...experience });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Experience</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Base Price ($)</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })} />
            </div>
            <div>
              <Label>Markup %</Label>
              <Input type="number" value={form.markup_pct} onChange={(e) => setForm({ ...form, markup_pct: parseFloat(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input
              value={(form.tags || []).join(', ')}
              onChange={(e) => setForm({ ...form, tags: e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Booking Type</Label>
              <Select value={form.booking_type} onValueChange={(v) => setForm({ ...form, booking_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.is_active ? 'active' : 'inactive'} onValueChange={(v) => setForm({ ...form, is_active: v === 'active' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>External URL</Label>
            <Input value={form.external_url || ''} onChange={(e) => setForm({ ...form, external_url: e.target.value })} />
          </div>
          <Button className="w-full" onClick={() => onSave(form)}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
