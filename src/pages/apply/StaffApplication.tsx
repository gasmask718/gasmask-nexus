import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Loader2 } from 'lucide-react';

type Category = { id: string; slug: string; name: string };
type Role = { id: string; category_id: string; slug: string; name: string; requires_license: boolean };

/**
 * Public staff / specialty application intake.
 * Route: /apply/staff — no login required.
 * Submits to the recruiting-apply edge function, which calls the canonical
 * ingest_recruiting_applicant() RPC (dedupe by email / last-10 phone).
 * No automated outreach of any kind.
 */
export default function StaffApplication() {
  const [search] = useSearchParams();
  const campaignCode = search.get('c') || search.get('campaign') || '';
  const sourcePlatform = search.get('src') || search.get('utm_source') || '';
  const sourceAdId = search.get('ad') || search.get('utm_content') || '';
  const presetCategory = search.get('category') || '';
  const presetRole = search.get('role') || '';

  const [categories, setCategories] = useState<Category[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    business_slug: '',
    experience_summary: '',
    qualifications: '',
    license_info: '',
    availability_summary: '',
  });
  const [honeypot, setHoneypot] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = 'Apply to Work With Us | Dynasty';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'Apply for staff, driver, security, beauty, event and specialty roles across the Dynasty group of businesses.');
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error: fnError } = await supabase.functions.invoke('recruiting-apply?taxonomy=1', {
        method: 'GET',
      });
      if (fnError) {
        setError('We could not load the role list. Please refresh the page.');
      } else if (data) {
        const cats: Category[] = data.categories || [];
        const rls: Role[] = data.roles || [];
        setCategories(cats);
        setRoles(rls);
        const pc = cats.find((c) => c.slug === presetCategory);
        if (pc) setCategoryId(pc.id);
        const pr = rls.find((r) => r.slug === presetRole && (!pc || r.category_id === pc.id));
        if (pr) {
          setRoleId(pr.id);
          setCategoryId(pr.category_id);
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRoles = useMemo(
    () => roles.filter((r) => r.category_id === categoryId),
    [roles, categoryId],
  );
  const selectedRole = roles.find((r) => r.id === roleId);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.full_name.trim()) return setError('Please enter your full name.');
    if (!form.email.trim() && form.phone.replace(/\D/g, '').length < 10)
      return setError('Please give us either an email address or a valid phone number.');
    if (!categoryId) return setError('Please choose what kind of work you are applying for.');

    setSubmitting(true);
    const category = categories.find((c) => c.id === categoryId);
    const { data, error: fnError } = await supabase.functions.invoke('recruiting-apply', {
      body: {
        ...form,
        category_slug: category?.slug,
        role_id: roleId || undefined,
        campaign_code: campaignCode || undefined,
        source_platform: sourcePlatform || 'public_form',
        source_ad_id: sourceAdId || undefined,
        company_website: honeypot,
      },
    });
    setSubmitting(false);
    if (fnError) {
      setError('Something went wrong sending your application. Please try again in a moment.');
      return;
    }
    if (data?.error) {
      setError(
        data.error === 'rate_limited'
          ? 'Too many submissions from this device. Please try again later.'
          : 'Please check your details and try again.',
      );
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto text-primary" />
            <h1 className="text-2xl font-semibold">Application received</h1>
            <p className="text-muted-foreground">
              Thanks {form.full_name.split(' ')[0]} — our team reviews every application by hand. If it
              looks like a fit, someone will reach out to you directly.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Apply to work with us</h1>
          <p className="text-muted-foreground">
            Tell us what you do and where you are. One form covers every role across our businesses.
          </p>
        </header>

        <Card>
          <CardContent className="p-6">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading roles…
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>What kind of work? *</Label>
                    <Select
                      value={categoryId}
                      onValueChange={(v) => {
                        setCategoryId(v);
                        setRoleId('');
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Specific role</Label>
                    <Select value={roleId} onValueChange={setRoleId} disabled={!visibleRoles.length}>
                      <SelectTrigger>
                        <SelectValue placeholder={visibleRoles.length ? 'Choose a role' : 'No specific roles listed'} />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleRoles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full name *</Label>
                    <Input id="full_name" maxLength={120} value={form.full_name} onChange={(e) => set('full_name')(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" maxLength={40} value={form.phone} onChange={(e) => set('phone')(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" maxLength={255} value={form.email} onChange={(e) => set('email')(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" maxLength={120} value={form.city} onChange={(e) => set('city')(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" maxLength={60} value={form.state} onChange={(e) => set('state')(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business_slug">Business you're applying to (optional)</Label>
                    <Input id="business_slug" maxLength={80} value={form.business_slug} onChange={(e) => set('business_slug')(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience_summary">Experience</Label>
                  <Textarea id="experience_summary" rows={3} maxLength={4000} value={form.experience_summary} onChange={(e) => set('experience_summary')(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qualifications">Skills & qualifications</Label>
                  <Textarea id="qualifications" rows={3} maxLength={4000} value={form.qualifications} onChange={(e) => set('qualifications')(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="license_info">
                    License / certification {selectedRole?.requires_license ? '(required for this role)' : '(if applicable)'}
                  </Label>
                  <Input id="license_info" maxLength={1000} value={form.license_info} onChange={(e) => set('license_info')(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="availability_summary">Availability</Label>
                  <Input id="availability_summary" maxLength={1000} placeholder="e.g. weekends, nights, full time" value={form.availability_summary} onChange={(e) => set('availability_summary')(e.target.value)} />
                </div>

                {/* spam honeypot – hidden from humans */}
                <div className="hidden" aria-hidden="true">
                  <Label htmlFor="company_website">Company website</Label>
                  <Input id="company_website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                </div>

                {error && (
                  <p className="text-sm rounded-md bg-destructive/15 text-destructive px-3 py-2">{error}</p>
                )}

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit application
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  We review every application by hand. No automated calls or texts.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
