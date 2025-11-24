import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Search } from 'lucide-react';
import { departmentThemes } from '@/config/departmentThemes';
import CommunicationLayout from './CommunicationLayout';

const CommunicationSMS = () => {
  const { currentBusiness } = useBusiness();
  const theme = departmentThemes.communication;
  const [searchTerm, setSearchTerm] = useState('');

  const { data: messages, isLoading } = useQuery({
    queryKey: ['communication-sms', currentBusiness?.id, searchTerm],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];

      const { data } = await supabase
        .from('call_center_messages')
        .select('*')
        .eq('business_name', currentBusiness.name)
        .order('created_at', { ascending: false });

      if (!data) return [];

      if (searchTerm) {
        return data.filter(msg => 
          msg.from_number?.includes(searchTerm) ||
          msg.to_number?.includes(searchTerm) ||
          msg.message_body?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return data;
    },
    enabled: !!currentBusiness?.id,
  });

  return (
    <CommunicationLayout
      title="SMS Management"
      subtitle="View and manage text message conversations"
    >
      <div className="space-y-6">
        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Search Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by number or message..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Messages List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Message History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading messages...</p>
            ) : messages && messages.length > 0 ? (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" style={{ color: theme.color }} />
                        <span className="font-medium">{msg.direction === 'inbound' ? msg.from_number : msg.to_number}</span>
                        <Badge variant={msg.direction === 'inbound' ? 'default' : 'secondary'}>
                          {msg.direction}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.created_at!).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{msg.message_body}</p>
                    {msg.media_urls && msg.media_urls.length > 0 && (
                      <Badge variant="outline" className="mt-2">
                        {msg.media_urls.length} attachment(s)
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No messages found</p>
            )}
          </CardContent>
        </Card>
      </div>
    </CommunicationLayout>
  );
};

export default CommunicationSMS;
