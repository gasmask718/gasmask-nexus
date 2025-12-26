/**
 * TopTier Customer Profile - Full customer profile with tabs
 */
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  ArrowLeft, Eye, Edit, Phone, Mail, MapPin, Calendar,
  DollarSign, Crown, TrendingUp, UserPlus, Building2,
  MessageSquare, FileText, Folder, Plus, Clock, CheckCircle
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { format } from 'date-fns';

// Generate simulated customer data
const generateCustomerData = (customerId: string) => {
  const names = [
    'Marcus Johnson', 'Sophia Williams', 'David Chen', 'Ashley Rodriguez',
    'Michael Davis', 'Jennifer Martinez', 'Christopher Brown', 'Amanda Taylor'
  ];
  const idx = parseInt(customerId.replace('cust_', ''), 10) - 1 || 0;
  const name = names[idx % names.length];
  
  const bookingCount = Math.floor(Math.random() * 8) + 2;
  const avgSpend = Math.floor(Math.random() * 15000) + 3000;
  const totalSpend = bookingCount * avgSpend;
  
  let customerType: 'new' | 'returning' | 'vip';
  if (bookingCount >= 5 || totalSpend >= 50000) {
    customerType = 'vip';
  } else if (bookingCount >= 2) {
    customerType = 'returning';
  } else {
    customerType = 'new';
  }

  return {
    id: customerId,
    name,
    email: `${name.toLowerCase().replace(' ', '.')}@email.com`,
    phone: '+1 305-555-0192',
    primary_state: 'FL',
    cities: ['Miami', 'Fort Lauderdale'],
    preferred_categories: ['exotic_rental_car_promo', 'yachts', 'club_lounge_package'],
    total_bookings: bookingCount,
    lifetime_spend: totalSpend,
    customer_type: customerType,
    last_booking_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Prefers luxury SUVs and yacht packages. Has expressed interest in helicopter tours.',
  };
};

// Generate simulated bookings for customer
const generateCustomerBookings = (customerId: string, count: number) => {
  const categories = ['exotic_rental_car_promo', 'yachts', 'club_lounge_package', 'helicopter_promo', 'private_chef_promo'];
  const statuses = ['completed', 'confirmed', 'pending'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `book_${customerId}_${i + 1}`,
    customer_id: customerId,
    partner_name: ['Luxury Rides Miami', 'Elite Yachts FL', 'VIP Nightclub Access', 'Sky Tours'][i % 4],
    partner_category: categories[i % categories.length],
    event_date: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString(),
    total_amount: Math.floor(Math.random() * 20000) + 3000,
    status: statuses[i % statuses.length],
    state: 'FL',
  }));
};

// Generate partners used by customer
const generatePartnersUsed = (customerId: string) => {
  return [
    { id: 'p1', company_name: 'Luxury Rides Miami', category: 'exotic_rental_car_promo', bookings: 3, total_spent: 25000 },
    { id: 'p2', company_name: 'Elite Yachts FL', category: 'yachts', bookings: 2, total_spent: 18000 },
    { id: 'p3', company_name: 'VIP Nightclub Access', category: 'club_lounge_package', bookings: 2, total_spent: 8000 },
    { id: 'p4', company_name: 'Sky Tours', category: 'helicopter_promo', bookings: 1, total_spent: 5500 },
  ];
};

// Generate interactions
const generateInteractions = (customerId: string) => {
  return [
    { id: 'int_1', type: 'call', direction: 'outbound', summary: 'Discussed upcoming yacht booking', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'int_2', type: 'text', direction: 'inbound', summary: 'Customer inquired about helicopter tour availability', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'int_3', type: 'email', direction: 'outbound', summary: 'Sent confirmation for exotic car rental', created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'int_4', type: 'call', direction: 'inbound', summary: 'Booking inquiry for VIP club package', created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
  ];
};

// Generate notes
const generateNotes = (customerId: string) => {
  return [
    { id: 'note_1', content: 'Customer prefers luxury SUVs over sports cars. Always requests tinted windows.', created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), created_by: 'Sales Rep' },
    { id: 'note_2', content: 'VIP status achieved. Offer 10% loyalty discount on next booking.', created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), created_by: 'Manager' },
    { id: 'note_3', content: 'Birthday: March 15. Consider sending personalized offer.', created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), created_by: 'CRM System' },
  ];
};

export default function TopTierCustomerProfile() {
  const navigate = useNavigate();
  const { customerId } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  
  const { simulationMode } = useSimulationMode();
  
  // Get customer data
  const customer = useMemo(() => generateCustomerData(customerId || 'cust_1'), [customerId]);
  const bookings = useMemo(() => generateCustomerBookings(customerId || 'cust_1', customer.total_bookings), [customerId, customer.total_bookings]);
  const partnersUsed = useMemo(() => generatePartnersUsed(customerId || 'cust_1'), [customerId]);
  const interactions = useMemo(() => generateInteractions(customerId || 'cust_1'), [customerId]);
  const notes = useMemo(() => generateNotes(customerId || 'cust_1'), [customerId]);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'vip':
        return <Badge className="bg-purple-500/10 text-purple-500 text-lg px-3 py-1"><Crown className="h-4 w-4 mr-1" />VIP</Badge>;
      case 'returning':
        return <Badge className="bg-blue-500/10 text-blue-500 text-lg px-3 py-1"><TrendingUp className="h-4 w-4 mr-1" />Returning</Badge>;
      case 'new':
        return <Badge className="bg-green-500/10 text-green-500 text-lg px-3 py-1"><UserPlus className="h-4 w-4 mr-1" />New</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getCategoryLabel = (value: string) => {
    return TOPTIER_PARTNER_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'text': return <MessageSquare className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-fit"
          onClick={() => navigate('/crm/toptier-experience/customers')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl bg-primary/10">
                {customer.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{customer.name}</h1>
                {getTypeBadge(customer.customer_type)}
                {simulationMode && <SimulationBadge />}
              </div>
              <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {customer.email}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {customer.phone}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/crm/toptier-experience/bookings/new?customer=${customerId}`)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Booking
            </Button>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit Customer
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
                <p className="text-2xl font-bold">{customer.total_bookings}</p>
              </div>
              <Calendar className="h-6 w-6 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lifetime Spend</p>
                <p className="text-2xl font-bold text-green-600">${customer.lifetime_spend.toLocaleString()}</p>
              </div>
              <DollarSign className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Booking</p>
                <p className="text-2xl font-bold">${Math.round(customer.lifetime_spend / customer.total_bookings).toLocaleString()}</p>
              </div>
              <TrendingUp className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Partners Used</p>
                <p className="text-2xl font-bold">{partnersUsed.length}</p>
              </div>
              <Building2 className="h-6 w-6 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Primary State</p>
                <p className="text-2xl font-bold">{customer.primary_state}</p>
              </div>
              <MapPin className="h-6 w-6 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="interactions">Interactions</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{customer.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Primary Location</p>
                    <p className="font-medium">{customer.cities?.join(', ')}, {customer.primary_state}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Preferred Categories</p>
                  <div className="flex flex-wrap gap-2">
                    {customer.preferred_categories?.map((cat: string) => (
                      <Badge key={cat} variant="secondary">
                        {getCategoryLabel(cat)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Customer Since</p>
                  <p className="font-medium">{format(new Date(customer.created_at), 'MMMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Last Booking</p>
                  <p className="font-medium">{format(new Date(customer.last_booking_date), 'MMMM d, yyyy')}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {customer.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Internal Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{customer.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings">
          <Card>
            <CardHeader>
              <CardTitle>Booking History</CardTitle>
              <CardDescription>All bookings made by this customer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Date</th>
                      <th className="text-left py-3 px-4 font-medium">Partner</th>
                      <th className="text-left py-3 px-4 font-medium">Category</th>
                      <th className="text-right py-3 px-4 font-medium">Amount</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking: any) => (
                      <tr key={booking.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          {format(new Date(booking.event_date), 'MMM d, yyyy')}
                        </td>
                        <td className="py-3 px-4 font-medium">{booking.partner_name}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{getCategoryLabel(booking.partner_category)}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          ${booking.total_amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={booking.status === 'completed' ? 'bg-green-500/10 text-green-500' : booking.status === 'confirmed' ? 'bg-blue-500/10 text-blue-500' : 'bg-yellow-500/10 text-yellow-500'}>
                            {booking.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/crm/toptier-experience/deals/${booking.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Partners Tab */}
        <TabsContent value="partners">
          <Card>
            <CardHeader>
              <CardTitle>Partners Used</CardTitle>
              <CardDescription>Partners this customer has booked with</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {partnersUsed.map((partner: any) => (
                  <div 
                    key={partner.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partner.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{partner.company_name}</p>
                        <Badge variant="outline" className="mt-1">{getCategoryLabel(partner.category)}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">${partner.total_spent.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">{partner.bookings} bookings</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interactions Tab */}
        <TabsContent value="interactions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Interaction History</CardTitle>
                <CardDescription>Calls, texts, and emails with this customer</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Log Interaction
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {interactions.map((interaction: any) => (
                    <div key={interaction.id} className="flex gap-4 p-4 border rounded-lg">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        interaction.type === 'call' ? 'bg-green-500/10 text-green-500' :
                        interaction.type === 'text' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-purple-500/10 text-purple-500'
                      }`}>
                        {getInteractionIcon(interaction.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{interaction.type}</Badge>
                          <Badge variant={interaction.direction === 'inbound' ? 'secondary' : 'outline'}>
                            {interaction.direction}
                          </Badge>
                          <span className="text-sm text-muted-foreground ml-auto">
                            {format(new Date(interaction.created_at), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                        <p className="mt-2">{interaction.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Internal Notes</CardTitle>
                <CardDescription>Notes and observations about this customer</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {notes.map((note: any) => (
                  <div key={note.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{note.created_by}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(note.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <p>{note.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Documents & Assets</CardTitle>
                <CardDescription>Contracts, receipts, and files</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No documents uploaded yet</p>
                <Button variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload First Document
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
