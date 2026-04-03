import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, patchTopTierData, postTopTierData, deleteTopTierData, logPenthouseAction } from '@/lib/toptierApi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ShoppingBag, Car, Plane, Sparkles, ToggleLeft, ToggleRight, Edit, Trash2, Plus, Loader2 } from 'lucide-react';

type FormMode = 'create' | 'edit';

export default function PenthouseMarketplace() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [formTable, setFormTable] = useState('tt_experiences');
  const [formData, setFormData] = useState<any>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ table: string; id: string; title: string } | null>(null);

  const { data: experiences = [] } = useQuery({
    queryKey: ['ph-experiences'],
    queryFn: () => fetchTopTierData('tt_experiences', { select: '*', order: 'created_at.desc' }),
  });

  const { data: jets = [] } = useQuery({
    queryKey: ['ph-jets'],
    queryFn: () => fetchTopTierData('tt_private_jets', { select: '*', order: 'created_at.desc' }),
  });

  const { data: charters = [] } = useQuery({
    queryKey: ['ph-charters'],
    queryFn: () => fetchTopTierData('tt_charter_requests', { select: '*', order: 'created_at.desc' }),
  });

  const getActorId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || 'unknown';
  };

  const toggleStatus = useMutation({
    mutationFn: async ({ table, id, currentStatus }: { table: string; id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const result = await patchTopTierData(table, { id: `eq.${id}` }, { status: newStatus, updated_at: new Date().toISOString() });
      const actorId = await getActorId();
      await logPenthouseAction({ action: 'toggle_status', target_type: table, target_id: id, actor_user_id: actorId, before: { status: currentStatus }, after: { status: newStatus } });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-experiences'] });
      queryClient.invalidateQueries({ queryKey: ['ph-jets'] });
      toast.success('Status toggled');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ table, data, mode, id }: { table: string; data: any; mode: FormMode; id?: string }) => {
      const actorId = await getActorId();
      if (mode === 'create') {
        const result = await postTopTierData(table, data);
        await logPenthouseAction({ action: 'create_listing', target_type: table, actor_user_id: actorId, after: data });
        return result;
      } else {
        const result = await patchTopTierData(table, { id: `eq.${id}` }, { ...data, updated_at: new Date().toISOString() });
        await logPenthouseAction({ action: 'edit_listing', target_type: table, target_id: id, actor_user_id: actorId, after: data });
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-experiences'] });
      queryClient.invalidateQueries({ queryKey: ['ph-jets'] });
      setFormOpen(false);
      toast.success(formMode === 'create' ? 'Created' : 'Updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      await deleteTopTierData(table, { id: `eq.${id}` });
      const actorId = await getActorId();
      await logPenthouseAction({ action: 'delete_listing', target_type: table, target_id: id, actor_user_id: actorId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-experiences'] });
      queryClient.invalidateQueries({ queryKey: ['ph-jets'] });
      setDeleteConfirm(null);
      toast.success('Deleted');
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = (table: string) => {
    setFormTable(table);
    setFormMode('create');
    setFormData({});
    setFormOpen(true);
  };

  const openEdit = (table: string, item: any) => {
    setFormTable(table);
    setFormMode('edit');
    setFormData(item);
    setFormOpen(true);
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-500/20 text-emerald-400',
      available: 'bg-emerald-500/20 text-emerald-400',
      inactive: 'bg-white/10 text-white/40',
      pending: 'bg-amber-500/20 text-amber-400',
      approved: 'bg-emerald-500/20 text-emerald-400',
      rejected: 'bg-red-500/20 text-red-400',
    };
    return <Badge className={`text-[10px] ${colors[s] || 'bg-white/10 text-white/40'}`}>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Marketplace Control</h1>
          <p className="text-white/40 text-sm mt-1">Full CRUD control — Dynasty OS writes, public site reads</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Experiences', count: experiences.length, icon: Sparkles },
          { label: 'Private Jets', count: jets.length, icon: Plane },
          { label: 'Charter Requests', count: charters.length, icon: Car },
        ].map((s, i) => (
          <Card key={i} className="bg-[#111] border-white/5">
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40">{s.label}</p>
                <p className="text-2xl font-bold text-[#C9A84C] mt-1">{s.count}</p>
              </div>
              <s.icon className="h-5 w-5 text-[#C9A84C]/50" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="experiences" className="space-y-4">
        <TabsList className="bg-[#111] border border-white/5">
          <TabsTrigger value="experiences" className="data-[state=active]:bg-[#C9A84C]/10 data-[state=active]:text-[#C9A84C]">Experiences</TabsTrigger>
          <TabsTrigger value="jets" className="data-[state=active]:bg-[#C9A84C]/10 data-[state=active]:text-[#C9A84C]">Private Jets</TabsTrigger>
          <TabsTrigger value="charters" className="data-[state=active]:bg-[#C9A84C]/10 data-[state=active]:text-[#C9A84C]">Charter Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="experiences">
          <div className="flex justify-end mb-3">
            <Button onClick={() => openCreate('tt_experiences')} className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black text-xs h-8">
              <Plus className="h-3 w-3 mr-1" /> New Experience
            </Button>
          </div>
          <Card className="bg-[#111] border-white/5">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-white/40">Title</TableHead>
                    <TableHead className="text-white/40">Category</TableHead>
                    <TableHead className="text-white/40">Price</TableHead>
                    <TableHead className="text-white/40">Status</TableHead>
                    <TableHead className="text-white/40">Partner</TableHead>
                    <TableHead className="text-white/40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {experiences.map((e: any) => (
                    <TableRow key={e.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="text-white/80 text-sm">{e.title}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] border-white/10 text-white/50">{e.category}</Badge></TableCell>
                      <TableCell className="text-[#C9A84C] text-sm">{e.price ? `$${Number(e.price).toLocaleString()}` : 'Free'}</TableCell>
                      <TableCell>{statusBadge(e.status || 'active')}</TableCell>
                      <TableCell className="text-white/50 text-sm">{e.partner_name || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-white/40" onClick={() => toggleStatus.mutate({ table: 'tt_experiences', id: e.id, currentStatus: e.status || 'active' })}>
                            {e.status === 'active' ? <ToggleRight className="h-3 w-3 text-emerald-400" /> : <ToggleLeft className="h-3 w-3" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400" onClick={() => openEdit('tt_experiences', e)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => setDeleteConfirm({ table: 'tt_experiences', id: e.id, title: e.title })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {experiences.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-white/30 py-8">No experiences found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jets">
          <div className="flex justify-end mb-3">
            <Button onClick={() => openCreate('tt_private_jets')} className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black text-xs h-8">
              <Plus className="h-3 w-3 mr-1" /> New Jet
            </Button>
          </div>
          <Card className="bg-[#111] border-white/5">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-white/40">Aircraft</TableHead>
                    <TableHead className="text-white/40">Status</TableHead>
                    <TableHead className="text-white/40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jets.map((j: any) => (
                    <TableRow key={j.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="text-white/80 text-sm">{j.aircraft_type || j.id}</TableCell>
                      <TableCell>{statusBadge(j.status || 'available')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400" onClick={() => openEdit('tt_private_jets', j)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => setDeleteConfirm({ table: 'tt_private_jets', id: j.id, title: j.aircraft_type || j.id })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {jets.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-white/30 py-8">No jets found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charters">
          <Card className="bg-[#111] border-white/5">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-white/40">Customer</TableHead>
                    <TableHead className="text-white/40">Route</TableHead>
                    <TableHead className="text-white/40">Date</TableHead>
                    <TableHead className="text-white/40">Passengers</TableHead>
                    <TableHead className="text-white/40">Price</TableHead>
                    <TableHead className="text-white/40">Status</TableHead>
                    <TableHead className="text-white/40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charters.map((c: any) => (
                    <TableRow key={c.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="text-white/80 text-sm">{c.customer_name}</TableCell>
                      <TableCell className="text-white/60 text-sm">{c.departure_location} → {c.arrival_location}</TableCell>
                      <TableCell className="text-white/60 text-sm">{c.departure_date}</TableCell>
                      <TableCell className="text-white/60 text-sm">{c.passenger_count}</TableCell>
                      <TableCell className="text-[#C9A84C] text-sm">{c.final_price || c.quoted_price ? `$${Number(c.final_price || c.quoted_price).toLocaleString()}` : '—'}</TableCell>
                      <TableCell>{statusBadge(c.status || 'pending')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400" onClick={() => openEdit('tt_charter_requests', c)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {charters.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-white/30 py-8">No charter requests</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#C9A84C]">
              {formMode === 'create' ? 'Create New' : 'Edit'} — {formTable.replace('tt_', '').replace(/_/g, ' ')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {formTable === 'tt_experiences' && (
              <>
                <div><Label className="text-white/50 text-xs">Title</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
                <div><Label className="text-white/50 text-xs">Category</Label>
                  <Select value={formData.category || ''} onValueChange={v => setFormData({ ...formData, category: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {['luxury_dining', 'yacht', 'villa', 'spa', 'adventure', 'nightlife', 'private_event', 'concierge'].map(c => (
                        <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-white/50 text-xs">Price</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: e.target.value })} /></div>
                <div><Label className="text-white/50 text-xs">Description</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
                <div><Label className="text-white/50 text-xs">Status</Label>
                  <Select value={formData.status || 'active'} onValueChange={v => setFormData({ ...formData, status: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {formTable === 'tt_private_jets' && (
              <>
                <div><Label className="text-white/50 text-xs">Aircraft Type</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.aircraft_type || ''} onChange={e => setFormData({ ...formData, aircraft_type: e.target.value })} /></div>
                <div><Label className="text-white/50 text-xs">Status</Label>
                  <Select value={formData.status || 'available'} onValueChange={v => setFormData({ ...formData, status: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {formTable === 'tt_charter_requests' && (
              <>
                <div><Label className="text-white/50 text-xs">Status</Label>
                  <Select value={formData.status || 'pending'} onValueChange={v => setFormData({ ...formData, status: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-white/50 text-xs">Quoted Price</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.quoted_price || ''} onChange={e => setFormData({ ...formData, quoted_price: e.target.value })} /></div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} className="border-white/10 text-white/50">Cancel</Button>
            <Button
              onClick={() => {
                const { id, created_at, updated_at, ...cleanData } = formData;
                saveMutation.mutate({ table: formTable, data: cleanData, mode: formMode, id: formData.id });
              }}
              disabled={saveMutation.isPending}
              className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black"
            >
              {saveMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {formMode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-[#111] border-red-500/20 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400">Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-white/60 text-sm">Are you sure you want to delete <strong className="text-white">{deleteConfirm?.title}</strong>? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-white/10 text-white/50">Cancel</Button>
            <Button
              onClick={() => deleteConfirm && deleteMutation.mutate({ table: deleteConfirm.table, id: deleteConfirm.id })}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}