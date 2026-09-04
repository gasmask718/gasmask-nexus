/**
 * VAAutoDialerSection — Auto Dialer surface for the VA Portal.
 *
 * Mirrors /communication/campaign-dial feature parity inside the VA
 * dashboard: 7 audience sources, Bland AI agent picker, server-side
 * dispatcher, live realtime monitor, recover-stuck control, history.
 *
 * Embeds the proven `CampaignDialPage` so the VA portal stays in lock-step
 * with the canonical implementation (single source of truth, no drift).
 * Wrapped in a VA-themed (slate/cyan) shell to match the rest of the
 * portal's aesthetic.
 */
import CampaignDialPage from '@/pages/communication/dialer/CampaignDialPage';
import { Rocket } from 'lucide-react';

export function VAAutoDialerSection() {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 overflow-hidden flex flex-col h-[calc(100vh-7rem)]">
      <div className="px-4 py-2 border-b border-slate-700/60 bg-slate-900/70 text-xs text-gasmask-glow flex items-center gap-2">
        <Rocket className="h-3.5 w-3.5" />
        <span className="font-semibold tracking-wide uppercase">
          Auto Dialer · Twilio + Bland AI · Server-side dispatcher
        </span>
      </div>
      {/* CampaignDialPage manages its own layout, queries, realtime + RLS. */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <CampaignDialPage />
      </div>
    </div>
  );
}
