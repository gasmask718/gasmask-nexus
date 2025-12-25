import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, AlertTriangle, Clock, CheckCircle, MapPin, 
  User, Calendar, MessageSquare, ArrowUp, Timer, 
  Store, Route, UserPlus, Save
} from 'lucide-react';
import { 
  useBikerIssue, 
  useIssueEvents, 
  useUpdateIssue, 
  useAddIssueEvent,
  useAssignIssue,
  useEscalateIssue,
  useResolveIssue
} from '@/hooks/useBikerIssues';
import { formatDistanceToNow, differenceInMinutes, isPast, format } from 'date-fns';
import { BikerAssignmentDialog } from '@/components/biker/BikerAssignmentDialog';
import { toast } from 'sonner';

const IssueDetailPage: React.FC = () => {
  const { issueId } = useParams();
  const navigate = useNavigate();
  
  const [comment, setComment] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const { data: issue, isLoading } = useBikerIssue(issueId!);
  const { data: events = [] } = useIssueEvents(issueId!);
  const updateIssue = useUpdateIssue();
  const addEvent = useAddIssueEvent();
  const assignIssue = useAssignIssue();
  const escalateIssue = useEscalateIssue();
  const resolveIssue = useResolveIssue();

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 text-center text-muted-foreground">Loading issue...</div>
      </Layout>
    );
  }

  if (!issue) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Issue not found</p>
          <Button className="mt-4" onClick={() => navigate('/delivery/bikers')}>
            Back to Biker OS
          </Button>
        </div>
      </Layout>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getSLAStatus = () => {
    if (!issue.due_at) return null;
    const dueAt = new Date(issue.due_at);
    const minutesRemaining = differenceInMinutes(dueAt, new Date());
    
    if (isPast(dueAt)) {
      return { text: `Overdue by ${formatDistanceToNow(dueAt)}`, color: 'text-red-500', urgent: true };
    } else if (minutesRemaining < 60) {
      return { text: `${minutesRemaining}m remaining`, color: 'text-orange-500', urgent: true };
    }
    return { text: `Due ${formatDistanceToNow(dueAt, { addSuffix: true })}`, color: 'text-muted-foreground', urgent: false };
  };

  const slaStatus = getSLAStatus();

  const handleAddComment = () => {
    if (!comment.trim()) return;
    addEvent.mutate({
      issue_id: issueId!,
      action: 'comment_added',
      notes: comment
    }, {
      onSuccess: () => setComment('')
    });
  };

  const handleStatusChange = () => {
    if (!newStatus) return;
    updateIssue.mutate({ 
      id: issueId!, 
      status: newStatus as any 
    });
    addEvent.mutate({
      issue_id: issueId!,
      action: 'status_changed',
      old_value: issue.status,
      new_value: newStatus,
      notes: `Status changed to ${newStatus}`
    });
  };

  const handleEscalate = () => {
    escalateIssue.mutate({ 
      issueId: issueId!,
      notes: 'Escalated by ops'
    });
  };

  const handleResolve = () => {
    resolveIssue.mutate({
      issueId: issueId!,
      notes: 'Issue resolved'
    });
  };

  const getEventIcon = (action: string) => {
    switch (action) {
      case 'created': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'assigned': return <UserPlus className="h-4 w-4 text-blue-500" />;
      case 'status_changed': return <Clock className="h-4 w-4 text-purple-500" />;
      case 'escalated': return <ArrowUp className="h-4 w-4 text-red-500" />;
      case 'resolved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'comment_added': return <MessageSquare className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Issue Details</h1>
              <Badge className={`${getSeverityColor(issue.severity)} text-white`}>
                {issue.severity}
              </Badge>
              <Badge variant={issue.status === 'resolved' ? 'default' : 'secondary'}>
                {issue.status}
              </Badge>
              {issue.escalated && (
                <Badge variant="destructive">Escalated</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{issue.issue_type.replace('_', ' ')}</p>
          </div>
        </div>

        {/* SLA Timer */}
        {slaStatus && issue.status !== 'resolved' && (
          <Card className={slaStatus.urgent ? 'border-red-500/50 bg-red-500/5' : ''}>
            <CardContent className="p-4 flex items-center gap-3">
              <Timer className={`h-5 w-5 ${slaStatus.color}`} />
              <span className={`font-medium ${slaStatus.color}`}>{slaStatus.text}</span>
              {issue.due_at && (
                <span className="text-sm text-muted-foreground ml-auto">
                  Due: {format(new Date(issue.due_at), 'MMM d, h:mm a')}
                </span>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Issue Info */}
            <Card>
              <CardHeader>
                <CardTitle>Issue Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Store / Location</p>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-left"
                      onClick={() => issue.location_id && navigate(`/delivery/store/${issue.location_id}`)}
                    >
                      <Store className="h-4 w-4 mr-1" />
                      {issue.location?.name || 'Unknown'}
                    </Button>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Issue Type</p>
                    <p className="font-medium">{issue.issue_type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Reported By</p>
                    <p className="font-medium">{issue.reporter?.full_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned To</p>
                    <p className="font-medium">{issue.assignee?.full_name || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">{format(new Date(issue.created_at), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                </div>

                {issue.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p className="bg-muted/50 p-3 rounded-lg">{issue.description}</p>
                  </div>
                )}

                {issue.photos && issue.photos.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Photos / Evidence</p>
                    <div className="flex gap-2 flex-wrap">
                      {issue.photos.map((photo, i) => (
                        <img 
                          key={i} 
                          src={photo} 
                          alt={`Evidence ${i + 1}`}
                          className="w-24 h-24 object-cover rounded-lg border"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {events.map((event) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="mt-1">{getEventIcon(event.action)}</div>
                      <div className="flex-1">
                        <p className="font-medium capitalize">{event.action.replace('_', ' ')}</p>
                        {event.notes && (
                          <p className="text-sm text-muted-foreground">{event.notes}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.created_at), 'MMM d, h:mm a')}
                          {event.actor && ` by ${event.actor.name}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Comment */}
                <div className="mt-6 pt-4 border-t">
                  <Textarea
                    placeholder="Add a comment or note..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                  />
                  <Button 
                    size="sm" 
                    className="mt-2"
                    onClick={handleAddComment}
                    disabled={!comment.trim() || addEvent.isPending}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" /> Add Comment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Actions */}
          <div className="space-y-4">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full" 
                  onClick={() => setAssignDialogOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" /> Assign / Reassign Biker
                </Button>
                
                {issue.status !== 'resolved' && (
                  <Button 
                    variant="outline" 
                    className="w-full text-green-600"
                    onClick={handleResolve}
                    disabled={resolveIssue.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Mark as Resolved
                  </Button>
                )}
                
                {!issue.escalated && issue.status !== 'resolved' && (
                  <Button 
                    variant="outline" 
                    className="w-full text-orange-600"
                    onClick={handleEscalate}
                    disabled={escalateIssue.isPending}
                  >
                    <ArrowUp className="h-4 w-4 mr-2" /> Escalate
                  </Button>
                )}

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/delivery/biker-tasks')}
                >
                  <Route className="h-4 w-4 mr-2" /> Create Follow-up Task
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => issue.location_id && navigate(`/delivery/store/${issue.location_id}`)}
                >
                  <Store className="h-4 w-4 mr-2" /> View Store Profile
                </Button>
              </CardContent>
            </Card>

            {/* Change Status */}
            <Card>
              <CardHeader>
                <CardTitle>Change Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={newStatus || issue.status} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  className="w-full"
                  onClick={handleStatusChange}
                  disabled={!newStatus || newStatus === issue.status || updateIssue.isPending}
                >
                  <Save className="h-4 w-4 mr-2" /> Update Status
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Assignment Dialog */}
        <BikerAssignmentDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          entityType="issue"
          entityId={issueId}
          entityName={issue.location?.name || 'Issue'}
          currentBikerId={issue.assigned_biker_id}
          onAssigned={() => {}}
        />
      </div>
    </Layout>
  );
};

export default IssueDetailPage;
