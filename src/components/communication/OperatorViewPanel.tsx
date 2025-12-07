import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Bot, UserCheck, AlertTriangle, Clock, Activity } from "lucide-react";
import { useLiveCallSessions } from "@/hooks/useLiveCallSessions";
import { LiveCallCard } from "./LiveCallCard";

interface OperatorViewPanelProps {
  businessId?: string;
}

export function OperatorViewPanel({ businessId }: OperatorViewPanelProps) {
  const {
    activeSessions,
    recentSessions,
    sessionsLoading,
    takeOverCall,
    isTakingOver,
    returnToAI,
    isReturning,
    endCall,
    isEnding,
    stats,
  } = useLiveCallSessions(businessId);

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Calls</p>
                <p className="text-2xl font-bold">{stats.totalActive}</p>
              </div>
              <Phone className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI Controlled</p>
                <p className="text-2xl font-bold">{stats.activeCount - stats.humanActiveCount}</p>
              </div>
              <Bot className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Human Active</p>
                <p className="text-2xl font-bold">{stats.humanActiveCount}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Handoffs</p>
                <p className="text-2xl font-bold">{stats.pendingHandoffs}</p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${stats.pendingHandoffs > 0 ? "text-destructive animate-pulse" : "text-muted-foreground"}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Activity Indicator */}
      {stats.totalActive > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Activity className="h-5 w-5 text-primary animate-pulse" />
          <span className="font-medium">Live Monitoring Active</span>
          <span className="text-sm text-muted-foreground">• Updates every 5 seconds</span>
        </div>
      )}

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Live Calls
            {stats.totalActive > 0 && (
              <Badge variant="secondary" className="ml-1">{stats.totalActive}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recent" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {sessionsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading live calls...</div>
          ) : activeSessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Phone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium">No Active Calls</p>
                <p className="text-sm text-muted-foreground">
                  When AI calls are in progress, they will appear here for monitoring and takeover.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeSessions.map((session) => (
                <LiveCallCard
                  key={session.id}
                  session={session}
                  onTakeOver={takeOverCall}
                  onReturnToAI={returnToAI}
                  onEndCall={endCall}
                  isTakingOver={isTakingOver}
                  isReturning={isReturning}
                  isEnding={isEnding}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recent" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Completed Calls</CardTitle>
              <CardDescription>Last 20 completed or failed call sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {recentSessions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No recent calls</p>
                ) : (
                  <div className="space-y-3">
                    {recentSessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant={session.status === "completed" ? "default" : "destructive"}>
                            {session.status}
                          </Badge>
                          <div>
                            <p className="font-medium">{session.store?.store_name || "Unknown"}</p>
                            <p className="text-sm text-muted-foreground">{session.business?.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {new Date(session.updated_at).toLocaleTimeString()}
                          </p>
                          {session.call_summary && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {session.call_summary}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
