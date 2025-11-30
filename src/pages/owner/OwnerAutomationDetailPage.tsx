import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Zap, Clock, Play, Pause, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const automationData: Record<string, { name: string; system: string; status: string; lastRun: string; nextRun: string; logs: string[] }> = {
  'text-followup': { name: 'Auto Text Follow-Up Engine', system: 'Communication OS', status: 'Active', lastRun: '3 min ago', nextRun: 'In 12 min', logs: ['2024-01-15 10:32:15 - Sent 24 follow-up texts', '2024-01-15 10:20:00 - Batch started', '2024-01-15 10:19:58 - Connected to Twilio API', '2024-01-15 10:00:00 - Scheduled run initiated'] },
  'lead-nurture': { name: 'TopTier Lead Nurture Sequence', system: 'TopTier OS', status: 'Active', lastRun: '12 min ago', nextRun: 'In 48 min', logs: ['2024-01-15 10:20:00 - Processed 8 leads', '2024-01-15 10:19:45 - Email campaign sent', '2024-01-15 10:19:30 - Lead scoring updated'] },
  'grant-deadline': { name: 'Grant Deadline Watcher', system: 'Grant Company OS', status: 'Degraded', lastRun: '45 min ago', nextRun: 'In 15 min', logs: ['2024-01-15 09:47:00 - Warning: API rate limit approaching', '2024-01-15 09:46:30 - Checked 12 deadlines', '2024-01-15 09:46:00 - Connection established'] },
  'funding-pipeline': { name: 'Funding Pipeline Monitor', system: 'Funding Company OS', status: 'Active', lastRun: '8 min ago', nextRun: 'In 22 min', logs: ['2024-01-15 10:24:00 - Pipeline value: $125K', '2024-01-15 10:23:45 - 3 files moved to underwriting', '2024-01-15 10:23:30 - Status sync complete'] },
  'bankroll-guard': { name: 'Sports Betting Bankroll Guard', system: 'Sports Betting AI', status: 'Active', lastRun: '1 min ago', nextRun: 'In 4 min', logs: ['2024-01-15 10:31:00 - Bankroll healthy: $2,450', '2024-01-15 10:30:55 - Risk threshold OK', '2024-01-15 10:30:50 - No active hedge required'] },
  'inventory-sync': { name: 'Inventory Auto-Sync', system: 'GasMask OS', status: 'Active', lastRun: '5 min ago', nextRun: 'In 25 min', logs: ['2024-01-15 10:27:00 - Synced 145 SKUs', '2024-01-15 10:26:30 - Low stock alerts: 3 items'] },
};

export default function OwnerAutomationDetailPage() {
  const { automationId } = useParams<{ automationId: string }>();
  const navigate = useNavigate();
  
  const automation = automationId ? automationData[automationId] : null;

  const handlePauseResume = () => {
    toast({
      title: "Coming Soon",
      description: "Pause/Resume toggle will be available in a future update.",
    });
  };
  
  if (!automation) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Automation not found</p>
        <Button variant="outline" onClick={() => navigate('/os/owner/autopilot')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Autopilot
        </Button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    Active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Degraded: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Paused: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner/autopilot')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/30">
              <Zap className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{automation.name}</h1>
              <p className="text-sm text-muted-foreground">{automation.system}</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={statusColors[automation.status]}>
          {automation.status}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-sm text-muted-foreground">Last Run</p>
                <p className="text-lg font-semibold">{automation.lastRun}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Play className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-sm text-muted-foreground">Next Run</p>
                <p className="text-lg font-semibold">{automation.nextRun}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Pause className="h-5 w-5 text-amber-400" />
              <div>
                <p className="text-sm text-muted-foreground">Control</p>
                <p className="text-lg font-semibold">Pause / Resume</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handlePauseResume}>
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Logs */}
      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Recent Logs</CardTitle>
          </div>
          <CardDescription className="text-xs">Last {automation.logs.length} log entries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 font-mono text-xs">
            {automation.logs.map((log, idx) => (
              <div key={idx} className="p-2 rounded bg-muted/50 text-muted-foreground">
                {log}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
