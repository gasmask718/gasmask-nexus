import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getEntityTypeLabel } from '@/hooks/useFieldSubmissions';
import { formatDistanceToNow } from 'date-fns';

interface FieldSubmissionItem {
  id: string;
  store_name: string;
  entity_type: string;
  action_type: string;
  submission_status: string;
  created_at: string;
  payload_before: Record<string, unknown> | null;
  payload_after: Record<string, unknown>;
  rejection_reason: string | null;
}

interface ChangeListsPageProps {
  portalType: 'driver' | 'biker';
}

export function ChangeListsPage({ portalType }: ChangeListsPageProps) {
  const [submissions, setSubmissions] = useState<FieldSubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubmissions() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('field_submissions')
          .select(`
            id,
            entity_type,
            action_type,
            submission_status,
            created_at,
            payload_before,
            payload_after,
            rejection_reason,
            store:store_master(store_name)
          `)
          .eq('submitted_by_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (data) {
          setSubmissions(data.map((c: any) => ({
            id: c.id,
            store_name: c.store?.store_name || 'Unknown Store',
            entity_type: c.entity_type,
            action_type: c.action_type,
            submission_status: c.submission_status,
            created_at: c.created_at,
            payload_before: c.payload_before,
            payload_after: c.payload_after,
            rejection_reason: c.rejection_reason,
          })));
        }
      } catch (error) {
        console.error('Error fetching submissions:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSubmissions();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'auto_approved':
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
      case 'auto_approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getChangeSummary = (item: FieldSubmissionItem): string => {
    const after = item.payload_after;
    if (!after) return 'No details';
    
    // For sticker changes
    if (item.entity_type === 'brand_sticker' && after.sticker_type) {
      const stickerName = String(after.sticker_type).replace(/_/g, ' ');
      return `${stickerName}: ${after.value ? 'Yes' : 'No'}`;
    }
    
    // For tube inventory
    if (item.entity_type === 'tube_inventory' && after.field) {
      return `${String(after.field).replace(/_/g, ' ')}: ${after.value}`;
    }

    // For store contacts
    if (item.entity_type === 'store_contact' && after.name) {
      return `Contact: ${after.name}`;
    }

    // Generic: show first meaningful field
    const keys = Object.keys(after).filter(k => !['store_id', 'brand_id', 'id', 'created_at', 'updated_at'].includes(k));
    if (keys.length > 0) {
      return `${keys.length} field${keys.length > 1 ? 's' : ''} changed`;
    }
    return 'Changes submitted';
  };

  const statusLabel = (status: string) => status.replace(/_/g, ' ');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">My Submissions</h1>
        <p className="text-sm text-muted-foreground">Your submitted changes and their approval status</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Submitted Changes
          </CardTitle>
          <CardDescription>
            All changes you've submitted for admin review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No submissions yet</p>
              <p className="text-xs mt-1">Changes you make during store visits will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.store_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getEntityTypeLabel(sub.entity_type as any)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {getChangeSummary(sub)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(sub.submission_status)}
                        <Badge variant={getStatusVariant(sub.submission_status)} className="capitalize">
                          {statusLabel(sub.submission_status)}
                        </Badge>
                      </div>
                      {sub.submission_status === 'rejected' && sub.rejection_reason && (
                        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {sub.rejection_reason}
                        </p>
                      )}
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
