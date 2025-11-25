import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Mail, Phone, Calendar, Filter } from 'lucide-react';

export default function CommunicationsCenterLogs() {
  const logs = [
    {
      type: 'sms',
      brand: 'GasMask',
      campaign: 'Restock Reminder',
      sent: 142,
      delivered: 138,
      failed: 4,
      timestamp: '2 hours ago',
      user: 'System AI'
    },
    {
      type: 'email',
      brand: 'HotMama',
      campaign: 'New Product Launch',
      sent: 567,
      delivered: 542,
      failed: 25,
      timestamp: '5 hours ago',
      user: 'Admin'
    },
    {
      type: 'call',
      brand: 'TopTier',
      campaign: 'Follow-up Calls',
      sent: 89,
      delivered: 67,
      failed: 22,
      timestamp: '1 day ago',
      user: 'AI Agent'
    },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sms': return <MessageSquare className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'call': return <Phone className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Communication Logs</h1>
        <p className="text-muted-foreground mt-2">
          Complete history of all outbound communications across all brands
        </p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Activity</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="calls">Calls</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recent Communications</span>
                <div className="flex items-center gap-2">
                  <Input placeholder="Search..." className="w-64" />
                  <Badge variant="outline" className="cursor-pointer">
                    <Filter className="w-4 h-4 mr-1" />
                    Filter
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {logs.map((log, i) => (
                  <div key={i} className="p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          {getTypeIcon(log.type)}
                        </div>
                        <div>
                          <div className="font-medium">{log.campaign}</div>
                          <div className="text-sm text-muted-foreground">
                            {log.brand} • {log.timestamp}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{log.user}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div className="text-center p-2 rounded bg-muted/50">
                        <div className="font-bold">{log.sent}</div>
                        <div className="text-xs text-muted-foreground">Sent</div>
                      </div>
                      <div className="text-center p-2 rounded bg-green-50 dark:bg-green-950">
                        <div className="font-bold text-green-600">{log.delivered}</div>
                        <div className="text-xs text-green-600">Delivered</div>
                      </div>
                      <div className="text-center p-2 rounded bg-red-50 dark:bg-red-950">
                        <div className="font-bold text-red-600">{log.failed}</div>
                        <div className="text-xs text-red-600">Failed</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold">2,847</div>
                <div className="text-sm text-muted-foreground">Total Sent Today</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-green-600">2,689</div>
                <div className="text-sm text-muted-foreground">Delivered</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-red-600">158</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold">94.5%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
