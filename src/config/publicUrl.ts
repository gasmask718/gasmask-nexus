/**
 * Canonical public URL for externally-shared links (invites, signup links).
 * Mirrors the backend APP_PUBLIC_URL secret used by send-ambassador-invite.
 * Never fall back to the builder host when the branded domain is available.
 */
export const PUBLIC_APP_URL: string =
  (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://app.gasmaskapproved.com';

export function ambassadorInviteLink(token: string): string {
  return `${PUBLIC_APP_URL}/invite/ambassador/${encodeURIComponent(token)}`;
}
