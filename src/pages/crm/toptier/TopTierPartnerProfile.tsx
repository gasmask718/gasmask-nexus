/**
 * TopTier Partner Profile Page
 * Full partner details with tabbed interface
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, Edit, ExternalLink, Phone, Mail, MapPin, 
  DollarSign, Percent, Calendar, FileText, Building2,
  User, Clock, Link2, CheckCircle, AlertCircle, Users,
  Megaphone, MessageSquare, File, Plus, Send
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { format } from 'date-fns';

export default function TopTierPartnerProfile() {
  const navigate = useNavigate();
  const { partnerId } = useParams<{ partnerId: string }>();
  const [activeTab, setActiveTab] = useState('overview');
  const [newNote, setNewNote] = useState('');
  
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

  // Mock interactions for demo
  const interactions = [
    { id: 1, type: 'call', message: 'Discussed Q2 pricing updates', date: new Date(Date.now() - 86400000 * 2), user: 'Admin' },
    { id: 2, type: 'email', message: 'Sent contract renewal notice', date: new Date(Date.now() - 86400000 * 5), user: 'Admin' },
    { id: 3, type: 'note', message: 'Partner confirmed availability for spring season', date: new Date(Date.now() - 86400000 * 10), user: 'Admin' },
  ];

  // Mock notes
  const notes = [
    { id: 1, content: 'Great partner to work with. Always responsive.', date: new Date(Date.now() - 86400000 * 3), user: 'Admin' },
    { id: 2, content: 'Negotiated 2% higher commission for exclusive deals.', date: new Date(Date.now() - 86400000 * 15), user: 'Admin' },
  ];

  // Mock assets
  const assets = [
    { id: 1, name: 'Service Agreement 2024.pdf', type: 'contract', uploadDate: new Date(Date.now() - 86400000 * 30) },
    { id: 2, name: 'Partner Media Kit.zip', type: 'media', uploadDate: new Date(Date.now() - 86400000 * 45) },
  ];

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

  const getStateName = (code: string) => {
    return US_STATES.find(s => s.value === code)?.label || code;
  };

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
          
          <div className="flex gap-2">
            {partner.booking_link && (
              <Button variant="outline" asChild>
                <a href={partner.booking_link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Booking Link
                </a>
              </Button>
            )}
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bookings">Deals</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Partner Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Partner Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium">{categoryInfo?.label}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contract Status</p>
                    <div className="mt-1">{getStatusBadge(partner.contract_status)}</div>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Service Area</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{getStateName(partner.state)} (Primary)</Badge>
                    {partner.service_area?.filter((s: string) => s !== partner.state).map((state: string) => (
                      <Badge key={state} variant="outline">{getStateName(state)}</Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">City</p>
                    <p className="font-medium">{partner.city}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Availability</p>
                    <p className="font-medium text-sm">{partner.availability_rules || 'Not specified'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing & Commission */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pricing & Commission</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm text-muted-foreground">Pricing Range</p>
                    <p className="text-xl font-bold">{partner.pricing_range || 'Not set'}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10">
                  <div>
                    <p className="text-sm text-muted-foreground">Commission Rate</p>
                    <p className="text-xl font-bold text-green-600">{partner.commission_rate}%</p>
                  </div>
                  <Percent className="h-8 w-8 text-green-500" />
                </div>
                {partner.booking_link && (
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground mb-2">Booking / Affiliate Link</p>
                    <a 
                      href={partner.booking_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <Link2 className="h-3 w-3" />
                      {partner.booking_link}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Primary Contact</p>
                    <p className="font-medium">{partner.contact_name || 'Not specified'}</p>
                  </div>
                </div>
                {partner.phone && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <a href={`tel:${partner.phone}`} className="font-medium text-primary hover:underline">
                        {partner.phone}
                      </a>
                    </div>
                  </div>
                )}
                {partner.email && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <a href={`mailto:${partner.email}`} className="font-medium text-primary hover:underline">
                        {partner.email}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{partnerBookings.length}</p>
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{partnerCampaigns.length}</p>
                  <p className="text-sm text-muted-foreground">Campaigns</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{partner.service_area?.length || 1}</p>
                  <p className="text-sm text-muted-foreground">States Covered</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Deals / Bookings</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Booking
              </Button>
            </CardHeader>
            <CardContent>
              {partnerBookings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Event Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnerBookings.map((booking: any) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.customer_name}</TableCell>
                        <TableCell>{booking.event_date}</TableCell>
                        <TableCell>${booking.total_amount?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{booking.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2" />
                  <p>No bookings yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Campaigns / Promos</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
            </CardHeader>
            <CardContent>
              {partnerCampaigns.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dates</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnerCampaigns.map((campaign: any) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>{campaign.promo_category}</TableCell>
                        <TableCell>
                          <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                            {campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {campaign.start_date} - {campaign.end_date}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Megaphone className="h-8 w-8 mx-auto mb-2" />
                  <p>No campaigns yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Communication Log</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Log Interaction
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {interactions.map((interaction) => (
                  <div key={interaction.id} className="flex items-start gap-3 p-3 rounded-lg border">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{interaction.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(interaction.date, 'MMM d, yyyy')} • {interaction.user}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">{interaction.type}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Documents & Media</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {assets.map((asset) => (
                  <div key={asset.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <File className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded {format(asset.uploadDate, 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">{asset.type}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Textarea 
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1"
                  />
                  <Button disabled={!newNote.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <Separator />
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div key={note.id} className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm">{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(note.date, 'MMM d, yyyy')} • {note.user}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
