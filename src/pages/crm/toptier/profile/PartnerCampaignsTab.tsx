/**
 * Partner Campaigns Tab - Full page with campaign list and actions
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, Search, Eye, Edit, Link, Megaphone,
  Calendar, Users, TrendingUp, Target
} from 'lucide-react';
import { SimulationBadge, EmptyStateWithGuidance } from '@/contexts/SimulationModeContext';
import { format } from 'date-fns';

interface PartnerCampaignsTabProps {
  partner: any;
  isSimulated: boolean;
  campaigns: any[];
}

export default function PartnerCampaignsTab({ partner, isSimulated, campaigns }: PartnerCampaignsTabProps) {
  const navigate = useNavigate();
  const { partnerId } = useParams();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign: any) => {
      return !searchTerm || 
        campaign.campaign_name?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [campaigns, searchTerm]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-500">Active</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500/10 text-blue-500">Scheduled</Badge>;
      case 'completed':
        return <Badge className="bg-gray-500/10 text-gray-500">Completed</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500/10 text-yellow-500">Paused</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Summary stats
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'active').length;
  const totalLeads = campaigns.reduce((sum: number, c: any) => sum + (c.leads_generated || 0), 0);
  const totalBookings = campaigns.reduce((sum: number, c: any) => sum + (c.bookings_generated || 0), 0);

  const handleCreateCampaign = () => {
    navigate(`/crm/toptier-experience/campaigns/new?partnerId=${partnerId}`);
  };

  const handleLinkCampaign = () => {
    // Open campaign selector modal
    console.log('Link existing campaign');
  };

  const handleViewCampaign = (campaignId: string) => {
    navigate(`/crm/toptier-experience/campaigns/${campaignId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          Campaigns / Promos
          {isSimulated && <SimulationBadge />}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleLinkCampaign}>
            <Link className="h-4 w-4 mr-2" />
            Link Campaign
          </Button>
          <Button onClick={handleCreateCampaign}>
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Campaigns</p>
                <p className="text-2xl font-bold">{activeCampaigns}</p>
              </div>
              <Megaphone className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">{totalLeads}</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bookings Generated</p>
                <p className="text-2xl font-bold">{totalBookings}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search campaigns..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Campaigns Table */}
      {filteredCampaigns.length === 0 ? (
        <EmptyStateWithGuidance
          icon={Megaphone}
          title="No Campaigns Linked"
          description="Link an existing campaign or create a new one to track partner promotions."
          actionLabel="Create Campaign"
          onAction={handleCreateCampaign}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Influencer(s)</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign: any) => (
                  <TableRow 
                    key={campaign.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewCampaign(campaign.id)}
                  >
                    <TableCell className="font-medium">{campaign.campaign_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {campaign.promo_category || 'General'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {campaign.linked_influencers?.length || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      {campaign.start_date ? format(new Date(campaign.start_date), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      {campaign.end_date ? format(new Date(campaign.end_date), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">{campaign.leads_generated || 0}</TableCell>
                    <TableCell className="text-right">{campaign.bookings_generated || 0}</TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewCampaign(campaign.id); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
