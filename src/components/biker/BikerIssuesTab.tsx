import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { useBikerIssues } from '@/hooks/useBikerIssues';
import { format, differenceInMinutes } from 'date-fns';

interface BikerIssuesTabProps {
  bikerId: string;
}

const severityColors: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-muted text-muted-foreground'
};

const BikerIssuesTab: React.FC<BikerIssuesTabProps> = ({ bikerId }) => {
  const navigate = useNavigate();
  const { data: issues = [], isLoading } = useBikerIssues({ bikerId });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading issues...
        </CardContent>
      </Card>
    );
  }

  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No issues assigned to this biker
        </CardContent>
      </Card>
    );
  }

  const getSLAStatus = (issue: any) => {
    if (!issue.due_at) return { text: 'No SLA', color: 'text-muted-foreground' };
    const now = new Date();
    const dueAt = new Date(issue.due_at);
    const minutesRemaining = differenceInMinutes(dueAt, now);
    
    if (minutesRemaining < 0) {
      return { text: `Overdue by ${Math.abs(minutesRemaining)}m`, color: 'text-destructive' };
    }
    if (minutesRemaining < 60) {
      return { text: `${minutesRemaining}m remaining`, color: 'text-orange-500' };
    }
    const hours = Math.floor(minutesRemaining / 60);
    return { text: `${hours}h ${minutesRemaining % 60}m remaining`, color: 'text-muted-foreground' };
  };

  return (
    <div className="space-y-3">
      {issues.map((issue: any) => {
        const slaStatus = getSLAStatus(issue);
        return (
          <Card key={issue.id} className="hover:shadow-md transition-shadow">
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <AlertCircle className={`h-5 w-5 mt-0.5 ${
                    issue.severity === 'critical' ? 'text-destructive' :
                    issue.severity === 'high' ? 'text-orange-500' :
                    'text-muted-foreground'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium capitalize">
                        {issue.issue_type?.replace(/_/g, ' ')}
                      </span>
                      <Badge className={severityColors[issue.severity || 'low']}>
                        {issue.severity}
                      </Badge>
                      <Badge variant={issue.status === 'resolved' ? 'default' : 'secondary'}>
                        {issue.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {issue.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className={slaStatus.color}>
                        <Clock className="h-3 w-3 inline mr-1" />
                        {slaStatus.text}
                      </span>
                      <span className="text-muted-foreground">
                        {format(new Date(issue.created_at), 'MMM d, HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/delivery/issues/${issue.id}`)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default BikerIssuesTab;