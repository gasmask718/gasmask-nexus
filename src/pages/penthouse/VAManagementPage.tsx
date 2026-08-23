import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Mail, Copy, RefreshCw, UserPlus, Building2, Search, Trash2, History, MessageSquare } from 'lucide-react';

interface Company { id: string; slug: string; name: string; brand_color: string | null; calls_for: string | null; vas_assigned: number | null; }
interface DirRow {
  membership_id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  joined_at: string;
  company_id: string;
  company_slug: string;
  company_name: string;
  primary_role?: string | null;
  extra_roles?: string[] | null;
  app_roles?: string[];
}
interface Invite {
  id: string; email: string; role: string; status: string;
  expires_at: string; created_at: string; company_id: string;
  token: string;
  channel?: string | null;
  phone?: string | null;
  sent_to_email?: string | null;
  sent_to_phone?: string | null;
}
interface InviteEvent {
  id: string;
  invite_id: string;
  event_type: string;
  channel: string | null;
  actor_user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function VAManagementPage() {
  const qc = useQueryClient();

  // ---- Companies ----
  const { data: companies = [] } = useQuery({
    queryKey: ['va-companies'],
    queryFn: async () => {
      // v_va_company_access carries calls_for ("what this VA will be calling")
      // and vas_assigned alongside the company row — one row per company.
      const { data, error } = await supabase
        .from('v_va_company_access')
        .select('company_id, slug, name, brand_color, calls_for, vas_assigned')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      const seen = new Set<string>();
      const rows: Company[] = [];
      for (const r of data ?? []) {
        if (!r.company_id || seen.has(r.company_id)) continue;
        seen.add(r.company_id);
        rows.push({
          id: r.company_id,
          slug: r.slug ?? '',
          name: r.name ?? '',
          brand_color: r.brand_color,
          calls_for: r.calls_for,
          vas_assigned: r.vas_assigned,
        });
      }
      return rows;
    },
  });

  // ---- Directory (memberships + profiles + app roles) ----
  const { data: directory = [], isLoading: dirLoading } = useQuery({
    queryKey: ['va-directory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_va_directory' as any)
        .select('*')
        .order('joined_at', { ascending: false });
      if (error) throw error;
      const rows = ((data ?? []) as unknown) as DirRow[];

      const userIds = Array.from(new Set(rows.map(r => r.user_id))).filter(Boolean);
      if (userIds.length === 0) return rows;

      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('user_id, primary_role, extra_roles')
          .in('user_id', userIds),
        supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds),
      ]);

      const profileMap = new Map(
        (profiles ?? []).map((p: any) => [p.user_id, p]),
      );
      const rolesMap = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const list = rolesMap.get(r.user_id) ?? [];
        list.push(r.role);
        rolesMap.set(r.user_id, list);
      });

      return rows.map(r => ({
        ...r,
        primary_role: profileMap.get(r.user_id)?.primary_role ?? null,
        extra_roles: profileMap.get(r.user_id)?.extra_roles ?? null,
        app_roles: rolesMap.get(r.user_id) ?? [],
      }));
    },
  });

  // ---- Invites ----
  const { data: invites = [] } = useQuery({
    queryKey: ['va-invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('va_invites')
        .select('id, email, role, status, expires_at, created_at, company_id, token, channel, phone, sent_to_email, sent_to_phone')
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as Invite[];
    },
  });

  // ---- Form ----
  type Channel = 'email' | 'sms' | 'both';
  const [form, setForm] = useState<{
    email: string; company_id: string; role: string; channel: Channel; phone: string;
  }>({ email: '', company_id: '', role: 'va', channel: 'email', phone: '' });

  useEffect(() => {
    if (!form.company_id && companies.length) {
      setForm(f => ({ ...f, company_id: companies[0].id }));
    }
  }, [companies, form.company_id]);

  const inviteMut = useMutation({
    mutationFn: async () => {
      if (!form.email.trim() || !form.company_id) throw new Error('Email and company required');
      if ((form.channel === 'sms' || form.channel === 'both') && !form.phone.trim()) {
        throw new Error('Phone number required for SMS channel');
      }
      const { data, error } = await supabase.functions.invoke('invite-va', {
        body: {
          email: form.email.trim(),
          company_id: form.company_id,
          role: form.role,
          channel: form.channel,
          phone: form.phone.trim() || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as {
        accept_url: string;
        channel: Channel;
        email_sent: boolean; email_error: string | null;
        sms_sent: boolean; sms_error: string | null;
      };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['va-invites'] });
      setForm(f => ({ ...f, email: '', phone: '' }));
      const parts: string[] = [];
      if (data.channel === 'email' || data.channel === 'both') {
        parts.push(data.email_sent ? 'email ✓' : `email ✗ (${data.email_error ?? 'failed'})`);
      }
      if (data.channel === 'sms' || data.channel === 'both') {
        parts.push(data.sms_sent ? 'sms ✓' : `sms ✗ (${data.sms_error ?? 'failed'})`);
      }
      const anySent = data.email_sent || data.sms_sent;
      const msg = parts.join(' · ');
      if (anySent) toast.success('Invite created', { description: msg });
      else toast.message('Invite created (no delivery)', { description: msg });
      navigator.clipboard?.writeText(data.accept_url).catch(() => {});
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to invite'),
  });

  const revokeMut = useMutation({
    mutationFn: async (id: string) => {
      // Uses revoke_va_invite RPC so status flip + audit event are atomic.
      const { data, error } = await supabase.rpc('revoke_va_invite', { p_invite_id: id });
      if (error) throw error;
      const r = data as { success?: boolean; error?: string } | null;
      if (!r?.success) throw new Error(r?.error ?? 'revoke_failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['va-invites'] });
      toast.success('Invite revoked');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('va_invites').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['va-invites'] });
      toast.success('Invite deleted');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to delete invite'),
  });

  // ---- Audit history modal ----
  const [historyInviteId, setHistoryInviteId] = useState<string | null>(null);
  const { data: historyEvents = [], isLoading: historyLoading } = useQuery({
    queryKey: ['va-invite-events', historyInviteId],
    enabled: !!historyInviteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('va_invite_events' as any)
        .select('id, invite_id, event_type, channel, actor_user_id, metadata, created_at')
        .eq('invite_id', historyInviteId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown) as InviteEvent[];
    },
  });

  const assignCompanyMut = useMutation({
    mutationFn: async ({
      membership_id, company_id, user_id, role,
    }: { membership_id: string; company_id: string; user_id: string; role: string }) => {
      // Synthetic IDs from v_va_directory for users with no real membership row
      // are prefixed "profile:". In that case we need to INSERT, not UPDATE.
      if (membership_id.startsWith('profile:')) {
        const { error } = await supabase
          .from('va_company_memberships')
          .insert({
            user_id,
            company_id,
            role: (role || 'va') as any,
            is_active: true,
            is_primary: true,
          });
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('va_company_memberships')
        .update({ company_id })
        .eq('id', membership_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['va-directory'] });
      toast.success('Company reassigned');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to reassign company'),
  });

  // ---- Filters ----
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return directory.filter(r => {
      if (filterCompany !== 'all' && r.company_id !== filterCompany) return false;
      if (filterRole !== 'all' && r.role !== filterRole) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.email ?? ''} ${r.full_name ?? ''} ${r.phone ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [directory, filterCompany, filterRole, search]);

  const distinctRoles = useMemo(
    () => Array.from(new Set(directory.map(d => d.role))).sort(),
    [directory],
  );

  const companyById = useMemo(
    () => Object.fromEntries(companies.map(c => [c.id, c])),
    [companies],
  );

  const copyLink = async (token: string) => {
    const url = `https://gasmask-os-nexus.lovable.app/va/auth?invite=${token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Invite link copied');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">VA Management</h1>
          <p className="text-sm text-slate-400">Invite VAs and manage their company assignments.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Invite form */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <UserPlus className="h-5 w-5" /> Invite a VA
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <Label className="text-slate-300">VA email</Label>
            <Input
              type="email" placeholder="va@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div>
            <Label className="text-slate-300">Company</Label>
            <Select value={form.company_id} onValueChange={v => setForm(f => ({ ...f, company_id: v }))}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300">Role</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="va">VA</SelectItem>
                <SelectItem value="senior_va">Senior VA</SelectItem>
                <SelectItem value="lead_va">Lead VA</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300">Channel</Label>
            <Select value={form.channel} onValueChange={(v) => setForm(f => ({ ...f, channel: v as Channel }))}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300">
              Phone {(form.channel === 'sms' || form.channel === 'both') && <span className="text-amber-400">*</span>}
            </Label>
            <Input
              type="tel" placeholder="+15558675310"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              disabled={form.channel === 'email'}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div className="md:col-span-6">
            <Button
              onClick={() => inviteMut.mutate()}
              disabled={
                inviteMut.isPending || !form.email || !form.company_id ||
                ((form.channel === 'sms' || form.channel === 'both') && !form.phone.trim())
              }
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {inviteMut.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
                : form.channel === 'sms'
                  ? <><MessageSquare className="h-4 w-4 mr-2" /> Send invite</>
                  : <><Mail className="h-4 w-4 mr-2" /> Send invite</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending invites */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Invites</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">
                  No invites yet
                </TableCell></TableRow>
              )}
              {invites.map(i => (
                <TableRow key={i.id}>
                  <TableCell className="text-white">
                    <div>{i.email}</div>
                    {i.phone && <div className="text-xs text-slate-500">{i.phone}</div>}
                  </TableCell>
                  <TableCell>{companyById[i.company_id]?.name ?? '—'}</TableCell>
                  <TableCell>{i.role}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{i.channel ?? 'email'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={i.status === 'pending' ? 'default'
                      : i.status === 'accepted' ? 'secondary' : 'destructive'}>
                      {i.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {new Date(i.expires_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="ghost" onClick={() => setHistoryInviteId(i.id)}>
                      <History className="h-3 w-3 mr-1" /> History
                    </Button>
                    {i.status === 'pending' && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => copyLink(i.token)}>
                          <Copy className="h-3 w-3 mr-1" /> Link
                        </Button>
                        <Button size="sm" variant="ghost"
                          className="text-amber-400"
                          disabled={revokeMut.isPending}
                          onClick={() => revokeMut.mutate(i.id)}>
                          Revoke
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400"
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (confirm(`Delete invite for ${i.email}? This cannot be undone.`)) {
                          deleteMut.mutate(i.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* History modal */}
      <Dialog open={!!historyInviteId} onOpenChange={(open) => !open && setHistoryInviteId(null)}>
        <DialogContent className="max-w-lg bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Invite history</DialogTitle>
          </DialogHeader>
          {historyLoading && (
            <div className="py-8 text-center text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin inline" />
            </div>
          )}
          {!historyLoading && historyEvents.length === 0 && (
            <div className="py-8 text-center text-slate-500">No events recorded.</div>
          )}
          {!historyLoading && historyEvents.length > 0 && (
            <ol className="space-y-3 max-h-96 overflow-y-auto">
              {historyEvents.map(ev => (
                <li key={ev.id} className="border-l-2 border-cyan-700 pl-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{ev.event_type}</Badge>
                    {ev.channel && <Badge variant="secondary" className="text-xs">{ev.channel}</Badge>}
                    <span className="text-xs text-slate-400 ml-auto">
                      {new Date(ev.created_at).toLocaleString()}
                    </span>
                  </div>
                  {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                    <pre className="mt-1 text-xs text-slate-400 whitespace-pre-wrap break-all">
                      {JSON.stringify(ev.metadata, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>

      {/* Directory */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Building2 className="h-5 w-5" /> All VAs ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-500" />
              <Input
                placeholder="Search by name, email, phone…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {distinctRoles.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Assigned Company</TableHead>
                <TableHead>Membership Role</TableHead>
                <TableHead>Profile Role</TableHead>
                <TableHead>App Roles</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dirLoading && (
                <TableRow><TableCell colSpan={9} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell></TableRow>
              )}
              {!dirLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">
                  No VAs match these filters
                </TableCell></TableRow>
              )}
              {filtered.map(r => (
                <TableRow key={r.membership_id}>
                  <TableCell className="text-white">{r.full_name ?? '—'}</TableCell>
                  <TableCell>{r.email ?? '—'}</TableCell>
                  <TableCell>{r.phone ?? '—'}</TableCell>
                  <TableCell>
                    <Select
                      value={r.company_id}
                      onValueChange={(v) => {
                        if (v !== r.company_id) {
                          assignCompanyMut.mutate({
                            membership_id: r.membership_id,
                            company_id: v,
                            user_id: r.user_id,
                            role: r.role,
                          });
                        }
                      }}
                      disabled={assignCompanyMut.isPending}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-8 min-w-[150px]">
                        <SelectValue>
                          <span style={{ color: companyById[r.company_id]?.brand_color ?? '#06b6d4' }}>
                            {r.company_name}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.primary_role
                      ? <Badge variant="secondary">{r.primary_role}</Badge>
                      : <span className="text-xs text-slate-500">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.app_roles ?? []).length === 0
                        ? <span className="text-xs text-slate-500">—</span>
                        : r.app_roles!.map(role => (
                            <Badge key={role} variant="outline" className="text-xs">{role}</Badge>
                          ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {new Date(r.joined_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {r.is_active
                      ? <Badge variant="secondary">Active</Badge>
                      : <Badge variant="destructive">Inactive</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
