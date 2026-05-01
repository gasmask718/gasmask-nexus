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
import { toast } from 'sonner';
import { Loader2, Mail, Copy, RefreshCw, UserPlus, Building2, Search, Trash2 } from 'lucide-react';

interface Company { id: string; slug: string; name: string; brand_color: string | null; }
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
}
interface Invite {
  id: string; email: string; role: string; status: string;
  expires_at: string; created_at: string; company_id: string;
  token: string;
}

export default function VAManagementPage() {
  const qc = useQueryClient();

  // ---- Companies ----
  const { data: companies = [] } = useQuery({
    queryKey: ['va-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('va_companies').select('id, slug, name, brand_color')
        .eq('is_active', true).order('name');
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });

  // ---- Directory ----
  const { data: directory = [], isLoading: dirLoading } = useQuery({
    queryKey: ['va-directory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_va_directory' as any)
        .select('*')
        .order('joined_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as DirRow[];
    },
  });

  // ---- Invites ----
  const { data: invites = [] } = useQuery({
    queryKey: ['va-invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('va_invites')
        .select('id, email, role, status, expires_at, created_at, company_id, token')
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as Invite[];
    },
  });

  // ---- Form ----
  const [form, setForm] = useState({ email: '', company_id: '', role: 'va' });

  useEffect(() => {
    if (!form.company_id && companies.length) {
      setForm(f => ({ ...f, company_id: companies[0].id }));
    }
  }, [companies, form.company_id]);

  const inviteMut = useMutation({
    mutationFn: async () => {
      if (!form.email.trim() || !form.company_id) throw new Error('Email and company required');
      const { data, error } = await supabase.functions.invoke('invite-va', {
        body: { email: form.email.trim(), company_id: form.company_id, role: form.role },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { accept_url: string; email_sent: boolean; email_error: string | null };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['va-invites'] });
      setForm(f => ({ ...f, email: '' }));
      if (data.email_sent) {
        toast.success('Invite sent', { description: form.email });
      } else {
        toast.message('Invite created (email not sent)', {
          description: 'Email infra not configured. Copy the link manually.',
        });
      }
      navigator.clipboard?.writeText(data.accept_url).catch(() => {});
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to invite'),
  });

  const revokeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('va_invites')
        .update({ status: 'revoked' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['va-invites'] });
      toast.success('Invite revoked');
    },
    onError: (e: any) => toast.error(e.message),
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
    const url = `${window.location.origin}/va/accept-invite/${token}`;
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
        <CardContent className="grid gap-4 md:grid-cols-4">
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
          <div className="md:col-span-4">
            <Button
              onClick={() => inviteMut.mutate()}
              disabled={inviteMut.isPending || !form.email || !form.company_id}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {inviteMut.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
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
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">
                  No invites yet
                </TableCell></TableRow>
              )}
              {invites.map(i => (
                <TableRow key={i.id}>
                  <TableCell className="text-white">{i.email}</TableCell>
                  <TableCell>{companyById[i.company_id]?.name ?? '—'}</TableCell>
                  <TableCell>{i.role}</TableCell>
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
                    {i.status === 'pending' && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => copyLink(i.token)}>
                          <Copy className="h-3 w-3 mr-1" /> Link
                        </Button>
                        <Button size="sm" variant="ghost"
                          className="text-red-400" onClick={() => revokeMut.mutate(i.id)}>
                          Revoke
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dirLoading && (
                <TableRow><TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell></TableRow>
              )}
              {!dirLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">
                  No VAs match these filters
                </TableCell></TableRow>
              )}
              {filtered.map(r => (
                <TableRow key={r.membership_id}>
                  <TableCell className="text-white">{r.full_name ?? '—'}</TableCell>
                  <TableCell>{r.email ?? '—'}</TableCell>
                  <TableCell>{r.phone ?? '—'}</TableCell>
                  <TableCell>
                    <Badge style={{
                      backgroundColor: (companyById[r.company_id]?.brand_color ?? '#06b6d4') + '33',
                      color: companyById[r.company_id]?.brand_color ?? '#06b6d4',
                    }}>{r.company_name}</Badge>
                  </TableCell>
                  <TableCell>{r.role}</TableCell>
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
