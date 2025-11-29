import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { History, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AuditEntry {
  id: string;
  action: string;
  metadata: {
    field?: string;
    old_value?: any;
    new_value?: any;
  } | null;
  created_at: string;
  user_id: string | null;
  user_name?: string;
}

interface AuditHistoryProps {
  entityType: string;
  entityId: string;
}

export function AuditHistory({ entityType, entityId }: AuditHistoryProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from('audit_logs')
          .select('id, action, metadata, created_at, user_id')
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        // Fetch user names for entries
        const userIds = [...new Set((data || []).map((e: any) => e.user_id).filter(Boolean))];
        let userMap: Record<string, string> = {};

        if (userIds.length > 0) {
          const { data: profiles } = await (supabase as any)
            .from('profiles')
            .select('id, name')
            .in('id', userIds);

          if (profiles) {
            userMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.name]));
          }
        }

        setEntries(
          (data || []).map((entry: any) => ({
            ...entry,
            user_name: entry.user_id ? userMap[entry.user_id] || 'Unknown' : 'System',
          }))
        );
      } catch (error) {
        console.error('Failed to fetch audit history:', error);
      } finally {
        setLoading(false);
      }
    };

    if (entityId) {
      fetchHistory();
    }
  }, [entityType, entityId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No history yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[200px]">
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="p-2 rounded-md bg-muted/30 text-sm"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="text-xs">{entry.user_name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(new Date(entry.created_at), 'MMM d, h:mm a')}
              </span>
            </div>
            <div className="text-foreground">
              {entry.metadata?.field ? (
                <span>
                  Changed <strong>{entry.metadata.field}</strong>
                  {entry.metadata.old_value !== undefined && (
                    <span className="text-muted-foreground">
                      {' '}from "{String(entry.metadata.old_value)}"
                    </span>
                  )}
                  {entry.metadata.new_value !== undefined && (
                    <span className="text-primary">
                      {' '}to "{String(entry.metadata.new_value)}"
                    </span>
                  )}
                </span>
              ) : (
                <span className="capitalize">{entry.action}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
