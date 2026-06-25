import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import {
  Plus, Instagram, Facebook, Linkedin, MessageSquare, Mail, Users, Globe,
  CalendarIcon, Copy, ExternalLink, UserCheck, Trash2, TrendingUp,
} from 'lucide-react';
import { format, differenceInDays, isToday, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const PLATFORMS = ['instagram','facebook','tiktok','linkedin','twitter','text','email','referral','other'] as const;
const LEAD_TYPES = ['ambassador','venue','staff','kit_buyer','rental'] as const;
const KANBAN_STATUSES = ['identified','contacted','responded','interested','signed_up','declined'] as const;
const ALL_STATUSES = ['identified','contacted','responded','interested','signed_up','declined','no_response'] as const;

type Platform = typeof PLATFORMS[number];
type LeadType = typeof LEAD_TYPES[number];
type Status = typeof ALL_STATUSES[number] | 'new';

interface Lead {
  id: string;
  platform: Platform | null;
  lead_type: LeadType | null;
  name: string;
  handle: string | null;
  contact: string | null;
  profile_url: string | null;
  location: string | null;
  follower_count: number | null;
  notes: string | null;
  outreach_message: string | null;
  status: Status;
  follow_up_date: string | null;
  signed_up_at: string | null;
  created_at: string;
}

const PlatformIcon = ({ p, className }: { p?: string | null; className?: string }) => {
  const c = className ?? 'h-3 w-3';
  switch (p) {
    case 'instagram': return <Instagram className={c} />;
    case 'facebook': return <Facebook className={c} />;
    case 'linkedin': return <Linkedin className={c} />;
    case 'text': return <MessageSquare className={c} />;
    case 'email': return <Mail className={c} />;
    case 'referral': return <Users className={c} />;
    default: return <Globe className={c} />;
  }
};

const SIGNUP_LINK = 'https://unforgettabletimes.com/ambassador?ref=[ref_code]';

const TEMPLATES: Record<string, string> = {
  'Instagram DM': `Hey [name]! 👋 Love your content. We're growing the Unforgettable Times ambassador program in your area and your vibe fits perfectly. Earn commission on every event you refer. Quick look: ${SIGNUP_LINK}`,
  'Facebook': `Hi [name] — saw your profile and thought you'd be a great fit for our Unforgettable Times ambassador program. Flexible, commission-based, you bring the network we bring the platform. Sign up: ${SIGNUP_LINK}`,
  'LinkedIn': `Hi [name], I'm building out the ambassador network for Unforgettable Times (events/experiences platform). Looking for connected people in your market — would love to send over details. Quick link: ${SIGNUP_LINK}`,
  'Text': `Hey [name], it's [your name] with Unforgettable Times. Quick question — open to a commission-based ambassador role? You'd earn on every booking you refer. Link: ${SIGNUP_LINK}`,
  'Email': `Subject: Quick opportunity — Unforgettable Times ambassador\n\nHi [name],\n\nWe're expanding the Unforgettable Times ambassador program and your profile stood out. Commission on every event/experience you refer, no quotas, full support.\n\nSign up here: ${SIGNUP_LINK}\n\nHappy to answer any questions.\n\nThanks,\n[your name]`,
};

const statusColor: Record<string, string> = {
  identified: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  contacted: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  responded: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  interested: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  signed_up: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  declined: 'bg-red-500/15 text-red-700 dark:text-red-300',
  no_response: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
  new: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
};

export default function UFTAmbassadorRecruiting() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', platform: 'instagram' as Platform, handle: '', contact: '',
    location: '', follower_count: '', lead_type: 'ambassador' as LeadType,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('ut_recruiting_leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else setLeads((data || []) as Lead[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addLead = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    const payload = {
      name: form.name.trim(),
      platform: form.platform,
      handle: form.handle.trim() || null,
      contact: form.contact.trim() || null,
      location: form.location.trim() || null,
      follower_count: form.follower_count ? parseInt(form.follower_count, 10) : null,
      lead_type: form.lead_type,
      status: 'identified' as Status,
    };
    const { error } = await (supabase as any).from('ut_recruiting_leads').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Lead added');
    setForm({ name: '', platform: 'instagram', handle: '', contact: '', location: '', follower_count: '', lead_type: 'ambassador' });
    load();
  };

  const updateLead = async (id: string, patch: Partial<Lead>) => {
    const finalPatch: Partial<Lead> = { ...patch };
    if (patch.status === 'signed_up') {
      finalPatch.signed_up_at = new Date().toISOString();
    }
    const { error } = await (supabase as any)
      .from('ut_recruiting_leads').update(finalPatch).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...finalPatch } as Lead : l));
  };

  const deleteLead = async (id: string) => {
    if (!confirm('Delete this lead?')) return;
    const { error } = await (supabase as any).from('ut_recruiting_leads').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  const filtered = useMemo(() => leads.filter(l =>
    (filterPlatform === 'all' || l.platform === filterPlatform) &&
    (filterType === 'all' || l.lead_type === filterType) &&
    (filterStatus === 'all' || l.status === filterStatus)
  ), [leads, filterPlatform, filterType, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_STATUSES.forEach(s => counts[s] = 0);
    leads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const signedThisMonth = leads.filter(l => l.signed_up_at && new Date(l.signed_up_at) >= monthStart).length;
    return { ...counts, signedThisMonth };
  }, [leads]);

  // Conversion metrics
  const metrics = useMemo(() => {
    const reached = leads.filter(l => l.status !== 'identified').length;
    const responded = leads.filter(l => ['responded','interested','signed_up','declined'].includes(l.status)).length;
    const signed = leads.filter(l => l.status === 'signed_up').length;
    const responseRate = reached ? (responded / reached) * 100 : 0;
    const conversionRate = reached ? (signed / reached) * 100 : 0;
    const days: number[] = [];
    leads.forEach(l => {
      if (l.signed_up_at) {
        days.push(differenceInDays(new Date(l.signed_up_at), new Date(l.created_at)));
      }
    });
    const avgDays = days.length ? days.reduce((a,b) => a+b, 0) / days.length : 0;
    const platformSigned: Record<string, number> = {};
    leads.filter(l => l.status === 'signed_up' && l.platform).forEach(l => {
      platformSigned[l.platform!] = (platformSigned[l.platform!] || 0) + 1;
    });
    const bestPlatform = Object.entries(platformSigned).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';
    return { reached, responseRate, conversionRate, avgDays, bestPlatform };
  }, [leads]);

  // Follow-ups due today
  const dueToday = useMemo(() => leads.filter(l => {
    if (!l.follow_up_date) return false;
    try { return isToday(parseISO(l.follow_up_date)); } catch { return false; }
  }), [leads]);

  const copyTemplate = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Template copied');
  };

  // Kanban DnD
  const onDragStart = (id: string) => setDraggedId(id);
  const onDropTo = (status: Status) => {
    if (!draggedId) return;
    const lead = leads.find(l => l.id === draggedId);
    if (lead && lead.status !== status) updateLead(draggedId, { status });
    setDraggedId(null);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header + stats */}
      <div>
        <h1 className="text-3xl font-bold">Ambassador Recruiting Pipeline</h1>
        <p className="text-muted-foreground">Track every person you reach out to about becoming an ambassador.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Identified</div><div className="text-2xl font-bold">{stats.identified}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Contacted</div><div className="text-2xl font-bold">{stats.contacted}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Interested</div><div className="text-2xl font-bold">{stats.interested}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Signed up this month</div><div className="text-2xl font-bold text-emerald-600">{stats.signedThisMonth}</div></CardContent></Card>
      </div>

      {/* Follow-up reminders */}
      {dueToday.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base">📅 {dueToday.length} lead{dueToday.length === 1 ? '' : 's'} need follow up today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dueToday.map(l => (
              <div key={l.id} className="flex items-center justify-between border rounded p-2">
                <div className="flex items-center gap-2">
                  <PlatformIcon p={l.platform} />
                  <span className="font-medium">{l.name}</span>
                  <span className="text-xs text-muted-foreground">{l.handle || l.contact}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => updateLead(l.id, { status: 'contacted', follow_up_date: null })}>
                  Mark Contacted
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Add */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Quick Add Lead</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Platform</Label>
                <Select value={form.platform} onValueChange={v => setForm({ ...form, platform: v as Platform })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Handle / Contact</Label>
                <Input value={form.handle} onChange={e => setForm({ ...form, handle: e.target.value })} placeholder="@handle or phone/email" />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              </div>
              <div>
                <Label>Follower Count</Label>
                <Input type="number" value={form.follower_count} onChange={e => setForm({ ...form, follower_count: e.target.value })} />
              </div>
              <div>
                <Label>Lead Type</Label>
                <Select value={form.lead_type} onValueChange={v => setForm({ ...form, lead_type: v as LeadType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEAD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Button onClick={addLead}><Plus className="h-4 w-4 mr-2" />Add Lead</Button>
              </div>
            </CardContent>
          </Card>

          {/* View toggle + filters */}
          <Tabs value={view} onValueChange={v => setView(v as 'kanban' | 'table')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="kanban">Kanban</TabsTrigger>
                <TabsTrigger value="table">Table</TabsTrigger>
              </TabsList>
              <div className="flex flex-wrap gap-2">
                <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Platform" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All platforms</SelectItem>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All types</SelectItem>{LEAD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All statuses</SelectItem>{ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="kanban" className="mt-4">
              {loading ? <p className="text-muted-foreground">Loading…</p> : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  {KANBAN_STATUSES.map(status => {
                    const items = filtered.filter(l => l.status === status);
                    return (
                      <div
                        key={status}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => onDropTo(status)}
                        className="border rounded-lg bg-muted/30 p-2 min-h-[300px]"
                      >
                        <div className="flex items-center justify-between mb-2 px-1">
                          <div className="text-xs font-semibold uppercase">{status.replace('_', ' ')}</div>
                          <Badge variant="outline" className="text-xs">{items.length}</Badge>
                        </div>
                        <div className="space-y-2">
                          {items.map(l => {
                            const days = differenceInDays(new Date(), new Date(l.created_at));
                            return (
                              <div
                                key={l.id}
                                draggable
                                onDragStart={() => onDragStart(l.id)}
                                className="bg-card border rounded p-2 text-sm cursor-grab active:cursor-grabbing shadow-sm"
                              >
                                <div className="flex items-center gap-1 font-medium">
                                  <PlatformIcon p={l.platform} />
                                  <span className="truncate">{l.name}</span>
                                </div>
                                {(l.handle || l.contact) && (
                                  <div className="text-xs text-muted-foreground truncate">{l.handle || l.contact}</div>
                                )}
                                {l.location && <div className="text-xs text-muted-foreground truncate">{l.location}</div>}
                                {l.follower_count != null && (
                                  <div className="text-xs">👥 {l.follower_count.toLocaleString()}</div>
                                )}
                                <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                                  <span>{days}d ago</span>
                                  {l.follow_up_date && <span>📅 {format(parseISO(l.follow_up_date), 'MMM d')}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="table" className="mt-4">
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>Handle/Contact</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Followers</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Follow-up</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.name}</TableCell>
                          <TableCell><div className="flex items-center gap-1"><PlatformIcon p={l.platform} />{l.platform}</div></TableCell>
                          <TableCell>{l.handle || l.contact || '—'}</TableCell>
                          <TableCell>{l.location || '—'}</TableCell>
                          <TableCell>{l.follower_count?.toLocaleString() || '—'}</TableCell>
                          <TableCell>{l.lead_type}</TableCell>
                          <TableCell>
                            <Select value={l.status} onValueChange={v => updateLead(l.id, { status: v as Status })}>
                              <SelectTrigger className="h-8 w-[130px]">
                                <SelectValue>
                                  <span className={cn('px-2 py-0.5 rounded text-xs', statusColor[l.status])}>{l.status}</span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>{ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8">
                                  <CalendarIcon className="h-3 w-3 mr-1" />
                                  {l.follow_up_date ? format(parseISO(l.follow_up_date), 'MMM d') : 'set'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single"
                                  selected={l.follow_up_date ? parseISO(l.follow_up_date) : undefined}
                                  onSelect={d => updateLead(l.id, { follow_up_date: d ? format(d, 'yyyy-MM-dd') : null })}
                                  initialFocus className={cn('p-3 pointer-events-auto')} />
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {l.profile_url && (
                                <Button asChild variant="ghost" size="sm"><a href={l.profile_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a></Button>
                              )}
                              {l.status !== 'signed_up' && (
                                <Button variant="outline" size="sm" onClick={() => updateLead(l.id, { status: 'signed_up' })}><UserCheck className="h-3 w-3" /></Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => deleteLead(l.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Conversion Metrics */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Conversion Metrics</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label="Reached out" value={metrics.reached.toString()} />
              <Stat label="Response rate" value={`${metrics.responseRate.toFixed(1)}%`} />
              <Stat label="Conversion rate" value={`${metrics.conversionRate.toFixed(1)}%`} />
              <Stat label="Avg days to convert" value={metrics.avgDays ? metrics.avgDays.toFixed(1) : '—'} />
              <Stat label="Best platform" value={metrics.bestPlatform} />
            </CardContent>
          </Card>
        </div>

        {/* Outreach Templates */}
        <Card className="lg:sticky lg:top-4 self-start">
          <CardHeader><CardTitle className="text-base">Outreach Templates</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Click to copy. Replace <code>[ref_code]</code> with the ambassador's ref code and <code>[name]</code> / <code>[your name]</code> as needed.
            </p>
            {Object.entries(TEMPLATES).map(([label, body]) => (
              <div key={label} className="border rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{label}</span>
                  <Button size="sm" variant="ghost" onClick={() => copyTemplate(body)}><Copy className="h-3 w-3" /></Button>
                </div>
                <Textarea readOnly value={body} rows={4} className="text-xs" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
