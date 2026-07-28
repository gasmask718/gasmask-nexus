import { useState } from 'react';
import { Smartphone, Share, MoreVertical, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstall } from '@/hooks/usePwaInstall';

const DISMISS_KEY = 'gasmask_install_prompt_dismissed_at';
const DISMISS_DAYS = 7;

function dismissed(): boolean {
  try {
    const at = localStorage.getItem(DISMISS_KEY);
    if (!at) return false;
    return Date.now() - parseInt(at, 10) < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
}

function isAndroid() {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
}

/**
 * InstallAppPrompt — "Install GasMask to your phone" card.
 * Shows the native install prompt where supported (Android/Chrome),
 * and platform-specific manual instructions on iOS Safari.
 */
export default function InstallAppPrompt({ compact = false }: { compact?: boolean }) {
  const { canInstall, isIos, isInstalled, triggerInstall } = usePwaInstall();
  const [hidden, setHidden] = useState(dismissed());

  if (isInstalled || hidden) return null;
  if (!canInstall && !isIos && !isAndroid()) return null;

  const hide = () => {
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {
      /* storage unavailable */
    }
    setHidden(true);
  };

  return (
    <div className={`relative rounded-xl border border-border bg-card p-3 ${compact ? '' : 'sm:p-4'}`}>
      <button
        onClick={hide}
        aria-label="Dismiss install prompt"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <Smartphone className="h-5 w-5 shrink-0 text-primary mt-0.5" />
        <div className="space-y-2 min-w-0">
          <p className="text-sm font-semibold">Install GasMask on your phone</p>

          {canInstall ? (
            <>
              <p className="text-xs text-muted-foreground">
                Adds an app icon to your home screen and opens full-screen — no browser bars.
              </p>
              <Button size="sm" onClick={triggerInstall} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Install app
              </Button>
            </>
          ) : isIos ? (
            <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
              In Safari, tap <Share className="h-3.5 w-3.5 inline" /> <span className="font-medium">Share</span> →
              <span className="font-medium">Add to Home Screen</span>.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
              In Chrome, tap <MoreVertical className="h-3.5 w-3.5 inline" /> menu →
              <span className="font-medium">Install app</span> / <span className="font-medium">Add to Home screen</span>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
