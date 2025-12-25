import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Eye, UserPlus, ChevronRight, MessageSquare, ArrowUp } from 'lucide-react';

interface Issue {
  id: string;
  store_id: string;
  store_name: string;
  issue_type: string;
  severity: 'low' | 'medium' | 'high';
  reported_by: string;
  reported_at: string;
  status: string;
  description?: string;
}

interface IssuesPanelProps {
  issues: Issue[];
  isLoading?: boolean;
  onViewDetails?: (issue: Issue) => void;
  onAssignBiker?: (storeId: string, storeName: string) => void;
  onEscalate?: (issueId: string) => void;
}

export const IssuesPanel: React.FC<IssuesPanelProps> = ({
  issues,
  isLoading,
  onViewDetails,
  onAssignBiker,
  onEscalate
}) => {
  const navigate = useNavigate();

  const getSeverityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      high: 'bg-red-500/10 text-red-600 border-red-500/20',
      medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      low: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    };
    return styles[severity] || styles.medium;
  };

  const getSeverityDot = (severity: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-500',
      medium: 'bg-amber-500',
      low: 'bg-emerald-500',
    };
    return colors[severity] || colors.medium;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading issues...
        </CardContent>
      </Card>
    );
  }

  if (issues.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Reported Issues
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="text-muted-foreground">No issues reported</p>
            <p className="text-sm text-muted-foreground">All stores are operating normally</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Reported Issues ({issues.length})
        </CardTitle>
        <Badge variant="destructive" className="animate-pulse">
          {issues.filter(i => i.severity === 'high').length} Urgent
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {issues.map((issue) => (
            <div 
              key={issue.id}
              className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border-l-4"
              style={{ 
                borderColor: issue.severity === 'high' ? 'rgb(239, 68, 68)' : 
                             issue.severity === 'medium' ? 'rgb(245, 158, 11)' : 
                             'rgb(34, 197, 94)' 
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-3 h-3 rounded-full mt-1.5 ${getSeverityDot(issue.severity)}`} />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{issue.store_name}</span>
                      <Badge variant="outline" className={getSeverityBadge(issue.severity)}>
                        {issue.severity}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">{issue.issue_type}</p>
                    {issue.description && (
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Reported by: {issue.reported_by}</span>
                      <span>•</span>
                      <span>{issue.reported_at}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onViewDetails?.(issue)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onAssignBiker?.(issue.store_id, issue.store_name)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Assign Biker
                  </Button>
                  {issue.severity === 'high' && (
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => onEscalate?.(issue.id)}
                    >
                      <ArrowUp className="h-4 w-4 mr-1" />
                      Escalate
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default IssuesPanel;
