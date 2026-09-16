/**
 * Invite/account state per ambassador record.
 * Reads the EXISTING ambassador_invites table (target_ambassador_id links an
 * invite to the exact ambassador record). No new invite system.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type InviteState = 'linked' | 'pending' | 'expired' | 'none';

export interface AmbassadorInviteState {
  state: InviteState;
  inviteId: string | null;
  token: string | null;
  expiresAt: string | null;
  email: string | null;
  phone: string | null;
}

export const EMPTY_INVITE_STATE: AmbassadorInviteState = {
  state: 'none',
  inviteId: null,
  token: null,
  expiresAt: null,
  email: null,
  phone: null,
};

function deriveState(invite: any, hasAccount: boolean): AmbassadorInviteState {
  if (hasAccount) {
    return {
      state: 'linked',
      inviteId: invite?.id ?? null,
      token: invite?.invite_token ?? null,
      expiresAt: invite?.expires_at ?? null,
      email: invite?.email ?? null,
      phone: invite?.phone ?? null,
    };
  }
  if (!invite) return EMPTY_INVITE_STATE;
  const base = {
    inviteId: invite.id as string,
    token: invite.invite_token as string,
    expiresAt: invite.expires_at as string,
    email: (invite.email ?? null) as string | null,
    phone: (invite.phone ?? null) as string | null,
  };
  if (invite.status === 'accepted') return { ...base, state: 'linked' };
  if (invite.status === 'revoked') return { ...base, state: 'expired' };
  if (invite.status === 'expired') return { ...base, state: 'expired' };
  if (new Date(invite.expires_at) < new Date()) return { ...base, state: 'expired' };
  return { ...base, state: 'pending' };
}

/** Bulk: invite state for many ambassador records (admin lists). */
export function useAmbassadorInviteStates(
  ambassadors: { id: string; user_id?: string | null }[]
) {
  const ids = ambassadors.map((a) => a.id).sort();
  const accountMap = new Map(ambassadors.map((a) => [a.id, !!a.user_id]));

  return useQuery({
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
        const isLive = row.status === 'pending' && new Date(row.expires_at) >= new Date();
        if (!current || (isLive && !(current.status === 'pending' && new Date(current.expires_at) >= new Date()))) {
          latest.set(key, row);
        }
      }

      const out = new Map<string, AmbassadorInviteState>();
      for (const id of ids) {
        out.set(id, deriveState(latest.get(id) ?? null, !!accountMap.get(id)));
      }
      return out;
    },
  });
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
    data: ambassadorId ? q.data?.get(ambassadorId) ?? EMPTY_INVITE_STATE : EMPTY_INVITE_STATE,
  };
}
