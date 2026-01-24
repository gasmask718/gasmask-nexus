import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Target, 
  Play, 
  Pause, 
  XCircle, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  FileText,
  TrendingUp,
  Shield,
  RefreshCw
} from 'lucide-react';
import { ExecutiveDirective } from '@/hooks/useExecutiveDirectives';
import { DirectiveBuilder } from './DirectiveBuilder';
import { format } from 'date-fns';

interface DirectivesPanelProps {
  directives: ExecutiveDirective[];
  activeDirectives: ExecutiveDirective[];
  draftDirectives: ExecutiveDirective[];
  businessId: string;
  isLoading: boolean;
  advisoryMode: boolean;
  onActivate: (id: string) => Promise<any>;
  onRevoke: (id: string, reason: string) => Promise<void>;
  onSimulate: (id: string) => Promise<any>;
  onRefresh: () => void;
}

export function DirectivesPanel({
  directives,
  activeDirectives,
  draftDirectives,
  businessId,
  isLoading,
  advisoryMode,
  onActivate,
  onRevoke,
  onSimulate,
  onRefresh
}: DirectivesPanelProps) {
  const [showBuilder, setShowBuilder] = useState(false);

  const getDirectiveTypeIcon = (type: string) => {
    switch (type) {
      case 'growth': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'recovery': return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 'test': return <Target className="h-4 w-4 text-purple-500" />;
      case 'hold': return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'optimize': return <Shield className="h-4 w-4 text-cyan-500" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500">Paused</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>;
      case 'revoked':
        return <Badge variant="destructive">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Advisory Mode Warning */}
      {advisoryMode && (
        <Card className="border-yellow-500 bg-yellow-500/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="font-semibold text-yellow-500">Advisory-Only Mode Active</p>
                <p className="text-sm text-muted-foreground">
                  Executive AI can provide recommendations but cannot execute actions. 
                  Safety conditions triggered this state.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Executive Directives</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowBuilder(true)}>
            <Target className="h-4 w-4 mr-2" />
            Issue Directive
          </Button>
        </div>
      </div>

      {/* Builder */}
      {showBuilder && (
        <DirectiveBuilder 
          businessId={businessId}
          onClose={() => setShowBuilder(false)}
          onCreated={() => {
            onRefresh();
            setShowBuilder(false);
          }}
        />
      )}

      {/* Active Directives */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          Active Directives ({activeDirectives.length})
        </h4>
        {activeDirectives.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No active directives</p>
              <p className="text-sm text-muted-foreground">
                Issue a directive to enable AI execution
              </p>
            </CardContent>
          </Card>
        ) : (
          activeDirectives.map(directive => (
            <Card key={directive.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getDirectiveTypeIcon(directive.directive_type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold capitalize">{directive.directive_type} Directive</p>
                        {getStatusBadge(directive.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {directive.intent_description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Scope: {directive.scope_type}</span>
                        {directive.expires_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires: {format(new Date(directive.expires_at), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onSimulate(directive.id)}
                      disabled={isLoading}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Simulate
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => onRevoke(directive.id, 'Manual revocation')}
                      disabled={isLoading}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Revoke
                    </Button>
                  </div>
                </div>

                {/* Constraints Summary */}
                <div className="mt-3 grid grid-cols-4 gap-4 text-sm border-t pt-3">
                  <div>
                    <span className="text-muted-foreground">Max Calls/Day:</span>
                    <p className="font-medium">{directive.constraints.max_daily_calls || 'Unlimited'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cooldown:</span>
                    <p className="font-medium">{directive.constraints.cooldown_hours || 24}h</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Target Conv:</span>
                    <p className="font-medium">
                      {directive.success_metrics.target_conversion_rate 
                        ? `${(directive.success_metrics.target_conversion_rate * 100).toFixed(1)}%` 
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Opt-out Cap:</span>
                    <p className="font-medium">
                      {directive.success_metrics.max_opt_out_rate 
                        ? `${(directive.success_metrics.max_opt_out_rate * 100).toFixed(1)}%` 
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Draft Directives */}
      {draftDirectives.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Draft Directives ({draftDirectives.length})
          </h4>
          {draftDirectives.map(directive => (
            <Card key={directive.id} className="border-dashed">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getDirectiveTypeIcon(directive.directive_type)}
                    <div>
                      <p className="font-semibold capitalize">{directive.directive_type} Directive</p>
                      <p className="text-sm text-muted-foreground">
                        {directive.intent_description}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onSimulate(directive.id)}
                      disabled={isLoading}
                    >
                      Simulate First
                    </Button>
                    <Button 
                      onClick={() => onActivate(directive.id)}
                      disabled={isLoading || advisoryMode}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Activate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default DirectivesPanel;
