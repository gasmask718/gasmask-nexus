import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, MapPin, Users, DollarSign, Phone, Mail, Calendar, Star, ArrowLeft, Edit, Image, FileText, Clock } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';

const SIMULATED_HALL = {
  id: 'hall-001',
  name: 'Grand Ballroom NYC',
  state: 'New York',
  city: 'Manhattan',
  address: '123 Fifth Avenue, New York, NY 10001',
  capacity: 500,
  priceRange: '$5,000 - $15,000',
  venueType: 'indoor',
  rating: 4.8,
  partnerStatus: 'active',
  phone: '+1 (212) 555-0101',
  email: 'events@grandballroom.com',
  website: 'www.grandballroomnyc.com',
  contactPerson: 'Jennifer Adams',
  contactTitle: 'Events Director',
  commissionRate: 15,
  eventsHosted: 127,
  totalRevenue: 245000,
  description: 'Premier event venue in the heart of Manhattan. Features stunning crystal chandeliers, state-of-the-art sound system, and flexible floor plans for events of all sizes.',
  amenities: ['Full Bar', 'Catering Kitchen', 'Bridal Suite', 'Valet Parking', 'AV Equipment', 'Dance Floor'],
  availability: ['Weekdays', 'Weekends', 'Holidays'],
  notes: 'Excellent partnership. Always professional. Quick response times.',
  pastEvents: [
    { id: 'e1', name: 'Smith Wedding Reception', date: '2024-01-10', guests: 250, revenue: 8500 },
    { id: 'e2', name: 'Corporate Gala - Tech Inc', date: '2024-01-05', guests: 400, revenue: 12000 },
    { id: 'e3', name: 'Quinceañera - Garcia Family', date: '2023-12-20', guests: 150, revenue: 5500 },
  ]
};

export default function UnforgettableEventHallDetail() {
  const navigate = useNavigate();
  const { hallId } = useParams();
  const { simulationMode } = useSimulationMode();

  const hall = simulationMode ? SIMULATED_HALL : null;

  if (!hall) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">Venue Not Found</h3>
          <p className="text-muted-foreground mb-4">Enable Simulation Mode to see demo data</p>
          <Button onClick={() => navigate('/crm/unforgettable_times_usa/event-halls')}>Back to Venues</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/crm/unforgettable_times_usa/event-halls')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              {hall.name}
              {simulationMode && <SimulationBadge />}
            </h1>
            <p className="text-muted-foreground flex items-center gap-1">
              <MapPin className="h-4 w-4" />{hall.address}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Edit className="h-4 w-4 mr-2" />Edit</Button>
          <Button><Phone className="h-4 w-4 mr-2" />Call</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Capacity</p><p className="text-2xl font-bold">{hall.capacity}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Events Hosted</p><p className="text-2xl font-bold">{hall.eventsHosted}</p></CardContent></Card>
        <Card className="border-green-500/30"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold text-green-400">${hall.totalRevenue.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Commission Rate</p><p className="text-2xl font-bold">{hall.commissionRate}%</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="events">Past Events</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader><CardTitle>About</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground">{hall.description}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Amenities</CardTitle></CardHeader>
                <CardContent><div className="flex flex-wrap gap-2">{hall.amenities.map(a => <Badge key={a} variant="secondary">{a}</Badge>)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{hall.priceRange}</p><p className="text-sm text-muted-foreground">Per event rental</p></CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="events">
              <Card>
                <CardHeader><CardTitle>Past Events</CardTitle><CardDescription>Events hosted at this venue</CardDescription></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {hall.pastEvents.map(event => (
                      <div key={event.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{event.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-3 w-3" />{event.date}
                            <Users className="h-3 w-3 ml-2" />{event.guests} guests
                          </p>
                        </div>
                        <p className="font-medium text-green-400">${event.revenue.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="media">
              <Card><CardContent className="p-12 text-center">
                <Image className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium">No Media Yet</h3>
                <p className="text-muted-foreground mb-4">Upload photos and videos of this venue</p>
                <Button><Image className="h-4 w-4 mr-2" />Upload Media</Button>
              </CardContent></Card>
            </TabsContent>
            <TabsContent value="notes">
              <Card>
                <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground">{hall.notes}</p></CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><p className="text-sm text-muted-foreground">Primary Contact</p><p className="font-medium">{hall.contactPerson}</p><p className="text-sm text-muted-foreground">{hall.contactTitle}</p></div>
              <div><p className="text-sm text-muted-foreground">Phone</p><p className="font-medium">{hall.phone}</p></div>
              <div><p className="text-sm text-muted-foreground">Email</p><p className="font-medium">{hall.email}</p></div>
              <div><p className="text-sm text-muted-foreground">Website</p><p className="font-medium">{hall.website}</p></div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1"><Phone className="h-4 w-4 mr-1" />Call</Button>
                <Button variant="outline" className="flex-1"><Mail className="h-4 w-4 mr-1" />Email</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Partnership Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <Badge>{hall.partnerStatus}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Rating</span>
                <span className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-400" />{hall.rating}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Venue Type</span>
                <Badge variant="outline">{hall.venueType}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
