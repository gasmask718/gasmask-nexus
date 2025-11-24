import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBusiness } from '@/contexts/BusinessContext';
import { supabase } from '@/integrations/supabase/client';
import CommunicationLayout from './CommunicationLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Send, Mail, Phone, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const CommunicationCampaigns = () => {
  const { currentBusiness } = useBusiness();
  const navigate = useNavigate();
  const [channelFilter, setChannelFilter] = useState<string | null>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns', currentBusiness?.id, channelFilter],
    enabled: !!currentBusiness?.id,
    queryFn: async () => {
      let query = supabase
        .from('campaigns')
        .select('*')
        .eq('business_id', currentBusiness!.id)
        .order('created_at', { ascending: false });

      if (channelFilter) {
        query = query.eq('channel', channelFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'call': return <Phone className="h-4 w-4" />;
      default: return <Send className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'sending': return 'secondary';
      case 'scheduled': return 'outline';
      case 'failed': return 'destructive';
      case 'paused': return 'outline';
      default: return 'outline';
    }
  };

  if (!currentBusiness) {
    return (
      <CommunicationLayout title="Campaigns" subtitle="Mass messaging and outreach">
        <p className="text-muted-foreground">Please select a business to view campaigns.</p>
      </CommunicationLayout>
    );
  }

  return (
    <CommunicationLayout title="Campaigns" subtitle="Mass messaging and outreach">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={channelFilter === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChannelFilter(null)}
            >
              All
            </Button>
            <Button
              variant={channelFilter === 'sms' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChannelFilter('sms')}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              SMS
            </Button>
            <Button
              variant={channelFilter === 'email' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChannelFilter('email')}
            >
              <Mail className="h-4 w-4 mr-1" />
              Email
            </Button>
            <Button
              variant={channelFilter === 'call' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChannelFilter('call')}
            >
              <Phone className="h-4 w-4 mr-1" />
              Call
            </Button>
          </div>
          <Button onClick={() => navigate('/communication/campaigns/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading campaigns...</div>
        ) : !campaigns || campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Send className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first mass SMS, email, or call campaign.
              </p>
              <Button onClick={() => navigate('/communication/campaigns/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <Card
                key={campaign.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/communication/campaigns/${campaign.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {getChannelIcon(campaign.channel)}
                      <div>
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Created {format(new Date(campaign.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <Badge variant={getStatusColor(campaign.status)}>
                      {campaign.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Recipients</p>
                      <p className="text-2xl font-bold">{campaign.total_recipients}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sent</p>
                      <p className="text-2xl font-bold">{campaign.sent_count}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Delivered</p>
                      <p className="text-2xl font-bold">{campaign.delivered_count}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Failed</p>
                      <p className="text-2xl font-bold text-destructive">{campaign.failed_count}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Opens</p>
                      <p className="text-2xl font-bold">{campaign.open_count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </CommunicationLayout>
  );
};

export default CommunicationCampaigns;
