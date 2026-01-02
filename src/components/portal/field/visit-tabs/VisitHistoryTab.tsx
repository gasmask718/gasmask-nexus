import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, CheckCircle2, XCircle, Clock, Truck, ClipboardCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VisitHistoryTabProps {
  storeId: string;
}

interface VisitRecord {
  id: string;
  visited_at: string;
  visitor_type: string;
  visit_type: string;
  status: string;
  visitor_name?: string;
}

interface ChangeListRecord {
  id: string;
  created_at: string;
  status: string;
  submitted_by_name?: string;
}

export function VisitHistoryTab({ storeId }: VisitHistoryTabProps) {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [changeLists, setChangeLists] = useState<ChangeListRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        // Fetch visits
        const { data: visitsData } = await supabase
          .from('store_visits')
          .select(`
            id,
            visited_at,
            role_type,
            visit_type,
            status,
            profiles:visited_by (full_name)
          `)
          .eq('store_id', storeId)
          .order('visited_at', { ascending: false })
          .limit(20);

        if (visitsData) {
          setVisits(visitsData.map((v: any) => ({
            id: v.id,
            visited_at: v.visited_at,
            visitor_type: v.role_type,
            visit_type: v.visit_type,
            status: v.status,
            visitor_name: v.profiles?.full_name,
          })));
        }

        // Fetch change lists
        const { data: changeListsData } = await supabase
          .from('change_lists')
          .select(`
            id,
            created_at,
            status,
            profiles:submitted_by (full_name)
          `)
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (changeListsData) {
          setChangeLists(changeListsData.map((c: any) => ({
            id: c.id,
            created_at: c.created_at,
            status: c.status,
            submitted_by_name: c.profiles?.full_name,
          })));
        }
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [storeId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Visits History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Visit History
          </CardTitle>
          <CardDescription>
            All visits and deliveries to this store
          </CardDescription>
        </CardHeader>
        <CardContent>
          {visits.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No visit history</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Visitor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell>
                      {new Date(visit.visited_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {visit.visit_type === 'delivery' ? (
                          <Truck className="h-4 w-4" />
                        ) : (
                          <ClipboardCheck className="h-4 w-4" />
                        )}
                        <span className="capitalize">{visit.visit_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {visit.visitor_type}
                        </Badge>
                        <span className="text-muted-foreground text-sm">
                          {visit.visitor_name || 'Unknown'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(visit.status)}
                        <Badge variant={getStatusVariant(visit.status) as any}>
                          {visit.status}
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

      {/* Change Lists History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Submitted Change Lists</CardTitle>
          <CardDescription>
            History of change submissions and their approval status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {changeLists.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No change lists submitted</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changeLists.map((cl) => (
                  <TableRow key={cl.id}>
                    <TableCell>
                      {new Date(cl.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{cl.submitted_by_name || 'Unknown'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(cl.status)}
                        <Badge variant={getStatusVariant(cl.status) as any}>
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
