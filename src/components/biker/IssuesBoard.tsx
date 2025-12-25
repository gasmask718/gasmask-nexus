import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Clock, CheckCircle, Eye, UserPlus, ArrowUp, Timer } from 'lucide-react';
import { useBikerIssues, useAssignIssue, useEscalateIssue } from '@/hooks/useBikerIssues';
import { formatDistanceToNow, differenceInMinutes, isPast } from 'date-fns';
import { BikerAssignmentDialog } from './BikerAssignmentDialog';

interface IssueCardProps {
  issue: any;
  onViewDetails: () => void;
  onAssign: () => void;
  onEscalate: () => void;
}

const IssueCard: React.FC<IssueCardProps> = ({ issue, onViewDetails, onAssign, onEscalate }) => {
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
    const now = new Date();
    const minutesRemaining = differenceInMinutes(dueAt, now);
    
    if (isPast(dueAt)) {
      return { text: `Overdue by ${formatDistanceToNow(dueAt)}`, color: 'text-red-500', urgent: true };
    } else if (minutesRemaining < 60) {
      return { text: `${minutesRemaining}m remaining`, color: 'text-orange-500', urgent: true };
    } else if (minutesRemaining < 240) {
      return { text: `${Math.round(minutesRemaining / 60)}h remaining`, color: 'text-yellow-500', urgent: false };
    }
    return { text: formatDistanceToNow(dueAt, { addSuffix: true }), color: 'text-muted-foreground', urgent: false };
  };

  const slaStatus = getSLAStatus();

  return (
    <Card className={`border-l-4 ${getSeverityColor(issue.severity)} bg-card hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{issue.location?.name || 'Unknown Store'}</h4>
            <p className="text-sm text-muted-foreground">{issue.issue_type.replace('_', ' ')}</p>
          </div>
          <Badge variant={issue.severity === 'critical' ? 'destructive' : 'secondary'}>
            {issue.severity}
          </Badge>
        </div>

        {slaStatus && (
          <div className={`flex items-center gap-1 text-sm mb-2 ${slaStatus.color}`}>
            <Timer className="h-3 w-3" />
            <span className={slaStatus.urgent ? 'font-semibold' : ''}>{slaStatus.text}</span>
          </div>
        )}

        {issue.assignee && (
          <p className="text-xs text-muted-foreground mb-2">
            Assigned: {issue.assignee.full_name}
          </p>
        )}

        {issue.escalated && (
          <Badge variant="destructive" className="mb-2">Escalated</Badge>
        )}

        <div className="flex gap-1 mt-3">
          <Button size="sm" variant="outline" onClick={onViewDetails} className="flex-1">
            <Eye className="h-3 w-3 mr-1" /> View
          </Button>
          <Button size="sm" variant="outline" onClick={onAssign}>
            <UserPlus className="h-3 w-3" />
          </Button>
          {!issue.escalated && (
            <Button size="sm" variant="outline" onClick={onEscalate} className="text-orange-500">
              <ArrowUp className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const IssuesBoard: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);

  const { data: issues = [], isLoading } = useBikerIssues({
    status: statusFilter === 'all' ? undefined : statusFilter,
    severity: severityFilter === 'all' ? undefined : severityFilter
  });

  const escalateIssue = useEscalateIssue();

  const openIssues = issues.filter(i => i.status === 'open');
  const inProgressIssues = issues.filter(i => i.status === 'in_progress');
  const resolvedIssues = issues.filter(i => i.status === 'resolved').slice(0, 10);

  const handleAssign = (issue: any) => {
    setSelectedIssue(issue);
    setAssignDialogOpen(true);
  };

  const handleEscalate = (issue: any) => {
    escalateIssue.mutate({ issueId: issue.id });
  };

  const columns = [
    { title: 'Open', icon: AlertTriangle, color: 'text-red-500', issues: openIssues },
    { title: 'In Progress', icon: Clock, color: 'text-yellow-500', issues: inProgressIssues },
    { title: 'Resolved', icon: CheckCircle, color: 'text-green-500', issues: resolvedIssues }
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={() => navigate('/delivery/issues/new')}>
          Report Issue
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((column) => (
          <Card key={column.title} className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <column.icon className={`h-5 w-5 ${column.color}`} />
                {column.title}
                <Badge variant="secondary" className="ml-auto">{column.issues.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
              ) : column.issues.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No issues</p>
              ) : (
                column.issues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    onViewDetails={() => navigate(`/delivery/issues/${issue.id}`)}
                    onAssign={() => handleAssign(issue)}
                    onEscalate={() => handleEscalate(issue)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Assignment Dialog */}
      {selectedIssue && (
        <BikerAssignmentDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          entityType="issue"
          entityId={selectedIssue.id}
          entityName={selectedIssue.location?.name || 'Issue'}
          onAssigned={() => setSelectedIssue(null)}
        />
      )}
    </div>
  );
};

export default IssuesBoard;
