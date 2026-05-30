import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { 
  Clock, Store, DollarSign, UserPlus, Phone, 
  MessageSquare, MapPin, FileText, CheckCircle2,
  AlertCircle, TrendingUp
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'store_added' | 'commission_earned' | 'visit_logged' | 'status_change' | 'note_added' | 'sale_completed';
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface AmbassadorActivityTimelineProps {
  ambassadorId: string;
  limit?: number;
}

const activityIcons: Record<string, React.ReactNode> = {
  store_added: <Store className="h-4 w-4" />,
  commission_earned: <DollarSign className="h-4 w-4" />,
  visit_logged: <MapPin className="h-4 w-4" />,
  status_change: <UserPlus className="h-4 w-4" />,
  note_added: <FileText className="h-4 w-4" />,
  sale_completed: <CheckCircle2 className="h-4 w-4" />,
};

const activityColors: Record<string, string> = {
  store_added: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  commission_earned: 'bg-green-500/10 text-green-500 border-green-500/20',
  visit_logged: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  status_change: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  note_added: 'bg-muted text-muted-foreground border-border',
  sale_completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

export function AmbassadorActivityTimeline({ ambassadorId, limit = 20 }: AmbassadorActivityTimelineProps) {
  // Fetch assignments (store additions)
  const { data: assignments } = useQuery({
    queryKey: ['ambassador-assignments-timeline', ambassadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_assignments')
        .select('id, created_at, role_type, company:companies(name)')
        .eq('ambassador_id', ambassadorId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!ambassadorId,
  });

  // Fetch commissions
  const { data: commissions } = useQuery({
    queryKey: ['ambassador-commissions-timeline', ambassadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_commissions')
        .select('id, created_at, amount, status, entity_type, notes')
        .eq('ambassador_id', ambassadorId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!ambassadorId,
  });

  // Fetch online sales
  const { data: onlineSales } = useQuery({
    queryKey: ['ambassador-sales-timeline', ambassadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_online_sales')
        .select('id, sale_date, order_amount, commission_amount, status, customer_name')
        .eq('ambassador_id', ambassadorId)
        .order('sale_date', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!ambassadorId,
  });

  // Fetch notes from ambassador_notes table
  const { data: notes } = useQuery({
    queryKey: ['ambassador-notes-timeline', ambassadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_notes')
        .select('id, created_at, note, created_by')
        .eq('ambassador_id', ambassadorId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!ambassadorId,
  });

  // Build unified timeline
  const buildTimeline = (): ActivityItem[] => {
    const items: ActivityItem[] = [];

    // Add store assignments
    (assignments || []).forEach((a: any) => {
      items.push({
        id: `assignment-${a.id}`,
        type: 'store_added',
        title: `Added ${a.company?.name || 'store'}`,
        description: `Role: ${a.role_type?.replace('_', ' ') || 'Store finder'}`,
        timestamp: a.created_at,
      });
    });

    // Add commissions
    (commissions || []).forEach((c: any) => {
      items.push({
        id: `commission-${c.id}`,
        type: 'commission_earned',
        title: `Commission: $${Number(c.amount).toFixed(2)}`,
        description: c.notes || `${c.entity_type} - ${c.status}`,
        timestamp: c.created_at,
        metadata: { status: c.status },
      });
    });

    // Add online sales
    (onlineSales || []).forEach((s: any) => {
      items.push({
        id: `sale-${s.id}`,
        type: 'sale_completed',
        title: `Online sale: $${Number(s.order_amount).toFixed(2)}`,
        description: s.customer_name ? `Customer: ${s.customer_name}` : undefined,
        timestamp: s.sale_date,
        metadata: { status: s.status, commission: s.commission_amount },
      });
    });

    // Add notes
    (notes || []).forEach((n: any) => {
      const noteText = n.note || '';
      items.push({
        id: `note-${n.id}`,
        type: 'note_added',
        title: 'Note added',
        description: noteText.substring(0, 100) + (noteText.length > 100 ? '...' : ''),
        timestamp: n.created_at,
      });
    });

    // Sort by timestamp descending
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return items.slice(0, limit);
  };

  const timeline = buildTimeline();

  if (timeline.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No activity recorded yet</p>
            <p className="text-sm mt-1">Activities will appear here as the ambassador takes actions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
            
            <div className="space-y-4">
              {timeline.map((item, index) => (
                <div key={item.id} className="relative flex gap-4 pl-10">
                  {/* Icon bubble */}
                  <div 
                    className={`absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border ${activityColors[item.type]}`}
                  >
                    {activityIcons[item.type]}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{item.title}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                        )}
                      </div>
                      <time className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(item.timestamp), 'MMM d, yyyy, h:mm a')}
                      </time>
                    </div>
                    {item.metadata?.status && (
                      <Badge variant="outline" className="mt-1 text-xs capitalize">
                        {item.metadata.status}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
