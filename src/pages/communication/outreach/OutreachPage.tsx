import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProactiveOutreachPanel from "@/components/communication/ProactiveOutreachPanel";
import { OutreachQueue, StoreEscalationsBoard } from "@/components/communication/outreach";
import { useOutreachQueueStats } from "@/hooks/useOutreachPlans";
import { useEscalationStats } from "@/hooks/useStoreEscalations";
import { Badge } from "@/components/ui/badge";

export default function OutreachPage() {
  const { data: queueStats } = useOutreachQueueStats();
  const { data: escalationStats } = useEscalationStats();

  return (
    <div className="w-full min-h-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Outreach & Cadence</h2>
        <div className="flex gap-4 text-sm">
          {queueStats && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Queue:</span>
              <Badge variant="outline">{queueStats.draft} drafts</Badge>
              <Badge variant="outline" className="border-blue-500/30 text-blue-500">
                {queueStats.approved + queueStats.running} active
              </Badge>
            </div>
          )}
          {escalationStats && escalationStats.pending + escalationStats.assigned > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Needs Visit:</span>
              <Badge variant="destructive">
                {escalationStats.pending + escalationStats.assigned}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="queue" className="w-full">
        <TabsList>
          <TabsTrigger value="queue" className="relative">
            Outreach Queue
            {queueStats && queueStats.draft > 0 && (
              <Badge 
                variant="destructive" 
                className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {queueStats.draft}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="escalations" className="relative">
            Needs Visit
            {escalationStats && (escalationStats.pending + escalationStats.assigned) > 0 && (
              <Badge 
                variant="outline" 
                className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs border-orange-500/30 text-orange-500"
              >
                {escalationStats.pending + escalationStats.assigned}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ai">AI Proactive</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-6">
          <OutreachQueue />
        </TabsContent>

        <TabsContent value="escalations" className="mt-6">
          <StoreEscalationsBoard />
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <ProactiveOutreachPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
