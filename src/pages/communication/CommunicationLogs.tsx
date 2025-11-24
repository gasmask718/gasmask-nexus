import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, Phone, MessageSquare, Mail, Search } from 'lucide-react';
import { departmentThemes } from '@/config/departmentThemes';
import CommunicationLayout from './CommunicationLayout';

const CommunicationLogs = () => {
  const { currentBusiness } = useBusiness();
  const theme = departmentThemes.communication;
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['communication-all-logs', currentBusiness?.id, searchTerm, channelFilter],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];

      // Combine calls, SMS, and emails into one unified log
      const [calls, sms, emails] = await Promise.all([
        supabase
          .from('call_center_logs')
          .select('*')
          .eq('business_name', currentBusiness.name)
          .order('created_at', { ascending: false })
          .then(({ data }) => data?.map(d => ({ ...d, channel: 'call' as const })) || []),
        supabase
          .from('call_center_messages')
          .select('*')
          .eq('business_name', currentBusiness.name)
          .order('created_at', { ascending: false })
          .then(({ data }) => data?.map(d => ({ ...d, channel: 'sms' as const })) || []),
        supabase
          .from('call_center_emails')
          .select('*')
          .eq('business_name', currentBusiness.name)
          .order('created_at', { ascending: false })
          .then(({ data }) => data?.map(d => ({ ...d, channel: 'email' as const })) || []),
      ]);

      let allLogs = [...calls, ...sms, ...emails].sort((a, b) => 
        new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
      );

      if (channelFilter !== 'all') {
        allLogs = allLogs.filter(log => log.channel === channelFilter);
      }

      if (searchTerm) {
        allLogs = allLogs.filter(log => {
          const searchLower = searchTerm.toLowerCase();
          if ('caller_id' in log && log.caller_id?.toLowerCase().includes(searchLower)) return true;
          if ('summary' in log && log.summary?.toLowerCase().includes(searchLower)) return true;
          if ('from_number' in log && log.from_number?.includes(searchLower)) return true;
          if ('to_number' in log && log.to_number?.includes(searchLower)) return true;
          if ('message_body' in log && log.message_body?.toLowerCase().includes(searchLower)) return true;
          if ('subject' in log && log.subject?.toLowerCase().includes(searchLower)) return true;
          return false;
        });
      }

      return allLogs;
    },
    enabled: !!currentBusiness?.id,
  });

  const getIcon = (channel: string) => {
    switch (channel) {
      case 'call': return <Phone className="h-4 w-4" style={{ color: theme.color }} />;
      case 'sms': return <MessageSquare className="h-4 w-4" style={{ color: theme.color }} />;
      case 'email': return <Mail className="h-4 w-4" style={{ color: theme.color }} />;
      default: return <FileText className="h-4 w-4" style={{ color: theme.color }} />;
    }
  };

  return (
    <CommunicationLayout
      title="Unified Communication Logs"
      subtitle="All communication channels in one timeline"
    >
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search all communications..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="call">Calls Only</SelectItem>
                <SelectItem value="sms">SMS Only</SelectItem>
                <SelectItem value="email">Email Only</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Unified Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Communication Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading logs...</p>
            ) : logs && logs.length > 0 ? (
              <div className="space-y-3">
                {logs.map((log, idx) => (
                  <div key={`${log.channel}-${log.id || idx}`} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getIcon(log.channel)}
                          <Badge variant="outline" className="capitalize">{log.channel}</Badge>
                          {'direction' in log && (
                            <Badge variant={log.direction === 'inbound' ? 'default' : 'secondary'}>
                              {log.direction}
                            </Badge>
                          )}
                        </div>
                        {log.channel === 'call' && 'caller_id' in log && (
                          <p className="text-sm font-medium">{log.caller_id}</p>
                        )}
                        {log.channel === 'sms' && 'from_number' in log && (
                          <p className="text-sm font-medium">{log.from_number} → {log.to_number}</p>
                        )}
                        {log.channel === 'email' && 'subject' in log && (
                          <p className="text-sm font-medium">{log.subject || '(No Subject)'}</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          {'summary' in log ? log.summary : ''}
                          {'message_body' in log ? log.message_body : ''}
                          {'body' in log ? (log.body?.substring(0, 100) + '...') : ''}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(log.created_at!).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No communication logs found</p>
            )}
          </CardContent>
        </Card>
      </div>
    </CommunicationLayout>
  );
};

export default CommunicationLogs;
