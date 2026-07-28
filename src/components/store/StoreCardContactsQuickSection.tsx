/**
 * StoreCardContactsQuickSection — Lazy-loaded contacts block for the store-card
 * Quick View expander. Mirrors the profile Store Contacts section actions but
 * compressed for the card surface.
 *
 * Actions are delegated to <StoreContactActions/> so behavior stays in one place.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Star, User, MessageSquare, ChevronDown, Handshake, BadgeCheck } from 'lucide-react';
import { StoreContactActions } from './StoreContactActions';
import { ContactRelationshipMarkers } from './ContactRelationshipMarkers';
import { AddContactModal } from './AddContactModal';
import { ContactCommunicationTimeline } from './ContactCommunicationTimeline';

interface Props {
  storeId: string;
  storeName: string;
}

export function StoreCardContactsQuickSection({ storeId, storeName }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});

  const { data: contacts = [], isLoading, refetch } = useQuery({
    queryKey: ['store-contacts', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_contacts')
        .select(
          'id, name, phone, role, is_primary, can_receive_sms, responsive_by_call, responsive_by_text, last_call_answered_at, last_text_received_at, sms_opt_in_status, owner_confirmed, owner_confirmed_at, owner_confirmed_by, is_homie, homie_set_at, homie_set_by'
        )
        .eq('store_id', storeId)
        .order('is_homie', { ascending: false })
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  return (
    <div className="space-y-1.5 border-t border-border/50 pt-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Contacts
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[10px]"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : contacts.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">No contacts yet</p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-border/40 bg-background/40 p-2 space-y-1.5"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{c.name}</span>
                {(c as any).is_homie && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[9px] gap-0.5 border-amber-500/50 bg-amber-500/20 text-amber-700"
                  >
                    <Handshake className="h-2.5 w-2.5" /> My Homie
                  </Badge>
                )}
                {(c as any).owner_confirmed && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[9px] gap-0.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                  >
                    <BadgeCheck className="h-2.5 w-2.5" /> Owner ✓
                  </Badge>
                )}
                {c.is_primary && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[9px] bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
                  >
                    <Star className="h-2.5 w-2.5 mr-0.5" /> Primary
                  </Badge>
                )}
                {c.phone && (
                  <span className="text-[10px] text-muted-foreground">{c.phone}</span>
                )}
                {c.sms_opt_in_status === 'opted_in' && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[9px] border-emerald-500/40 text-emerald-600"
                  >
                    SMS opt-in
                  </Badge>
                )}
              </div>
              <ContactRelationshipMarkers
                contact={c as any}
                storeId={storeId}
                compact
                invalidateKeys={[['store-contacts', storeId]]}
              />
              <StoreContactActions
                contact={c as any}
                storeId={storeId}
                compact
                invalidateKeys={[['store-contacts', storeId]]}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] w-full justify-start text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setOpenHistory((s) => ({ ...s, [c.id]: !s[c.id] }))
                }
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                {openHistory[c.id] ? 'Hide' : 'View'} conversation history
                <ChevronDown
                  className={`h-3 w-3 ml-auto transition-transform ${openHistory[c.id] ? 'rotate-180' : ''}`}
                />
              </Button>
              {openHistory[c.id] && (
                <div className="pt-2 border-t border-border/40">
                  <ContactCommunicationTimeline
                    storeId={storeId}
                    contactId={c.id}
                    contactName={c.name}
                    contactPhone={c.phone}
                    canReceiveSms={c.can_receive_sms}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <AddContactModal
        open={addOpen}
        onOpenChange={setAddOpen}
        storeId={storeId}
        storeName={storeName}
        onSuccess={() => {
          setAddOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
