import { Badge } from '@/components/ui/badge';
import { Check, Zap, Crown, Rocket, DollarSign, Gift } from 'lucide-react';

interface Tier {
  name: string;
  price: string;
  cadence: string;
  icon: any;
  color: string;
  border: string;
  tagline: string;
  features: string[];
  bestFor: string;
}

const TIERS: Tier[] = [
  {
    name: 'Starter',
    price: '$497',
    cadence: '/month',
    icon: Zap,
    color: 'text-cyan-300',
    border: 'border-cyan-500/40 bg-cyan-500/5',
    tagline: 'Get found online — fast.',
    bestFor: 'Solo owners, new businesses, single location',
    features: [
      'Google Business Profile setup & optimization',
      'Local SEO foundation (citations + maps)',
      'Reputation management (review requests)',
      '1 social media platform managed',
      'Monthly performance report',
      'Dedicated VA support',
    ],
  },
  {
    name: 'Growth',
    price: '$997',
    cadence: '/month',
    icon: Rocket,
    color: 'text-emerald-300',
    border: 'border-emerald-500/50 bg-emerald-500/10',
    tagline: 'Most popular — built to scale leads.',
    bestFor: 'Established businesses ready for more inquiries',
    features: [
      'Everything in Starter',
      'Google Ads management ($500 ad spend included)',
      'SEO content (4 blog posts/mo)',
      '3 social platforms managed',
      'Lead capture website / landing page',
      'Bi-weekly strategy calls',
      'AI-powered lead qualification',
    ],
  },
  {
    name: 'Domination',
    price: '$2,497',
    cadence: '/month',
    icon: Crown,
    color: 'text-amber-300',
    border: 'border-amber-500/40 bg-amber-500/5',
    tagline: 'Own your market.',
    bestFor: 'Multi-location, high-ticket services, ready to dominate',
    features: [
      'Everything in Growth',
      'Full website build & hosting',
      'Google + Meta + TikTok ads ($1.5k spend)',
      'Unlimited social platforms',
      'Video content (4 short-form/mo)',
      'CRM + automation setup',
      'Dedicated account strategist',
      'Weekly calls + 24/7 support',
    ],
  },
];

const ADD_ONS = [
  { label: 'Logo + brand identity', price: '$497 one-time' },
  { label: 'Photo / video shoot day', price: '$897 one-time' },
  { label: 'Email marketing setup', price: '$297/mo' },
  { label: 'SMS marketing automation', price: '$197/mo' },
];

const INCLUDED_BONUSES = [
  'Free 30-min strategy call before signing',
  'No long-term contract — month-to-month',
  '90-day results guarantee on Growth & Domination',
  'Dedicated US-based account manager',
  'Free monthly strategy review',
];

export function VAServicesPricing() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-400" />
          Services & Pricing — What We Offer
        </h3>
        <p className="text-[11px] text-slate-400">
          Reference instantly while on the call. Tap a tier to read aloud.
        </p>
      </div>

      {/* Tiers */}
      <div className="space-y-2">
        {TIERS.map(tier => {
          const Icon = tier.icon;
          return (
            <div key={tier.name} className={`rounded-lg p-3 border ${tier.border}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${tier.color}`} />
                  <span className={`text-sm font-bold ${tier.color}`}>{tier.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-white">{tier.price}</span>
                  <span className="text-[10px] text-slate-400">{tier.cadence}</span>
                </div>
              </div>
              <p className="text-xs italic text-slate-300 mb-2">"{tier.tagline}"</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                Best for: <span className="text-slate-300 normal-case">{tier.bestFor}</span>
              </p>
              <ul className="space-y-1">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-slate-300">
                    <Check className={`h-3 w-3 mt-0.5 shrink-0 ${tier.color}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Add-ons */}
      <div className="rounded-lg p-3 border border-slate-700/60 bg-slate-900/40">
        <p className="text-xs font-bold text-purple-300 mb-2 flex items-center gap-1.5">
          <Zap className="h-3 w-3" /> Popular Add-Ons
        </p>
        <div className="space-y-1">
          {ADD_ONS.map(a => (
            <div key={a.label} className="flex justify-between text-xs">
              <span className="text-slate-300">{a.label}</span>
              <span className="text-purple-300 font-mono">{a.price}</span>
            </div>
          ))}
        </div>
      </div>

      {/* What's always included */}
      <div className="rounded-lg p-3 border border-emerald-500/30 bg-emerald-500/5">
        <p className="text-xs font-bold text-emerald-300 mb-2 flex items-center gap-1.5">
          <Gift className="h-3 w-3" /> What's Always Included (Every Plan)
        </p>
        <ul className="space-y-1">
          {INCLUDED_BONUSES.map(b => (
            <li key={b} className="flex items-start gap-1.5 text-xs text-slate-300">
              <Check className="h-3 w-3 mt-0.5 shrink-0 text-emerald-400" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Quick pitch line */}
      <div className="rounded-lg p-3 border border-cyan-500/30 bg-cyan-500/5">
        <p className="text-[10px] uppercase tracking-wide text-cyan-400 mb-1 font-bold">
          Quick Pitch (read on call)
        </p>
        <p className="text-xs text-slate-200 italic leading-relaxed">
          "Most of our clients start on the <strong className="text-emerald-300">Growth plan at $997</strong> —
          it's our most popular because it includes Google Ads, SEO, social management, and a lead-capture
          page. There's no contract, you can cancel anytime, and we guarantee results in the first 90 days.
          Want me to walk you through what that would look like for your business?"
        </p>
      </div>
    </div>
  );
}
