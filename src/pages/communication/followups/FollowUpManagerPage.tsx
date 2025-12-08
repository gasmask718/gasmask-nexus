import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Clock, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import {
  usePendingFollowUps,
  useDueTodayFollowUps,
  useOverdueFollowUps,
  useCompletedFollowUps,
  useFollowUpQueueStats,
  useCompleteFollowUp,
  useCancelFollowUp,
  useTriggerFollowUpNow,
  useRunFollowUpEngine,
} from '@/hooks/useFollowUps';
import { FollowUpCard } from '@/components/communication/followups/FollowUpCard';

export default function FollowUpManagerPage() {
  const [activeTab, setActiveTab] = useState('pending');

  const { data: stats } = useFollowUpQueueStats();
  const { data: pendingFollowUps, isLoading: pendingLoading } = usePendingFollowUps();
  const { data: dueTodayFollowUps, isLoading: dueTodayLoading } = useDueTodayFollowUps();
  const { data: overdueFollowUps, isLoading: overdueLoading } = useOverdueFollowUps();
  const { data: completedFollowUps, isLoading: completedLoading } = useCompletedFollowUps();

  const completeFollowUp = useCompleteFollowUp();
  const cancelFollowUp = useCancelFollowUp();
  const triggerFollowUp = useTriggerFollowUpNow();
  const runEngine = useRunFollowUpEngine();

  const handleTrigger = (id: string) => triggerFollowUp.mutate(id);
  const handleComplete = (id: string) => completeFollowUp.mutate(id);
  const handleCancel = (id: string) => cancelFollowUp.mutate(id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Follow-Up Manager</h1>
          <p className="text-muted-foreground">Automated follow-up detection and scheduling</p>
        </div>
        <Button variant="outline" onClick={() => runEngine.mutate()} disabled={runEngine.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${runEngine.isPending ? 'animate-spin' : ''}`} />
          Run Engine
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-full bg-orange-100 text-orange-600"><Clock className="h-5 w-5" /></div><div><div className="text-2xl font-bold">{stats?.pending || 0}</div><div className="text-sm text-muted-foreground">Pending</div></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-full bg-blue-100 text-blue-600"><Zap className="h-5 w-5" /></div><div><div className="text-2xl font-bold">{stats?.dueToday || 0}</div><div className="text-sm text-muted-foreground">Due Today</div></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-full bg-red-100 text-red-600"><AlertTriangle className="h-5 w-5" /></div><div><div className="text-2xl font-bold">{stats?.overdue || 0}</div><div className="text-sm text-muted-foreground">Overdue</div></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-full bg-green-100 text-green-600"><CheckCircle className="h-5 w-5" /></div><div><div className="text-2xl font-bold">{stats?.completed || 0}</div><div className="text-sm text-muted-foreground">Completed</div></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">Pending {(stats?.pending || 0) > 0 && <Badge variant="secondary" className="ml-1">{stats?.pending}</Badge>}</TabsTrigger>
          <TabsTrigger value="due-today">Due Today {(stats?.dueToday || 0) > 0 && <Badge variant="secondary" className="ml-1">{stats?.dueToday}</Badge>}</TabsTrigger>
          <TabsTrigger value="overdue">Overdue {(stats?.overdue || 0) > 0 && <Badge variant="destructive" className="ml-1">{stats?.overdue}</Badge>}</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {pendingLoading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : 
           !pendingFollowUps?.length ? <div className="text-center py-8 text-muted-foreground">No pending follow-ups</div> :
           pendingFollowUps.map((fu) => <FollowUpCard key={fu.id} followUp={fu} onTrigger={handleTrigger} onComplete={handleComplete} onCancel={handleCancel} isLoading={triggerFollowUp.isPending} />)}
        </TabsContent>

        <TabsContent value="due-today" className="space-y-4 mt-4">
          {dueTodayLoading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : 
           !dueTodayFollowUps?.length ? <div className="text-center py-8 text-muted-foreground">No follow-ups due today</div> :
           dueTodayFollowUps.map((fu) => <FollowUpCard key={fu.id} followUp={fu} onTrigger={handleTrigger} onComplete={handleComplete} onCancel={handleCancel} isLoading={triggerFollowUp.isPending} />)}
        </TabsContent>

        <TabsContent value="overdue" className="space-y-4 mt-4">
          {overdueLoading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : 
           !overdueFollowUps?.length ? <div className="text-center py-8 text-muted-foreground">No overdue follow-ups</div> :
           overdueFollowUps.map((fu) => <FollowUpCard key={fu.id} followUp={fu} onTrigger={handleTrigger} onComplete={handleComplete} onCancel={handleCancel} isLoading={triggerFollowUp.isPending} />)}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-4">
          {completedLoading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : 
           !completedFollowUps?.length ? <div className="text-center py-8 text-muted-foreground">No completed follow-ups</div> :
           completedFollowUps.map((fu) => <FollowUpCard key={fu.id} followUp={fu} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
