import { AlertTriangle } from 'lucide-react';
import { earnDb } from '@/lib/dynastyEarnClient';

export function EarnStub({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="border-b border-[#C9A84C]/30 pb-4">
          <h1 className="text-3xl font-bold text-[#C9A84C]">{title}</h1>
          <p className="text-sm text-white/60 mt-1">{description}</p>
        </header>

        {!earnDb && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Connect Dynasty Earn database</div>
              <div className="text-sm text-amber-100/80">
                Set <code>VITE_DYNASTY_EARN_SUPABASE_URL</code> and{' '}
                <code>VITE_DYNASTY_EARN_SUPABASE_KEY</code> to enable this page.
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-white/10 bg-white/5 p-12 text-center text-white/50">
          Page under construction.
        </div>
      </div>
    </div>
  );
}

export default EarnStub;
