import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface PersonalNotesCardProps {
  contactId?: string;
  storeId?: string;
}

export function PersonalNotesCard({ contactId, storeId }: PersonalNotesCardProps) {
  const { data: interactions, isLoading } = useQuery({
    queryKey: ["personal-notes", contactId, storeId],
    queryFn: async () => {
      let query = supabase
        .from("contact_interactions")
        .select("id, summary, subject, interaction_type, created_at")
        .order("created_at", { ascending: false });

      if (contactId) {
        query = query.eq("contact_id", contactId);
      } else if (storeId) {
        query = query.eq("store_id", storeId);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      // Filter to entries with summary or subject
      return data?.filter((i: any) => (i.summary && i.summary.trim()) || (i.subject && i.subject.trim())) || [];
    },
    enabled: !!(contactId || storeId),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Personal Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Personal Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!interactions?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No notes recorded yet
          </p>
        ) : (
          <ScrollArea className="h-[200px] pr-2">
            <div className="space-y-3">
              {interactions.map((interaction: any) => (
                <div
                  key={interaction.id}
                  className="p-3 bg-muted/30 rounded-lg border border-border/30"
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      {interaction.subject && (
                        <p className="text-sm font-medium mb-1">{interaction.subject}</p>
                      )}
                      <p className="text-sm">{interaction.summary}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span className="capitalize">{interaction.interaction_type || "Note"}</span>
                        <span>•</span>
                        <span>{format(new Date(interaction.created_at), "MMM d, yyyy h:mm a")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
