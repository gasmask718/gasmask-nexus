import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ChangeListItem {
  id: string;
  store_name: string;
  status: string;
  created_at: string;
  items_count: number;
}

interface ChangeListsPageProps {
  portalType: 'driver' | 'biker';
}

export function ChangeListsPage({ portalType }: ChangeListsPageProps) {
  const [changeLists, setChangeLists] = useState<ChangeListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChangeLists() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('change_lists')
          .select(`
            id,
            status,
            created_at,
            store_master:store_id (store_name),
            change_list_items (id)
          `)
          .eq('submitted_by', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (data) {
          setChangeLists(data.map((c: any) => ({
            id: c.id,
            store_name: c.store_master?.store_name || 'Unknown',
            status: c.status,
            created_at: c.created_at,
            items_count: c.change_list_items?.length || 0,
          })));
        }
      } catch (error) {
        console.error('Error fetching change lists:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchChangeLists();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'committed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" => {
    switch (status) {
      case 'approved':
      case 'committed':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Change Lists</h1>
        <p className="text-sm text-muted-foreground">Your submitted changes and their status</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Submitted Changes
          </CardTitle>
          <CardDescription>
            All changes you've submitted for review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : changeLists.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No change lists submitted yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changeLists.map((cl) => (
                  <TableRow key={cl.id}>
                    <TableCell className="font-medium">{cl.store_name}</TableCell>
                    <TableCell>{new Date(cl.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{cl.items_count} items</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(cl.status)}
                        <Badge variant={getStatusVariant(cl.status)}>
                          {cl.status}
                        </Badge>
                      </div>
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
