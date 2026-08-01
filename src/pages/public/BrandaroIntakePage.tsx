import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CheckCircle2, Upload, AlertTriangle, Loader2, Palette } from 'lucide-react';

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/brandaro-intake`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

type Prefill = {
  business_name: string;
  industry: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  colors: { primary?: string; secondary?: string; accent?: string };
};

const COLOR_FIELDS = [
  { key: 'primary' as const, label: 'Primary' },
  { key: 'secondary' as const, label: 'Secondary' },
  { key: 'accent' as const, label: 'Accent' },
];

export default function BrandaroIntakePage() {
  const [params] = useSearchParams();
  const demoId = params.get('demo')?.trim() ?? '';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tier, setTier] = useState<string>('starter');
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [preferredDomain, setPreferredDomain] = useState('');
  const [contentNotes, setContentNotes] = useState('');
  const [colors, setColors] = useState<Record<string, string>>({});
  const [existingLogo, setExistingLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!demoId) {
        setLoadError('This intake link is missing its reference. Please use the link we texted you.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${FN_URL}?demo=${encodeURIComponent(demoId)}`, {
          headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        });
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(body?.error ?? 'We could not find this intake form.');
        } else {
          const pre = body.prefill as Prefill;
          setTier(body.tier ?? 'starter');
          setAlreadyDone(body.intake_completed === true);
          setBusinessName(pre?.business_name ?? '');
          setColors(pre?.colors ?? {});
          setExistingLogo(pre?.logo_url ?? null);
        }
      } catch {
        if (!cancelled) setLoadError('We could not load your intake form. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [demoId]);

  const confirmation = useMemo(
    () =>
      tier === 'starter'
        ? "Thanks! We're building your site now."
        : 'Thanks! A developer will be in touch shortly to start your build.',
    [tier],
  );

  function onLogoChange(file: File | null) {
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error('Logo must be a PNG, JPG, WEBP, or SVG image.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Logo must be smaller than 5 MB.');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',').pop() ?? '');
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(file);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) return toast.error('Business name is required.');
    if (!contactEmail.trim()) return toast.error('Contact email is required.');

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        demo_id: demoId,
        business_name: businessName.trim(),
        contact_email: contactEmail.trim(),
        preferred_domain: preferredDomain.trim(),
        content_notes: contentNotes.trim(),
        colors,
      };
      if (logoFile) {
        payload.logo = { data: await fileToBase64(logoFile), content_type: logoFile.type };
      }
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body?.already) {
          setAlreadyDone(true);
          if (body.tier) setTier(body.tier);
        }
        toast.error(body?.error ?? 'Submission failed. Please try again.');
        return;
      }
      if (body.tier) setTier(body.tier);
      setSubmitted(true);
    } catch {
      toast.error('Submission failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">{children}</div>
    </main>
  );

  if (loading) {
    return (
      <Shell>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell>
        <Card>
          <CardHeader className="items-center text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden />
            <CardTitle>We couldn't open your intake form</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  if (submitted || alreadyDone) {
    return (
      <Shell>
        <Card>
          <CardHeader className="items-center text-center">
            <CheckCircle2 className="h-12 w-12 text-primary" aria-hidden />
            <CardTitle className="text-2xl">
              {submitted ? confirmation : 'Your details are already in.'}
            </CardTitle>
            <CardDescription>
              {tier === 'starter'
                ? "We'll email you as soon as your site is live."
                : "A developer on our team will reach out at the email you gave us."}
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Let's finish your website</h1>
        <p className="text-muted-foreground">
          A few quick details and we'll turn your demo into the real thing.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Business details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business-name">Business name *</Label>
              <Input
                id="business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Contact email *</Label>
              <Input
                id="contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                maxLength={255}
                required
              />
              <p className="text-xs text-muted-foreground">We'll use this for build updates.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Preferred domain</Label>
              <Input
                id="domain"
                value={preferredDomain}
                onChange={(e) => setPreferredDomain(e.target.value)}
                placeholder="yourbusiness.com"
                maxLength={253}
              />
              <p className="text-xs text-muted-foreground">Optional — leave blank if you don't have one yet.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your logo</CardTitle>
            <CardDescription>Optional — upload it and we'll use it across the site.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(logoPreview || existingLogo) && (
              <img
                src={logoPreview ?? existingLogo ?? ''}
                alt="Your business logo"
                className="h-20 w-auto rounded border border-border bg-muted object-contain p-2"
              />
            )}
            <div className="space-y-2">
              <Label htmlFor="logo" className="flex items-center gap-2">
                <Upload className="h-4 w-4" aria-hidden /> Upload logo
              </Label>
              <Input
                id="logo"
                type="file"
                accept={ALLOWED_LOGO_TYPES.join(',')}
                onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, or SVG — up to 5 MB.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette className="h-4 w-4" aria-hidden /> Brand colors
            </CardTitle>
            <CardDescription>Pre-filled from your demo — change any you'd like.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {COLOR_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`color-${key}`}>{label}</Label>
                <div className="flex items-center gap-2">
                  <input
                    id={`color-${key}`}
                    type="color"
                    value={colors[key] ?? '#000000'}
                    onChange={(e) => setColors((c) => ({ ...c, [key]: e.target.value }))}
                    className="h-10 w-12 cursor-pointer rounded border border-border bg-background"
                    aria-label={`${label} color`}
                  />
                  <Input
                    value={colors[key] ?? ''}
                    onChange={(e) => setColors((c) => ({ ...c, [key]: e.target.value }))}
                    placeholder="#000000"
                    maxLength={7}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Anything you want changed?</CardTitle>
            <CardDescription>
              Text, services, photos, hours — tell us what should differ from the demo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={contentNotes}
              onChange={(e) => setContentNotes(e.target.value)}
              rows={6}
              maxLength={5000}
              placeholder="e.g. Add our new location, drop the third service, use the photos I'm emailing over..."
              aria-label="Content notes"
            />
            <p className="mt-2 text-xs text-muted-foreground">{contentNotes.length}/5000</p>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {saving ? 'Submitting…' : 'Submit and start my build'}
        </Button>
      </form>
    </Shell>
  );
}
