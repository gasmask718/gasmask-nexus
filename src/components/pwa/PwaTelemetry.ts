/**
 * PwaTelemetry — Lightweight PWA event logger
 * Logs install funnel + SW lifecycle events.
 * Console-only by default; swap in analytics provider if available.
 */

type PwaEvent =
  | 'pwa_install_prompt_shown'
  | 'pwa_install_prompt_accepted'
  | 'pwa_install_prompt_dismissed'
  | 'pwa_installed_detected'
  | 'sw_registered'
  | 'sw_update_found'
  | 'sw_update_applied';

const PREFIX = '[PWA]';

/**
 * Log a PWA telemetry event. Never blocks UI.
 */
export function logPwaEvent(event: PwaEvent, meta?: Record<string, unknown>) {
  try {
    const payload = { event, timestamp: new Date().toISOString(), ...meta };
    console.info(`${PREFIX} ${event}`, payload);
  } catch {
    // Telemetry must never crash the app
  }
}

/**
 * Check if currently running as installed PWA.
 */
export function isRunningAsInstalledPwa(): boolean {
  // Standard check
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari check
  if ((navigator as any).standalone === true) return true;
  return false;
}
