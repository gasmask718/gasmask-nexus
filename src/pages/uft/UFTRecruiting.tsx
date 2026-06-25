import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { CalendarIcon, Plus, ExternalLink, Trash2, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'referral', 'other'] as const;
const LEAD_TYPES = ['venue', 'staff', 'ambassador', 'kit_buyer'] as const;
const STATUSES = ['new', 'contacted', 'interested', 'signed_up', 'declined'] as const;

type Platform = typeof PLATFORMS[number];
type LeadType = typeof LEAD_TYPES[number];
type Status = typeof STATUSES[number];

interface RecruitingLead {
  id: string;
  platform: Platform | null;
  lead_type: LeadType | null;
  name: string | null;
  contact: string | null;
  profile_url: string | null;
  location: string | null;
  notes: string | null;
  status: Status;
  follow_up_date: string | null;
  created_at: string;
}

const statusVariant: Record<Status, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  new: 'outline',
  contacted: 'secondary',
  interested: 'default',
  signed_up: 'default',
  declined: 'destructive',
};

export default function UFTRecruiting() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<RecruitingLead[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [form, setForm] = useState({
    name: '',
    contact: '',
    profile_url: '',
    location: '',
    notes: '',
    platform: 'instagram' as Platform,
    lead_type: 'ambassador' as LeadType,
    follow_up_date: undefined as Date | undefined,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('ut_recruiting_leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else setLeads((data || []) as RecruitingLead[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addLead = async () => {
    if (!form.name?.trim()) {
      toast.error('Name is required');
      return;
    }
    const payload = {
      name: form.name.trim(),
      contact: form.contact.trim() || null,
      profile_url: form.profile_url.trim() || null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      platform: form.platform,
      lead_type: form.lead_type,
      follow_up_date: form.follow_up_date ? format(form.follow_up_date, 'yyyy-MM-dd') : null,
      status: 'new' as Status,
    };
    const { error } = await (supabase as any).from('ut_recruiting_leads').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Lead added');
    setForm({
      name: '', contact: '', profile_url: '', location: '', notes: '',
      platform: 'instagram', lead_type: 'ambassador', follow_up_date: undefined,
    });
    load();
  };

  const updateLead = async (id: string, patch: Partial<RecruitingLead>) => {
    const { error } = await (supabase as any)
      .from('ut_recruiting_leads').update(patch).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } as RecruitingLead : l));
  };

  const deleteLead = async (id: string) => {
    if (!confirm('Delete this lead?')) return;
    const { error } = await (supabase as any).from('ut_recruiting_leads').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  const markSignedUp = async (lead: RecruitingLead) => {
    await updateLead(lead.id, { status: 'signed_up' });
    toast.success('Marked signed up');
    if (lead.lead_type === 'venue' || lead.lead_type === 'staff') {
      navigate('/uft/vendors');
    } else if (lead.lead_type === 'ambassador') {
      navigate('/uft/ambassadors');
    }
  };

  const filtered = useMemo(() => leads.filter(l =>
    (filterPlatform === 'all' || l.platform === filterPlatform) &&
    (filterType === 'all' || l.lead_type === filterType) &&
    (filterStatus === 'all' || l.status === filterStatus)
  ), [leads, filterPlatform, filterType, filterStatus]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { new: 0, contacted: 0, interested: 0, signed_up: 0, declined: 0 };
    leads.forEach(l => { c[l.status] = (c[l.status] || 0) + 1; });
    return c;
  }, [leads]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Social Media Recruiting</h1>
        <p className="text-muted-foreground">Track outreach to potential vendors, ambassadors, and kit buyers.</p>
      </div>

      {/* Pipeline counts */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STATUSES.map(s => (
          <Card key={s}>
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground">{s.replace('_', ' ')}</div>
              <div className="text-2xl font-bold">{counts[s]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick add */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add Lead</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
          </div>
          <div>
            <Label>Contact</Label>
            <Input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="@handle / email / phone" />
          </div>
          <div>
            <Label>Profile URL</Label>
            <Input value={form.profile_url} onChange={e => setForm({ ...form, profile_url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="City, State" />
          </div>
          <div>
            <Label>Platform</Label>
            <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v as Platform })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Lead Type</Label>
            <Select value={form.lead_type} onValueChange={(v) => setForm({ ...form, lead_type: v as LeadType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Follow-up date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !form.follow_up_date && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.follow_up_date ? format(form.follow_up_date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.follow_up_date} onSelect={(d) => setForm({ ...form, follow_up_date: d })} initialFocus className={cn('p-3 pointer-events-auto')} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="md:col-span-3">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="md:col-span-3">
            <Button onClick={addLead}><Plus className="h-4 w-4 mr-2" />Add Lead</Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters + table */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <CardTitle>Leads ({filtered.length})</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Platform" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {LEAD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground">No leads yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(lead => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="font-medium">{lead.name || '—'}</div>
                        {lead.profile_url && (
                          <a href={lead.profile_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
                            profile <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {lead.notes && <div className="text-xs text-muted-foreground line-clamp-2 max-w-xs">{lead.notes}</div>}
                      </TableCell>
                      <TableCell>{lead.platform || '—'}</TableCell>
                      <TableCell>{lead.lead_type || '—'}</TableCell>
                      <TableCell>{lead.contact || '—'}</TableCell>
                      <TableCell>{lead.location || '—'}</TableCell>
                      <TableCell>
                        <Select value={lead.status} onValueChange={(v) => updateLead(lead.id, { status: v as Status })}>
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue>
                              <Badge variant={statusVariant[lead.status]}>{lead.status}</Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8">
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              {lead.follow_up_date ? format(new Date(lead.follow_up_date), 'MMM d') : 'set'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={lead.follow_up_date ? new Date(lead.follow_up_date) : undefined}
                              onSelect={(d) => updateLead(lead.id, { follow_up_date: d ? format(d, 'yyyy-MM-dd') : null })}
                              initialFocus
                              className={cn('p-3 pointer-events-auto')}
                            />
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {lead.status !== 'signed_up' && (
                            <Button variant="outline" size="sm" onClick={() => markSignedUp(lead)} title="Mark Signed Up">
                              <UserCheck className="h-3 w-3" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => deleteLead(lead.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
