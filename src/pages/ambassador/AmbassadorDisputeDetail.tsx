import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  AlertTriangle,
  MessageSquare,
  Paperclip,
  Send,
  Clock,
  User,
  Shield,
  DollarSign,
  Calendar,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import {
import { toast } from 'sonner';
import { openSignedStorageObject } from '@/lib/storageLinks';
  useDispute,
  useDisputeMessages,
  useDisputeEvidence,
  useAddDisputeMessage,
  REASON_CODE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '@/hooks/useDisputes';

export default function AmbassadorDisputeDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: dispute, isLoading } = useDispute(id);
  const { data: messages = [] } = useDisputeMessages(id);
  const { data: evidence = [] } = useDisputeEvidence(id);
  const addMessage = useAddDisputeMessage();
  
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = async () => {
    if (!id || !newMessage.trim()) return;
    
    await addMessage.mutateAsync({
      disputeId: id,
      message: newMessage.trim(),
    });
    
    setNewMessage('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p>Dispute not found</p>
          <Link to="/ambassador/disputes">
            <Button variant="outline" className="mt-4">
              Back to Disputes
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const canAddMessage = dispute.status === 'needs_info' || dispute.status === 'submitted';

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/ambassador/disputes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {dispute.title || REASON_CODE_LABELS[dispute.reason_code]}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={STATUS_COLORS[dispute.status]}>
              {STATUS_LABELS[dispute.status]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Filed {format(new Date(dispute.submitted_at), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dispute Details */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Dispute Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Reason</div>
                <div className="font-medium">{REASON_CODE_LABELS[dispute.reason_code]}</div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground">Description</div>
                <div className="mt-1 whitespace-pre-wrap">{dispute.description}</div>
              </div>
              
              {dispute.requested_amount && (
                <div>
                  <div className="text-sm text-muted-foreground">Requested Amount</div>
                  <div className="font-medium text-lg">
                    ${dispute.requested_amount.toLocaleString()}
                  </div>
                </div>
              )}
              
              {dispute.resolution_summary && (
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="text-sm text-muted-foreground mb-1">Resolution</div>
                  <div>{dispute.resolution_summary}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Messages */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No messages yet
                </p>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${
                        msg.author_role === 'ambassador' ? '' : 'flex-row-reverse'
                      }`}
                    >
                      <div className={`p-2 rounded-full ${
                        msg.author_role === 'ambassador' 
                          ? 'bg-primary/10' 
                          : 'bg-amber-500/10'
                      }`}>
                        {msg.author_role === 'ambassador' ? (
                          <User className="h-4 w-4 text-primary" />
                        ) : (
                          <Shield className="h-4 w-4 text-amber-400" />
                        )}
                      </div>
                      <div className={`flex-1 ${
                        msg.author_role === 'ambassador' ? 'pr-12' : 'pl-12'
                      }`}>
                        <div className={`p-3 rounded-lg ${
                          msg.author_role === 'ambassador'
                            ? 'bg-primary/10 border border-primary/20'
                            : 'bg-amber-500/10 border border-amber-500/20'
                        }`}>
                          <div className="text-xs text-muted-foreground mb-1">
                            {msg.author_role === 'ambassador' ? 'You' : 'Admin'} •{' '}
                            {format(new Date(msg.created_at), 'MMM d, yyyy, h:mm a')}
                          </div>
                          <div className="whitespace-pre-wrap">{msg.message}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canAddMessage && (
                <>
                  <Separator className="my-4" />
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      rows={2}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || addMessage.isPending}
                      size="icon"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
                <div>
                  <div className="text-sm font-medium">Submitted</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(dispute.submitted_at), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
              </div>
              
              {dispute.reviewed_at && (
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-amber-400" />
                  <div>
                    <div className="text-sm font-medium">Reviewed</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(dispute.reviewed_at), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                </div>
              )}
              
              {dispute.resolved_at && (
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-400" />
                  <div>
                    <div className="text-sm font-medium">Resolved</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(dispute.resolved_at), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Commission */}
          {dispute.commission_ledger && (
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Related Commission
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm text-muted-foreground">Source</div>
                  <div className="font-medium">
                    {(dispute.commission_ledger as any)?.source_name || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Amount</div>
                  <div className="font-medium">
                    ${((dispute.commission_ledger as any)?.commission_amount || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Earned</div>
                  <div className="font-medium">
                    {(dispute.commission_ledger as any)?.earned_at 
                      ? format(new Date((dispute.commission_ledger as any).earned_at), 'MMM d, yyyy')
                      : 'N/A'
                    }
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evidence */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Paperclip className="h-4 w-4 text-primary" />
                Evidence ({evidence.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No evidence attached
                </p>
              ) : (
                <div className="space-y-2">
                  {evidence.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => openSignedStorageObject('dispute-evidence', e.file_url).catch((err: any) => toast.error(err.message || 'Could not open attachment'))}
                      className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate flex-1">
                        {e.file_name || 'Attachment'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
