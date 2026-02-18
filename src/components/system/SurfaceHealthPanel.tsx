import { useEffect, useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Badge } from '@/components/ui/badge';
import { Shield, Wifi, FileText, Bot, CheckCircle, XCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HealthCheck {
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * SurfaceHealthPanel — Read-only admin widget showing multi-surface health.
 * SW status, manifest, noindex, robots.txt.
 */
export function SurfaceHealthPanel() {
  const { roles, loading } = useUserRole();
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [ran, setRan] = useState(false);

  const isAdmin = roles.includes('admin');

  useEffect(() => {
    if (loading || !isAdmin || ran) return;

    const runChecks = async () => {
      const results: HealthCheck[] = [];

      // 1. SW registered?
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration('/portal');
        results.push({
          label: 'Service Worker',
          ok: !!reg,
          detail: reg ? `Scope: ${reg.scope}` : 'Not registered',
        });
      } else {
        results.push({ label: 'Service Worker', ok: false, detail: 'Not supported' });
      }

      // 2. Manifest linked?
      const manifestLink = document.querySelector('link[rel="manifest"]');
      results.push({
        label: 'Manifest',
        ok: !!manifestLink,
        detail: manifestLink ? manifestLink.getAttribute('href') || 'linked' : 'Missing <link rel="manifest">',
      });

      // 3. noindex on admin?
      const metas = document.querySelectorAll('meta[name="robots"]');
      const hasNoindex = Array.from(metas).some((m) =>
        m.getAttribute('content')?.includes('noindex')
      );
      results.push({
        label: 'Admin noindex',
        ok: hasNoindex,
        detail: hasNoindex ? 'Protected' : 'Missing noindex meta',
      });

      // 4. robots.txt reachable?
      try {
        const res = await fetch('/robots.txt');
        const text = await res.text();
        const blocksPortal = text.includes('/portal');
        results.push({
          label: 'robots.txt',
          ok: res.ok && blocksPortal,
          detail: blocksPortal ? 'Blocks /portal' : 'Does not block /portal',
        });
      } catch {
        results.push({ label: 'robots.txt', ok: false, detail: 'Unreachable' });
      }

      setChecks(results);
      setRan(true);
    };

    runChecks();
  }, [loading, isAdmin, ran]);

  if (loading || !isAdmin) return null;

  const allOk = checks.length > 0 && checks.every((c) => c.ok);
  const icon = allOk ? (
    <Shield className="h-3 w-3 text-emerald-400" />
  ) : (
    <Shield className="h-3 w-3 text-amber-400" />
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`text-[10px] px-2 py-0.5 cursor-default ${
              allOk
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            }`}
          >
            {icon}
            <span className="ml-1">Surface: {allOk ? 'OK' : 'Issues'}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="text-xs space-y-1.5">
            <p className="font-semibold">Surface Health</p>
            {checks.map((c) => (
              <div key={c.label} className="flex items-center gap-1.5">
                {c.ok ? (
                  <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                )}
                <span>
                  {c.label}: <span className="text-muted-foreground">{c.detail}</span>
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default SurfaceHealthPanel;
