import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, MessageSquare, Mail, MapPin, MessageCircle, Users, TrendingUp, AlertCircle } from "lucide-react";
import { format, subDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function Communications() {
  const [dateRange, setDateRange] = useState(30);
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const { data: communications, isLoading } = useQuery({
    queryKey: ['all-communications', dateRange, entityFilter, channelFilter],
    queryFn: async () => {
      const startDate = subDays(new Date(), dateRange);
      
      let query = supabase
        .from('communication_events')
        .select('*, profiles(name), stores(name)')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (entityFilter !== 'all') {
        query = query.eq('linked_entity_type', entityFilter);
      }

      if (channelFilter !== 'all') {
        query = query.eq('channel', channelFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['communication-stats', dateRange],
    queryFn: async () => {
      const startDate = subDays(new Date(), dateRange);
      
      const { data: comms } = await supabase
        .from('communication_events')
        .select('channel, user_id, linked_entity_id, linked_entity_type, created_at')
        .gte('created_at', startDate.toISOString());

      if (!comms) return null;

      // Top communicators
      const userCounts: { [key: string]: number } = {};
      comms.forEach(c => {
        if (c.user_id) userCounts[c.user_id] = (userCounts[c.user_id] || 0) + 1;
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', Object.keys(userCounts));

      const topCommunicators = Object.entries(userCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([userId, count]) => ({
          name: profiles?.find(p => p.id === userId)?.name || 'Unknown',
          count,
        }));

      // Inactive stores (no contact in 30+ days)
      const recentStoreIds = new Set(
        comms.filter(c => c.linked_entity_type === 'store').map(c => c.linked_entity_id)
      );

      const { data: allStores } = await supabase
        .from('stores')
        .select('id, name')
        .eq('status', 'active');

      const inactiveStores = allStores?.filter(s => !recentStoreIds.has(s.id)) || [];

      // Overdue reminders
      const { data: overdueReminders } = await supabase
        .from('reminders')
        .select('*, stores(name)')
        .eq('status', 'overdue')
        .limit(10);

      // Communication frequency by day
      const dayGroups: { [key: string]: number } = {};
      comms.forEach(c => {
        const day = format(new Date(c.created_at), 'MMM dd');
        dayGroups[day] = (dayGroups[day] || 0) + 1;
      });

      const frequencyData = Object.entries(dayGroups).map(([day, count]) => ({
        day,
        count,
      }));

      return {
        topCommunicators,
        inactiveStores: inactiveStores.slice(0, 10),
        overdueReminders: overdueReminders || [],
        frequencyData,
        totalCommunications: comms.length,
      };
    },
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'visit': return <MapPin className="h-4 w-4" />;
      case 'whatsapp': return <MessageCircle className="h-4 w-4" />;
      default: return <TrendingUp className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-muted-foreground">Loading communications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Global Communication Dashboard</h1>
          <p className="text-muted-foreground">Intelligence center for all company communications</p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={String(dateRange)} onValueChange={(v) => setDateRange(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="store">Stores</SelectItem>
                  <SelectItem value="wholesaler">Wholesalers</SelectItem>
                  <SelectItem value="influencer">Influencers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="call">Phone Call</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="visit">Visit</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Stats Widgets */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Communications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCommunications || 0}</div>
              <p className="text-xs text-muted-foreground">Last {dateRange} days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Inactive Stores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {stats?.inactiveStores?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">No contact in 30+ days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Overdue Follow-ups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {stats?.overdueReminders?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">Action required</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Communicators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.topCommunicators?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Team members</p>
            </CardContent>
          </Card>
        </div>

        {/* Communication Frequency Chart */}
        {stats?.frequencyData && stats.frequencyData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Communication Frequency</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.frequencyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Top Communicators */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top Communicators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.topCommunicators?.map((comm, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="font-medium">{comm.name}</span>
                    <Badge variant="secondary">{comm.count} contacts</Badge>
                  </div>
                ))}
                {(!stats?.topCommunicators || stats.topCommunicators.length === 0) && (
                  <p className="text-sm text-muted-foreground">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Inactive Stores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Inactive Stores (30+ Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.inactiveStores?.map((store) => (
                  <div key={store.id} className="flex items-center justify-between text-sm">
                    <span>{store.name}</span>
                    <Badge variant="destructive">No Contact</Badge>
                  </div>
                ))}
                {(!stats?.inactiveStores || stats.inactiveStores.length === 0) && (
                  <p className="text-sm text-muted-foreground">All stores have recent contact</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Communication Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Communications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {communications?.slice(0, 20).map((comm) => (
                <div key={comm.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                  <div className="mt-1">{getChannelIcon(comm.channel || '')}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{comm.profiles?.name || 'Unknown'}</span>
                      <Badge variant="outline" className="capitalize">
                        {comm.linked_entity_type || 'unknown'}
                      </Badge>
                      <Badge variant="secondary" className="capitalize">
                        {comm.channel || 'other'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{comm.summary}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(comm.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
              {(!communications || communications.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No communications found for the selected filters
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}