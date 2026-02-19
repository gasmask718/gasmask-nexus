/**
 * useUnifiedProfileView - Unified Profile Truth Layer
 * 
 * Provides a role-agnostic profile contract for all CRM profile pages.
 * This is a VIEW-LAYER contract only — no new tables, no duplicate data.
 * 
 * Surfaces:
 *   - Ops participation (inbox threads, tasks)
 *   - Contact summary (masked DOB, derived neighborhood)
 *   - Activity metrics
 * 
 * Governance: This hook is read-only. It does not write, score, or trigger actions.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ProfileRole = 'ambassador' | 'driver' | 'biker' | 'influencer';

export interface UnifiedProfileIdentity {
  userId: string | null;
  role: ProfileRole;
  displayName: string;
  status: string;
  joinedAt: string | null;
}

export interface UnifiedContactInfo {
  phone: string | null;
  phoneMasked: string | null;
  email: string | null;
  dateOfBirth: string | null; // stored raw
  dateOfBirthMasked: string | null; // "Mar 1990" format
  neighborhood: string | null;
  territory: string | null;
}

export interface UnifiedOpsParticipation {
  inboxThreadsCount: number;
  unreadThreadsCount: number;
  tasksAssigned: number;
  tasksCompleted: number;
  tasksCancelled: number;
  tasksOpen: number;
}

export interface UnifiedProfileView {
  identity: UnifiedProfileIdentity;
  contact: UnifiedContactInfo;
  opsParticipation: UnifiedOpsParticipation;
  isLoading: boolean;
}

/** Mask phone: show only last 4 digits */
function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***-***-${digits.slice(-4)}`;
}

/** Mask DOB: show month + year only */
function maskDob(dob: string | null): string | null {
  if (!dob) return null;
  try {
    const d = new Date(dob);
    if (isNaN(d.getTime())) return null;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return null;
  }
}

/**
 * Fetches ops participation data (inbox + tasks) for a given user_id.
 * Read-only. No mutations, no side effects.
 */
function useOpsParticipation(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['unified-ops-participation', userId],
    queryFn: async (): Promise<UnifiedOpsParticipation> => {
      if (!userId) return { inboxThreadsCount: 0, unreadThreadsCount: 0, tasksAssigned: 0, tasksCompleted: 0, tasksCancelled: 0, tasksOpen: 0 };

      // Fetch inbox participation
      const { data: recipients } = await supabase
        .from('ops_inbox_recipients')
        .select('thread_id, read_at')
        .eq('user_id', userId)
        .limit(200);

      const inboxThreadsCount = recipients?.length || 0;
      const unreadThreadsCount = recipients?.filter(r => !r.read_at).length || 0;

      // Fetch task participation
      const { data: tasks } = await supabase
        .from('ops_tasks')
        .select('status')
        .eq('expected_actor_id', userId)
        .limit(200);

      const tasksAssigned = tasks?.length || 0;
      const tasksCompleted = tasks?.filter(t => t.status === 'completed').length || 0;
      const tasksCancelled = tasks?.filter(t => t.status === 'cancelled').length || 0;
      const tasksOpen = tasks?.filter(t => t.status === 'open' || t.status === 'in_progress').length || 0;

      return { inboxThreadsCount, unreadThreadsCount, tasksAssigned, tasksCompleted, tasksCancelled, tasksOpen };
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/**
 * useUnifiedProfileView — The canonical profile contract hook.
 * 
 * Usage:
 *   const profile = useUnifiedProfileView({
 *     userId: driver.user_id,
 *     role: 'driver',
 *     displayName: driver.full_name,
 *     status: driver.status,
 *     joinedAt: driver.created_at,
 *     phone: driver.phone,
 *     email: driver.email,
 *     dateOfBirth: null,
 *     neighborhood: null,
 *     territory: driver.home_base,
 *   });
 */
export function useUnifiedProfileView(params: {
  userId: string | null | undefined;
  role: ProfileRole;
  displayName: string;
  status: string;
  joinedAt: string | null;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  neighborhood?: string | null;
  territory?: string | null;
}): UnifiedProfileView {
  const ops = useOpsParticipation(params.userId);

  return {
    identity: {
      userId: params.userId || null,
      role: params.role,
      displayName: params.displayName,
      status: params.status,
      joinedAt: params.joinedAt,
    },
    contact: {
      phone: params.phone || null,
      phoneMasked: maskPhone(params.phone || null),
      email: params.email || null,
      dateOfBirth: params.dateOfBirth || null,
      dateOfBirthMasked: maskDob(params.dateOfBirth || null),
      neighborhood: params.neighborhood || null,
      territory: params.territory || null,
    },
    opsParticipation: ops.data || {
      inboxThreadsCount: 0, unreadThreadsCount: 0,
      tasksAssigned: 0, tasksCompleted: 0, tasksCancelled: 0, tasksOpen: 0,
    },
    isLoading: ops.isLoading,
  };
}
