/**
 * TopTier Campaign Detail Page
 * Full view of a promo campaign with all related data
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, Edit, Calendar, DollarSign, Building2, 
  Users, Megaphone, TrendingUp, CheckCircle, Clock, 
  AlertCircle, Eye, Link2
} from 'lucide-react';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { format } from 'date-fns';

export default function TopTierCampaignDetail() {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();
  
  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  const simulatedCampaigns = getEntityData('promo_campaign');
  const simulatedPartners = getEntityData('partner');
  const { data: campaigns, isSimulated } = useResolvedData([], simulatedCampaigns);
  const { data: partners } = useResolvedData([], simulatedPartners);

  const campaign = useMemo(() => {
    return campaigns.find((c: any) => c.id === campaignId);
  }, [campaigns, campaignId]);

  const linkedPartners = useMemo(() => {
    if (!campaign?.linked_partners) return [];
    return partners.filter((p: any) => campaign.linked_partners.includes(p.id));
  }, [campaign, partners]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500/10 text-blue-500"><Calendar className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-500/10 text-yellow-500"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
      case 'ended':
        return <Badge className="bg-gray-500/10 text-gray-500"><AlertCircle className="h-3 w-3 mr-1" />Ended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!campaign) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="p-8 text-center">
          <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Campaign not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The campaign you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/crm/toptier-experience/partners')}>
            View Partners
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
              <Megaphone className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{campaign.campaign_name}</h1>
                {isSimulated && <SimulationBadge />}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(campaign.status)}
                <Badge variant="outline">{campaign.promo_category?.replace(/_/g, ' ')}</Badge>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/crm/toptier-experience/campaigns/${campaignId}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Campaign
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold">${(campaign.budget || 0).toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversions</p>
                <p className="text-2xl font-bold">{campaign.conversions || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Linked Partners</p>
                <p className="text-2xl font-bold">{linkedPartners.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Influencers</p>
                <p className="text-2xl font-bold">{campaign.linked_influencers?.length || 0}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Campaign Details */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-medium">
                  {campaign.start_date ? format(new Date(campaign.start_date), 'MMM d, yyyy') : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">End Date</p>
                <p className="font-medium">
                  {campaign.end_date ? format(new Date(campaign.end_date), 'MMM d, yyyy') : 'Ongoing'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Budget Spent</p>
              <Progress value={((campaign.spent || 0) / (campaign.budget || 1)) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                ${(campaign.spent || 0).toLocaleString()} of ${(campaign.budget || 0).toLocaleString()}
              </p>
            </div>
            {campaign.tracking_link && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tracking Link</p>
                <a 
                  href={campaign.tracking_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 text-sm"
                >
                  <Link2 className="h-3 w-3" />
                  {campaign.tracking_link}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Linked Partners */}
        <Card>
          <CardHeader>
            <CardTitle>Linked Partners</CardTitle>
          </CardHeader>
          <CardContent>
            {linkedPartners.length === 0 ? (
              <p className="text-muted-foreground text-sm">No partners linked to this campaign.</p>
            ) : (
              <div className="space-y-3">
                {linkedPartners.map((partner: any) => (
                  <div 
                    key={partner.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partner.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{partner.company_name}</p>
                        <p className="text-sm text-muted-foreground">{partner.city}, {partner.state}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle>Description & Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{campaign.description || 'No description provided.'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
