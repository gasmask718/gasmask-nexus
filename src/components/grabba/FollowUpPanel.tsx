// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UP PANEL — Dashboard panel for automated follow-up status
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFollowUpEngine } from '@/hooks/useFollowUpEngine';
import { 
  Mail, 
  MessageSquare, 
  CheckCircle2, 
  Route, 
  Users, 
  Package,
  AlertTriangle,
  Clock,
  Play,
  Settings,
  FileText,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function FollowUpPanel() {
  const navigate = useNavigate();
  const { 
    stats, 
    recentLogs, 
    latestBriefing, 
    loading, 
    isRunning, 
    triggerFollowUpScan,
    generateBriefing,
  } = useFollowUpEngine();

  const handleRunEngine = async () => {
    try {
      await triggerFollowUpScan();
      toast.success('Follow-up engine completed');
    } catch {
      toast.error('Failed to run follow-up engine');
    }
  };

  const handleGenerateBriefing = async () => {
    const hour = new Date().getHours();
    const type = hour < 14 ? 'morning' : 'evening';
    try {
      await generateBriefing(type);
      toast.success(`${type} briefing generated`);
    } catch {
      toast.error('Failed to generate briefing');
    }
  };

  if (loading) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Items Auto-Handled Today */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Auto-Handled Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3 w-3" /> Invoices Emailed
              </span>
              <Badge variant="secondary">{stats?.byCategory?.invoice || 0}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <MessageSquare className="h-3 w-3" /> Stores Texted
              </span>
              <Badge variant="secondary">{stats?.byCategory?.store || 0}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" /> Tasks Created
              </span>
              <Badge variant="secondary">{stats?.todayActions || 0}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Route className="h-3 w-3" /> Routes Generated
              </span>
              <Badge variant="secondary">{stats?.byCategory?.route || 0}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-3 w-3" /> Ambassadors Messaged
              </span>
              <Badge variant="secondary">{stats?.byCategory?.ambassador || 0}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-3 w-3" /> Reorder Alerts
              </span>
              <Badge variant="secondary">{stats?.byCategory?.inventory || 0}</Badge>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <Button
              size="sm"
              onClick={handleRunEngine}
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Follow-Up Engine
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* High Priority Escalations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            High Priority Escalations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[180px]">
            {latestBriefing?.escalations && latestBriefing.escalations.length > 0 ? (
              <div className="space-y-2">
                {latestBriefing.escalations.slice(0, 5).map((esc, idx) => (
                  <div key={idx} className="p-2 rounded bg-muted/50 text-xs">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">
                        {esc.entityType}
                      </Badge>
                      <span className="text-orange-500 font-medium">
                        {esc.urgency}%
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground line-clamp-2">
                      {esc.reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-2 text-green-500/50" />
                <p className="text-sm">No escalations</p>
              </div>
            )}
          </ScrollArea>

          <div className="mt-4 pt-4 border-t flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/grabba/daily-briefing')}
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-1" />
              Briefing
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateBriefing}
              className="flex-1"
            >
              <Clock className="h-4 w-4 mr-1" />
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Next Actions Scheduled */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            Recent Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[180px]">
            {recentLogs && recentLogs.length > 0 ? (
              <div className="space-y-2">
                {recentLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="p-2 rounded bg-muted/50 text-xs">
                    <div className="flex items-center justify-between">
                      <Badge 
                        variant={log.escalated ? 'destructive' : 'secondary'}
                        className="text-[10px]"
                      >
                        {log.action_category}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(log.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {log.action_taken.replace(/_/g, ' ')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Clock className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No recent actions</p>
              </div>
            )}
          </ScrollArea>

          <div className="mt-4 pt-4 border-t">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/grabba/follow-up-settings')}
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure Rules
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
