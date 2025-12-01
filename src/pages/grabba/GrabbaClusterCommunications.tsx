import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  MessageSquare, Mail, Phone, Send, Users, Calendar, TrendingUp, Bell
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { GRABBA_BRAND_CONFIG } from '@/config/grabbaSkyscraper';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';

// Demo campaigns data
const recentCampaigns = [
  { id: '1', type: 'sms', name: 'GasMask Restock Alert', brand: 'gasmask', recipients: 145, sent: '2024-01-15', status: 'completed', opens: 89 },
  { id: '2', type: 'email', name: 'HotMama New Product Launch', brand: 'hotmama', recipients: 230, sent: '2024-01-14', status: 'completed', opens: 156 },
  { id: '3', type: 'sms', name: 'Grabba R Us Weekend Special', brand: 'grabba', recipients: 180, sent: '2024-01-13', status: 'completed', opens: 102 },
  { id: '4', type: 'call', name: 'Hot Scalati Follow-up', brand: 'scalati', recipients: 45, sent: '2024-01-12', status: 'in-progress', opens: 28 },
];

const upcomingCampaigns = [
  { id: '5', type: 'sms', name: 'Multi-Brand Weekend Push', brands: ['all'], scheduled: '2024-01-20', recipients: 420 },
  { id: '6', type: 'email', name: 'January Newsletter', brands: ['all'], scheduled: '2024-01-22', recipients: 650 },
];

export default function GrabbaClusterCommunications() {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState('overview');

  const handleRowClick = (campaignId: string) => {
    console.log('[GRABBA COMMS] Campaign clicked', campaignId);
    toast.info('Campaign detail view coming soon');
  };

  const handleNewCampaign = (type: string) => {
    console.log('[GRABBA COMMS] New campaign', type);
    navigate(`/grabba/communication?type=${type}`);
  };

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            Grabba Communications Hub
          </h1>
          <p className="text-muted-foreground mt-2">
            SMS, Email, and AI calls for GasMask, HotMama, Hot Scalati, and Grabba R Us only
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs">SMS Sent (MTD)</span>
              </div>
              <div className="text-2xl font-bold">2,847</div>
              <div className="text-xs text-muted-foreground">+12% vs last month</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <Mail className="h-4 w-4" />
                <span className="text-xs">Emails Sent</span>
              </div>
              <div className="text-2xl font-bold">1,234</div>
              <div className="text-xs text-muted-foreground">68% open rate</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Phone className="h-4 w-4" />
                <span className="text-xs">AI Calls Made</span>
              </div>
              <div className="text-2xl font-bold">189</div>
              <div className="text-xs text-muted-foreground">45 follow-ups needed</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <Users className="h-4 w-4" />
                <span className="text-xs">Total Contacts</span>
              </div>
              <div className="text-2xl font-bold">1,420</div>
              <div className="text-xs text-muted-foreground">Grabba brands only</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => handleNewCampaign('sms')} className="gap-2">
                <MessageSquare className="h-4 w-4" /> New SMS Blast
              </Button>
              <Button onClick={() => handleNewCampaign('email')} variant="outline" className="gap-2">
                <Mail className="h-4 w-4" /> New Email Campaign
              </Button>
              <Button onClick={() => handleNewCampaign('call')} variant="outline" className="gap-2">
                <Phone className="h-4 w-4" /> AI Call Campaign
              </Button>
              <Button onClick={() => navigate('/grabba/communication-logs')} variant="ghost" className="gap-2">
                <Bell className="h-4 w-4" /> View All Logs
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="overview">Recent Campaigns</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Campaigns</CardTitle>
                <CardDescription>Click a row to view details</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Opens</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCampaigns.map(campaign => {
                      const brandConfig = GRABBA_BRAND_CONFIG[campaign.brand as keyof typeof GRABBA_BRAND_CONFIG];
                      return (
                        <TableRow 
                          key={campaign.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleRowClick(campaign.id)}
                        >
                          <TableCell className="font-medium">{campaign.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {campaign.type === 'sms' && <MessageSquare className="h-3 w-3 mr-1" />}
                              {campaign.type === 'email' && <Mail className="h-3 w-3 mr-1" />}
                              {campaign.type === 'call' && <Phone className="h-3 w-3 mr-1" />}
                              {campaign.type.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge style={{ backgroundColor: brandConfig?.primary, color: 'white' }}>
                              {brandConfig?.name || campaign.brand}
                            </Badge>
                          </TableCell>
                          <TableCell>{campaign.recipients}</TableCell>
                          <TableCell>{campaign.sent}</TableCell>
                          <TableCell>
                            <Badge variant={campaign.status === 'completed' ? 'default' : 'secondary'}>
                              {campaign.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{campaign.opens}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduled">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingCampaigns.map(campaign => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{campaign.type.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {campaign.scheduled}
                          </div>
                        </TableCell>
                        <TableCell>{campaign.recipients}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">Edit</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Brand Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(GRABBA_BRAND_CONFIG).map(([key, config]) => (
                    <div 
                      key={key}
                      className="p-4 rounded-lg border cursor-pointer hover:bg-muted/50"
                      style={{ borderLeft: `4px solid ${config.primary}` }}
                      onClick={() => navigate(`/grabba/brand/${key}/communications`)}
                    >
                      <div className="text-sm font-medium">{config.name}</div>
                      <div className="text-2xl font-bold mt-2">{Math.floor(Math.random() * 500) + 200}</div>
                      <div className="text-xs text-muted-foreground">messages this month</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </GrabbaLayout>
  );
}
