import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';

/**
 * Public "Apply as an Independent Cleaner" intake (ICW).
 * Route: /apply/cleaner — no login required.
 * Submits to the icw-candidate-apply edge function, which writes to
 * icw_candidate_leads with status 'candidate'. Zero outreach, zero auto-approval.
 */
export default function ICWCleanerApplication() {
  const [search] = useSearchParams();
  const utm = useMemo(
    () => ({
      utm_source: search.get('utm_source') || undefined,
      utm_medium: search.get('utm_medium') || undefined,
      utm_campaign: search.get('utm_campaign') || undefined,
    }),
    [search],
  );

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    service_area: '',
    experience_summary: '',
    availability_summary: '',
    independent_signal: '',
    owns_supplies: '',
    contact_method: '',
    referral_source: '',
  });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = 'Apply as an Independent Cleaner | ICW';
  }, []);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError('Please tick the consent box before submitting.');
      return;
    }
    if (!form.full_name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      setError('Please give us either an email address or a phone number.');
      return;
    }
    setSubmitting(true);
    const { data, error: fnError } = await supabase.functions.invoke('icw-candidate-apply', {
      body: {
        ...form,
        owns_supplies:
          form.owns_supplies === 'yes' ? true : form.owns_supplies === 'no' ? false : null,
        independent_signal: form.independent_signal || null,
        contact_method: form.contact_method || null,
        consent: true,
        ...utm,
      },
    });
    setSubmitting(false);
    if (fnError || (data as any)?.error) {
      setError((data as any)?.error || fnError?.message || 'Something went wrong. Please try again.');
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <main className="min-h-screen bg-background px-4 py-16 flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h1 className="text-2xl font-bold">Application received</h1>
            <p className="text-sm text-muted-foreground">
              Thanks — your application is with our team for review. If you're a fit for upcoming
              independent contractor work, someone from ICW will reach out using the contact method
              you chose. Submitting this form doesn't guarantee selection.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Apply as an Independent Cleaner
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell us about your cleaning work and where you operate. Independent contractor
            consideration only — no account needed.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-6">
          <Card>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name *</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => set('full_name')(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    value={form.email}
                    onChange={(e) => set('email')(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => set('phone')(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Give us at least one of email or phone.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={form.city} onChange={(e) => set('city')(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" value={form.state} onChange={(e) => set('state')(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service_area">Service area</Label>
                <Input
                  id="service_area"
                  placeholder="e.g. Brooklyn + Queens, up to 20 miles"
                  value={form.service_area}
                  onChange={(e) => set('service_area')(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="experience_summary">Cleaning experience / services offered</Label>
                <Textarea
                  id="experience_summary"
                  rows={4}
                  placeholder="Years of experience, types of cleaning, any specialties."
                  value={form.experience_summary}
                  onChange={(e) => set('experience_summary')(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="availability_summary">Availability</Label>
                <Textarea
                  id="availability_summary"
                  rows={3}
                  placeholder="Days, hours, full-time or part-time."
                  value={form.availability_summary}
                  onChange={(e) => set('availability_summary')(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6 space-y-5">
              <div className="space-y-2">
                <Label>Are you independent / self-employed?</Label>
                <RadioGroup
                  value={form.independent_signal}
                  onValueChange={set('independent_signal')}
                  className="flex gap-6 pt-1"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="explicit_yes" id="ind_yes" />
                    <Label htmlFor="ind_yes" className="font-normal">Yes</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="explicit_no" id="ind_no" />
                    <Label htmlFor="ind_no" className="font-normal">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Do you own your cleaning supplies / products?</Label>
                <RadioGroup
                  value={form.owns_supplies}
                  onValueChange={set('owns_supplies')}
                  className="flex gap-6 pt-1"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="yes" id="sup_yes" />
                    <Label htmlFor="sup_yes" className="font-normal">Yes</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="sup_no" />
                    <Label htmlFor="sup_no" className="font-normal">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Preferred contact method</Label>
                <RadioGroup
                  value={form.contact_method}
                  onValueChange={set('contact_method')}
                  className="space-y-2 pt-1"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="public_phone" id="cm_phone" />
                    <Label htmlFor="cm_phone" className="font-normal">Phone / text</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="public_email" id="cm_email" />
                    <Label htmlFor="cm_email" className="font-normal">Email</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="platform_relay" id="cm_relay" />
                    <Label htmlFor="cm_relay" className="font-normal">
                      Through the platform I applied on
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="referral_source">How did you hear about us?</Label>
                <Input
                  id="referral_source"
                  placeholder="e.g. Craigslist ad, Indeed, friend referral"
                  value={form.referral_source}
                  onChange={(e) => set('referral_source')(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">Privacy notice</p>
                <p>
                  We collect the details you enter here — your name, contact details, location,
                  experience and availability — for one purpose: reviewing you as a possible
                  independent contractor cleaner. We do not sell your information and we do not
                  share it outside ICW for marketing. You can ask us to remove your information at
                  any time by emailing{' '}
                  <a href="mailto:privacy@icleanworld.com" className="text-primary underline">
                    privacy@icleanworld.com
                  </a>
                  , and we'll delete your application record.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="consent" className="text-sm font-normal leading-relaxed">
                  I consent to ICW collecting and reviewing this information for independent
                  contractor consideration. I understand submitting this form does not guarantee
                  selection. *
                </Label>
              </div>

              {error && (
                <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting || !consent}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit application
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </main>
  );
}
