/**
 * ContactRelationshipMarkers — two INDEPENDENT per-contact markers.
 *
 *   Owner Confirmed  → store_contacts.owner_confirmed / owner_confirmed_at / owner_confirmed_by
 *   My Homie         → store_contacts.is_homie / homie_set_at / homie_set_by
 *
 * Rules:
 *   - Multiple contacts per store may be owner-confirmed (owners + partners).
 *     Confirming one NEVER unconfirms another.
 *   - Multiple contacts per store may be homies. Toggle only.
 *   - The two flags never touch each other.
 *   - store_contacts is the single source of truth for contacts — no mirror table.
 *   - Save failures surface the REAL Supabase error text.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BadgeCheck, Handshake, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export interface ContactMarkerFields {
  id: string;
  name?: string;
  owner_confirmed?: boolean | null;
  owner_confirmed_at?: string | null;
  owner_confirmed_by?: string | null;
  is_homie?: boolean | null;
  homie_set_at?: string | null;
  homie_set_by?: string | null;
}

interface Props {
  contact: ContactMarkerFields;
  storeId: string;
  /** Extra react-query keys to invalidate after a write. */
  invalidateKeys?: unknown[][];
  compact?: boolean;
}

function useActorName(userId?: string | null) {
  return useQuery({
    queryKey: ['profile-name', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', userId as string)
        .maybeSingle();
      if (error) return null;
      return data?.name ?? null;
    },
  });
}

function stamp(at?: string | null, who?: string | null) {
  const parts: string[] = [];
  if (who) parts.push(who);
  if (at) {
    const d = new Date(at);
    if (!isNaN(d.getTime())) parts.push(format(d, 'MMM d, yyyy'));
  }
  return parts.join(' · ');
}

export function ContactRelationshipMarkers({
  contact,
  storeId,
  invalidateKeys = [],
  compact = false,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [busy, setBusy] = useState<'owner' | 'homie' | null>(null);

  const ownerConfirmed = !!contact.owner_confirmed;
  const isHomie = !!contact.is_homie;

  const { data: ownerActor } = useActorName(ownerConfirmed ? contact.owner_confirmed_by : null);
  const { data: homieActor } = useActorName(isHomie ? contact.homie_set_by : null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['store-contacts-responsiveness', storeId] });
    qc.invalidateQueries({ queryKey: ['store-contacts', storeId] });
    qc.invalidateQueries({ queryKey: ['contact-responsiveness', storeId] });
    qc.invalidateQueries({ queryKey: ['store-contact', contact.id] });
    invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key as any }));
  };

  const write = async (kind: 'owner' | 'homie', next: boolean) => {
    setBusy(kind);
    try {
      const patch =
        kind === 'owner'
          ? {
              owner_confirmed: next,
              owner_confirmed_at: next ? new Date().toISOString() : null,
              owner_confirmed_by: next ? user?.id ?? null : null,
            }
          : {
              is_homie: next,
              homie_set_at: next ? new Date().toISOString() : null,
              homie_set_by: next ? user?.id ?? null : null,
            };

      const { error } = await supabase
        .from('store_contacts')
        .update(patch as any)
        .eq('id', contact.id);

      // Surface the REAL error — never swallow it.
      if (error) {
        toast.error(
          `${kind === 'owner' ? 'Owner confirmation' : 'Homie'} save failed: ${error.message}`,
          { description: error.details || error.hint || undefined }
        );
        return;
      }

      invalidate();
      toast.success(
        kind === 'owner'
          ? next
            ? `${contact.name || 'Contact'} confirmed as owner`
            : 'Owner confirmation removed'
          : next
            ? `${contact.name || 'Contact'} marked as My Homie`
            : 'Homie marker removed'
      );
    } catch (e: any) {
      toast.error(`Save failed: ${e?.message || String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const size = compact ? 'h-6 px-2 text-[10px]' : 'h-7 px-2.5 text-xs';
  const icon = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* ── OWNER (emerald / shield-check) ───────────────────────────── */}
        {ownerConfirmed ? (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={`${compact ? 'h-5 text-[10px]' : 'h-6 text-xs'} gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-600`}
                >
                  <BadgeCheck className={icon} />
                  Owner ✓
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Confirmed {stamp(contact.owner_confirmed_at, ownerActor) || 'owner'}
              </TooltipContent>
            </Tooltip>
            <Button
              size="sm"
              variant="ghost"
              className={`${size} text-muted-foreground hover:text-destructive`}
              disabled={busy === 'owner'}
              onClick={() => write('owner', false)}
            >
              {busy === 'owner' ? <Loader2 className={`${icon} animate-spin`} /> : <X className={icon} />}
              Unconfirm
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className={`${size} border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10`}
            disabled={busy === 'owner'}
            onClick={() => write('owner', true)}
          >
            {busy === 'owner' ? (
              <Loader2 className={`${icon} mr-1 animate-spin`} />
            ) : (
              <BadgeCheck className={`${icon} mr-1`} />
            )}
            Confirm Owner
          </Button>
        )}

        {/* ── HOMIE (amber / handshake) ────────────────────────────────── */}
        {isHomie ? (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  className={`${compact ? 'h-5 text-[10px]' : 'h-6 text-xs'} gap-1 border-amber-500/50 bg-amber-500/20 text-amber-700 hover:bg-amber-500/20`}
                  variant="outline"
                >
                  <Handshake className={icon} />
                  My Homie
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Your go-to person {stamp(contact.homie_set_at, homieActor) && `— ${stamp(contact.homie_set_at, homieActor)}`}
              </TooltipContent>
            </Tooltip>
            <Button
              size="sm"
              variant="ghost"
              className={`${size} text-muted-foreground hover:text-destructive`}
              disabled={busy === 'homie'}
              onClick={() => write('homie', false)}
            >
              {busy === 'homie' ? <Loader2 className={`${icon} animate-spin`} /> : <X className={icon} />}
              Remove
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className={`${size} border-amber-500/40 text-amber-600 hover:bg-amber-500/10`}
            disabled={busy === 'homie'}
            onClick={() => write('homie', true)}
          >
            {busy === 'homie' ? (
              <Loader2 className={`${icon} mr-1 animate-spin`} />
            ) : (
              <Handshake className={`${icon} mr-1`} />
            )}
            My Homie
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}
