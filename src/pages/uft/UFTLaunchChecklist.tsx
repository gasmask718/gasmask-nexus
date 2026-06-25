import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, PartyPopper, Lock } from 'lucide-react';

interface CheckItem {
  id: string;
  label: string;
  category: string;
  locked?: boolean; // pre-checked, cannot uncheck
  howToFix?: string;
}

const CHECKLIST: CheckItem[] = [
  // TECHNICAL (locked / done)
  { id: 't-db', label: 'Database: 26 tables with RLS', category: 'Technical', locked: true },
  { id: 't-edge', label: 'Edge functions: 15 + 6 admin = 21 total', category: 'Technical', locked: true },
  { id: 't-webhook', label: 'Stripe webhook registered', category: 'Technical', locked: true },
  { id: 't-connect', label: 'Stripe Connect configured', category: 'Technical', locked: true },
  { id: 't-staff', label: 'Staff categories: 130+ roles', category: 'Technical', locked: true },
  { id: 't-amb', label: 'Ambassador system built', category: 'Technical', locked: true },
  { id: 't-tour', label: 'Virtual tour support built', category: 'Technical', locked: true },
  { id: 't-cron', label: 'pg_cron review + reminder jobs', category: 'Technical', locked: true },
  { id: 't-ts', label: 'Zero TypeScript errors', category: 'Technical', locked: true },

  // CONFIGURATION
  { id: 'c-stripe-sk', label: 'STRIPE_SECRET_KEY added to UFT secrets', category: 'Config', howToFix: 'UFT Lovable → Settings → Secrets' },
  { id: 'c-stripe-pk', label: 'STRIPE_PUBLISHABLE_KEY added to UFT secrets', category: 'Config', howToFix: 'Same location as STRIPE_SECRET_KEY' },
  { id: 'c-stripe-whs', label: 'STRIPE_WEBHOOK_SECRET added to UFT secrets', category: 'Config', howToFix: 'Same location (whsec_oETlX11…)' },
  { id: 'c-resend', label: 'RESEND_API_KEY added to UFT secrets', category: 'Config', howToFix: 'resend.com → create API key → add to secrets' },
  { id: 'c-resend-domain', label: 'Resend domain verified', category: 'Config', howToFix: 'resend.com → Domains → verify unforgettabletimes.com' },
  { id: 'c-make-auth', label: 'Make.com Authorization header added', category: 'Config', howToFix: 'Make.com → scenario → HTTP module → Headers → add Bearer token' },
  { id: 'c-make-on', label: 'Make.com scenario activated', category: 'Config', howToFix: 'Toggle ON in Make.com' },

  // PRE-LAUNCH
  { id: 'p-test-payment', label: 'Test payment completed', category: 'Pre-Launch', howToFix: 'Use card 4242 4242 4242 4242 on build-event checkout' },
  { id: 'p-test-email', label: 'Booking confirmation email received', category: 'Pre-Launch', howToFix: 'Needs Resend key first' },
  { id: 'p-test-sms', label: 'Ambassador SMS fires on test sale', category: 'Pre-Launch', howToFix: 'Complete a test booking with ?ref= param' },
  { id: 'p-products', label: '20+ products in Shopify shop', category: 'Pre-Launch', howToFix: 'AutoDS → Marketplace → search party/event → import' },
  { id: 'p-shopify-bank', label: 'Shopify Payments connected to bank', category: 'Pre-Launch', howToFix: 'Shopify Admin → Settings → Payments' },
  { id: 'p-clean', label: 'Test vendor data removed from DB', category: 'Pre-Launch', howToFix: 'Supabase → delete test records' },
  { id: 'p-real-vendors', label: '5+ real vendor profiles added', category: 'Pre-Launch', howToFix: 'Share vendor signup link' },

  // GO-LIVE
  { id: 'g-stripe-live', label: 'Stripe live keys swapped in', category: 'Go-Live', howToFix: 'Get sk_live_ from Stripe dashboard' },
  { id: 'g-whs-live', label: 'Live webhook secret registered', category: 'Go-Live', howToFix: 'Register new webhook in Stripe live mode' },
  { id: 'g-domain', label: 'unforgettabletimes.com domain live', category: 'Go-Live', howToFix: 'Connect domain in Lovable settings' },
  { id: 'g-gsc', label: 'Google Search Console — sitemap submitted', category: 'Go-Live', howToFix: 'search.google.com/search-console' },
  { id: 'g-amb-10', label: 'First 10 ambassadors onboarded', category: 'Go-Live', howToFix: 'Share /ambassador-portal link' },
  { id: 'g-david', label: 'David completed personal test booking', category: 'Go-Live', howToFix: 'Go through full customer flow yourself' },
];

const STORAGE_KEY = 'uft-launch-checklist';
const CATEGORIES = ['Technical', 'Config', 'Pre-Launch', 'Go-Live'];

export default function UFTLaunchChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expandedFix, setExpandedFix] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setChecked(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = (item: CheckItem) => {
    if (item.locked) return;
    const next = { ...checked, [item.id]: !checked[item.id] };
    setChecked(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const isDone = (item: CheckItem) => item.locked || !!checked[item.id];

  const total = CHECKLIST.length;
  const done = CHECKLIST.filter(isDone).length;
  const pct = Math.round((done / total) * 100);
  const allDone = done === total;

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

      {CATEGORIES.map((cat) => (
        <Card key={cat}>
          <CardHeader><CardTitle className="text-base">{cat}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {CHECKLIST.filter((c) => c.category === cat).map((item) => {
              const done = isDone(item);
              return (
                <div key={item.id}>
                  <button
                    className={`flex items-center gap-3 w-full text-left py-1.5 rounded px-2 -mx-2 transition-colors ${item.locked ? 'cursor-default' : 'hover:bg-muted/30'}`}
                    onClick={() => toggle(item)}
                  >
                    {done ? (
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <span className={`text-sm ${done ? 'line-through text-muted-foreground' : ''}`}>
                      {item.label}
                    </span>
                    {item.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                    {!done && item.howToFix && (
                      <span
                        role="button"
                        className="ml-auto text-xs text-blue-400 hover:underline"
                        onClick={(e) => { e.stopPropagation(); setExpandedFix(expandedFix === item.id ? null : item.id); }}
                      >
                        How to fix
                      </span>
                    )}
                  </button>
                  {expandedFix === item.id && item.howToFix && (
                    <div className="ml-8 mt-1 mb-2 p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                      Fix: {item.howToFix}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
