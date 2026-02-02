/**
 * QA Metrics Summary - Overview dashboard for QA Command Center
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, XCircle, AlertTriangle, Building2, 
  Route, Zap, Database, TrendingUp
} from 'lucide-react';
import { QAScanResults, FloorSummary } from '@/hooks/useQAScanner';

interface QAMetricsSummaryProps {
  scanResults: QAScanResults | null;
}

export function QAMetricsSummary({ scanResults }: QAMetricsSummaryProps) {
  if (!scanResults) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Route className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Scan Results Yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Click "Run Full Scan" to analyze all Floors 1-9 for production readiness issues.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalIssues = scanResults.routeIssues.length + 
                      scanResults.actionIssues.length + 
                      scanResults.dataHealthIssues.length;

  const totalPages = scanResults.floorSummaries.reduce((sum, f) => sum + f.totalPages, 0);
  const healthyPages = scanResults.floorSummaries.reduce((sum, f) => sum + f.pagesOk, 0);
  const healthPercentage = totalPages > 0 ? Math.round((healthyPages / totalPages) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Overall Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Overall System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Production Readiness</span>
              <span className="text-2xl font-bold">{healthPercentage}%</span>
            </div>
            <Progress value={healthPercentage} className="h-3" />
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{totalPages}</p>
                <p className="text-xs text-muted-foreground">Total Pages</p>
              </div>
              <div className="text-center p-3 bg-green-500/10 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{healthyPages}</p>
                <p className="text-xs text-muted-foreground">Pages OK</p>
              </div>
              <div className="text-center p-3 bg-destructive/10 rounded-lg">
                <p className="text-2xl font-bold text-destructive">{totalIssues}</p>
                <p className="text-xs text-muted-foreground">Total Issues</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floor-by-Floor Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Floor-by-Floor Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {scanResults.floorSummaries.map((floor) => (
              <FloorStatusRow key={floor.floorId} floor={floor} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Issue Breakdown */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Route className="h-4 w-4" />
              Route Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{scanResults.routeIssues.length}</p>
            <div className="mt-2 space-y-1">
              {scanResults.routeIssues.slice(0, 3).map((issue) => (
                <p key={issue.id} className="text-xs text-muted-foreground truncate">
                  • {issue.pageName}: {issue.status}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Action Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{scanResults.actionIssues.length}</p>
            <div className="mt-2 space-y-1">
              {scanResults.actionIssues.slice(0, 3).map((issue) => (
                <p key={issue.id} className="text-xs text-muted-foreground truncate">
                  • {issue.actionLabel}: {issue.status}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{scanResults.dataHealthIssues.length}</p>
            <div className="mt-2 space-y-1">
              {scanResults.dataHealthIssues.slice(0, 3).map((issue) => (
                <p key={issue.id} className="text-xs text-muted-foreground truncate">
                  • {issue.tableName}: {issue.status}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FloorStatusRow({ floor }: { floor: FloorSummary }) {
  const statusIcon = floor.status === 'healthy' 
    ? <CheckCircle2 className="h-5 w-5 text-green-500" />
    : floor.status === 'critical'
    ? <XCircle className="h-5 w-5 text-destructive" />
    : <AlertTriangle className="h-5 w-5 text-orange-500" />;

  const progressValue = floor.totalPages > 0 
    ? (floor.pagesOk / floor.totalPages) * 100 
    : 100;

  return (
    <div className="flex items-center gap-4 p-3 border rounded-lg">
      {statusIcon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium truncate">{floor.floorName}</p>
          <div className="flex items-center gap-2">
            {floor.p0Count > 0 && (
              <Badge variant="destructive" className="text-xs">
                {floor.p0Count} P0
              </Badge>
            )}
            {floor.p1Count > 0 && (
              <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
                {floor.p1Count} P1
              </Badge>
            )}
            {floor.p2Count > 0 && (
              <Badge variant="outline" className="text-xs">
                {floor.p2Count} P2
              </Badge>
            )}
          </div>
        </div>
        <Progress value={progressValue} className="h-1.5" />
        <p className="text-xs text-muted-foreground mt-1">
          {floor.pagesOk}/{floor.totalPages} pages OK
        </p>
      </div>
    </div>
  );
}
