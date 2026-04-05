import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Moon, Users, CheckCircle, XCircle, MessageSquare, DollarSign,
  Phone, Mail, MapPin, Calendar, UserPlus, Building2, Inbox
} from 'lucide-react';

/* ─── types ─── */
type NightlifeRequest = {
  id: string; user_name: string; phone: string | null; email: string | null;
  city: string; venue: string | null; party_size: number; date: string;
  request_details: string | null; status: string;
  assigned_promoter_id: string | null; counter_offer_details: string | null;
  counter_offer_price: number | null; promoter_notes: string | null;
  created_at: string;
};

type NightlifePartner = {
  id: string; name: string; city: string; contact: string | null;
  email: string | null; phone: string | null; role: string;
  bio: string | null; is_active: boolean; created_at: string;
  venues: string[] | null;
};

/* ─── status helpers ─── */
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Inbox },
  accepted: { label: 'Accepted', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  declined: { label: 'Declined', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  counter_offer: { label: 'Counter Offer', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: MessageSquare },
};

export default function PenthouseNightlife() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('requests');
  const [respondModal, setRespondModal] = useState<NightlifeRequest | null>(null);
  const [responseAction, setResponseAction] = useState<'accepted' | 'declined' | 'counter_offer'>('accepted');
  const [counterPrice, setCounterPrice] = useState('');
  const [counterDetails, setCounterDetails] = useState('');
  const [promoterNotes, setPromoterNotes] = useState('');
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  const [newPartner, setNewPartner] = useState({ name: '', city: '', phone: '', email: '', role: 'promoter', bio: '' });
  const [statusFilter, setStatusFilter] = useState('all');

  /* ─── queries ─── */
  const { data: requests = [] } = useQuery({
    queryKey: ['nightlife-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nightlife_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as NightlifeRequest[];
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['nightlife-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nightlife_partners')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as NightlifePartner[];
    },
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['nightlife-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nightlife_bookings')
        .select('*, nightlife_requests(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  /* ─── mutations ─── */
  const respondMutation = useMutation({
    mutationFn: async () => {
      if (!respondModal) return;
      const updates: any = {
        status: responseAction,
        promoter_notes: promoterNotes || null,
        updated_at: new Date().toISOString(),
      };
      if (responseAction === 'counter_offer') {
        updates.counter_offer_price = counterPrice ? parseFloat(counterPrice) : null;
        updates.counter_offer_details = counterDetails || null;
      }
      const { error } = await supabase
        .from('nightlife_requests')
        .update(updates)
        .eq('id', respondModal.id);
      if (error) throw error;

      // If accepted, auto-create a booking
      if (responseAction === 'accepted') {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('nightlife_bookings').insert({
          request_id: respondModal.id,
          confirmed_by: user?.id,
          status: 'confirmed',
        });
      }

      // Send notification (SMS + admin alert)
      try {
        await supabase.functions.invoke('nightlife-notify', {
          body: {
            request_id: respondModal.id,
            action: responseAction,
            counter_price: counterPrice || null,
            counter_details: counterDetails || null,
          },
        });
      } catch (e) {
        console.error('Notification failed:', e);
      }
    },
    onSuccess: () => {
      toast.success(`Request ${responseAction === 'counter_offer' ? 'counter-offered' : responseAction}!`);
      qc.invalidateQueries({ queryKey: ['nightlife-requests'] });
      qc.invalidateQueries({ queryKey: ['nightlife-bookings'] });
      setRespondModal(null);
      resetResponseForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addPartnerMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('nightlife_partners').insert({
        name: newPartner.name,
        city: newPartner.city,
        phone: newPartner.phone || null,
        email: newPartner.email || null,
        role: newPartner.role,
        bio: newPartner.bio || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Partner added!');
      qc.invalidateQueries({ queryKey: ['nightlife-partners'] });
      setAddPartnerOpen(false);
      setNewPartner({ name: '', city: '', phone: '', email: '', role: 'promoter', bio: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ requestId, promoterId }: { requestId: string; promoterId: string }) => {
      const { error } = await supabase
        .from('nightlife_requests')
        .update({ assigned_promoter_id: promoterId, updated_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Promoter assigned!');
      qc.invalidateQueries({ queryKey: ['nightlife-requests'] });
    },
  });

  function resetResponseForm() {
    setResponseAction('accepted');
    setCounterPrice('');
    setCounterDetails('');
    setPromoterNotes('');
  }

  const filteredRequests = statusFilter === 'all'
    ? requests
    : requests.filter(r => r.status === statusFilter);

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    accepted: requests.filter(r => r.status === 'accepted').length,
    bookings: bookings.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#C9A84C] flex items-center gap-2">
            <Moon className="h-6 w-6" /> VIP Nightlife Hub
          </h1>
          <p className="text-white/40 text-sm mt-1">Manage VIP requests, promoters, and bookings</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', value: stats.total, icon: Inbox, color: 'text-white' },
          { label: 'Pending', value: stats.pending, icon: Moon, color: 'text-amber-400' },
          { label: 'Accepted', value: stats.accepted, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Bookings', value: stats.bookings, icon: Calendar, color: 'text-blue-400' },
        ].map(s => (
          <Card key={s.label} className="bg-white/[0.03] border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-white/40">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="requests" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">
            <Inbox className="h-4 w-4 mr-1" /> Requests ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="partners" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">
            <Users className="h-4 w-4 mr-1" /> Partners ({partners.length})
          </TabsTrigger>
          <TabsTrigger value="bookings" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">
            <Calendar className="h-4 w-4 mr-1" /> Bookings ({bookings.length})
          </TabsTrigger>
        </TabsList>

        {/* ── REQUESTS TAB ── */}
        <TabsContent value="requests" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="counter_offer">Counter Offer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredRequests.length === 0 ? (
            <Card className="bg-white/[0.03] border-white/10">
              <CardContent className="p-8 text-center text-white/30">
                <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No requests found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map(req => {
                const sc = statusConfig[req.status] || statusConfig.pending;
                const assignedPartner = partners.find(p => p.id === req.assigned_promoter_id);
                return (
                  <Card key={req.id} className="bg-white/[0.03] border-white/10 hover:border-[#C9A84C]/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-semibold text-lg">{req.user_name}</span>
                            <Badge className={`${sc.color} text-xs`}>{sc.label}</Badge>
                            <span className="text-white/20 text-xs">{format(new Date(req.created_at), 'MMM dd, yyyy')}</span>
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/50">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {req.city}{req.venue ? ` · ${req.venue}` : ''}</span>
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Party of {req.party_size}</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(req.date), 'MMM dd, yyyy')}</span>
                          </div>

                          {req.phone && <span className="flex items-center gap-1 text-sm text-white/40"><Phone className="h-3 w-3" /> {req.phone}</span>}
                          {req.email && <span className="flex items-center gap-1 text-sm text-white/40"><Mail className="h-3 w-3" /> {req.email}</span>}

                          {req.request_details && (
                            <p className="text-sm text-white/60 bg-white/5 rounded p-2 mt-1">{req.request_details}</p>
                          )}

                          {req.status === 'counter_offer' && req.counter_offer_price && (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 mt-1">
                              <p className="text-blue-400 text-sm font-medium flex items-center gap-1">
                                <DollarSign className="h-3 w-3" /> Counter: ${req.counter_offer_price}
                              </p>
                              {req.counter_offer_details && <p className="text-blue-300/60 text-xs mt-1">{req.counter_offer_details}</p>}
                            </div>
                          )}

                          {assignedPartner && (
                            <p className="text-xs text-[#C9A84C]/70">Assigned to: {assignedPartner.name}</p>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 min-w-[160px]">
                          {req.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => { setRespondModal(req); setResponseAction('accepted'); }}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" /> Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                onClick={() => { setRespondModal(req); setResponseAction('counter_offer'); }}
                              >
                                <MessageSquare className="h-3 w-3 mr-1" /> Counter
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                onClick={() => { setRespondModal(req); setResponseAction('declined'); }}
                              >
                                <XCircle className="h-3 w-3 mr-1" /> Decline
                              </Button>
                            </>
                          )}
                          {/* Assign promoter */}
                          <Select
                            value={req.assigned_promoter_id || ''}
                            onValueChange={(v) => assignMutation.mutate({ requestId: req.id, promoterId: v })}
                          >
                            <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-8">
                              <SelectValue placeholder="Assign promoter" />
                            </SelectTrigger>
                            <SelectContent>
                              {partners.filter(p => p.is_active).map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name} ({p.city})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── PARTNERS TAB ── */}
        <TabsContent value="partners" className="space-y-4">
          <div className="flex justify-end">
            <Button
              className="bg-[#C9A84C] hover:bg-[#B8973E] text-black"
              onClick={() => setAddPartnerOpen(true)}
            >
              <UserPlus className="h-4 w-4 mr-1" /> Add Partner
            </Button>
          </div>

          {partners.length === 0 ? (
            <Card className="bg-white/[0.03] border-white/10">
              <CardContent className="p-8 text-center text-white/30">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No partners yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partners.map(p => (
                <Card key={p.id} className="bg-white/[0.03] border-white/10">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-[#C9A84C]" />
                        <span className="text-white font-semibold">{p.name}</span>
                      </div>
                      <Badge className={p.is_active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/50">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.city}</span>
                      <Badge variant="outline" className="text-[10px] border-white/20 text-white/40">{p.role}</Badge>
                    </div>
                    {p.phone && <span className="flex items-center gap-1 text-xs text-white/40"><Phone className="h-3 w-3" /> {p.phone}</span>}
                    {p.email && <span className="flex items-center gap-1 text-xs text-white/40"><Mail className="h-3 w-3" /> {p.email}</span>}
                    {p.bio && <p className="text-xs text-white/30 mt-1">{p.bio}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── BOOKINGS TAB ── */}
        <TabsContent value="bookings" className="space-y-4">
          {bookings.length === 0 ? (
            <Card className="bg-white/[0.03] border-white/10">
              <CardContent className="p-8 text-center text-white/30">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No bookings yet — accept a request to create one</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {bookings.map((b: any) => (
                <Card key={b.id} className="bg-white/[0.03] border-white/10">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{b.nightlife_requests?.user_name || 'Unknown'}</p>
                      <p className="text-white/40 text-sm">
                        {b.nightlife_requests?.city} · {b.nightlife_requests?.venue || 'TBD'} · Party of {b.nightlife_requests?.party_size}
                      </p>
                      <p className="text-white/30 text-xs mt-1">{format(new Date(b.created_at), 'MMM dd, yyyy')}</p>
                    </div>
                    <div className="text-right">
                      {b.final_price && <p className="text-[#C9A84C] font-bold">${b.final_price}</p>}
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">{b.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── RESPOND MODAL ── */}
      <Dialog open={!!respondModal} onOpenChange={(o) => { if (!o) { setRespondModal(null); resetResponseForm(); } }}>
        <DialogContent className="bg-[#0D0D0D] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#C9A84C]">
              {responseAction === 'accepted' ? '✅ Accept Request' : responseAction === 'declined' ? '❌ Decline Request' : '💬 Counter Offer'}
            </DialogTitle>
          </DialogHeader>
          {respondModal && (
            <div className="space-y-4">
              <div className="bg-white/5 rounded p-3 text-sm space-y-1">
                <p className="text-white font-medium">{respondModal.user_name}</p>
                <p className="text-white/50">{respondModal.city} · {respondModal.venue || 'TBD'} · Party of {respondModal.party_size}</p>
                <p className="text-white/50">{format(new Date(respondModal.date), 'MMMM dd, yyyy')}</p>
              </div>

              {responseAction === 'counter_offer' && (
                <>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Counter Price ($)</label>
                    <Input
                      type="number"
                      value={counterPrice}
                      onChange={e => setCounterPrice(e.target.value)}
                      className="bg-white/5 border-white/10 text-white"
                      placeholder="e.g. 2500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Counter Details</label>
                    <Textarea
                      value={counterDetails}
                      onChange={e => setCounterDetails(e.target.value)}
                      className="bg-white/5 border-white/10 text-white"
                      placeholder="What you're offering instead..."
                      rows={3}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs text-white/50 mb-1 block">Notes (optional)</label>
                <Textarea
                  value={promoterNotes}
                  onChange={e => setPromoterNotes(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Internal notes..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" className="text-white/50" onClick={() => { setRespondModal(null); resetResponseForm(); }}>Cancel</Button>
            <Button
              className={
                responseAction === 'accepted' ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : responseAction === 'declined' ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
              onClick={() => respondMutation.mutate()}
              disabled={respondMutation.isPending}
            >
              {respondMutation.isPending ? 'Saving...' : responseAction === 'accepted' ? 'Accept' : responseAction === 'declined' ? 'Decline' : 'Send Counter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ADD PARTNER MODAL ── */}
      <Dialog open={addPartnerOpen} onOpenChange={setAddPartnerOpen}>
        <DialogContent className="bg-[#0D0D0D] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#C9A84C]">Add Nightlife Partner</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={newPartner.name} onChange={e => setNewPartner(p => ({ ...p, name: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            <Input placeholder="City" value={newPartner.city} onChange={e => setNewPartner(p => ({ ...p, city: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            <Input placeholder="Phone" value={newPartner.phone} onChange={e => setNewPartner(p => ({ ...p, phone: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            <Input placeholder="Email" value={newPartner.email} onChange={e => setNewPartner(p => ({ ...p, email: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            <Select value={newPartner.role} onValueChange={v => setNewPartner(p => ({ ...p, role: v }))}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="promoter">Promoter</SelectItem>
                <SelectItem value="club">Club</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Bio (optional)" value={newPartner.bio} onChange={e => setNewPartner(p => ({ ...p, bio: e.target.value }))} className="bg-white/5 border-white/10 text-white" rows={2} />
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-white/50" onClick={() => setAddPartnerOpen(false)}>Cancel</Button>
            <Button className="bg-[#C9A84C] hover:bg-[#B8973E] text-black" onClick={() => addPartnerMutation.mutate()} disabled={!newPartner.name || !newPartner.city || addPartnerMutation.isPending}>
              {addPartnerMutation.isPending ? 'Saving...' : 'Add Partner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
