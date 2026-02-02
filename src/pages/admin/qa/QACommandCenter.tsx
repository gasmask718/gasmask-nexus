/**
 * QA Command Center - Floors 1-9 Production Readiness Audit
 * 
 * Scans every route/page, detects 404s, dead buttons, missing CRUD,
 * broken API calls, RLS denials, and provides a prioritized fix queue.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, AlertTriangle, CheckCircle2, XCircle, RefreshCw, 
  Route, Zap, Database, Layout, ExternalLink, Bug, Clock
} from 'lucide-react';
import { RouteRegistryScanner } from '@/components/qa/RouteRegistryScanner';
import { ActionWiringScanner } from '@/components/qa/ActionWiringScanner';
import { DataHealthScanner } from '@/components/qa/DataHealthScanner';
import { FixQueue } from '@/components/qa/FixQueue';
import { QAMetricsSummary } from '@/components/qa/QAMetricsSummary';
import { useQAScanner } from '@/hooks/useQAScanner';

export default function QACommandCenter() {
  const [activeTab, setActiveTab] = useState('overview');
  const { 
    scanResults, 
    isScanning, 
    runFullScan,
    p0Count,
    p1Count,
    p2Count,
    lastScanTime
  } = useQAScanner();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            QA Command Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Floors 1-9 Production Readiness Audit System
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastScanTime && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Last scan: {new Date(lastScanTime).toLocaleTimeString()}
            </span>
          )}
          <Button 
            onClick={runFullScan} 
            disabled={isScanning}
            size="lg"
          >
            {isScanning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Run Full Scan
              </>
            )}
          </Button>
        </div>
      </div>

      {/* P0/P1/P2 Summary Badges */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-destructive">P0 Critical</p>
                <p className="text-3xl font-bold text-destructive">{p0Count}</p>
              </div>
              <XCircle className="h-10 w-10 text-destructive/50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              404s, crashes, dead buttons, RLS denials
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">P1 High</p>
                <p className="text-3xl font-bold text-orange-600">{p1Count}</p>
              </div>
              <AlertTriangle className="h-10 w-10 text-orange-500/50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Missing states, broken filters, API errors
            </p>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">P2 Medium</p>
                <p className="text-3xl font-bold text-yellow-600">{p2Count}</p>
              </div>
              <Bug className="h-10 w-10 text-yellow-500/50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              UI polish, performance, responsiveness
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Go-Live Ready</p>
                <p className="text-3xl font-bold text-green-600">
                  {p0Count === 0 ? '✓' : '✗'}
                </p>
              </div>
              <CheckCircle2 className="h-10 w-10 text-green-500/50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {p0Count === 0 ? 'No P0 blockers' : `${p0Count} P0 issues blocking`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="routes" className="flex items-center gap-2">
            <Route className="h-4 w-4" />
            Routes
            {scanResults?.routeIssues?.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                {scanResults.routeIssues.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Actions
            {scanResults?.actionIssues?.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                {scanResults.actionIssues.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Health
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Fix Queue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <QAMetricsSummary scanResults={scanResults} />
        </TabsContent>

        <TabsContent value="routes" className="mt-6">
          <RouteRegistryScanner scanResults={scanResults} />
        </TabsContent>

        <TabsContent value="actions" className="mt-6">
          <ActionWiringScanner scanResults={scanResults} />
        </TabsContent>

        <TabsContent value="data" className="mt-6">
          <DataHealthScanner scanResults={scanResults} />
        </TabsContent>

        <TabsContent value="queue" className="mt-6">
          <FixQueue scanResults={scanResults} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
