// ═══════════════════════════════════════════════════════════════════════════════
// LEGAL PACKET PAGE — Pre-Legal Documentation & Escalation
// ═══════════════════════════════════════════════════════════════════════════════

import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  Download, 
  FileText, 
  Mail, 
  MessageSquare, 
  Phone,
  Scale,
  User,
  XCircle,
} from 'lucide-react';
import { useCollectionAccount, useCollectionActions, useCollectionCases } from '@/hooks/useCollections';
import { usePaymentPromises } from '@/hooks/usePaymentPromises';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION ICON MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

const actionIcons: Record<string, React.ReactNode> = {
  email_sent: <Mail className="h-4 w-4 text-blue-600" />,
  sms_sent: <MessageSquare className="h-4 w-4 text-green-600" />,
  call_logged: <Phone className="h-4 w-4 text-purple-600" />,
  statement_sent: <FileText className="h-4 w-4 text-orange-600" />,
  promise_created: <Calendar className="h-4 w-4 text-cyan-600" />,
  promise_kept: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  promise_broken: <XCircle className="h-4 w-4 text-red-600" />,
  escalated: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  note_added: <FileText className="h-4 w-4 text-gray-600" />,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function LegalPacketPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const { data: account, isLoading: accountLoading } = useCollectionAccount(accountId);
  const { data: actions } = useCollectionActions(accountId, 100);
  const { data: cases } = useCollectionCases(accountId);
  const { data: promises } = usePaymentPromises(accountId);

  if (accountLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Account not found</p>
      </div>
    );
  }

  const activeCase = cases?.find(c => !c.closed_at);
  const keptPromises = promises?.filter(p => p.status === 'kept') || [];
  const brokenPromises = promises?.filter(p => p.status === 'broken') || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-amber-600" />
            <h1 className="text-2xl font-bold">Legal Packet</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Complete documentation for escalated account
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </div>

      {/* Account Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Identity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Entity Name</p>
              <p className="font-medium">{account.entity_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entity Type</p>
              <p className="font-medium capitalize">{account.entity_type}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Primary Brand</p>
              <p className="font-medium">{account.primary_brand || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Risk Tier</p>
              <Badge variant="destructive" className="capitalize">
                {account.risk_tier}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Total Outstanding</p>
              <p className="text-2xl font-bold">{formatCurrency(account.total_outstanding)}</p>
            </div>
            <div className="p-4 bg-red-500/10 rounded-lg">
              <p className="text-xs text-muted-foreground">Total Overdue</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(account.total_overdue)}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Invoice Count</p>
              <p className="text-2xl font-bold">{account.invoice_count}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Days Overdue</p>
              <p className="text-2xl font-bold">{account.max_days_overdue}</p>
            </div>
          </div>
          {account.oldest_invoice_date && (
            <p className="text-sm text-muted-foreground mt-4">
              Oldest unpaid invoice: {format(new Date(account.oldest_invoice_date), 'MMMM d, yyyy')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Current Case Status */}
      {activeCase && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Current Collection Case
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Stage</p>
                <Badge className="mt-1 capitalize">{activeCase.stage.replace(/_/g, ' ')}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Opened</p>
                <p className="font-medium">{format(new Date(activeCase.opened_at), 'MMM d, yyyy')}</p>
              </div>
              {activeCase.reason && (
                <div>
                  <p className="text-xs text-muted-foreground">Reason</p>
                  <p className="font-medium">{activeCase.reason}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Promise History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Promise-to-Pay History</CardTitle>
          <CardDescription>
            {keptPromises.length} kept, {brokenPromises.length} broken
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!promises || promises.length === 0) ? (
            <p className="text-muted-foreground text-center py-4">No promises recorded</p>
          ) : (
            <div className="space-y-3">
              {promises.map((promise) => (
                <div 
                  key={promise.id} 
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    promise.status === 'kept' ? 'bg-green-500/10' :
                    promise.status === 'broken' ? 'bg-red-500/10' :
                    promise.status === 'cancelled' ? 'bg-gray-500/10' :
                    'bg-amber-500/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {promise.status === 'kept' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    {promise.status === 'broken' && <XCircle className="h-5 w-5 text-red-600" />}
                    {promise.status === 'active' && <Calendar className="h-5 w-5 text-amber-600" />}
                    {promise.status === 'cancelled' && <XCircle className="h-5 w-5 text-gray-400" />}
                    <div>
                      <p className="font-medium">{formatCurrency(promise.promise_amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        Promised for {format(new Date(promise.promise_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={promise.status === 'kept' ? 'default' : promise.status === 'broken' ? 'destructive' : 'outline'}
                    className="capitalize"
                  >
                    {promise.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Communications Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Communications Log</CardTitle>
          <CardDescription>Complete audit trail of all collection activity</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            {(!actions || actions.length === 0) ? (
              <p className="text-muted-foreground text-center py-4">No actions recorded</p>
            ) : (
              <div className="space-y-4">
                {actions.map((action, index) => (
                  <div key={action.id}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {actionIcons[action.action_type] || <FileText className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm capitalize">
                            {action.action_type.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(action.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        {action.message_preview && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {action.message_preview}
                          </p>
                        )}
                        <Badge variant="outline" className="mt-2 text-xs capitalize">
                          {action.channel}
                        </Badge>
                      </div>
                    </div>
                    {index < actions.length - 1 && <Separator className="my-4" />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Legal Notice */}
      <Card className="border-red-500/50 bg-red-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Scale className="h-6 w-6 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-600">Pre-Legal Documentation</p>
              <p className="text-sm text-muted-foreground mt-1">
                This packet contains all communications, promises, and financial records 
                for legal review. All data is timestamped and immutable.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Total owed: <span className="font-bold text-foreground">{formatCurrency(account.total_outstanding)}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default LegalPacketPage;
