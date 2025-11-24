import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Phone, MessageSquare, Mail } from 'lucide-react';
import { departmentThemes } from '@/config/departmentThemes';
import CommunicationLayout from './CommunicationLayout';

const CommunicationAnalytics = () => {
  const { currentBusiness } = useBusiness();
  const theme = departmentThemes.communication;

  const { data: analytics } = useQuery({
    queryKey: ['communication-analytics', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return null;

      const [calls, sms, emails] = await Promise.all([
        supabase
          .from('call_center_logs')
          .select('*')
          .eq('business_name', currentBusiness.name),
        supabase
          .from('call_center_messages')
          .select('*')
          .eq('business_name', currentBusiness.name),
        supabase
          .from('call_center_emails')
          .select('*')
          .eq('business_name', currentBusiness.name),
      ]);

      const callData = calls.data || [];
      const smsData = sms.data || [];
      const emailData = emails.data || [];

      const avgCallDuration = callData.length > 0
        ? callData.reduce((sum, call) => sum + (call.duration || 0), 0) / callData.length
        : 0;

      const avgSentiment = callData.length > 0
        ? callData.reduce((sum, call) => sum + (call.sentiment_score || 50), 0) / callData.length
        : 50;

      return {
        totalCalls: callData.length,
        totalSMS: smsData.length,
        totalEmails: emailData.length,
        avgCallDuration: Math.round(avgCallDuration),
        avgSentiment: Math.round(avgSentiment),
        missedCalls: callData.filter(c => c.outcome === 'missed' || !c.answered_by).length,
        inboundCalls: callData.filter(c => c.direction === 'inbound').length,
        outboundCalls: callData.filter(c => c.direction === 'outbound').length,
      };
    },
    enabled: !!currentBusiness?.id,
  });

  return (
    <CommunicationLayout
      title="Communication Analytics"
      subtitle="Performance metrics and insights across all channels"
    >
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card style={{ borderColor: theme.accent }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Total Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{ color: theme.color }}>
                {analytics?.totalCalls || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics?.inboundCalls || 0} in · {analytics?.outboundCalls || 0} out
              </p>
            </CardContent>
          </Card>

          <Card style={{ borderColor: theme.accent }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Total SMS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{ color: theme.color }}>
                {analytics?.totalSMS || 0}
              </div>
            </CardContent>
          </Card>

          <Card style={{ borderColor: theme.accent }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Total Emails
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{ color: theme.color }}>
                {analytics?.totalEmails || 0}
              </div>
            </CardContent>
          </Card>

          <Card style={{ borderColor: theme.accent }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Avg Sentiment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{ color: theme.color }}>
                {analytics?.avgSentiment || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Out of 100</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Call Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Average Duration</span>
                <span className="font-semibold">
                  {analytics?.avgCallDuration ? `${Math.floor(analytics.avgCallDuration / 60)}m ${analytics.avgCallDuration % 60}s` : '0s'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Missed Calls</span>
                <span className="font-semibold text-destructive">{analytics?.missedCalls || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <span className="font-semibold">
                  {analytics?.totalCalls ? Math.round(((analytics.totalCalls - (analytics.missedCalls || 0)) / analytics.totalCalls) * 100) : 0}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Channel Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Phone Calls</span>
                <span className="font-semibold">{analytics?.totalCalls || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Text Messages</span>
                <span className="font-semibold">{analytics?.totalSMS || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Emails</span>
                <span className="font-semibold">{analytics?.totalEmails || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </CommunicationLayout>
  );
};

export default CommunicationAnalytics;
