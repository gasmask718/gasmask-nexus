import { useState, useEffect } from 'react';
import { fetchTopTierData, postTopTierData, patchTopTierData, deleteTopTierData, logPenthouseAction } from '@/lib/toptierApi';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, Plus, CheckCircle, XCircle, Star, Clock, User, Camera, FileText, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface SecurityAgent {
  id: string;
  name: string;
  profile_image: string | null;
  bio: string | null;
  years_experience: number;
  specialties: string[];
  armed: boolean;
  hourly_rate: number;
  verified: boolean;
  independent_contractor: boolean;
  city: string | null;
  state: string | null;
  is_active: boolean;
  created_at: string;
}

interface Certification {
  id: string;
  agent_id: string;
  license_type: string;
  license_number: string | null;
  expiration_date: string | null;
  insurance_status: string;
  document_url: string | null;
  verified: boolean;
}

interface SecurityMedia {
  id: string;
  agent_id: string;
  type: string;
  url: string;
  caption: string | null;
}

interface SecurityBooking {
  id: string;
  agent_id: string | null;
  service_type: string;
  hours: number;
  number_of_agents: number;
  location: string | null;
  event_date: string | null;
  total_price: number;
  status: string;
  client_name: string | null;
  client_email: string | null;
  notes: string | null;
  created_at: string;
}

export default function PenthouseSecurity() {
  const [agents, setAgents] = useState<SecurityAgent[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [media, setMedia] = useState<SecurityMedia[]>([]);
  const [bookings, setBookings] = useState<SecurityBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('agents');

  // Agent form
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [editAgent, setEditAgent] = useState<SecurityAgent | null>(null);
  const [agentForm, setAgentForm] = useState({ name: '', bio: '', city: '', state: '', years_experience: '0', hourly_rate: '0', specialties: '', armed: false, profile_image: '' });

  // Cert form
  const [showCertModal, setShowCertModal] = useState(false);
  const [certForm, setCertForm] = useState({ agent_id: '', license_type: '', license_number: '', expiration_date: '', insurance_status: 'pending' });

  // Media form
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaForm, setMediaForm] = useState({ agent_id: '', type: 'image', url: '', caption: '' });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [a, c, m, b] = await Promise.all([
        fetchTopTierData<SecurityAgent>('security_agents', { order: 'created_at.desc' }),
        fetchTopTierData<Certification>('security_certifications'),
        fetchTopTierData<SecurityMedia>('security_media'),
        fetchTopTierData<SecurityBooking>('security_bookings', { order: 'created_at.desc' }),
      ]);
      setAgents(a); setCerts(c); setMedia(m); setBookings(b);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Realtime bookings
  useEffect(() => {
    const channel = supabase.channel('security-bookings-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_bookings' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const getActorId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || 'system';
  };

  // Agent CRUD
  const saveAgent = async () => {
    const actorId = await getActorId();
    const body = {
      name: agentForm.name,
      bio: agentForm.bio || null,
      city: agentForm.city || null,
      state: agentForm.state || null,
      years_experience: parseInt(agentForm.years_experience) || 0,
      hourly_rate: parseFloat(agentForm.hourly_rate) || 0,
      specialties: agentForm.specialties.split(',').map(s => s.trim()).filter(Boolean),
      armed: agentForm.armed,
      profile_image: agentForm.profile_image || null,
      independent_contractor: true,
    };
    try {
      if (editAgent) {
        await patchTopTierData('security_agents', { id: `eq.${editAgent.id}` }, body);
        await logPenthouseAction({ action: 'update_security_agent', target_type: 'security_agent', target_id: editAgent.id, actor_user_id: actorId, before: editAgent, after: body });
      } else {
        await postTopTierData('security_agents', body);
        await logPenthouseAction({ action: 'create_security_agent', target_type: 'security_agent', actor_user_id: actorId, after: body });
      }
      toast.success(editAgent ? 'Agent updated' : 'Agent created');
      setShowAgentModal(false); setEditAgent(null);
      setAgentForm({ name: '', bio: '', city: '', state: '', years_experience: '0', hourly_rate: '0', specialties: '', armed: false, profile_image: '' });
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleAgentVerified = async (agent: SecurityAgent) => {
    const actorId = await getActorId();
    await patchTopTierData('security_agents', { id: `eq.${agent.id}` }, { verified: !agent.verified });
    await logPenthouseAction({ action: 'toggle_agent_verified', target_type: 'security_agent', target_id: agent.id, actor_user_id: actorId, before: { verified: agent.verified }, after: { verified: !agent.verified } });
    toast.success(agent.verified ? 'Verification removed' : 'Agent verified');
    fetchAll();
  };

  const toggleAgentActive = async (agent: SecurityAgent) => {
    const actorId = await getActorId();
    await patchTopTierData('security_agents', { id: `eq.${agent.id}` }, { is_active: !agent.is_active });
    await logPenthouseAction({ action: 'toggle_agent_active', target_type: 'security_agent', target_id: agent.id, actor_user_id: actorId });
    toast.success(agent.is_active ? 'Agent deactivated' : 'Agent activated');
    fetchAll();
  };

  // Cert CRUD
  const saveCert = async () => {
    const actorId = await getActorId();
    await postTopTierData('security_certifications', {
      agent_id: certForm.agent_id,
      license_type: certForm.license_type,
      license_number: certForm.license_number || null,
      expiration_date: certForm.expiration_date || null,
      insurance_status: certForm.insurance_status,
    });
    await logPenthouseAction({ action: 'add_certification', target_type: 'security_certification', actor_user_id: actorId, after: certForm });
    toast.success('Certification added');
    setShowCertModal(false);
    setCertForm({ agent_id: '', license_type: '', license_number: '', expiration_date: '', insurance_status: 'pending' });
    fetchAll();
  };

  const toggleCertVerified = async (cert: Certification) => {
    const actorId = await getActorId();
    await patchTopTierData('security_certifications', { id: `eq.${cert.id}` }, { verified: !cert.verified });
    await logPenthouseAction({ action: 'toggle_cert_verified', target_type: 'security_certification', target_id: cert.id, actor_user_id: actorId });
    toast.success(cert.verified ? 'Cert unverified' : 'Cert verified');
    fetchAll();
  };

  // Media CRUD
  const saveMedia = async () => {
    const actorId = await getActorId();
    await postTopTierData('security_media', {
      agent_id: mediaForm.agent_id,
      type: mediaForm.type,
      url: mediaForm.url,
      caption: mediaForm.caption || null,
    });
    await logPenthouseAction({ action: 'add_security_media', target_type: 'security_media', actor_user_id: actorId, after: mediaForm });
    toast.success('Media added');
    setShowMediaModal(false);
    setMediaForm({ agent_id: '', type: 'image', url: '', caption: '' });
    fetchAll();
  };

  // Booking actions
  const updateBookingStatus = async (booking: SecurityBooking, status: string) => {
    const actorId = await getActorId();
    await patchTopTierData('security_bookings', { id: `eq.${booking.id}` }, { status });
    await logPenthouseAction({ action: `booking_${status}`, target_type: 'security_booking', target_id: booking.id, actor_user_id: actorId, before: { status: booking.status }, after: { status } });
    toast.success(`Booking ${status}`);
    fetchAll();
  };

  const openEditAgent = (agent: SecurityAgent) => {
    setEditAgent(agent);
    setAgentForm({
      name: agent.name, bio: agent.bio || '', city: agent.city || '', state: agent.state || '',
      years_experience: String(agent.years_experience), hourly_rate: String(agent.hourly_rate),
      specialties: agent.specialties?.join(', ') || '', armed: agent.armed, profile_image: agent.profile_image || '',
    });
    setShowAgentModal(true);
  };

  const getAgentName = (id: string | null) => agents.find(a => a.id === id)?.name || 'Unassigned';
  const statusColor = (s: string) => {
    if (s === 'confirmed' || s === 'accepted') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (s === 'pending') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (s === 'declined' || s === 'cancelled') return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-white/10 text-white/60 border-white/20';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#C9A84C] flex items-center gap-2"><Shield className="h-6 w-6" /> Security Marketplace</h1>
          <p className="text-sm text-white/40 mt-1">Independent contractor security professionals</p>
        </div>
        <div className="flex gap-2 text-xs text-white/30">
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">{agents.filter(a => a.verified).length} Verified</Badge>
          <Badge className="bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/30">{agents.length} Agents</Badge>
          <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">{bookings.filter(b => b.status === 'pending').length} Pending</Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="agents" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">
            <User className="h-4 w-4 mr-1" /> Agents ({agents.length})
          </TabsTrigger>
          <TabsTrigger value="certs" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">
            <FileText className="h-4 w-4 mr-1" /> Certifications ({certs.length})
          </TabsTrigger>
          <TabsTrigger value="media" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">
            <Camera className="h-4 w-4 mr-1" /> Media ({media.length})
          </TabsTrigger>
          <TabsTrigger value="bookings" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">
            <Calendar className="h-4 w-4 mr-1" /> Bookings ({bookings.length})
          </TabsTrigger>
        </TabsList>

        {/* AGENTS TAB */}
        <TabsContent value="agents" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditAgent(null); setAgentForm({ name: '', bio: '', city: '', state: '', years_experience: '0', hourly_rate: '0', specialties: '', armed: false, profile_image: '' }); setShowAgentModal(true); }} className="bg-[#C9A84C] text-black hover:bg-[#B8973F]">
              <Plus className="h-4 w-4 mr-1" /> Add Agent
            </Button>
          </div>
          <div className="grid gap-4">
            {agents.map(agent => (
              <div key={agent.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-start gap-4">
                  {agent.profile_image ? (
                    <img src={agent.profile_image} alt={agent.name} className="h-16 w-16 rounded-lg object-cover border border-white/10" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-white/10 flex items-center justify-center"><User className="h-8 w-8 text-white/30" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold">{agent.name}</h3>
                      {agent.verified && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                      {agent.armed && <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">ARMED</Badge>}
                      <Badge className={agent.is_active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]' : 'bg-red-500/15 text-red-400 border-red-500/30 text-[10px]'}>
                        {agent.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </div>
                    <p className="text-sm text-white/40 mt-1">{agent.city}{agent.state ? `, ${agent.state}` : ''} · {agent.years_experience}yr exp · ${agent.hourly_rate}/hr</p>
                    {agent.specialties?.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {agent.specialties.map(s => <Badge key={s} className="bg-white/5 text-white/50 border-white/10 text-[10px]">{s}</Badge>)}
                      </div>
                    )}
                    {agent.bio && <p className="text-xs text-white/30 mt-2 line-clamp-2">{agent.bio}</p>}
                    <p className="text-[10px] text-white/20 mt-1">Independent Contractor · {certs.filter(c => c.agent_id === agent.id).length} certs · {media.filter(m => m.agent_id === agent.id).length} media</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEditAgent(agent)} className="border-white/10 text-white/60 hover:text-[#C9A84C] text-xs">Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => toggleAgentVerified(agent)} className={`border-white/10 text-xs ${agent.verified ? 'text-red-400' : 'text-emerald-400'}`}>
                      {agent.verified ? 'Unverify' : 'Verify'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleAgentActive(agent)} className={`border-white/10 text-xs ${agent.is_active ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {agent.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {agents.length === 0 && <p className="text-center text-white/30 py-8">No agents yet. Add your first security professional.</p>}
          </div>
        </TabsContent>

        {/* CERTIFICATIONS TAB */}
        <TabsContent value="certs" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setCertForm({ agent_id: agents[0]?.id || '', license_type: '', license_number: '', expiration_date: '', insurance_status: 'pending' }); setShowCertModal(true); }} className="bg-[#C9A84C] text-black hover:bg-[#B8973F]" disabled={agents.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Add Certification
            </Button>
          </div>
          <div className="grid gap-3">
            {certs.map(cert => (
              <div key={cert.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#C9A84C]" />
                    <span className="text-white font-medium">{cert.license_type}</span>
                    {cert.verified && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                  </div>
                  <p className="text-xs text-white/40 mt-1">Agent: {getAgentName(cert.agent_id)} · #{cert.license_number || 'N/A'} · Expires: {cert.expiration_date || 'N/A'}</p>
                  <Badge className={cert.insurance_status === 'active' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] mt-1' : 'bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] mt-1'}>
                    Insurance: {cert.insurance_status}
                  </Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => toggleCertVerified(cert)} className={`border-white/10 text-xs ${cert.verified ? 'text-red-400' : 'text-emerald-400'}`}>
                  {cert.verified ? 'Unverify' : 'Verify'}
                </Button>
              </div>
            ))}
            {certs.length === 0 && <p className="text-center text-white/30 py-8">No certifications uploaded yet.</p>}
          </div>
        </TabsContent>

        {/* MEDIA TAB */}
        <TabsContent value="media" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setMediaForm({ agent_id: agents[0]?.id || '', type: 'image', url: '', caption: '' }); setShowMediaModal(true); }} className="bg-[#C9A84C] text-black hover:bg-[#B8973F]" disabled={agents.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Add Media
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {media.map(m => (
              <div key={m.id} className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                {m.type === 'image' ? (
                  <img src={m.url} alt={m.caption || ''} className="w-full h-40 object-cover" />
                ) : (
                  <video src={m.url} className="w-full h-40 object-cover" controls />
                )}
                <div className="p-2">
                  <p className="text-xs text-white/60">{getAgentName(m.agent_id)}</p>
                  {m.caption && <p className="text-[10px] text-white/30">{m.caption}</p>}
                </div>
              </div>
            ))}
            {media.length === 0 && <p className="col-span-3 text-center text-white/30 py-8">No media uploaded yet.</p>}
          </div>
        </TabsContent>

        {/* BOOKINGS TAB */}
        <TabsContent value="bookings" className="space-y-4">
          <div className="grid gap-3">
            {bookings.map(b => (
              <div key={b.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{b.service_type}</span>
                      <Badge className={statusColor(b.status) + ' text-[10px]'}>{b.status.toUpperCase()}</Badge>
                    </div>
                    <p className="text-xs text-white/40 mt-1">
                      {b.client_name || 'Anonymous'} · {b.location || 'TBD'} · {b.event_date || 'No date'}
                    </p>
                    <p className="text-xs text-white/30 mt-1">
                      {b.hours}hr × {b.number_of_agents} agent(s) · Agent: {getAgentName(b.agent_id)} · <span className="text-[#C9A84C]">${b.total_price}</span>
                    </p>
                    {b.notes && <p className="text-[10px] text-white/20 mt-1">{b.notes}</p>}
                  </div>
                  {b.status === 'pending' && (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => updateBookingStatus(b, 'accepted')} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">Accept</Button>
                      <Button size="sm" onClick={() => updateBookingStatus(b, 'declined')} className="bg-red-600 hover:bg-red-700 text-white text-xs">Decline</Button>
                    </div>
                  )}
                  {b.status === 'accepted' && (
                    <Button size="sm" onClick={() => updateBookingStatus(b, 'confirmed')} className="bg-[#C9A84C] text-black hover:bg-[#B8973F] text-xs">Confirm</Button>
                  )}
                </div>
              </div>
            ))}
            {bookings.length === 0 && <p className="text-center text-white/30 py-8">No booking requests yet.</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* AGENT MODAL */}
      <Dialog open={showAgentModal} onOpenChange={setShowAgentModal}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-[#C9A84C]">{editAgent ? 'Edit Agent' : 'Add Agent'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Full Name *" value={agentForm.name} onChange={e => setAgentForm(f => ({ ...f, name: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="City" value={agentForm.city} onChange={e => setAgentForm(f => ({ ...f, city: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              <Input placeholder="State" value={agentForm.state} onChange={e => setAgentForm(f => ({ ...f, state: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Years Experience" value={agentForm.years_experience} onChange={e => setAgentForm(f => ({ ...f, years_experience: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              <Input type="number" placeholder="Hourly Rate ($)" value={agentForm.hourly_rate} onChange={e => setAgentForm(f => ({ ...f, hourly_rate: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            </div>
            <Input placeholder="Specialties (comma-separated)" value={agentForm.specialties} onChange={e => setAgentForm(f => ({ ...f, specialties: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            <Input placeholder="Profile Image URL" value={agentForm.profile_image} onChange={e => setAgentForm(f => ({ ...f, profile_image: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            <textarea placeholder="Bio" value={agentForm.bio} onChange={e => setAgentForm(f => ({ ...f, bio: e.target.value }))} className="w-full bg-white/5 border border-white/10 text-white rounded-md p-2 text-sm min-h-[80px]" />
            <label className="flex items-center gap-2 text-sm text-white/60">
              <input type="checkbox" checked={agentForm.armed} onChange={e => setAgentForm(f => ({ ...f, armed: e.target.checked }))} className="rounded" />
              Armed Security
            </label>
            <Button onClick={saveAgent} disabled={!agentForm.name} className="w-full bg-[#C9A84C] text-black hover:bg-[#B8973F]">{editAgent ? 'Update' : 'Create'} Agent</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CERT MODAL */}
      <Dialog open={showCertModal} onOpenChange={setShowCertModal}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-[#C9A84C]">Add Certification</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <select value={certForm.agent_id} onChange={e => setCertForm(f => ({ ...f, agent_id: e.target.value }))} className="w-full bg-white/5 border border-white/10 text-white rounded-md p-2 text-sm">
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <Input placeholder="License Type *" value={certForm.license_type} onChange={e => setCertForm(f => ({ ...f, license_type: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            <Input placeholder="License Number" value={certForm.license_number} onChange={e => setCertForm(f => ({ ...f, license_number: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            <Input type="date" placeholder="Expiration Date" value={certForm.expiration_date} onChange={e => setCertForm(f => ({ ...f, expiration_date: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            <select value={certForm.insurance_status} onChange={e => setCertForm(f => ({ ...f, insurance_status: e.target.value }))} className="w-full bg-white/5 border border-white/10 text-white rounded-md p-2 text-sm">
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
            <Button onClick={saveCert} disabled={!certForm.license_type || !certForm.agent_id} className="w-full bg-[#C9A84C] text-black hover:bg-[#B8973F]">Add Certification</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MEDIA MODAL */}
      <Dialog open={showMediaModal} onOpenChange={setShowMediaModal}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-[#C9A84C]">Add Media</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <select value={mediaForm.agent_id} onChange={e => setMediaForm(f => ({ ...f, agent_id: e.target.value }))} className="w-full bg-white/5 border border-white/10 text-white rounded-md p-2 text-sm">
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={mediaForm.type} onChange={e => setMediaForm(f => ({ ...f, type: e.target.value }))} className="w-full bg-white/5 border border-white/10 text-white rounded-md p-2 text-sm">
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
            <Input placeholder="Media URL *" value={mediaForm.url} onChange={e => setMediaForm(f => ({ ...f, url: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            <Input placeholder="Caption" value={mediaForm.caption} onChange={e => setMediaForm(f => ({ ...f, caption: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            <Button onClick={saveMedia} disabled={!mediaForm.url || !mediaForm.agent_id} className="w-full bg-[#C9A84C] text-black hover:bg-[#B8973F]">Add Media</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
