// ═══════════════════════════════════════════════════════════════════════════════
// STORE FIELD ACTIVITY PANEL
// Shows recent field submissions for a specific store
// ═══════════════════════════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  User,
  ExternalLink,
  FileText
} from 'lucide-react';
import { fieldStamp, fieldRelative } from '@/lib/dates';
import { Link } from 'react-router-dom';
import { 
  useStoreFieldSubmissions,
  getEntityTypeLabel,
  getActionTypeLabel,
  getStatusColor,
  type FieldSubmission,
} from '@/hooks/useFieldSubmissions';

interface StoreFieldActivityPanelProps {
  storeId: string;
}

export function StoreFieldActivityPanel({ storeId }: StoreFieldActivityPanelProps) {
  const { data: submissions, isLoading } = useStoreFieldSubmissions(storeId, 10);

  const pendingCount = submissions?.filter(s => s.submission_status === 'pending_review').length || 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending_review':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'auto_approved':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Field Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Field Activity
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingCount} pending
              </Badge>
            )}
          </CardTitle>
          <Link to="/communication/field-submissions">
            <Button variant="ghost" size="sm">
              View All
              <ExternalLink className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {!submissions?.length ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No field activity recorded</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-0.5">
                    {getStatusIcon(sub.submission_status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {getEntityTypeLabel(sub.entity_type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {getActionTypeLabel(sub.action_type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-sm">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{sub.submitter_name}</span>
                      <span className="text-muted-foreground capitalize">
                        ({sub.submitted_by_role})
                      </span>
                    </div>
                    <div className="mt-1" title={fieldRelative(sub.created_at)}>
                      <div className="text-xs font-medium text-foreground">
                        {fieldStamp(sub.created_at)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {fieldRelative(sub.created_at)}
                      </div>
                    </div>
                    {sub.rejection_reason && (
                      <div className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                        Rejected: {sub.rejection_reason}
                      </div>
                    )}
                  </div>
                  <Badge className={getStatusColor(sub.submission_status)}>
                    {sub.submission_status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
