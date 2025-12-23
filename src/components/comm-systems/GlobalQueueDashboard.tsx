import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Phone,
  MessageSquare,
  Mail,
  AlertTriangle,
  Clock,
  User,
  Building,
  ArrowRight,
  Inbox,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCommBusinessContext } from "./GlobalBusinessFilter";
import { format, isToday, differenceInMinutes } from "date-fns";
import { cn } from "@/lib/utils";

interface QueueItem {
  id: string;
  channel: string;
  phone_number?: string;
  content?: string;
  status: string;
  priority?: string;
  owner_user_id?: string;
  business_id?: string;
  created_at: string;
  sla_deadline?: string;
}

export function GlobalQueueDashboard() {
  const { context } = useCommBusinessContext();

  const { data: queueItems, isLoading, refetch } = useQuery({
    queryKey: ['global-queue', context.businessId],
    queryFn: async () => {
      let query = supabase
        .from('communication_messages')
        .select('*')
        .in('status', ['open', 'in_progress', 'escalated'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (context.businessId) {
        query = query.eq('business_id', context.businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as QueueItem[];
    },
    refetchInterval: 30000,
  });

  const { data: unassignedItems } = useQuery({
    queryKey: ['unassigned-queue', context.businessId],
    queryFn: async () => {
      let query = supabase
        .from('communication_messages')
        .select('*')
        .is('owner_user_id', null)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (context.businessId) {
        query = query.eq('business_id', context.businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as QueueItem[];
    },
  });

  const stats = {
    total: queueItems?.length || 0,
    calls: queueItems?.filter(i => i.channel === 'call').length || 0,
    sms: queueItems?.filter(i => i.channel === 'sms').length || 0,
    emails: queueItems?.filter(i => i.channel === 'email').length || 0,
    escalated: queueItems?.filter(i => i.status === 'escalated').length || 0,
    unassigned: unassignedItems?.length || 0,
    urgent: queueItems?.filter(i => i.priority === 'urgent').length || 0,
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'call': return Phone;
      case 'email': return Mail;
      default: return MessageSquare;
    }
  };

  const getSLAStatus = (deadline?: string) => {
    if (!deadline) return { status: 'none', label: 'No SLA' };
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diff = differenceInMinutes(deadlineDate, now);
    
    if (diff < 0) return { status: 'overdue', label: `${Math.abs(diff)}m overdue` };
    if (diff < 30) return { status: 'warning', label: `${diff}m left` };
    return { status: 'ok', label: `${Math.floor(diff / 60)}h ${diff % 60}m` };
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">Total Queue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{stats.calls}</div>
                <p className="text-xs text-muted-foreground">Calls</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{stats.sms}</div>
                <p className="text-xs text-muted-foreground">SMS</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{stats.emails}</div>
                <p className="text-xs text-muted-foreground">Emails</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={stats.escalated > 0 ? "border-destructive" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn("h-5 w-5", stats.escalated > 0 ? "text-destructive" : "text-muted-foreground")} />
              <div>
                <div className="text-2xl font-bold">{stats.escalated}</div>
                <p className="text-xs text-muted-foreground">Escalated</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={stats.unassigned > 0 ? "border-orange-500" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <User className={cn("h-5 w-5", stats.unassigned > 0 ? "text-orange-500" : "text-muted-foreground")} />
              <div>
                <div className="text-2xl font-bold">{stats.unassigned}</div>
                <p className="text-xs text-muted-foreground">Unassigned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={stats.urgent > 0 ? "border-red-500" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className={cn("h-5 w-5", stats.urgent > 0 ? "text-red-500" : "text-muted-foreground")} />
              <div>
                <div className="text-2xl font-bold">{stats.urgent}</div>
                <p className="text-xs text-muted-foreground">Urgent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's Workload */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Today's Workload</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Calls</span>
                <div className="flex items-center gap-2">
                  <Progress value={(stats.calls / Math.max(stats.total, 1)) * 100} className="w-32" />
                  <span className="text-sm font-medium w-8">{stats.calls}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">SMS</span>
                <div className="flex items-center gap-2">
                  <Progress value={(stats.sms / Math.max(stats.total, 1)) * 100} className="w-32" />
                  <span className="text-sm font-medium w-8">{stats.sms}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Emails</span>
                <div className="flex items-center gap-2">
                  <Progress value={(stats.emails / Math.max(stats.total, 1)) * 100} className="w-32" />
                  <span className="text-sm font-medium w-8">{stats.emails}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unassigned Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Unassigned Items
              {stats.unassigned > 0 && (
                <Badge variant="destructive">{stats.unassigned}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {unassignedItems?.length ? (
                <div className="space-y-2">
                  {unassignedItems.slice(0, 10).map((item) => {
                    const Icon = getChannelIcon(item.channel);
                    const sla = getSLAStatus(item.sla_deadline);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          item.channel === 'call' ? "bg-blue-100 text-blue-600" :
                          item.channel === 'email' ? "bg-purple-100 text-purple-600" :
                          "bg-green-100 text-green-600"
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.phone_number || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.content?.slice(0, 50)}...
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.priority === 'urgent' && (
                            <Badge variant="destructive" className="text-xs">Urgent</Badge>
                          )}
                          <span className={cn(
                            "text-xs",
                            sla.status === 'overdue' && "text-destructive",
                            sla.status === 'warning' && "text-orange-500"
                          )}>
                            {sla.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mb-2 text-green-500" />
                  <p className="text-sm">All items assigned</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Active Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : queueItems?.length ? (
              <div className="space-y-2">
                {queueItems.map((item) => {
                  const Icon = getChannelIcon(item.channel);
                  const sla = getSLAStatus(item.sla_deadline);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        item.channel === 'call' ? "bg-blue-100 text-blue-600" :
                        item.channel === 'email' ? "bg-purple-100 text-purple-600" :
                        "bg-green-100 text-green-600"
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{item.phone_number || 'Unknown'}</p>
                          <Badge variant="outline" className="uppercase text-xs">{item.channel}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {item.content?.slice(0, 60)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          {item.status === 'escalated' && (
                            <Badge variant="destructive">Escalated</Badge>
                          )}
                          {item.priority === 'urgent' && (
                            <Badge variant="destructive">Urgent</Badge>
                          )}
                          {item.priority === 'high' && (
                            <Badge className="bg-orange-500">High</Badge>
                          )}
                        </div>
                        <span className={cn(
                          "text-xs",
                          sla.status === 'overdue' && "text-destructive",
                          sla.status === 'warning' && "text-orange-500",
                          sla.status === 'ok' && "text-muted-foreground"
                        )}>
                          <Clock className="h-3 w-3 inline mr-1" />
                          {sla.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.created_at), 'h:mm a')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                <Inbox className="h-12 w-12 mb-2 opacity-50" />
                <p>Queue is empty</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
