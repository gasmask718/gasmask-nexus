import { useVASession } from '@/contexts/VASessionContext';

interface ScriptStep {
  key: string;
  icon: string;
  title: string;
  text: string;
  tip?: string;
}

// Hardcoded expanded scripts (i18n covers the basic 4 — this is the on-call deep playbook)
const SCRIPTS: ScriptStep[] = [
  {
    key: 'opener',
    icon: '👋',
    title: 'Step 1 — Opener (5 sec)',
    text: "Hi, is this the owner or manager? ... Great — my name is [Your Name] from Brandaro. I'll be quick — we help local businesses like yours show up first on Google and bring in 3–5x more customers. Did I catch you at an okay time?",
    tip: 'Smile while you talk. Speak slower than feels natural.',
  },
  {
    key: 'permission',
    icon: '🎯',
    title: 'Step 2 — Get Permission',
    text: "Awesome — I promise this won't take more than 90 seconds. Quick question: when somebody Googles your type of business in your area right now, do you usually show up on the first page?",
    tip: 'Wait for their answer. Let them talk.',
  },
  {
    key: 'discover',
    icon: '🔍',
    title: 'Step 3 — Discover Pain',
    text: "Got it. So how are you currently getting most of your new customers — is it word-of-mouth, walk-ins, ads, or something else? ... And if you could double the number of new customers next month, would that make a real difference for the business?",
    tip: 'Take notes — repeat their words back later.',
  },
  {
    key: 'pitch',
    icon: '💡',
    title: 'Step 4 — Pitch (FAQs Tab Has Details)',
    text: "Here's exactly what we do: we set up your Google Business Profile, run your ads, manage your social media, and build a website that actually converts visitors into leads. Most of our clients start seeing more inquiries within the first 30 days. We have three plans — Starter at $497, Growth at $997 (most popular), and Domination at $2,497. No contracts.",
    tip: 'Open the Services tab to walk them through pricing.',
  },
  {
    key: 'close',
    icon: '🤝',
    title: 'Step 5 — Soft Close',
    text: "Based on what you just told me, I think the Growth plan would be a perfect fit. Here's what I'd love to do — I'll send you a quick proposal right now via text, and we'll hop on a 15-minute Zoom tomorrow to walk through the strategy. Does 10am or 2pm work better for you?",
    tip: 'Always offer two times. Never ask "are you interested?"',
  },
  {
    key: 'lockin',
    icon: '🔒',
    title: 'Step 6 — Lock It In',
    text: "Perfect. I'm sending the proposal to your phone right now — you'll see it in about 30 seconds. I just need your best email so I can send the calendar invite for [day/time]. ... Got it. Look out for both — proposal by text, calendar invite by email. Anything else come up before we hop off?",
    tip: 'Confirm phone & email back to them. Send invoice/SMS while still on the call.',
  },
];

export function VAScripts() {
  const { t } = useVASession();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white">{t('va.scripts.title')}</h3>
      <p className="text-[11px] text-slate-400 -mt-2">
        Read naturally — don't sound like a robot. Pause for their answers.
      </p>
      {SCRIPTS.map(step => (
        <div key={step.key} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{step.icon}</span>
            <span className="text-xs font-bold text-cyan-400 uppercase">{step.title}</span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed mb-2">{step.text}</p>
          {step.tip && (
            <p className="text-[11px] text-amber-300/80 italic border-l-2 border-amber-500/40 pl-2">
              💡 {step.tip}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
