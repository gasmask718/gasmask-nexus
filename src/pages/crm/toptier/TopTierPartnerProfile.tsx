/**
 * TopTier Partner Profile Page
 * Enterprise-grade account-style view with all tabs functional
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
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, Edit, ExternalLink, Phone, Mail, MapPin, 
  DollarSign, Percent, Calendar, FileText, Building2,
  User, Clock, Link2, CheckCircle, AlertCircle, Users,
  Megaphone, MessageSquare, File, Plus, Send, Download,
  PhoneCall, MessageCircle, Video, StickyNote, Filter,
  TrendingUp, CreditCard, Wallet, Eye, Upload, Tag, X
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
  const [interactionFilter, setInteractionFilter] = useState('all');
  
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

  // Simulated Commission Data
  const commissions = useMemo(() => {
    if (!partner) return [];
    return partnerBookings.map((booking: any, index: number) => ({
      id: `comm-${index}`,
      deal: booking.customer_name,
      dealId: booking.id,
      grossAmount: booking.total_amount || 0,
      commissionRate: partner.commission_rate || 10,
      commissionAmount: Math.round((booking.total_amount || 0) * (partner.commission_rate || 10) / 100),
      payoutStatus: index === 0 ? 'paid' : index === 1 ? 'pending' : 'scheduled',
      payoutDate: index === 0 ? format(new Date(Date.now() - 86400000 * 5), 'MMM d, yyyy') : null,
      eventDate: booking.event_date,
    }));
  }, [partner, partnerBookings]);

  // Commission totals
  const commissionTotals = useMemo(() => {
    const total = commissions.reduce((sum: number, c: any) => sum + c.commissionAmount, 0);
    const paid = commissions.filter((c: any) => c.payoutStatus === 'paid').reduce((sum: number, c: any) => sum + c.commissionAmount, 0);
    const pending = commissions.filter((c: any) => c.payoutStatus === 'pending').reduce((sum: number, c: any) => sum + c.commissionAmount, 0);
    return { total, paid, pending };
  }, [commissions]);

  // Simulated Interactions (enhanced)
  const interactions = useMemo(() => [
    { id: 1, type: 'call', direction: 'outbound', message: 'Discussed Q2 pricing updates and new package options', date: new Date(Date.now() - 86400000 * 2), user: 'Admin', duration: '12 min' },
    { id: 2, type: 'email', direction: 'outbound', message: 'Sent contract renewal notice with updated terms', date: new Date(Date.now() - 86400000 * 5), user: 'Admin' },
    { id: 3, type: 'text', direction: 'inbound', message: 'Partner confirmed availability for spring season bookings', date: new Date(Date.now() - 86400000 * 8), user: 'Partner' },
    { id: 4, type: 'meeting', direction: 'in-person', message: 'On-site visit to review facilities and services', date: new Date(Date.now() - 86400000 * 15), user: 'Admin', duration: '45 min' },
    { id: 5, type: 'call', direction: 'inbound', message: 'Partner inquired about commission structure changes', date: new Date(Date.now() - 86400000 * 20), user: 'Partner', duration: '8 min' },
    { id: 6, type: 'note', direction: null, message: 'Internal note: Partner has been very responsive, consider for featured promotion', date: new Date(Date.now() - 86400000 * 25), user: 'Admin' },
  ], []);

  const filteredInteractions = useMemo(() => {
    if (interactionFilter === 'all') return interactions;
    return interactions.filter(i => i.type === interactionFilter);
  }, [interactions, interactionFilter]);

  // Simulated Contacts
  const contacts = useMemo(() => [
    { id: 1, name: partner?.contact_name || 'Primary Contact', role: 'Owner', phone: partner?.phone || '', email: partner?.email || '', isPrimary: true },
    { id: 2, name: 'Operations Manager', role: 'Operations', phone: '555-555-0102', email: 'ops@partner.com', isPrimary: false },
    { id: 3, name: 'Booking Coordinator', role: 'Bookings', phone: '555-555-0103', email: 'bookings@partner.com', isPrimary: false },
  ], [partner]);

  // Simulated Notes
  const [notes, setNotes] = useState([
    { id: 1, content: 'Great partner to work with. Always responsive and professional.', date: new Date(Date.now() - 86400000 * 3), user: 'Admin' },
    { id: 2, content: 'Negotiated 2% higher commission for exclusive deals. Approved by management.', date: new Date(Date.now() - 86400000 * 15), user: 'Admin' },
    { id: 3, content: 'Partner prefers text communication over calls for quick updates.', date: new Date(Date.now() - 86400000 * 30), user: 'Admin' },
  ]);

  // Simulated Assets
  const assets = [
    { id: 1, name: 'Service Agreement 2024.pdf', type: 'contract', size: '2.4 MB', uploadDate: new Date(Date.now() - 86400000 * 30), tags: ['legal', 'active'] },
    { id: 2, name: 'Partner Media Kit.zip', type: 'media', size: '45 MB', uploadDate: new Date(Date.now() - 86400000 * 45), tags: ['marketing'] },
    { id: 3, name: 'Insurance Certificate.pdf', type: 'insurance', size: '1.1 MB', uploadDate: new Date(Date.now() - 86400000 * 60), tags: ['legal', 'insurance'] },
    { id: 4, name: 'Rate Card 2024.xlsx', type: 'document', size: '156 KB', uploadDate: new Date(Date.now() - 86400000 * 20), tags: ['pricing'] },
    { id: 5, name: 'Promo Photos.zip', type: 'media', size: '120 MB', uploadDate: new Date(Date.now() - 86400000 * 10), tags: ['marketing', 'photos'] },
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

  const getPayoutStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/10 text-green-500">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500">Pending</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500/10 text-blue-500">Scheduled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'call': return <PhoneCall className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'text': return <MessageCircle className="h-4 w-4" />;
      case 'meeting': return <Video className="h-4 w-4" />;
      case 'note': return <StickyNote className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    setNotes([
      { id: notes.length + 1, content: newNote, date: new Date(), user: 'Admin' },
      ...notes,
    ]);
    setNewNote('');
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
        <TabsList className="grid grid-cols-8 w-full max-w-4xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bookings">Deals</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="interactions">Interactions</TabsTrigger>
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

          {/* KPI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <p className="text-3xl font-bold text-green-600">${commissionTotals.total.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Commission</p>
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
              <div>
                <CardTitle className="text-lg">Deals / Bookings</CardTitle>
                <CardDescription>All bookings involving this partner</CardDescription>
              </div>
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
                      <TableHead>Deal Value</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnerBookings.map((booking: any) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.customer_name}</TableCell>
                        <TableCell>{booking.event_date}</TableCell>
                        <TableCell>${booking.total_amount?.toLocaleString()}</TableCell>
                        <TableCell className="text-green-600">
                          ${Math.round((booking.total_amount || 0) * (partner.commission_rate || 10) / 100).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{booking.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2" />
                  <p>No bookings yet</p>
                  <Button variant="outline" size="sm" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Booking
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Campaigns / Promos</CardTitle>
                <CardDescription>Marketing campaigns featuring this partner</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Link Campaign
              </Button>
            </CardHeader>
            <CardContent>
              {partnerCampaigns.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Influencers</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnerCampaigns.map((campaign: any) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>{campaign.promo_category}</TableCell>
                        <TableCell>{campaign.linked_influencers?.length || 0}</TableCell>
                        <TableCell className="text-sm">
                          {campaign.start_date} - {campaign.end_date}
                        </TableCell>
                        <TableCell>
                          <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                            {campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
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

        {/* Commissions Tab */}
        <TabsContent value="commissions" className="space-y-6 mt-6">
          {/* Commission Summary */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Lifetime Commission</p>
                    <p className="text-2xl font-bold text-green-600">${commissionTotals.total.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Payout</p>
                    <p className="text-2xl font-bold text-yellow-600">${commissionTotals.pending.toLocaleString()}</p>
                  </div>
                  <Wallet className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Paid Out</p>
                    <p className="text-2xl font-bold">${commissionTotals.paid.toLocaleString()}</p>
                  </div>
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Commission Ledger */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Commission Ledger</CardTitle>
                <CardDescription>Detailed breakdown of all commissions</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {commissions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deal</TableHead>
                      <TableHead>Event Date</TableHead>
                      <TableHead className="text-right">Gross Amount</TableHead>
                      <TableHead className="text-center">Rate</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Payout Status</TableHead>
                      <TableHead>Payout Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((comm: any) => (
                      <TableRow key={comm.id}>
                        <TableCell className="font-medium">{comm.deal}</TableCell>
                        <TableCell>{comm.eventDate}</TableCell>
                        <TableCell className="text-right">${comm.grossAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-center">{comm.commissionRate}%</TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          ${comm.commissionAmount.toLocaleString()}
                        </TableCell>
                        <TableCell>{getPayoutStatusBadge(comm.payoutStatus)}</TableCell>
                        <TableCell>{comm.payoutDate || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-8 w-8 mx-auto mb-2" />
                  <p>No commissions recorded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interactions Tab */}
        <TabsContent value="interactions" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Interaction History</CardTitle>
                <CardDescription>Communication timeline with this partner</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="flex gap-1">
                  {['all', 'call', 'email', 'text', 'meeting', 'note'].map((type) => (
                    <Button
                      key={type}
                      variant={interactionFilter === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setInteractionFilter(type)}
                    >
                      {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </Button>
                  ))}
                </div>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Log Interaction
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredInteractions.map((interaction) => (
                  <div key={interaction.id} className="flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/30 transition-colors">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      interaction.type === 'call' ? 'bg-blue-500/10 text-blue-500' :
                      interaction.type === 'email' ? 'bg-purple-500/10 text-purple-500' :
                      interaction.type === 'text' ? 'bg-green-500/10 text-green-500' :
                      interaction.type === 'meeting' ? 'bg-orange-500/10 text-orange-500' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {getInteractionIcon(interaction.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{interaction.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-xs text-muted-foreground">
                          {format(interaction.date, 'MMM d, yyyy h:mm a')}
                        </p>
                        <span className="text-xs text-muted-foreground">•</span>
                        <p className="text-xs text-muted-foreground">{interaction.user}</p>
                        {interaction.duration && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <p className="text-xs text-muted-foreground">{interaction.duration}</p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{interaction.type}</Badge>
                      {interaction.direction && (
                        <Badge variant="secondary" className="text-xs">{interaction.direction}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Contacts</CardTitle>
                <CardDescription>People associated with this partner</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                        contact.isPrimary ? 'bg-primary/10' : 'bg-muted'
                      }`}>
                        <User className={`h-6 w-6 ${contact.isPrimary ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{contact.name}</p>
                          {contact.isPrimary && (
                            <Badge className="bg-primary/10 text-primary">Primary</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{contact.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                          <Phone className="h-4 w-4" />
                          {contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                          <Mail className="h-4 w-4" />
                          {contact.email}
                        </a>
                      )}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
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
              <div>
                <CardTitle className="text-lg">Documents & Media</CardTitle>
                <CardDescription>Files associated with this partner</CardDescription>
              </div>
              <Button size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <File className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{asset.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{asset.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{asset.size}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {asset.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(asset.uploadDate, 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Internal Notes</CardTitle>
              <CardDescription>Private notes about this partner</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Textarea 
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1"
                    rows={3}
                  />
                  <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <Separator />
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div key={note.id} className="p-4 rounded-lg bg-muted/50 group">
                      <p className="text-sm">{note.content}</p>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-muted-foreground">
                          {format(note.date, 'MMM d, yyyy h:mm a')} • {note.user}
                        </p>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
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
