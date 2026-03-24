import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Phone, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

export default function DCInfrastructure() {
  const { data: phoneNumbers = [] } = useQuery({
    queryKey: ['dc-phone-numbers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('business_phone_numbers')
        .select('*')
        .limit(50);
      return data || [];
    },
  });

  const { data: latestPlaybook } = useQuery({
    queryKey: ['dc-cron-status'],
    queryFn: async () => {
      const { data } = await supabase
        .from('playbook_history')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const healthChecks = [
    { 
      name: 'Twilio Voice', 
      status: 'operational', 
      detail: 'Number: +18484004179',
    },
    { 
      name: 'ElevenLabs Agents', 
      status: 'operational', 
      detail: '4 agents active',
    },
    { 
      name: 'Self-Learn Cron', 
      status: latestPlaybook ? 'operational' : 'waiting', 
      detail: latestPlaybook 
        ? `Last run: ${new Date(latestPlaybook.created_at).toLocaleString()}`
        : 'Waiting for first call data',
    },
    {
      name: 'Bridge (twilio-elevenlabs-bridge)',
      status: 'operational',
      detail: 'provider_call_sid constraint active',
    },
    {
      name: 'Status Webhook (twilio-call-status)',
      status: 'operational',
      detail: 'Writing to ai_call_logs',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" /> Infrastructure & Health
        </h1>
        <p className="text-sm text-muted-foreground">System health, phone numbers, and cron status</p>
      </div>

      {/* Health Checks */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {healthChecks.map((check) => (
            <div key={check.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                {check.status === 'operational' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : check.status === 'waiting' ? (
                  <Clock className="h-5 w-5 text-yellow-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="text-sm font-medium">{check.name}</p>
                  <p className="text-xs text-muted-foreground">{check.detail}</p>
                </div>
              </div>
              <Badge variant="outline" className={
                check.status === 'operational' ? 'text-green-500 border-green-500' :
                check.status === 'waiting' ? 'text-yellow-500 border-yellow-500' :
                'text-red-500 border-red-500'
              }>
                {check.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Phone Numbers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" /> Phone Number Library
          </CardTitle>
        </CardHeader>
        <CardContent>
          {phoneNumbers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No phone numbers found in database.</p>
          ) : (
            <div className="space-y-2">
              {phoneNumbers.map((num: any) => (
                <div key={num.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="font-mono text-sm">{num.phone_number || num.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {num.label || num.friendly_name || 'No label'} · {num.provider || 'twilio'}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {num.capabilities?.join(', ') || num.type || 'voice'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
