import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Loader2, BookOpen, Shield, Trophy } from 'lucide-react';

interface ScriptStep {
  id: string;
  step_number: number;
  step_name: string;
  step_key: string;
  display_label: string | null;
  va_says: string;
  coaching_tip: string | null;
  tag_lead_as: string | null;
}

interface Rebuttal {
  id: string;
  objection_key: string;
  label: string;
  human_response: string | null;
  soft_rebuttal: string | null;
  aggressive_rebuttal: string | null;
}

interface Props {
  businessName?: string;
  firstName?: string;
  vaName?: string;
  city?: string;
}

const PACKAGES = [
  { name: 'Starter', price: '$750', terms: '$375 deposit / $375 launch', highlights: '3 pages, mobile-responsive, basic SEO, live in 5–7 days', best: 'New businesses, solopreneurs' },
  { name: 'Professional ⭐', price: '$1,500', terms: '$750 deposit / $750 launch', highlights: 'Up to 7 pages, advanced SEO, social integration, popups, 7–10 days', best: 'Established service businesses' },
  { name: 'Premium', price: '$2,997', terms: '$1,498.50 / $1,498.50', highlights: 'Unlimited pages, custom photography, pro copy, e-commerce, 14–21 days', best: 'Brands wanting standout design / e-com' },
  { name: 'Enterprise', price: '$5,000+', terms: 'Custom', highlights: 'Multi-location, portals, custom integrations, dedicated PM', best: 'Multi-location / franchises' },
];

const CLOSES = [
  { name: 'Assumptive', text: 'What email should I send the receipt to?' },
  { name: 'Demo-Lock', text: 'Your demo expires in 24 hours. Today\'s pricing is locked for today only. Text me back yes and I\'ll send the link.' },
  { name: 'Bundle', text: 'Bundle the website + Care Plan + Sara — I\'ll knock $200 off the website. Best deal I can do. Yes or no?' },
  { name: 'Choice', text: 'Two options. A: Pro + Care + Sara at $1,500 setup + $396/mo. B: Just website + Care at $1,500 + $97/mo. Which one feels right?' },
  { name: 'Risk-Reversal', text: 'You pay 50% deposit today. We build the site. If you hate it during design, you get the deposit back. ZERO risk. Send the link?' },
];

const INDUSTRY_HOOKS: Record<string, string> = {
  'Real Estate': 'Real estate is speed-to-lead. Whoever responds first wins. Sara picks up in 1 ring, qualifies the lead, books the showing.',
  'Restaurants': 'Restaurants live and die by reviews. We fix your Google rating in 90 days, capture every reservation call, get your menu online for orders.',
  'Trades (Plumbing/HVAC)': 'You\'re on jobs all day — every missed call is $200–$500 walking away. Sara captures EVERY call 24/7.',
  'Salons / Barbershops': 'Online booking + Sara means appointments 24/7. Customers book at midnight. No more phone tag.',
  'Cleaning Services': 'Cleaning gets crushed by inquiry volume. AI handles every chat, DM, message — qualifies, gives ballpark pricing, books the estimate.',
};

function fillTokens(text: string, p: Props): string {
  return text
    .replace(/\[FIRST_NAME\]/g, p.firstName || '[FIRST_NAME]')
    .replace(/\[VA_NAME\]/g, p.vaName || '[VA_NAME]')
    .replace(/\[BUSINESS_NAME\]/g, p.businessName || '[BUSINESS_NAME]')
    .replace(/\[CITY\]/g, p.city || '[CITY]')
    .replace(/\[NAME\]/g, p.firstName || '[NAME]');
}

export function BrandaroCallScript(props: Props) {
  const [steps, setSteps] = useState<ScriptStep[]>([]);
  const [rebuttals, setRebuttals] = useState<Rebuttal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [s, r] = await Promise.all([
        (supabase as any)
          .from('brandaro_sales_script_steps')
          .select('id, step_number, step_name, step_key, display_label, va_says, coaching_tip, tag_lead_as')
          .eq('is_active', true)
          .order('step_number'),
        (supabase as any)
          .from('brandaro_closer_rebuttals')
          .select('id, objection_key, label, human_response, soft_rebuttal, aggressive_rebuttal'),
      ]);
      if (cancel) return;
      setSteps(s.data || []);
      setRebuttals(r.data || []);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  if (loading) {
    return (
      <Card className="bg-slate-900/60 border-slate-700">
        <CardContent className="p-6 flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading sales playbook…
        </CardContent>
      </Card>
    );
  }

  const step = steps[activeIdx];

  return (
    <Card className="bg-slate-900/60 border-slate-700">
      <CardContent className="p-0">
        <Tabs defaultValue="script" className="w-full">
          <TabsList className="w-full bg-slate-800 rounded-t-lg rounded-b-none border-b border-slate-700">
            <TabsTrigger value="script" className="flex-1 text-xs gap-1"><BookOpen className="h-3 w-3" /> Script</TabsTrigger>
            <TabsTrigger value="rebuttals" className="flex-1 text-xs gap-1"><Shield className="h-3 w-3" /> Rebuttals</TabsTrigger>
            <TabsTrigger value="packages" className="flex-1 text-xs">Packages</TabsTrigger>
            <TabsTrigger value="closes" className="flex-1 text-xs gap-1"><Trophy className="h-3 w-3" /> Closes</TabsTrigger>
            <TabsTrigger value="hooks" className="flex-1 text-xs">Industry</TabsTrigger>
          </TabsList>

          {/* SCRIPT */}
          <TabsContent value="script" className="p-4 space-y-3 mt-0">
            {step && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <Badge className="bg-cyan-600 text-white text-[10px]">
                    {step.display_label || `Stage ${step.step_number}`}
                  </Badge>
                  <div className="flex gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7"
                      onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                      disabled={activeIdx === 0}>
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-7 w-7"
                      onClick={() => setActiveIdx(i => Math.min(steps.length - 1, i + 1))}
                      disabled={activeIdx >= steps.length - 1}>
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="bg-slate-800/60 border border-slate-700 rounded p-3">
                  <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-line">
                    {fillTokens(step.va_says, props)}
                  </p>
                </div>
                {step.coaching_tip && (
                  <div className="text-[11px] text-amber-300/90 italic border-l-2 border-amber-500/50 pl-2">
                    💡 {step.coaching_tip}
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {steps.map((s, i) => (
                    <button key={s.id} onClick={() => setActiveIdx(i)}
                      className={`h-6 w-6 rounded text-[10px] font-bold border transition ${
                        i === activeIdx
                          ? 'bg-cyan-500 border-cyan-400 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}>
                      {s.step_number}
                    </button>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* REBUTTALS */}
          <TabsContent value="rebuttals" className="p-4 space-y-3 mt-0 max-h-[420px] overflow-y-auto">
            {rebuttals.length === 0 && <p className="text-xs text-slate-400">No rebuttals loaded.</p>}
            {rebuttals.map(r => (
              <div key={r.id} className="bg-slate-800/60 border border-slate-700 rounded p-3 space-y-2">
                <div className="text-xs font-bold text-orange-400">"{r.label}"</div>
                {r.human_response && (
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {fillTokens(r.human_response, props)}
                  </p>
                )}
                {(r.soft_rebuttal || r.aggressive_rebuttal) && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/50">
                    {r.soft_rebuttal && (
                      <div className="text-[10px] text-emerald-300/80">
                        <span className="font-bold">Soft:</span> {fillTokens(r.soft_rebuttal, props)}
                      </div>
                    )}
                    {r.aggressive_rebuttal && (
                      <div className="text-[10px] text-rose-300/80">
                        <span className="font-bold">Hard:</span> {fillTokens(r.aggressive_rebuttal, props)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </TabsContent>

          {/* PACKAGES */}
          <TabsContent value="packages" className="p-4 space-y-2 mt-0 max-h-[420px] overflow-y-auto">
            {PACKAGES.map(p => (
              <div key={p.name} className="bg-slate-800/60 border border-slate-700 rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-white">{p.name}</span>
                  <span className="text-sm font-mono text-emerald-400">{p.price}</span>
                </div>
                <div className="text-[10px] text-slate-400 mb-1">{p.terms}</div>
                <div className="text-xs text-slate-200">{p.highlights}</div>
                <div className="text-[10px] text-cyan-400 mt-1">Best for: {p.best}</div>
              </div>
            ))}
            <div className="bg-slate-800/40 border border-slate-700 rounded p-2 text-[11px] text-slate-300">
              <span className="font-bold text-amber-400">Mandatory add-ons:</span> Care Plan $97/mo · Sara AI Receptionist $499 setup + $299/mo
            </div>
          </TabsContent>

          {/* CLOSES */}
          <TabsContent value="closes" className="p-4 space-y-2 mt-0 max-h-[420px] overflow-y-auto">
            {CLOSES.map(c => (
              <div key={c.name} className="bg-slate-800/60 border border-slate-700 rounded p-3">
                <div className="text-xs font-bold text-cyan-400 mb-1">{c.name} Close</div>
                <p className="text-xs text-slate-200 leading-relaxed">{fillTokens(c.text, props)}</p>
              </div>
            ))}
          </TabsContent>

          {/* INDUSTRY HOOKS */}
          <TabsContent value="hooks" className="p-4 space-y-2 mt-0 max-h-[420px] overflow-y-auto">
            {Object.entries(INDUSTRY_HOOKS).map(([industry, hook]) => (
              <div key={industry} className="bg-slate-800/60 border border-slate-700 rounded p-3">
                <div className="text-xs font-bold text-cyan-400 mb-1">{industry}</div>
                <p className="text-xs text-slate-200 leading-relaxed">{hook}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
