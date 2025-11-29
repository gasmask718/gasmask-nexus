// ═══════════════════════════════════════════════════════════════════════════════
// DAILY BRIEFING PAGE — AI Manager Briefing
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFollowUpEngine } from '@/hooks/useFollowUpEngine';
import { supabase } from '@/integrations/supabase/client';
import { DailyBriefingContent } from '@/services/followUpEngine';
import { toast } from 'sonner';
import { 
  Sun, 
  Moon, 
  AlertTriangle, 
  Store, 
  FileText, 
  Package, 
  Truck, 
  Users,
  CheckCircle2,
  TrendingUp,
  Calendar,
  RefreshCw,
  ArrowLeft,
  Loader2,
  Lightbulb,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DailyBriefing() {
  const navigate = useNavigate();
  const { generateBriefing, latestBriefing, loading: engineLoading } = useFollowUpEngine();
  const [briefings, setBriefings] = useState<{morning?: DailyBriefingContent; evening?: DailyBriefingContent}>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchTodayBriefings();
  }, []);

  const fetchTodayBriefings = async () => {
    setLoading(true);
    try {
      const client = supabase as any;
      const today = new Date().toISOString().split('T')[0];
      
      const { data } = await client
        .from('ai_daily_briefings')
        .select('*')
        .eq('briefing_date', today)
        .order('created_at', { ascending: false });

      if (data) {
        const morning = data.find((b: any) => b.briefing_type === 'morning');
        const evening = data.find((b: any) => b.briefing_type === 'evening');
        setBriefings({
          morning: morning?.content,
          evening: evening?.content,
        });
      }
    } catch (error) {
      console.error('Failed to fetch briefings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (type: 'morning' | 'evening') => {
    setGenerating(true);
    try {
      await generateBriefing(type);
      await fetchTodayBriefings();
      toast.success(`${type} briefing generated`);
    } catch {
      toast.error('Failed to generate briefing');
    } finally {
      setGenerating(false);
    }
  };

  const currentHour = new Date().getHours();
  const defaultTab = currentHour < 14 ? 'morning' : 'evening';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Daily Manager Briefing</h1>
            <p className="text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchTodayBriefings}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="morning" className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            Morning Briefing
          </TabsTrigger>
          <TabsTrigger value="evening" className="flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Evening Wrap-Up
          </TabsTrigger>
        </TabsList>

        <TabsContent value="morning">
          <BriefingView
            type="morning"
            briefing={briefings.morning}
            onGenerate={() => handleGenerate('morning')}
            generating={generating}
          />
        </TabsContent>

        <TabsContent value="evening">
          <BriefingView
            type="evening"
            briefing={briefings.evening}
            onGenerate={() => handleGenerate('evening')}
            generating={generating}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface BriefingViewProps {
  type: 'morning' | 'evening';
  briefing?: DailyBriefingContent;
  onGenerate: () => void;
  generating: boolean;
}

function BriefingView({ type, briefing, onGenerate, generating }: BriefingViewProps) {
  if (!briefing) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          {type === 'morning' ? (
            <Sun className="h-12 w-12 text-yellow-500/50 mb-4" />
          ) : (
            <Moon className="h-12 w-12 text-blue-500/50 mb-4" />
          )}
          <h3 className="text-lg font-medium mb-2">
            No {type} briefing generated yet
          </h3>
          <p className="text-muted-foreground text-center mb-4">
            Generate a briefing to see your daily summary and action items
          </p>
          <Button onClick={onGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                Generate {type} Briefing
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Summary Card */}
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Risk Summary
          </CardTitle>
          <CardDescription>Current issues requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                New Risks
              </span>
              <Badge variant="secondary">{briefing.summary.newRisks}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <Store className="h-4 w-4 text-blue-500" />
                Stores Needing Visits
              </span>
              <Badge variant="secondary">{briefing.summary.storesNeedingVisits}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-red-500" />
                Unpaid Invoices
              </span>
              <Badge variant="secondary">{briefing.summary.unpaidInvoices}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-amber-500" />
                Low Stock Items
              </span>
              <Badge variant="secondary">{briefing.summary.lowStockItems}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-purple-500" />
                Driver Issues
              </span>
              <Badge variant="secondary">{briefing.summary.driverIssues}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-green-500" />
                Ambassador Issues
              </span>
              <Badge variant="secondary">{briefing.summary.ambassadorIssues}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions Taken */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Actions Taken
          </CardTitle>
          <CardDescription>Automated actions completed today</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Invoices Emailed</span>
              <span className="font-medium">{briefing.actionsTaken.invoicesEmailed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Stores Texted</span>
              <span className="font-medium">{briefing.actionsTaken.storesTexted}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tasks Created</span>
              <span className="font-medium">{briefing.actionsTaken.tasksCreated}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Routes Generated</span>
              <span className="font-medium">{briefing.actionsTaken.routesGenerated}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ambassadors Messaged</span>
              <span className="font-medium">{briefing.actionsTaken.ambassadorsMessaged}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Reorder Alerts</span>
              <span className="font-medium">{briefing.actionsTaken.reorderAlertsSent}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Escalations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Escalations
          </CardTitle>
          <CardDescription>Items requiring manual attention</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {briefing.escalations.length > 0 ? (
              <div className="space-y-2">
                {briefing.escalations.map((esc, idx) => (
                  <div key={idx} className="p-2 rounded bg-muted/50 text-sm">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">
                        {esc.entityType}
                      </Badge>
                      <span className="text-orange-500 text-xs font-medium">
                        {esc.urgency}% urgency
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs line-clamp-2">
                      {esc.reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-green-500/50 mb-2" />
                <p className="text-sm">No escalations</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            AI Recommendations
          </CardTitle>
          <CardDescription>Suggested actions based on current data</CardDescription>
        </CardHeader>
        <CardContent>
          {briefing.recommendations.length > 0 ? (
            <ul className="space-y-2">
              {briefing.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No specific recommendations at this time. Keep up the good work!
            </p>
          )}

          {type === 'evening' && briefing.tomorrowPlan && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Tomorrow's Plan
              </h4>
              <ul className="space-y-1">
                {briefing.tomorrowPlan.map((item, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
