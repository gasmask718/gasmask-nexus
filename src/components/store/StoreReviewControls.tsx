import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, Circle, ShieldCheck, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { dynastyStamp, dynastyRelative } from '@/lib/dates';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';

interface Props {
  storeId: string;
  compact?: boolean;
}

interface ReviewState {
  reviewed_by_admin: boolean | null;
  reviewed_by_admin_at: string | null;
  reviewed_by_admin_by: string | null;
  reviewed_by_va: boolean | null;
  reviewed_by_va_at: string | null;
  reviewed_by_va_by: string | null;
}

export function StoreReviewControls({ storeId, compact = false }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const canToggleAdmin = isAdmin();

  const { data: state } = useQuery({
    queryKey: ['store-review-state', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_master')
        .select('reviewed_by_admin, reviewed_by_admin_at, reviewed_by_admin_by, reviewed_by_va, reviewed_by_va_at, reviewed_by_va_by')
        .eq('id', storeId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ReviewState | null;
    },
  });

  // Resolve WHO completed each check (id → display name).
  const reviewerIds = [state?.reviewed_by_admin_by, state?.reviewed_by_va_by].filter(Boolean) as string[];
  const { data: reviewers } = useQuery({
    queryKey: ['store-review-reviewers', reviewerIds.sort().join(',')],
    enabled: reviewerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', reviewerIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.id] = p.name || p.email || 'Unknown user'; });
      return map;
    },
  });

  const nameFor = (id: string | null | undefined) =>
    (id && reviewers?.[id]) || (id ? 'Unknown user' : 'Unknown user');

  const toggle = useMutation({
    mutationFn: async (vars: { type: 'admin' | 'va'; next: boolean }) => {
      const { error } = await (supabase as any).from('store_review_events').insert({
        store_id: storeId,
        review_type: vars.type,
        action: vars.next ? 'reviewed' : 'unreviewed',
        reviewed_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      toast.success(vars.next ? 'Marked reviewed' : 'Unmarked');
      qc.invalidateQueries({ queryKey: ['store-review-state', storeId] });
      qc.invalidateQueries({ queryKey: ['stores-server-page'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update review status'),
  });

  const adminOn = !!state?.reviewed_by_admin;
  const vaOn = !!state?.reviewed_by_va;

  const renderStamp = (at: string | null | undefined, by: string | null | undefined) => {
    if (!at) return null;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="opacity-90 font-normal">
              · {dynastyStamp(at)}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <div>Completed {dynastyStamp(at)}</div>
              <div className="opacity-80">{dynastyRelative(at)}</div>
              <div className="opacity-80">by {nameFor(by)}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className={cn('space-y-1', compact ? 'text-xs' : 'text-sm')}>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size={compact ? 'sm' : 'default'}
          variant={adminOn ? 'default' : 'outline'}
          disabled={!canToggleAdmin || toggle.isPending}
          onClick={(e) => {
            e.stopPropagation();
            if (!canToggleAdmin) return;
            toggle.mutate({ type: 'admin', next: !adminOn });
          }}
          title={canToggleAdmin ? 'Toggle admin review' : 'Admin only'}
          className={cn(
            adminOn && 'bg-emerald-600 hover:bg-emerald-700 text-white',
            'gap-2',
          )}
        >
          {adminOn ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          <span>Reviewed by Admin</span>
          {adminOn && renderStamp(state?.reviewed_by_admin_at, state?.reviewed_by_admin_by)}
        </Button>

        <Button
          type="button"
          size={compact ? 'sm' : 'default'}
          variant={vaOn ? 'default' : 'outline'}
          disabled={toggle.isPending}
          onClick={(e) => {
            e.stopPropagation();
            toggle.mutate({ type: 'va', next: !vaOn });
          }}
          className={cn(
            vaOn && 'bg-sky-600 hover:bg-sky-700 text-white',
            'gap-2',
          )}
        >
          {vaOn ? <CheckCircle2 className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          <span>Reviewed by VA</span>
          {vaOn && renderStamp(state?.reviewed_by_va_at, state?.reviewed_by_va_by)}
        </Button>
      </div>

      {/* Inline "last time this account was worked" line — date + time + who */}
      {(adminOn || vaOn) && (
        <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
          {vaOn && state?.reviewed_by_va_at && (
            <span>
              ✓ VA — <span className="text-foreground font-medium">{dynastyStamp(state.reviewed_by_va_at)}</span>
              {' '}({dynastyRelative(state.reviewed_by_va_at)}) · {nameFor(state.reviewed_by_va_by)}
            </span>
          )}
          {adminOn && state?.reviewed_by_admin_at && (
            <span>
              ✓ Admin — <span className="text-foreground font-medium">{dynastyStamp(state.reviewed_by_admin_at)}</span>
              {' '}({dynastyRelative(state.reviewed_by_admin_at)}) · {nameFor(state.reviewed_by_admin_by)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}


/** Compact status badge for grid cards. */
export function StoreReviewBadge({
  reviewedByAdmin,
  reviewedByVa,
}: {
  reviewedByAdmin?: boolean | null;
  reviewedByVa?: boolean | null;
}) {
  if (!reviewedByAdmin && !reviewedByVa) {
    return (
      <Badge variant="outline" className="gap-1 text-[10px] border-amber-500/50 text-amber-600">
        <Circle className="h-2.5 w-2.5" /> needs review
      </Badge>
    );
  }
  return (
    <div className="flex gap-1">
      {reviewedByAdmin && (
        <Badge className="gap-1 text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white">
          <CheckCircle2 className="h-2.5 w-2.5" /> Admin
        </Badge>
      )}
      {reviewedByVa && (
        <Badge className="gap-1 text-[10px] bg-sky-600 hover:bg-sky-600 text-white">
          <CheckCircle2 className="h-2.5 w-2.5" /> VA
        </Badge>
      )}
    </div>
  );
}
