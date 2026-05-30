import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  useComplianceMetrics, 
  useComplianceAlerts,
  useLatestComplianceStatus,
  useAcknowledgeAlert,
  useResolveAlert,
  useRefreshComplianceMetrics
} from "@/hooks/useComplianceDashboard";
import { useComplianceSeeder } from "@/hooks/useComplianceSeeder";
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Lock,
  RefreshCw,
  Zap,
  TrendingDown,
  User,
  FileText,
  Bell,
  Database,
  Play
} from "lucide-react";
import { format } from "date-fns";

interface Props {
  businessId: string | null;
}

export function ComplianceDashboard({ businessId }: Props) {
  const { data: latestStatus, isLoading: statusLoading } = useLatestComplianceStatus(businessId);
  const { data: metrics } = useComplianceMetrics(businessId, 7);
  const { data: alerts } = useComplianceAlerts(businessId, true);
  const acknowledgeAlert = useAcknowledgeAlert();
  const resolveAlert = useResolveAlert();
  const refreshMetrics = useRefreshComplianceMetrics();
  const seeder = useComplianceSeeder();

  const hasData = latestStatus || (metrics && metrics.length > 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'compliant':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Compliant</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" /> Warning</Badge>;
      case 'non_compliant':
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" /> Non-Compliant</Badge>;
      case 'locked':
        return <Badge className="bg-purple-500"><Lock className="h-3 w-3 mr-1" /> Locked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-500/10';
      case 'error': return 'border-red-500 bg-red-500/10';
      case 'warning': return 'border-yellow-500 bg-yellow-500/10';
      case 'info': return 'border-blue-500 bg-blue-500/10';
      default: return 'border-muted';
    }
  };

  // Calculate trend data
  const recentMetrics = metrics?.slice(0, 24) || [];
  const avgPermissionRate = recentMetrics.length > 0
    ? recentMetrics.reduce((sum, m) => sum + (m.permission_rate || 0), 0) / recentMetrics.length
    : 100;
  const totalBreaches = recentMetrics.reduce((sum, m) => sum + m.confidence_breaches, 0);
  const totalTakeovers = recentMetrics.reduce((sum, m) => sum + m.human_takeover_count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            Compliance Dashboard
          </h2>
          <p className="text-muted-foreground">
            Real-time regulatory compliance monitoring and risk assessment
          </p>
        </div>
        <div className="flex gap-2">
          {!hasData && (
            <Button
              onClick={() => seeder.mutate({ businessId: businessId || undefined })}
              disabled={seeder.isPending}
              className="bg-primary"
            >
              <Database className={`h-4 w-4 mr-2 ${seeder.isPending ? 'animate-pulse' : ''}`} />
              {seeder.isPending ? 'Seeding...' : 'Seed Canonical Data'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => businessId && refreshMetrics.mutate({ businessId })}
            disabled={refreshMetrics.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshMetrics.isPending ? 'animate-spin' : ''}`} />
            Refresh Metrics
          </Button>
        </div>
      </div>

      {/* Seeding Prompt when no data */}
      {!hasData && !statusLoading && (
        <Card className="border-2 border-dashed border-muted-foreground/30">
          <CardContent className="py-12 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Compliance Data Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Seed canonical simulation data to activate the compliance dashboard with proof of system safety.
            </p>
            <Button
              size="lg"
              onClick={() => seeder.mutate({ businessId: businessId || undefined })}
              disabled={seeder.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              {seeder.isPending ? 'Generating Proof Data...' : 'Generate Canonical Simulations'}
            </Button>
            <div className="mt-6 text-sm text-muted-foreground">
              <p>This will create:</p>
              <ul className="mt-2 space-y-1">
                <li>✓ Kill Switch Mid-Sentence simulation</li>
                <li>✓ Confidence Collapse → AI Muted simulation</li>
                <li>✓ Human Takeover Within SLA simulation</li>
                <li>✓ Forensic replay timelines</li>
                <li>✓ Immutable evidence packs</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <>

      {/* Status Banner */}
      <Card className={`border-2 ${
        latestStatus?.compliance_status === 'compliant' ? 'border-green-500' :
        latestStatus?.compliance_status === 'warning' ? 'border-yellow-500' :
        latestStatus?.compliance_status === 'non_compliant' ? 'border-red-500' :
        'border-purple-500'
      }`}>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {latestStatus?.compliance_status === 'compliant' ? (
                <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
              ) : latestStatus?.compliance_status === 'warning' ? (
                <div className="h-16 w-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                </div>
              ) : latestStatus?.compliance_status === 'locked' ? (
                <div className="h-16 w-16 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Lock className="h-8 w-8 text-purple-500" />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
              )}
              <div>
                <div className="text-2xl font-bold">
                  {latestStatus?.compliance_status === 'compliant' ? 'System Compliant' :
                   latestStatus?.compliance_status === 'warning' ? 'Compliance Warning' :
                   latestStatus?.compliance_status === 'locked' ? 'AI Disabled' :
                   'Non-Compliant'}
                </div>
                <div className="text-muted-foreground">
                  Last updated: {latestStatus?.created_at 
                    ? format(new Date(latestStatus.created_at), 'MMM d, yyyy HH:mm')
                    : 'Never'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Risk Score</div>
              <div className={`text-4xl font-bold ${
                (latestStatus?.risk_score || 0) < 20 ? 'text-green-500' :
                (latestStatus?.risk_score || 0) < 50 ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {latestStatus?.risk_score?.toFixed(0) || 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Permission Rate
            </div>
            <div className="text-2xl font-bold mt-1">
              {latestStatus?.permission_rate?.toFixed(1) || 100}%
            </div>
            <Progress value={latestStatus?.permission_rate || 100} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Zap className="h-4 w-4" />
              Kill Switch Rate
            </div>
            <div className="text-2xl font-bold mt-1">
              {latestStatus?.kill_switch_success_rate?.toFixed(0) || 100}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {latestStatus?.kill_switch_activations || 0} activations
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingDown className="h-4 w-4" />
              Confidence Breaches
            </div>
            <div className="text-2xl font-bold mt-1">
              {latestStatus?.confidence_breaches || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              This period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <User className="h-4 w-4" />
              Human Takeovers
            </div>
            <div className="text-2xl font-bold mt-1">
              {latestStatus?.human_takeover_count || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Avg {latestStatus?.avg_human_takeover_latency_ms || 0}ms latency
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertTriangle className="h-4 w-4" />
              Unapproved Techniques
            </div>
            <div className={`text-2xl font-bold mt-1 ${
              (latestStatus?.unapproved_technique_uses || 0) > 0 ? 'text-red-500' : 'text-green-500'
            }`}>
              {latestStatus?.unapproved_technique_uses || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Must be zero
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <FileText className="h-4 w-4" />
              Audit Completeness
            </div>
            <div className="text-2xl font-bold mt-1">
              {latestStatus?.audit_completeness_rate?.toFixed(0) || 100}%
            </div>
            <Progress value={latestStatus?.audit_completeness_rate || 100} className="mt-2 h-1" />
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Active Compliance Alerts
          </CardTitle>
          <CardDescription>
            {alerts?.length || 0} unresolved alerts require attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts?.length === 0 ? (
            <div className="text-center py-8 text-green-500 flex flex-col items-center gap-2">
              <CheckCircle2 className="h-8 w-8" />
              <span>No active alerts - system operating normally</span>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {alerts?.map(alert => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border-2 ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          alert.severity === 'critical' || alert.severity === 'error' ? 'destructive' :
                          alert.severity === 'warning' ? 'secondary' : 'outline'
                        }>
                          {alert.severity}
                        </Badge>
                        <span className="font-medium">{alert.title}</span>
                      </div>
                      <div className="flex gap-2">
                        {!alert.acknowledged && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => acknowledgeAlert.mutate({ alertId: alert.id })}
                          >
                            Acknowledge
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => resolveAlert.mutate({ alertId: alert.id })}
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>
                    {alert.description && (
                      <div className="text-sm text-muted-foreground mt-2">
                        {alert.description}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{format(new Date(alert.created_at), 'MMM d, yyyy HH:mm')}</span>
                      <span className="capitalize">{alert.alert_type.replace(/_/g, ' ')}</span>
                      {alert.acknowledged && (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Acknowledged
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* 7-Day Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">7-Day Compliance Trend</CardTitle>
          <CardDescription>Historical compliance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <div className="text-sm text-muted-foreground">Avg Permission Rate</div>
              <div className={`text-3xl font-bold ${
                avgPermissionRate >= 99 ? 'text-green-500' :
                avgPermissionRate >= 95 ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {avgPermissionRate.toFixed(1)}%
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <div className="text-sm text-muted-foreground">Total Confidence Breaches</div>
              <div className={`text-3xl font-bold ${
                totalBreaches === 0 ? 'text-green-500' :
                totalBreaches < 10 ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {totalBreaches}
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <div className="text-sm text-muted-foreground">Human Takeovers</div>
              <div className="text-3xl font-bold text-blue-500">
                {totalTakeovers}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}