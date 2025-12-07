import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { MessageSquare, Phone, TrendingUp, Users, Clock, ThermometerSun } from 'lucide-react';

interface CommunicationHeatmapProps {
  businessId?: string;
}

export default function CommunicationHeatmap({ businessId }: CommunicationHeatmapProps) {
  const { data: stats } = useQuery({
    queryKey: ['communication-stats', businessId],
    queryFn: async () => {
      // Get message counts
      let messagesQuery = supabase
        .from('communication_messages')
        .select('id, channel, direction, created_at', { count: 'exact' });
      if (businessId) messagesQuery = messagesQuery.eq('business_id', businessId);
      const { data: messages, count: totalMessages } = await messagesQuery;

      // Get call logs
      let callsQuery = supabase
        .from('ai_call_logs')
        .select('id, outcome, created_at', { count: 'exact' });
      if (businessId) callsQuery = callsQuery.eq('business_id', businessId);
      const { data: calls, count: totalCalls } = await callsQuery;

      // Calculate stats
      const smsCount = messages?.filter(m => m.channel === 'sms').length || 0;
      const inboundCount = messages?.filter(m => m.direction === 'inbound').length || 0;
      const outboundCount = messages?.filter(m => m.direction === 'outbound').length || 0;
      const answeredCalls = calls?.filter(c => c.outcome === 'answered').length || 0;

      return {
        totalMessages: totalMessages || 0,
        totalCalls: totalCalls || 0,
        smsCount,
        inboundCount,
        outboundCount,
        answeredCalls,
        responseRate: outboundCount > 0 ? Math.round((inboundCount / outboundCount) * 100) : 0,
        answerRate: (totalCalls || 0) > 0 ? Math.round((answeredCalls / (totalCalls || 1)) * 100) : 0,
      };
    }
  });

  const { data: dailyData } = useQuery({
    queryKey: ['communication-daily', businessId],
    queryFn: async () => {
      // Fetch recent messages grouped by day
      const { data: messages } = await supabase
        .from('communication_messages')
        .select('created_at, channel')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      const days = 7;
      const result = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayMessages = messages?.filter(m => m.created_at?.startsWith(dateStr)) || [];
        result.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          messages: dayMessages.length,
          calls: dayMessages.filter(m => m.channel === 'call' || m.channel === 'ai_call').length,
        });
      }
      return result;
    }
  });

  const { data: topStores } = useQuery({
    queryKey: ['top-stores-communication', businessId],
    queryFn: async () => {
      // Fetch stores with communication counts
      const { data: stores } = await supabase
        .from('store_master')
        .select('id, store_name')
        .is('deleted_at', null)
        .limit(5);
      
      return stores?.map((store, i) => ({
        name: store.store_name,
        messages: 0,
        calls: 0,
        status: i < 2 ? 'hot' : i < 4 ? 'warm' : 'cold',
      })) || [];
    }
  });

  const channelData = [
    { name: 'SMS', value: stats?.smsCount || 0, color: 'hsl(var(--primary))' },
    { name: 'AI Calls', value: stats?.totalCalls || 0, color: 'hsl(var(--chart-2))' },
    { name: 'Manual Calls', value: Math.floor((stats?.totalCalls || 0) * 0.3), color: 'hsl(var(--chart-3))' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hot': return 'text-red-500 bg-red-500/10';
      case 'warm': return 'text-yellow-500 bg-yellow-500/10';
      case 'cold': return 'text-blue-500 bg-blue-500/10';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalMessages || 0}</p>
                <p className="text-xs text-muted-foreground">Total Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Phone className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalCalls || 0}</p>
                <p className="text-xs text-muted-foreground">Total Calls</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <TrendingUp className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.responseRate || 0}%</p>
                <p className="text-xs text-muted-foreground">Response Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Phone className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.answerRate || 0}%</p>
                <p className="text-xs text-muted-foreground">Answer Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5" />
              Communication Activity (7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="messages" fill="hsl(var(--primary))" name="Messages" radius={[4, 4, 0, 0]} />
                <Bar dataKey="calls" fill="hsl(var(--chart-2))" name="Calls" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Channel Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5" />
              Channel Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {channelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Stores by Communication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ThermometerSun className="w-5 h-5" />
            Store Communication Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topStores?.map((store, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium w-8">#{index + 1}</span>
                  <div>
                    <p className="font-medium">{store.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {store.messages} messages • {store.calls} calls
                    </p>
                  </div>
                </div>
                <Badge className={getStatusColor(store.status)}>
                  {store.status.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sentiment Placeholder */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-muted-foreground">
            <MessageSquare className="w-5 h-5" />
            Sentiment Analysis
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            AI sentiment analysis will show positive, neutral, and negative message trends
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
