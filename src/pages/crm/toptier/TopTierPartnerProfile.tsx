/**
 * TopTier Partner Profile Page
 * Enterprise-grade account-style view with all tabs functional
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Edit, ExternalLink, MapPin, 
  Percent, Building2, Plus, MessageSquare, Upload,
  CheckCircle, AlertCircle, Clock
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import {
  PartnerOverviewTab,
  PartnerDealsTab,
  PartnerCampaignsTab,
  PartnerCommissionsTab,
  PartnerInteractionsTab,
  PartnerContactsTab,
  PartnerAssetsTab,
  PartnerNotesTab,
  PartnerMediaVaultTab
} from './profile';

export default function TopTierPartnerProfile() {
  const navigate = useNavigate();
  const { partnerId } = useParams<{ partnerId: string }>();
  const [activeTab, setActiveTab] = useState('overview');
  
  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  // Get data
  const simulatedPartners = getEntityData('partner');
  const simulatedBookings = getEntityData('booking');
  const simulatedCampaigns = getEntityData('promo_campaign');
  
  const { data: partners, isSimulated } = useResolvedData([], simulatedPartners);
  const { data: bookings } = useResolvedData([], simulatedBookings);
  const { data: campaigns } = useResolvedData([], simulatedCampaigns);

  // Find the partner
  const partner = useMemo(() => {
    return partners.find((p: any) => p.id === partnerId);
  }, [partners, partnerId]);

  // Get category info
  const categoryInfo = TOPTIER_PARTNER_CATEGORIES.find(c => c.value === partner?.partner_category);

  // Get related bookings
  const partnerBookings = useMemo(() => {
    return bookings.filter((b: any) => 
      b.linked_partners?.includes(partnerId) ||
      b.partner_categories?.includes(partner?.partner_category)
    );
  }, [bookings, partnerId, partner?.partner_category]);

  // Get related campaigns
  const partnerCampaigns = useMemo(() => {
    return campaigns.filter((c: any) => 
      c.linked_partners?.includes(partnerId) ||
      c.promo_category === partner?.partner_category
    );
  }, [campaigns, partnerId, partner?.partner_category]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'expired':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!partner) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Partner not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The partner you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/crm/toptier-experience/partners')}>
            View All Partners
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-fit"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{partner.company_name}</h1>
                {isSimulated && <SimulationBadge />}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{categoryInfo?.label}</Badge>
                {getStatusBadge(partner.contract_status)}
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {partner.city}, {partner.state}
                </span>
                <span className="flex items-center gap-1">
                  <Percent className="h-3 w-3" />
                  {partner.commission_rate}% commission
                </span>
              </div>
            </div>
          </div>
          
          {/* Header Actions */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partnerId}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Partner
            </Button>
            <Button variant="outline" onClick={() => navigate(`/crm/toptier-experience/deals/new?partnerId=${partnerId}`)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Deal
            </Button>
            <Button variant="outline" onClick={() => setActiveTab('interactions')}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Log Interaction
            </Button>
            <Button variant="outline" onClick={() => setActiveTab('assets')}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Asset
            </Button>
            {partner.booking_link && (
              <Button variant="outline" asChild>
                <a href={partner.booking_link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Booking Link
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-9 w-full max-w-5xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="media">Media Vault</TabsTrigger>
          <TabsTrigger value="interactions">Interactions</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <PartnerOverviewTab 
            partner={partner} 
            isSimulated={isSimulated} 
            bookings={partnerBookings}
            campaigns={partnerCampaigns}
          />
        </TabsContent>

        {/* Deals Tab */}
        <TabsContent value="deals" className="mt-6">
          <PartnerDealsTab 
            partner={partner} 
            isSimulated={isSimulated} 
            bookings={partnerBookings}
          />
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="mt-6">
          <PartnerCampaignsTab 
            partner={partner} 
            isSimulated={isSimulated} 
            campaigns={partnerCampaigns}
          />
        </TabsContent>

        {/* Commissions Tab */}
        <TabsContent value="commissions" className="mt-6">
          <PartnerCommissionsTab 
            partner={partner} 
            isSimulated={isSimulated} 
            bookings={partnerBookings}
          />
        </TabsContent>

        {/* Media Vault Tab */}
        <TabsContent value="media" className="mt-6">
          <PartnerMediaVaultTab 
            partner={partner} 
            isSimulated={isSimulated}
          />
        </TabsContent>

        {/* Interactions Tab */}
        <TabsContent value="interactions" className="mt-6">
          <PartnerInteractionsTab 
            partner={partner} 
            isSimulated={isSimulated}
          />
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="mt-6">
          <PartnerContactsTab 
            partner={partner} 
            isSimulated={isSimulated}
          />
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets" className="mt-6">
          <PartnerAssetsTab 
            partner={partner} 
            isSimulated={isSimulated}
          />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-6">
          <PartnerNotesTab 
            partner={partner} 
            isSimulated={isSimulated}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
