import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useBusiness } from '@/contexts/BusinessContext';
import { supabase } from '@/integrations/supabase/client';
import CommunicationLayout from './CommunicationLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Mail, MessageSquare, Phone, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import { format } from 'date-fns';

const CommunicationCampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    enabled: !!currentBusiness?.id && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id!)
        .eq('business_id', currentBusiness!.id)
        .single();
      if (error) throw error;
      return data;
    }
  });

  const { data: recipients } = useQuery({
    queryKey: ['campaign-recipients', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_recipients')
        .select('*')
        .eq('campaign_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'sms': return <MessageSquare className="h-5 w-5" />;
      case 'email': return <Mail className="h-5 w-5" />;
      case 'call': return <Phone className="h-5 w-5" />;
      default: return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'opened': return <Eye className="h-4 w-4 text-blue-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  if (!currentBusiness) {
    return (
      <CommunicationLayout title="Campaign Details">
        <p className="text-muted-foreground">Please select a business to view campaign details.</p>
      </CommunicationLayout>
    );
  }

  if (isLoading) {
    return (
      <CommunicationLayout title="Campaign Details">
        <div className="text-center py-12 text-muted-foreground">Loading campaign...</div>
      </CommunicationLayout>
    );
  }

  if (!campaign) {
    return (
      <CommunicationLayout title="Campaign Details">
        <p className="text-muted-foreground">Campaign not found</p>
      </CommunicationLayout>
    );
  }

  const deliveryRate = campaign.total_recipients > 0 
    ? ((campaign.delivered_count / campaign.total_recipients) * 100).toFixed(1)
    : 0;

  const openRate = campaign.delivered_count > 0
    ? ((campaign.open_count / campaign.delivered_count) * 100).toFixed(1)
    : 0;

  return (
    <CommunicationLayout title={campaign.name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/communication/campaigns')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Campaigns
          </Button>
          <Badge variant={campaign.status === 'completed' ? 'default' : 'secondary'}>
            {campaign.status}
          </Badge>
        </div>

        {/* Overview Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
              {getChannelIcon(campaign.channel)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaign.total_recipients}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaign.sent_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaign.delivered_count}</div>
              <p className="text-xs text-muted-foreground mt-1">{deliveryRate}% delivery rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Opens</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaign.open_count}</div>
              <p className="text-xs text-muted-foreground mt-1">{openRate}% open rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Campaign Details */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Channel</p>
                <p className="font-medium capitalize">{campaign.channel}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{format(new Date(campaign.created_at), 'PPP')}</p>
              </div>
              {campaign.scheduled_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="font-medium">{format(new Date(campaign.scheduled_at), 'PPP p')}</p>
                </div>
              )}
              {campaign.completed_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="font-medium">{format(new Date(campaign.completed_at), 'PPP p')}</p>
                </div>
              )}
            </div>
            {campaign.subject && (
              <div>
                <p className="text-sm text-muted-foreground">Subject</p>
                <p className="font-medium">{campaign.subject}</p>
              </div>
            )}
            {campaign.message_template && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Message</p>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="whitespace-pre-wrap">{campaign.message_template}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recipients Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recipients</CardTitle>
          </CardHeader>
          <CardContent>
            {recipients && recipients.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Delivered At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((recipient) => (
                    <TableRow key={recipient.id}>
                      <TableCell>{recipient.contact_name || '-'}</TableCell>
                      <TableCell>{recipient.contact_value}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(recipient.status)}
                          <span className="capitalize">{recipient.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {recipient.sent_at ? format(new Date(recipient.sent_at), 'PPp') : '-'}
                      </TableCell>
                      <TableCell>
                        {recipient.delivered_at ? format(new Date(recipient.delivered_at), 'PPp') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">No recipients data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </CommunicationLayout>
  );
};

export default CommunicationCampaignDetail;
