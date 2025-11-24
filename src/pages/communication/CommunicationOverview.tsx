import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, MessageSquare, Mail, Users, TrendingUp, Clock } from 'lucide-react';
import { departmentThemes } from '@/config/departmentThemes';
import CommunicationLayout from './CommunicationLayout';

const CommunicationOverview = () => {
  const { currentBusiness } = useBusiness();
  const theme = departmentThemes.communication;

  const { data: stats } = useQuery({
    queryKey: ['communication-overview', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get call center logs
      const { data: callLogs } = await supabase
        .from('call_center_logs')
        .select('*')
        .eq('business_name', currentBusiness.name)
        .gte('created_at', today.toISOString());

      // Get SMS
      const { data: smsLogs } = await supabase
        .from('call_center_messages')
        .select('*')
        .eq('business_name', currentBusiness.name)
        .gte('created_at', today.toISOString());

      // Get emails
      const { data: emailLogs } = await supabase
        .from('call_center_emails')
        .select('*')
        .eq('business_name', currentBusiness.name)
        .gte('created_at', today.toISOString());

      // Get AI agents
      const { data: aiAgents } = await supabase
        .from('call_center_ai_agents')
        .select('*')
        .eq('business_name', currentBusiness.name)
        .eq('is_active', true);

      // Get phone numbers
      const { data: phoneNumbers } = await supabase
        .from('call_center_phone_numbers')
        .select('*')
        .eq('business_name', currentBusiness.name)
        .eq('is_active', true);

      return {
        totalCalls: callLogs?.length || 0,
        totalSMS: smsLogs?.length || 0,
        totalEmails: emailLogs?.length || 0,
        activeAgents: aiAgents?.length || 0,
        activeNumbers: phoneNumbers?.length || 0,
        missedCalls: callLogs?.filter(c => c.outcome === 'missed' || !c.answered_by).length || 0,
      };
    },
    enabled: !!currentBusiness?.id,
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['recent-communication', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];

      const { data } = await supabase
        .from('call_center_logs')
        .select('*')
        .eq('business_name', currentBusiness.name)
        .order('created_at', { ascending: false })
        .limit(5);

      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  return (
    <CommunicationLayout
      title="Communication Overview"
      subtitle="Unified multi-channel communication command center"
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card style={{ borderColor: theme.accent }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" style={{ color: theme.color }} />
                Total Calls Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{ color: theme.color }}>
                {stats?.totalCalls || 0}
              </div>
            </CardContent>
          </Card>

          <Card style={{ borderColor: theme.accent }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" style={{ color: theme.color }} />
                SMS Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{ color: theme.color }}>
                {stats?.totalSMS || 0}
              </div>
            </CardContent>
          </Card>

          <Card style={{ borderColor: theme.accent }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" style={{ color: theme.color }} />
                Emails
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{ color: theme.color }}>
                {stats?.totalEmails || 0}
              </div>
            </CardContent>
          </Card>

          <Card style={{ borderColor: theme.accent }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" style={{ color: theme.color }} />
                Active AI Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{ color: theme.color }}>
                {stats?.activeAgents || 0}
              </div>
            </CardContent>
          </Card>

          <Card style={{ borderColor: theme.accent }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" style={{ color: theme.color }} />
                Active Numbers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{ color: theme.color }}>
                {stats?.activeNumbers || 0}
              </div>
            </CardContent>
          </Card>

          <Card style={{ borderColor: theme.accent }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: theme.color }} />
                Missed Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">
                {stats?.missedCalls || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity?.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                  <Phone className="h-4 w-4 mt-1" style={{ color: theme.color }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.caller_id}</p>
                    <p className="text-xs text-muted-foreground">{activity.summary || 'No summary'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(activity.created_at!).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {(!recentActivity || recentActivity.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </CommunicationLayout>
  );
};

export default CommunicationOverview;
