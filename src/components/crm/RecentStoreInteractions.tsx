import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone,
  MessageSquare,
  Mail,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Clock,
  AlertCircle,
  Link2,
  Eye,
  FileText,
  Package,
} from "lucide-react";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useStoreMasterResolver } from "@/hooks/useStoreMasterResolver";
import { toast } from "sonner";
import { InteractionDetailModal } from "@/components/store/InteractionDetailModal";

const CHANNEL_ICONS: Record<string, typeof Phone> = {
  CALL: Phone,
  SMS: MessageSquare,
  WHATSAPP: MessageSquare,
  IN_PERSON: Users,
  EMAIL: Mail,
  OTHER: MessageSquare,
};

interface Interaction {
  id: string;
  channel: string;
  direction: string;
  subject: string;
  summary: string | null;
  outcome: string | null;
  sentiment: string | null;
  next_action: string | null;
  follow_up_at: string | null;
  created_at: string;
  contact?: {
    id: string;
    name: string;
  } | null;
}

interface StoreNote {
  id: string;
  note_text: string;
  created_at: string;
  created_by: string | null;
  profile?: {
    name: string;
  } | null;
}

interface VisitLog {
  id: string;
  visit_type: string;
  visit_datetime: string | null;
  created_at: string;
  customer_response: string | null;
  cash_collected: number | null;
  products_delivered: any;
  user?: {
    name: string;
  } | null;
}

type UnifiedInteraction = 
  | (Interaction & { type: 'interaction' })
  | (StoreNote & { type: 'note' })
  | (VisitLog & { type: 'visit' });

interface RecentStoreInteractionsProps {
  storeId: string;
  onLogInteraction: (storeMasterId: string) => void;
  onViewAll?: () => void;
}

export function RecentStoreInteractions({ storeId, onLogInteraction, onViewAll }: RecentStoreInteractionsProps) {
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const {
    storeMasterId,
    isLoading: resolving,
    needsCreation,
    legacyStore,
    createStoreMaster,
    isCreating,
  } = useStoreMasterResolver(storeId);

  const { data: interactions, isLoading: loadingInteractions } = useQuery({
    queryKey: ["store-interactions", storeMasterId],
    queryFn: async () => {
      if (!storeMasterId) return [];
      const { data, error } = await supabase
        .from("contact_interactions")
        .select(
          `
          id,
          channel,
          direction,
          subject,
          summary,
          outcome,
          sentiment,
          next_action,
          follow_up_at,
          created_at,
          contact:store_contacts(id, name)
        `,
        )
        .eq("store_id", storeMasterId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data as Interaction[]).map(i => ({ ...i, type: 'interaction' as const }));
    },
    enabled: !!storeMasterId,
  });

  const { data: notes, isLoading: loadingNotes } = useQuery({
    queryKey: ["store-notes-for-interactions", storeMasterId],
    queryFn: async () => {
      if (!storeMasterId) return [];
      const { data, error } = await supabase
        .from("store_notes")
        .select(
          `
          id,
          note_text,
          created_at,
          created_by,
          profile:profiles(name)
        `,
        )
        .eq("store_id", storeMasterId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data as StoreNote[]).map(n => ({ ...n, type: 'note' as const }));
    },
    enabled: !!storeMasterId,
  });

  // Query visit logs - need to map storeId to stores table first
  const { data: visitLogs, isLoading: loadingVisits } = useQuery({
    queryKey: ["store-visit-logs-for-interactions", storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from("visit_logs")
        .select(
          `
          id,
          visit_type,
          visit_datetime,
          created_at,
          customer_response,
          cash_collected,
          products_delivered,
          user:profiles(name)
        `,
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data as VisitLog[]).map(v => ({ ...v, type: 'visit' as const }));
    },
    enabled: !!storeId,
  });

  // Merge and sort all interactions, notes, and visits by created_at
  const allInteractions: UnifiedInteraction[] = [
    ...(interactions || []),
    ...(notes || []),
    ...(visitLogs || []),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const isLoading = loadingInteractions || loadingNotes || loadingVisits;

  const handleCreateStoreMaster = async () => {
    try {
      const created = await createStoreMaster();
      toast.success("Store Master record created");
      onLogInteraction(created.id);
    } catch (error: any) {
      toast.error("Failed to create store master: " + error.message);
    }
  };

  const handleLogInteraction = () => {
    if (storeMasterId) {
      onLogInteraction(storeMasterId);
    }
  };

  const handleInteractionClick = (item: UnifiedInteraction) => {
    if (item.type === 'interaction') {
      // Extract just the interaction properties (without the 'type' field)
      const { type, ...interaction } = item;
      setSelectedInteraction(interaction);
      setDetailOpen(true);
    } else if (item.type === 'note') {
      // For notes, show a toast with the note text
      toast.info(item.note_text, {
        title: 'Note',
        description: format(new Date(item.created_at), 'MMM d, yyyy h:mm a'),
      });
    } else if (item.type === 'visit') {
      // For visits, show visit details
      const visit = item;
      const visitTypeLabel = visit.visit_type?.replace(/([A-Z])/g, ' $1').trim() || 'Visit';
      const productCount = visit.products_delivered ? (Array.isArray(visit.products_delivered) ? visit.products_delivered.length : 1) : 0;
      toast.info(visit.customer_response || 'Visit logged', {
        title: visitTypeLabel,
        description: `${productCount > 0 ? `${productCount} product(s) • ` : ''}${format(new Date(visit.created_at), 'MMM d, yyyy h:mm a')}`,
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Recent Interactions
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" onClick={handleLogInteraction} disabled={!storeMasterId || resolving}>
                    <Plus className="h-4 w-4 mr-1" /> Log Interaction
                  </Button>
                </span>
              </TooltipTrigger>
              {!storeMasterId && !resolving && (
                <TooltipContent>
                  <p>Link this store to Store Master first</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </CardHeader>
        <CardContent>
          {resolving || isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : needsCreation ? (
            <div className="text-center py-6 space-y-4">
              <AlertCircle className="h-10 w-10 mx-auto text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Link to Store Master</p>
                <p className="text-xs text-muted-foreground mt-1">Create a Store Master record to log interactions</p>
              </div>
              <Button size="sm" onClick={handleCreateStoreMaster} disabled={isCreating}>
                <Link2 className="h-4 w-4 mr-2" />
                {isCreating ? "Creating..." : `Create Store Master for "${legacyStore?.name}"`}
              </Button>
            </div>
          ) : !storeMasterId ? (
            <div className="text-center py-6 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50 text-yellow-500" />
              <p className="text-sm">Store not linked to store_master</p>
              <p className="text-xs mt-1">Interactions require a valid store_master record</p>
            </div>
          ) : allInteractions && allInteractions.length > 0 ? (
            <div className="space-y-3">
              {allInteractions.map((item) => {
                if (item.type === 'interaction') {
                  const interaction = item;
                  const ChannelIcon = CHANNEL_ICONS[interaction.channel] || MessageSquare;
                  return (
                    <div
                      key={interaction.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 cursor-pointer hover:bg-muted/50 transition-colors group"
                      onClick={() => handleInteractionClick(item)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <ChannelIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{interaction.subject}</span>
                            <Badge variant="outline" className="text-xs">
                              {interaction.direction === "OUTBOUND" ? (
                                <ArrowUpRight className="h-3 w-3" />
                              ) : (
                                <ArrowDownLeft className="h-3 w-3" />
                              )}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(interaction.contact as any)?.name} •{" "}
                            {format(new Date(interaction.created_at), "MMM d, h:mm a")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {interaction.outcome && (
                          <Badge variant="secondary" className="text-xs">
                            {interaction.outcome.replace(/_/g, " ")}
                          </Badge>
                        )}
                        <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  );
                } else if (item.type === 'note') {
                  const note = item;
                  return (
                    <div
                      key={note.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 cursor-pointer hover:bg-muted/50 transition-colors group"
                      onClick={() => handleInteractionClick(item)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">Note</span>
                            <Badge variant="outline" className="text-xs">Note</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {note.note_text}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {(note.profile as any)?.name || 'System'} •{" "}
                            {format(new Date(note.created_at), "MMM d, h:mm a")}
                          </div>
                        </div>
                      </div>
                      <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  );
                } else if (item.type === 'visit') {
                  const visit = item;
                  const visitTypeLabel = visit.visit_type?.replace(/([A-Z])/g, ' $1').trim() || 'Visit';
                  const productCount = visit.products_delivered ? (Array.isArray(visit.products_delivered) ? visit.products_delivered.length : 1) : 0;
                  return (
                    <div
                      key={visit.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 cursor-pointer hover:bg-muted/50 transition-colors group"
                      onClick={() => handleInteractionClick(item)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{visitTypeLabel}</span>
                            <Badge variant="outline" className="text-xs">Visit</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {visit.customer_response || (productCount > 0 ? `${productCount} product(s) delivered` : 'Visit logged')}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {(visit.user as any)?.name || 'System'} •{" "}
                            {format(new Date(visit.created_at), "MMM d, h:mm a")}
                          </div>
                        </div>
                      </div>
                      <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  );
                }
                return null;
              })}
              {onViewAll && (
                <Button variant="ghost" size="sm" className="w-full" onClick={onViewAll}>
                  View all interactions
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No interactions yet</p>
              <p className="text-xs mt-1">Log your first call or visit</p>
            </div>
          )}
        </CardContent>
      </Card>

      <InteractionDetailModal open={detailOpen} onOpenChange={setDetailOpen} interaction={selectedInteraction} />
    </>
  );
}
