// ═══════════════════════════════════════════════════════════════════════════════
// OWNER EXECUTIVE REPORTS — Generate & Download Empire Reports
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  Building2,
  Loader2,
} from 'lucide-react';

interface ReportData {
  generatedAt: string;
  revenue: {
    total: number;
    byBusiness: Record<string, number>;
    trend: string;
  };
  alerts: Array<{ type: string; message: string; system: string }>;
  tasks: Array<{ title: string; priority: string; due: string }>;
  summary: string;
}

export default function OwnerExecutiveReports() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const generateDailyReport = async () => {
    setIsGenerating(true);
    console.log('[EXECUTIVE REPORTS] Generating daily report...');

    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 1500));

    const report: ReportData = {
      generatedAt: new Date().toISOString(),
      revenue: {
        total: 342500,
        byBusiness: {
          'Grabba Cluster': 215000,
          'TopTier Experience': 48500,
          'Funding Company': 32000,
          'PlayBoxxx': 12400,
          'Grants Division': 8200,
          'Real Estate': 14200,
          'iClean WeClean': 8400,
          'Unforgettable Times': 3800,
        },
        trend: '+14% vs last month',
      },
      alerts: [
        { type: 'Critical', message: '2 Funding files over SLA', system: 'Funding Company' },
        { type: 'Warning', message: '3 TopTier payments pending', system: 'TopTier Experience' },
        { type: 'Warning', message: '12 stores low inventory', system: 'Grabba Cluster' },
        { type: 'Info', message: '5 new ambassador applications', system: 'Ambassador Network' },
      ],
      tasks: [
        { title: 'Escalate Funding SLA breaches', priority: 'High', due: 'Today' },
        { title: 'Review TopTier weekend pricing', priority: 'Medium', due: 'Tomorrow' },
        { title: 'Approve PlayBoxxx creator payouts', priority: 'Medium', due: 'This week' },
        { title: 'Grabba Queens expansion plan', priority: 'Low', due: 'Next week' },
      ],
      summary: `Empire Performance Report - ${new Date().toLocaleDateString()}

EXECUTIVE SUMMARY:
Total MTD Revenue: $342,500 (+14% vs last month)
Top Performer: TopTier Experience (+22%)
Needs Attention: Funding Company (SLA issues)

KEY METRICS:
• Active Businesses: 8
• Total Workforce: 58 drivers, 78 ambassadors, 6 VAs
• System Health: 89%
• Customer Satisfaction: 4.7/5

CRITICAL ACTIONS:
1. Escalate 2 Funding files over 48hr SLA immediately
2. Clear TopTier payment backlog ($4,200 pending)
3. Schedule Grabba restock for 12 low-inventory stores

OPPORTUNITIES:
• TopTier: Raise weekend base price $15 = +$2,400/month
• Grabba: Queens expansion = +$8,000/month potential
• PlayBoxxx: Fast-track 5 pending creators = +$3,500/month

RISKS:
• Funding SLA breaches could impact reputation
• Grabba inventory gaps may cause lost sales
• 26 dormant ambassadors need reactivation

RECOMMENDATION:
Focus this week on operational efficiency - clear backlogs, 
restock inventory, and activate dormant resources before 
pursuing growth initiatives.`,
    };

    setReportData(report);
    setIsGenerating(false);
    toast.success('Daily report generated successfully');
  };

  const downloadReport = (format: 'txt' | 'json') => {
    if (!reportData) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'txt') {
      content = reportData.summary;
      filename = `dynasty-report-${new Date().toISOString().split('T')[0]}.txt`;
      mimeType = 'text/plain';
    } else {
      content = JSON.stringify(reportData, null, 2);
      filename = `dynasty-report-${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Report downloaded as ${format.toUpperCase()}`);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30">
            <FileText className="h-8 w-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Executive Reports</h1>
            <p className="text-sm text-muted-foreground">
              Generate and download comprehensive empire reports
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={generateDailyReport} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Daily Report
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Report Types */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-blue-500/50 transition-colors" onClick={generateDailyReport}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="h-5 w-5 text-blue-500" />
              <span className="font-medium">Daily Summary</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Revenue, alerts, tasks, and key metrics for today
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-green-500/50 transition-colors opacity-60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="font-medium">Weekly Performance</span>
              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Week-over-week trends and analysis
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-purple-500/50 transition-colors opacity-60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <DollarSign className="h-5 w-5 text-purple-500" />
              <span className="font-medium">Financial Report</span>
              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Detailed P&L across all businesses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Generated Report */}
      {reportData && (
        <Card className="rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Report Generated
              </CardTitle>
              <CardDescription>
                Generated at {new Date(reportData.generatedAt).toLocaleString()}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadReport('txt')}>
                <Download className="h-4 w-4 mr-2" />
                Download .TXT
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadReport('json')}>
                <Download className="h-4 w-4 mr-2" />
                Download .JSON
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="revenue">Revenue</TabsTrigger>
                <TabsTrigger value="alerts">Alerts</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/50 p-4 rounded-lg">
                    {reportData.summary}
                  </pre>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="revenue" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                    <span className="font-medium">Total MTD Revenue</span>
                    <span className="text-2xl font-bold text-green-500">
                      ${reportData.revenue.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(reportData.revenue.byBusiness).map(([business, amount]) => (
                      <div key={business} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {business}
                        </span>
                        <span className="font-medium">${amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="alerts" className="mt-4">
                <div className="space-y-2">
                  {reportData.alerts.map((alert, idx) => (
                    <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${
                      alert.type === 'Critical' ? 'bg-red-500/10 border-red-500/30' :
                      alert.type === 'Warning' ? 'bg-amber-500/10 border-amber-500/30' :
                      'bg-blue-500/10 border-blue-500/30'
                    }`}>
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={`h-4 w-4 ${
                          alert.type === 'Critical' ? 'text-red-500' :
                          alert.type === 'Warning' ? 'text-amber-500' :
                          'text-blue-500'
                        }`} />
                        <div>
                          <p className="font-medium">{alert.message}</p>
                          <p className="text-xs text-muted-foreground">{alert.system}</p>
                        </div>
                      </div>
                      <Badge variant={alert.type === 'Critical' ? 'destructive' : 'secondary'}>
                        {alert.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="mt-4">
                <div className="space-y-2">
                  {reportData.tasks.map((task, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        <span>{task.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          task.priority === 'High' ? 'destructive' :
                          task.priority === 'Medium' ? 'default' : 'secondary'
                        }>
                          {task.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.due}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Recent Reports */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { name: 'Daily Summary', date: 'Yesterday', type: 'Daily' },
              { name: 'Weekly Performance', date: '3 days ago', type: 'Weekly' },
              { name: 'Daily Summary', date: '4 days ago', type: 'Daily' },
            ].map((report, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{report.name}</p>
                    <p className="text-xs text-muted-foreground">{report.date}</p>
                  </div>
                </div>
                <Badge variant="outline">{report.type}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
