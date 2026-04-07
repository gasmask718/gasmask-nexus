import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Building2, MapPin, Users, DollarSign, Eye, Pause, Trash2, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useEventSpaces, useEventSpacePartners, useUpsertEventSpace, useDeleteEventSpace, useUpsertPartner, useEventSpaceStats } from '@/hooks/useEventSpaces';

const CATEGORIES = ['rooftop', 'hall', 'lounge', 'outdoor', 'ballroom', 'garden', 'warehouse'];
const FEATURES = ['bar', 'kitchen', 'stage', 'parking', 'outdoor_area', 'sound_system', 'lighting', 'catering', 'wifi', 'av_equipment'];

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  live: 'bg-emerald-500/10 text-emerald-600',
  paused: 'bg-amber-500/10 text-amber-600',
  pending: 'bg-amber-500/10 text-amber-600',
  approved: 'bg-emerald-500/10 text-emerald-600',
  suspended: 'bg-red-500/10 text-red-600',
};

export default function UTEventSpaces() {
  const { data: spaces = [], isLoading } = useEventSpaces();
  const { data: partners = [] } = useEventSpacePartners();
  const stats = useEventSpaceStats();
  const upsertSpace = useUpsertEventSpace();
  const deleteSpace = useDeleteEventSpace();
  const upsertPartner = useUpsertPartner();

  const [spaceDialog, setSpaceDialog] = useState(false);
  const [partnerDialog, setPartnerDialog] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [partnerForm, setPartnerForm] = useState<Record<string, any>>({});

  const u = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const up = (k: string, v: any) => setPartnerForm(p => ({ ...p, [k]: v }));

  const saveSpace = () => {
    upsertSpace.mutate(form, { onSuccess: () => { setSpaceDialog(false); setForm({}); } });
  };

  const savePartner = () => {
    upsertPartner.mutate(partnerForm, { onSuccess: () => { setPartnerDialog(false); setPartnerForm({}); } });
  };

  const s = stats.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🏛️ Event Spaces Control</h1>
          <p className="text-muted-foreground text-sm">Manage nationwide venue inventory, partners & availability</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Spaces', value: s?.totalSpaces ?? '—', icon: Building2 },
          { label: 'Live', value: s?.liveSpaces ?? '—', icon: Eye },
          { label: 'Avg Price', value: s?.avgPrice ? `$${s.avgPrice}` : '—', icon: DollarSign },
          { label: 'Partners', value: s?.totalPartners ?? '—', icon: Users },
          { label: 'Pending', value: s?.pendingPartners ?? '—', icon: Clock },
        ].map(st => (
          <Card key={st.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <st.icon className="h-3.5 w-3.5" />
                {st.label}
              </div>
              <p className="text-xl font-bold">{st.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="spaces">
        <TabsList>
          <TabsTrigger value="spaces">Spaces ({spaces.length})</TabsTrigger>
          <TabsTrigger value="partners">Partners ({partners.length})</TabsTrigger>
        </TabsList>

        {/* SPACES TAB */}
        <TabsContent value="spaces" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={spaceDialog} onOpenChange={setSpaceDialog}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setForm({})}><Plus className="h-4 w-4 mr-1" /> Add Space</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{form.id ? 'Edit' : 'Add'} Event Space</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={form.name || ''} onChange={e => u('name', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input value={form.city || ''} onChange={e => u('city', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input value={form.state || ''} onChange={e => u('state', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={form.category || 'hall'} onValueChange={v => u('category', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Capacity</Label>
                      <Input type="number" value={form.capacity || ''} onChange={e => u('capacity', parseInt(e.target.value))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Base Price ($)</Label>
                      <Input type="number" value={form.base_price || ''} onChange={e => u('base_price', parseFloat(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Commission %</Label>
                      <Input type="number" value={form.commission_rate || 15} onChange={e => u('commission_rate', parseFloat(e.target.value))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Partner</Label>
                    <Select value={form.partner_id || ''} onValueChange={v => u('partner_id', v)}>
                      <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
                      <SelectContent>
                        {partners.filter(p => p.status === 'approved').map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status || 'draft'} onValueChange={v => u('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="live">Live</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea rows={3} value={form.description || ''} onChange={e => u('description', e.target.value)} />
                  </div>
                  <Button onClick={saveSpace} disabled={upsertSpace.isPending} className="w-full">
                    {form.id ? 'Update' : 'Create'} Space
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : spaces.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No spaces yet</TableCell></TableRow>
                ) : spaces.map((sp: any) => (
                  <TableRow key={sp.id}>
                    <TableCell className="font-medium">{sp.name}</TableCell>
                    <TableCell className="text-sm">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{sp.city}, {sp.state}</span>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{sp.category}</Badge></TableCell>
                    <TableCell>{sp.capacity ?? '—'}</TableCell>
                    <TableCell>${Number(sp.base_price || 0).toLocaleString()}</TableCell>
                    <TableCell>{sp.commission_rate}%</TableCell>
                    <TableCell><Badge className={`text-[10px] ${STATUS_STYLE[sp.status]}`}>{sp.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setForm(sp); setSpaceDialog(true); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {sp.status === 'draft' && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => upsertSpace.mutate({ id: sp.id, status: 'live' })}>
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                          </Button>
                        )}
                        {sp.status === 'live' && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => upsertSpace.mutate({ id: sp.id, status: 'paused' })}>
                            <Pause className="h-3.5 w-3.5 text-amber-500" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteSpace.mutate(sp.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* PARTNERS TAB */}
        <TabsContent value="partners" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={partnerDialog} onOpenChange={setPartnerDialog}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setPartnerForm({})}><Plus className="h-4 w-4 mr-1" /> Add Partner</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{partnerForm.id ? 'Edit' : 'Add'} Venue Partner</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Business Name</Label><Input value={partnerForm.name || ''} onChange={e => up('name', e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Contact Name</Label><Input value={partnerForm.contact_name || ''} onChange={e => up('contact_name', e.target.value)} /></div>
                    <div className="space-y-2"><Label>Contact Email</Label><Input value={partnerForm.contact_email || ''} onChange={e => up('contact_email', e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Phone</Label><Input value={partnerForm.contact_phone || ''} onChange={e => up('contact_phone', e.target.value)} /></div>
                    <div className="space-y-2"><Label>Website</Label><Input value={partnerForm.website || ''} onChange={e => up('website', e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>City</Label><Input value={partnerForm.city || ''} onChange={e => up('city', e.target.value)} /></div>
                    <div className="space-y-2"><Label>State</Label><Input value={partnerForm.state || ''} onChange={e => up('state', e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Commission %</Label>
                      <Input type="number" value={partnerForm.commission_rate || 15} onChange={e => up('commission_rate', parseFloat(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={partnerForm.status || 'pending'} onValueChange={v => up('status', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Notes</Label><Textarea rows={2} value={partnerForm.notes || ''} onChange={e => up('notes', e.target.value)} /></div>
                  <Button onClick={savePartner} disabled={upsertPartner.isPending} className="w-full">
                    {partnerForm.id ? 'Update' : 'Create'} Partner
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No partners yet</TableCell></TableRow>
                ) : partners.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm">{p.contact_name}<br /><span className="text-muted-foreground">{p.contact_email}</span></TableCell>
                    <TableCell className="text-sm">{p.city}, {p.state}</TableCell>
                    <TableCell>{p.commission_rate}%</TableCell>
                    <TableCell><Badge className={`text-[10px] ${STATUS_STYLE[p.status]}`}>{p.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setPartnerForm(p); setPartnerDialog(true); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {p.status === 'pending' && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => upsertPartner.mutate({ id: p.id, status: 'approved' })}>
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                          </Button>
                        )}
                        {p.status === 'approved' && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => upsertPartner.mutate({ id: p.id, status: 'suspended' })}>
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
