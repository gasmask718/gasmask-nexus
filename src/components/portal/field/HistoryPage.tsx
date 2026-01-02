import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, Store, Truck, ClipboardCheck, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface HistoryItem {
  id: string;
  store_name: string;
  visit_type: string;
  status: string;
  visited_at: string;
}

interface HistoryPageProps {
  portalType: 'driver' | 'biker';
}

export function HistoryPage({ portalType }: HistoryPageProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('store_visits')
          .select(`
            id,
            visit_type,
            status,
            created_at,
            store_master:store_id (store_name)
          `)
          .eq('visited_by', user.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (data) {
          setHistory(data.map((v: any) => ({
            id: v.id,
            store_name: v.store_master?.store_name || 'Unknown',
            visit_type: v.visit_type,
            status: v.status,
            visited_at: v.created_at,
          })));
        }
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Visit History</h1>
        <p className="text-sm text-muted-foreground">All your past visits and deliveries</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Your History
          </CardTitle>
          <CardDescription>
            {history.length} visits recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No history yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{new Date(item.visited_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{item.store_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.visit_type === 'delivery' ? (
                          <Truck className="h-4 w-4" />
                        ) : (
                          <ClipboardCheck className="h-4 w-4" />
                        )}
                        <span className="capitalize">{item.visit_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'completed' ? 'default' : 'secondary'}>
                        {item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
