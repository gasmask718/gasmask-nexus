import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, Download, Calendar, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

const reportTypes = [
  { id: 'daily', name: 'Daily Briefing', description: 'Today\'s key metrics and alerts', lastGenerated: '2 hours ago' },
  { id: 'weekly', name: 'Weekly Performance', description: 'Week-over-week business comparison', lastGenerated: 'Yesterday' },
  { id: 'monthly', name: 'Monthly P&L', description: 'Full financial breakdown by business', lastGenerated: '3 days ago' },
  { id: 'quarterly', name: 'Quarterly Review', description: 'Strategic insights and projections', lastGenerated: 'Last month' },
];

export default function OwnerReports() {
  const navigate = useNavigate();

  const handleGenerateReport = (type: string) => {
    toast.info(`Generating ${type} report...`, {
      description: 'Full report generation coming in advanced Owner Suite.'
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30">
            <FileText className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Executive Reports</h1>
            <p className="text-sm text-muted-foreground">Dynasty performance reports</p>
          </div>
        </div>
      </div>

      {/* Report Types */}
      <div className="grid gap-4 md:grid-cols-2">
        {reportTypes.map((report) => (
          <Card key={report.id} className="rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{report.name}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {report.lastGenerated}
                </Badge>
              </div>
              <CardDescription className="text-xs">{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => handleGenerateReport(report.name)}>
                  <BarChart3 className="h-4 w-4" />
                  Generate
                </Button>
                <Button size="sm" variant="ghost" className="gap-2" onClick={() => handleGenerateReport(report.name)}>
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scheduled Reports */}
      <Card className="rounded-xl border-blue-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            Scheduled Reports
          </CardTitle>
          <CardDescription className="text-xs">
            Automatic report delivery (Coming Soon)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Configure automatic daily, weekly, and monthly reports delivered to your email 
            or stored in Dropbox. This feature is part of the advanced Owner Suite.
          </p>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => navigate('/os/owner')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Owner Dashboard
      </Button>
    </div>
  );
}
