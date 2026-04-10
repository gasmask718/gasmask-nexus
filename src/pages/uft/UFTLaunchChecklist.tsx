import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, PartyPopper } from 'lucide-react';

interface CheckItem {
  id: string;
  label: string;
  category: string;
  howToFix?: string;
}

const CHECKLIST: CheckItem[] = [
  { id: 'schema', label: 'Supabase schema complete (15 tables)', category: 'Technical' },
  { id: 'rls', label: 'RLS on all tables', category: 'Technical' },
  { id: 'edge', label: '15 edge functions deployed', category: 'Technical' },
  { id: 'webhook', label: 'Stripe webhook registered', category: 'Technical' },
  { id: 'connect', label: 'Stripe Connect configured', category: 'Technical' },
  { id: 'cron', label: 'pg_cron jobs active', category: 'Technical' },
  { id: 'resend', label: 'RESEND_API_KEY added to Vault', category: 'Configuration', howToFix: 'Go to Lovable Cloud → Secrets → Add RESEND_API_KEY from resend.com dashboard.' },
  { id: 'resend-domain', label: 'Resend domain verified (no-reply@unforgettabletimes.com)', category: 'Configuration', howToFix: 'In Resend dashboard → Domains → Add unforgettabletimes.com → Add DNS records.' },
  { id: 'twilio-ac', label: 'Twilio AC-prefix SID confirmed', category: 'Configuration', howToFix: 'Verify TWILIO_ACCOUNT_SID starts with "AC". Update in Lovable Cloud → Secrets if needed.' },
  { id: 'stripe-key', label: 'STRIPE_SECRET_KEY in Vault (test mode)', category: 'Configuration' },
  { id: 'dynasty-key', label: 'Dynasty OS API key in both Vaults', category: 'Configuration' },
  { id: 'test-payment', label: 'Test payment end-to-end (test card)', category: 'Pre-Launch', howToFix: 'Use Stripe test card 4242424242424242 to complete a full booking flow.' },
  { id: 'test-email', label: 'Test booking confirmation email fires', category: 'Pre-Launch', howToFix: 'Complete a test booking and verify email arrives via Resend logs.' },
  { id: 'test-sms', label: 'Test ambassador SMS fires on sale', category: 'Pre-Launch', howToFix: 'Use a test ref_code to trigger the track-ambassador-sale edge function.' },
  { id: 'test-ai', label: 'Test AI event planner generates plan', category: 'Pre-Launch', howToFix: 'Call generate-event-plan edge function with sample prompt and verify vendor matches.' },
  { id: 'clean-data', label: 'Remove all test/seed data', category: 'Pre-Launch' },
  { id: 'domain', label: 'Verify unforgettabletimes.com domain', category: 'Pre-Launch', howToFix: 'Point DNS A record to hosting provider. Verify in Lovable publish settings.' },
  { id: 'stripe-live', label: 'Swap sk_test_ → sk_live_ in Vault', category: 'Go-Live', howToFix: 'In Lovable Cloud → Secrets → Update STRIPE_SECRET_KEY with live key from Stripe dashboard.' },
  { id: 'webhook-live', label: 'Swap whsec_test → live webhook secret', category: 'Go-Live', howToFix: 'Register live webhook endpoint in Stripe → Developers → Webhooks.' },
  { id: 'resend-verify', label: 'Verify domain with Resend', category: 'Go-Live' },
  { id: 'announce', label: 'Announce to first 10 ambassadors', category: 'Go-Live' },
  { id: 'sitemap', label: 'Submit sitemap to Google Search Console', category: 'Go-Live', howToFix: 'Go to search.google.com/search-console → Add property → Submit sitemap.xml.' },
  { id: 'analytics', label: 'Enable Google Analytics or Plausible', category: 'Go-Live', howToFix: 'Add tracking script to index.html or use a Plausible integration.' },
];

const STORAGE_KEY = 'uft-launch-checklist';

export default function UFTLaunchChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expandedFix, setExpandedFix] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setChecked(JSON.parse(saved));
    } catch {}
  }, []);

  const toggle = (id: string) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const total = CHECKLIST.length;
  const done = CHECKLIST.filter((c) => checked[c.id]).length;
  const pct = Math.round((done / total) * 100);
  const allDone = done === total;
  const categories = [...new Set(CHECKLIST.map((c) => c.category))];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <PartyPopper className="h-7 w-7 text-purple-400" />
        <div>
          <h1 className="text-2xl font-bold">Launch Checklist</h1>
          <p className="text-sm text-muted-foreground">Unforgettable Times pre-launch verification</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{done} of {total} complete</span>
            <span className="text-sm font-bold">{pct}%</span>
          </div>
          <Progress value={pct} className="h-3" />
          {allDone && (
            <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
              <p className="text-lg font-bold text-green-400">🚀 Platform is READY TO LAUNCH</p>
            </div>
          )}
        </CardContent>
      </Card>

      {categories.map((cat) => (
        <Card key={cat}>
          <CardHeader><CardTitle className="text-base">{cat}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {CHECKLIST.filter((c) => c.category === cat).map((item) => (
              <div key={item.id}>
                <button
                  className="flex items-center gap-3 w-full text-left py-1.5 hover:bg-muted/30 rounded px-2 -mx-2 transition-colors"
                  onClick={() => toggle(item.id)}
                >
                  {checked[item.id] ? (
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <span className={`text-sm ${checked[item.id] ? 'line-through text-muted-foreground' : ''}`}>
                    {item.label}
                  </span>
                  {!checked[item.id] && item.howToFix && (
                    <button
                      className="ml-auto text-xs text-blue-400 hover:underline"
                      onClick={(e) => { e.stopPropagation(); setExpandedFix(expandedFix === item.id ? null : item.id); }}
                    >
                      How to fix
                    </button>
                  )}
                </button>
                {expandedFix === item.id && item.howToFix && (
                  <div className="ml-8 mt-1 mb-2 p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                    {item.howToFix}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
