/**
 * Dynasty-wide recruiting review / call queue.
 * Reads the canonical applicant identity (recruiting_applicants) through
 * v_recruiting_applicant_queue and writes status only — never creates a
 * second applicant record. Intake goes through ingest_recruiting_applicant
 * so duplicates are impossible.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, UserPlus, Search } from 'lucide-react';
import { toast } from 'sonner';

const REVIEW_STATUSES = ['new', 'in_review', 'qualified', 'rejected', 'on_hold'] as const;
const CALL_STATUSES = ['not_called', 'queued', 'attempted', 'reached', 'no_answer'] as const;
const ONBOARDING_STATUSES = ['not_started', 'in_progress', 'onboarded', 'declined'] as const;

const ANY = '__any__';

const REVIEW_BADGE: Record<string, string> = {
  new: 'bg-primary/15 text-primary border-primary/40',
  in_review: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  qualified: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  rejected: 'bg-destructive/15 text-destructive border-destructive/40',
  on_hold: 'bg-muted text-muted-foreground border-border',
};

const pretty = (v: string) => v.replace(/_/g, ' ');

export default function RecruitingApplicants() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(ANY);
  const [role, setRole] = useState<string>(ANY);
  const [business, setBusiness] = useState<string>(ANY);
  const [campaign, setCampaign] = useState<string>(ANY);
  const [state, setState] = useState<string>(ANY);
  const [reviewStatus, setReviewStatus] = useState<string>(ANY);
  const [open, setOpen] = useState(false);

  const categories = useQuery({
    queryKey: ['recruiting-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recruiting_categories')
        .select('id, slug, name, sort_order')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const roles = useQuery({
    queryKey: ['recruiting-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recruiting_roles')
        .select('id, slug, name, category_id, requires_license')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const campaigns = useQuery({
    queryKey: ['recruiting-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recruiting_campaigns')
        .select('id, code, name, platform, business_slug')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const queue = useQuery({
    queryKey: ['recruiting-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_recruiting_applicant_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (input: { id: string; field: string; value: string }) => {
      const { error } = await supabase
        .from('recruiting_applicants')
        .update({ [input.field]: input.value })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recruiting-queue'] });
      toast.success('Status updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ingest = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const { data, error } = await supabase.rpc('ingest_recruiting_applicant', {
        p_payload: payload,
      });
      if (error) throw error;
      return data as { applicant_created: boolean };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['recruiting-queue'] });
      setOpen(false);
      toast.success(res?.applicant_created ? 'Applicant added' : 'Matched an existing person — role added to them');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = queue.data ?? [];

  const businessOptions = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => r.business_slugs ?? []))).sort(),
    [rows],
  );
  const stateOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.state).filter(Boolean) as string[])).sort(),
    [rows],
  );

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q && ![r.full_name, r.email, r.phone, r.city].some((v) => v?.toLowerCase().includes(q))) return false;
    if (category !== ANY && !(r.category_slugs ?? []).includes(category)) return false;
    if (role !== ANY && !(r.role_names ?? []).includes(role)) return false;
    if (business !== ANY && !(r.business_slugs ?? []).includes(business)) return false;
    if (campaign !== ANY && !(r.campaign_codes ?? []).includes(campaign)) return false;
    if (state !== ANY && r.state !== state) return false;
    if (reviewStatus !== ANY && r.review_status !== reviewStatus) return false;
    return true;
  });

  const newCount = rows.filter((r) => r.review_status === 'new').length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Recruiting Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">
            One person, many roles. {rows.length} applicants · {newCount} awaiting review.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" /> Add applicant</Button>
          </DialogTrigger>
          <AddApplicantDialog
            categories={categories.data ?? []}
            roles={roles.data ?? []}
            campaigns={campaigns.data ?? []}
            onSubmit={(p) => ingest.mutate(p)}
            pending={ingest.isPending}
          />
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Name, email, phone, city" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <FilterSelect label="Category" value={category} onChange={setCategory}
            options={(categories.data ?? []).map((c) => ({ value: c.slug, label: c.name }))} />
          <FilterSelect label="Role" value={role} onChange={setRole}
            options={(roles.data ?? []).map((r) => ({ value: r.name, label: r.name }))} />
          <FilterSelect label="Business" value={business} onChange={setBusiness}
            options={businessOptions.map((b) => ({ value: b, label: b }))} />
          <FilterSelect label="Campaign" value={campaign} onChange={setCampaign}
            options={(campaigns.data ?? []).map((c) => ({ value: c.code, label: c.code }))} />
          <FilterSelect label="State" value={state} onChange={setState}
            options={stateOptions.map((s) => ({ value: s, label: s }))} />
          <FilterSelect label="Review status" value={reviewStatus} onChange={setReviewStatus}
            options={REVIEW_STATUSES.map((s) => ({ value: s, label: pretty(s) }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Applicants ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {queue.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading
            </div>
          ) : queue.error ? (
            <p className="text-destructive text-sm">{(queue.error as Error).message}</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">No applicants match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Businesses / Campaigns</TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead>Call</TableHead>
                    <TableHead>Onboarding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[r.email, r.phone].filter(Boolean).join(' · ')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[r.city, r.state].filter(Boolean).join(', ')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(r.category_names ?? []).map((c) => (
                            <Badge key={c} variant="outline">{c}</Badge>
                          ))}
                          {(r.role_names ?? []).map((n) => (
                            <Badge key={n} className="bg-primary/15 text-primary border-primary/40">{n}</Badge>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {r.application_count} application{r.application_count === 1 ? '' : 's'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <div>{(r.business_slugs ?? []).join(', ') || '—'}</div>
                          <div className="text-muted-foreground">
                            {[...(r.campaign_codes ?? []), ...(r.source_platforms ?? [])].join(' · ') || 'no campaign'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusPicker
                          value={r.review_status ?? 'new'}
                          options={REVIEW_STATUSES}
                          badgeClass={REVIEW_BADGE[r.review_status ?? 'new']}
                          onChange={(v) => updateStatus.mutate({ id: r.id!, field: 'review_status', value: v })}
                          pending={updateStatus.isPending}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusPicker
                          value={r.call_status ?? 'not_called'}
                          options={CALL_STATUSES}
                          onChange={(v) => updateStatus.mutate({ id: r.id!, field: 'call_status', value: v })}
                          pending={updateStatus.isPending}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusPicker
                          value={r.onboarding_status ?? 'not_started'}
                          options={ONBOARDING_STATUSES}
                          onChange={(v) => updateStatus.mutate({ id: r.id!, field: 'onboarding_status', value: v })}
                          pending={updateStatus.isPending}
                        />
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

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatusPicker({
  value, options, onChange, pending, badgeClass,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  pending?: boolean;
  badgeClass?: string;
}) {
  return (
    <div className="space-y-1">
      {badgeClass && <Badge className={badgeClass}>{pretty(value)}</Badge>}
      <Select value={value} onValueChange={onChange} disabled={pending}>
        <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{pretty(o)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AddApplicantDialog({
  categories, roles, campaigns, onSubmit, pending,
}: {
  categories: { id: string; slug: string; name: string }[];
  roles: { id: string; slug: string; name: string; category_id: string }[];
  campaigns: { id: string; code: string; name: string }[];
  onSubmit: (payload: Record<string, string>) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', city: '', state: '',
    category_slug: '', role_slug: '', business_slug: '', campaign_code: '',
    source_platform: '', source_ad_id: '',
    experience_summary: '', license_info: '', availability_summary: '',
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const selectedCategory = categories.find((c) => c.slug === form.category_slug);
  const roleOptions = roles.filter((r) => r.category_id === selectedCategory?.id);

  const submit = () => {
    if (!form.full_name.trim()) return toast.error('Name is required');
    if (!form.email.trim() && !form.phone.trim()) return toast.error('Email or phone is required');
    if (!form.category_slug) return toast.error('Pick a category');
    const payload: Record<string, string> = {};
    Object.entries(form).forEach(([k, v]) => { if (v.trim()) payload[k] = v.trim(); });
    onSubmit(payload);
  };

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Add applicant</DialogTitle></DialogHeader>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Full name *"><Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
        <Field label="Email"><Input value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="City"><Input value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
        <Field label="State"><Input value={form.state} onChange={(e) => set('state', e.target.value)} /></Field>
        <Field label="Category *">
          <Select value={form.category_slug} onValueChange={(v) => { set('category_slug', v); set('role_slug', ''); }}>
            <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Role">
          <Select value={form.role_slug} onValueChange={(v) => set('role_slug', v)} disabled={!roleOptions.length}>
            <SelectTrigger><SelectValue placeholder={roleOptions.length ? 'Pick a role' : 'No detailed roles yet'} /></SelectTrigger>
            <SelectContent>
              {roleOptions.map((r) => <SelectItem key={r.slug} value={r.slug}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Business"><Input value={form.business_slug} onChange={(e) => set('business_slug', e.target.value)} /></Field>
        <Field label="Campaign">
          <Select value={form.campaign_code} onValueChange={(v) => set('campaign_code', v)} disabled={!campaigns.length}>
            <SelectTrigger><SelectValue placeholder={campaigns.length ? 'Pick a campaign' : 'No campaigns yet'} /></SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Source platform"><Input value={form.source_platform} onChange={(e) => set('source_platform', e.target.value)} /></Field>
        <Field label="Ad / source ID"><Input value={form.source_ad_id} onChange={(e) => set('source_ad_id', e.target.value)} /></Field>
        <Field label="License / certification"><Input value={form.license_info} onChange={(e) => set('license_info', e.target.value)} /></Field>
        <Field label="Availability"><Input value={form.availability_summary} onChange={(e) => set('availability_summary', e.target.value)} /></Field>
        <div className="md:col-span-2">
          <Field label="Experience / qualifications">
            <Textarea rows={3} value={form.experience_summary} onChange={(e) => set('experience_summary', e.target.value)} />
          </Field>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save applicant
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
