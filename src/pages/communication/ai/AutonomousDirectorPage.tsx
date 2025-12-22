import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  Play, 
  Pause, 
  TrendingUp, 
  Zap, 
  FileText, 
  Settings,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Target,
  DollarSign,
  Users,
  Phone,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAutonomousOps } from '@/hooks/useAutonomousOps';
import { toast } from 'sonner';
import DirectorReportsPanel from '@/components/communication/director/DirectorReportsPanel';
import DirectorTasksPanel from '@/components/communication/director/DirectorTasksPanel';
import RevenueForecastPanel from '@/components/communication/director/RevenueForecastPanel';

export default function AutonomousDirectorPage() {
  const [directorEnabled, setDirectorEnabled] = useState(true);
  const [autoCreateCampaigns, setAutoCreateCampaigns] = useState(true);
  const [autoAdjustPacing, setAutoAdjustPacing] = useState(true);
  const [autoChangeVoices, setAutoChangeVoices] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const { runCycle, runningCycle } = useAutonomousOps();

  const { data: latestReport } = useQuery({
    queryKey: ['latest-director-report'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_director_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      return data;
    },
  });

  const { data: pendingTasks } = useQuery({
    queryKey: ['pending-director-tasks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_outbound_director_tasks')
        .select('*')
        .in('status', ['pending', 'running'])
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const handleRunNow = async () => {
    if (!directorEnabled) {
      toast.error('Director is paused', {
        description: 'Enable the Autonomous Director to run cycles.',
      });
      return;
    }

    setIsRunning(true);
    try {
      // Determine which cycle to run based on current time
      const hour = new Date().getHours();
      let cycleType: 'morning' | 'midday' | 'evening';
      
      if (hour < 12) {
        cycleType = 'morning';
      } else if (hour < 17) {
        cycleType = 'midday';
      } else {
        cycleType = 'evening';
      }

      toast.info(`Starting ${cycleType} cycle...`, {
        description: 'The Autonomous Director is now processing.',
      });

      await runCycle(cycleType);
      
      toast.success('Autonomous Director cycle completed', {
        description: `The ${cycleType} cycle has finished successfully.`,
      });
    } catch (error) {
      // Error already handled in runCycle
      console.error('Run now failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            Autonomous Director
          </h1>
          <p className="text-muted-foreground">
            AI-powered outbound campaign management and optimization
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={directorEnabled}
              onCheckedChange={setDirectorEnabled}
              id="director-toggle"
            />
            <Label htmlFor="director-toggle">
              {directorEnabled ? 'Active' : 'Paused'}
            </Label>
          </div>
          <Button 
            variant="outline" 
            onClick={handleRunNow}
            disabled={isRunning || !!runningCycle || !directorEnabled}
          >
            {isRunning || runningCycle ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isRunning || runningCycle ? 'Running...' : 'Run Now'}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Campaigns</p>
                <p className="text-3xl font-bold">{latestReport?.campaigns_created || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Megaphone className="h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              +{latestReport?.campaigns_optimized || 0} optimized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Predicted Revenue</p>
                <p className="text-3xl font-bold">
                  ${latestReport?.predicted_revenue?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <p className="text-xs text-green-500 mt-2">
              +12% vs last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stores Reached</p>
                <p className="text-3xl font-bold">{latestReport?.stores_shifted || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Via calls & SMS
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
                <p className="text-3xl font-bold">{pendingTasks?.length || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-orange-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Auto-executing
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="reports" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="forecast" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Forecast
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <DirectorReportsPanel />
        </TabsContent>

        <TabsContent value="tasks">
          <DirectorTasksPanel />
        </TabsContent>

        <TabsContent value="forecast">
          <RevenueForecastPanel />
        </TabsContent>

        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>AI Recommendations</CardTitle>
              <CardDescription>
                Actions suggested by the autonomous director based on data analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg bg-green-500/5 border-green-500/20">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Launch reactivation campaign for 47 dormant stores</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      These stores haven't ordered in 14+ days but have high lifetime value.
                      Recommended: SMS sequence with personalized offers.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm">Execute</Button>
                      <Button size="sm" variant="outline">Preview</Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-orange-500/5 border-orange-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Switch voice for Brooklyn stores</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Analysis shows 23% higher conversion with "George" voice for this region.
                      Currently using "Aria".
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm">Apply Change</Button>
                      <Button size="sm" variant="outline">Ignore</Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-blue-500/5 border-blue-500/20">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Adjust call timing for Queens territory</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Peak answer rates detected at 10-11am and 2-3pm.
                      Current schedule misses optimal windows.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm">Optimize Schedule</Button>
                      <Button size="sm" variant="outline">View Data</Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Director Settings</CardTitle>
              <CardDescription>
                Configure autonomous behavior and permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Allow Autonomous Campaign Creation</p>
                  <p className="text-sm text-muted-foreground">
                    AI can create new campaigns based on opportunity detection
                  </p>
                </div>
                <Switch
                  checked={autoCreateCampaigns}
                  onCheckedChange={setAutoCreateCampaigns}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Allow Pacing Adjustments</p>
                  <p className="text-sm text-muted-foreground">
                    AI can adjust call/SMS rates based on performance
                  </p>
                </div>
                <Switch
                  checked={autoAdjustPacing}
                  onCheckedChange={setAutoAdjustPacing}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Allow Voice Changes</p>
                  <p className="text-sm text-muted-foreground">
                    AI can switch voices based on performance data
                  </p>
                </div>
                <Switch
                  checked={autoChangeVoices}
                  onCheckedChange={setAutoChangeVoices}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Notification Level</p>
                  <p className="text-sm text-muted-foreground">
                    How often to notify about autonomous actions
                  </p>
                </div>
                <Badge>All Actions</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Megaphone(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 11 18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}
