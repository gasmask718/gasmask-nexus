/**
 * Invite/account state per ambassador record.
 * Reads the EXISTING ambassador_invites table (target_ambassador_id links an
 * invite to the exact ambassador record). No new invite system.
 *
 * IMPORTANT: the linked-account fact (ambassadors.user_id) is applied OUTSIDE
 * the react-query cache. The query only caches raw invite rows, keyed by the
 * ambassador ids. Previously the account flag was folded in inside queryFn, so
 * a screen that knew the ambassador id before it knew user_id (the profile
 * page) cached "pending" forever and contradicted the list view, which knew
 * both at once ("Account linked").
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type InviteState = 'linked' | 'pending' | 'expired' | 'none';

export interface AmbassadorInviteState {
  /** Canonical account state. A linked auth account always wins. */
  state: InviteState;
  inviteId: string | null;
  token: string | null;
  expiresAt: string | null;
  /** Address the invite itself was addressed to (NOT the contact or auth email). */
  email: string | null;
  phone: string | null;
  /** True when the account is linked but an un-consumed invite row still exists. */
  staleInvite: boolean;
}

export const EMPTY_INVITE_STATE: AmbassadorInviteState = {
  state: 'none',
  inviteId: null,
  token: null,
  expiresAt: null,
  email: null,
  phone: null,
  staleInvite: false,
};

function isLiveInvite(invite: any): boolean {
  return invite?.status === 'pending' && new Date(invite.expires_at) >= new Date();
}

function deriveState(invite: any, hasAccount: boolean): AmbassadorInviteState {
  const base = {
    inviteId: (invite?.id ?? null) as string | null,
    token: (invite?.invite_token ?? null) as string | null,
    expiresAt: (invite?.expires_at ?? null) as string | null,
    email: (invite?.email ?? null) as string | null,
    phone: (invite?.phone ?? null) as string | null,
  };

  if (hasAccount) {
    // Linked auth account is the canonical truth. A still-pending invite row is
    // historical/stale — surfaced separately, never as "not linked".
    return { ...base, state: 'linked', staleInvite: isLiveInvite(invite) };
  }
  if (!invite) return EMPTY_INVITE_STATE;
  if (invite.status === 'accepted') return { ...base, state: 'linked', staleInvite: false };
  if (invite.status === 'revoked' || invite.status === 'expired') {
    return { ...base, state: 'expired', staleInvite: false };
  }
  if (new Date(invite.expires_at) < new Date()) return { ...base, state: 'expired', staleInvite: false };
  return { ...base, state: 'pending', staleInvite: false };
}

/** Bulk: invite state for many ambassador records (admin lists). */
export function useAmbassadorInviteStates(
  ambassadors: { id: string; user_id?: string | null }[]
) {
  const ids = ambassadors.map((a) => a.id).sort();
  const accountMap = new Map(ambassadors.map((a) => [a.id, !!a.user_id]));

  const q = useQuery({
    queryKey: ['ambassador-invite-states', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_invites')
        .select('id, invite_token, status, expires_at, email, phone, target_ambassador_id, created_at')
        .in('target_ambassador_id', ids)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const latest = new Map<string, any>();
      for (const row of data || []) {
        const key = row.target_ambassador_id as string;
        if (!key) continue;
        const current = latest.get(key);
        // Prefer a live pending invite over an older/dead one.
        if (!current || (isLiveInvite(row) && !isLiveInvite(current))) {
          latest.set(key, row);
        }
      }
      return latest;
    },
  });

  // Derived per render from the CURRENT account flags — never cached.
  const out = new Map<string, AmbassadorInviteState>();
  for (const id of ids) {
    out.set(id, deriveState(q.data?.get(id) ?? null, !!accountMap.get(id)));
  }

  return { ...q, data: q.data ? out : undefined, states: out };
}

/** Single ambassador. */
export function useAmbassadorInviteStateOne(
  ambassadorId: string | undefined,
  hasAccount: boolean
) {
  const q = useAmbassadorInviteStates(
    ambassadorId ? [{ id: ambassadorId, user_id: hasAccount ? 'x' : null }] : []
  );
  return {
    ...q,
    data: ambassadorId ? q.states.get(ambassadorId) ?? EMPTY_INVITE_STATE : EMPTY_INVITE_STATE,
  };
}
