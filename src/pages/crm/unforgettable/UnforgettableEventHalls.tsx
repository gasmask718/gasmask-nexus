import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, MapPin, Users, DollarSign, Phone, Mail, Plus, Search, ArrowRight, Star, Calendar } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';

const US_STATES = ['All States', 'California', 'Florida', 'Georgia', 'Illinois', 'New York', 'Texas', 'Nevada', 'Arizona', 'Colorado', 'Washington'];

interface EventHall {
  id: string;
  name: string;
  state: string;
  city: string;
  capacity: number;
  priceRange: string;
  venueType: 'indoor' | 'outdoor' | 'both';
  rating: number;
  partnerStatus: 'active' | 'pending' | 'inactive';
  phone: string;
  email: string;
  imageUrl?: string;
  eventsHosted: number;
}

const SIMULATED_HALLS: EventHall[] = [
  { id: 'hall-001', name: 'Grand Ballroom NYC', state: 'New York', city: 'Manhattan', capacity: 500, priceRange: '$5,000 - $15,000', venueType: 'indoor', rating: 4.8, partnerStatus: 'active', phone: '+1 (212) 555-0101', email: 'events@grandballroom.com', eventsHosted: 127 },
  { id: 'hall-002', name: 'Sunset Gardens LA', state: 'California', city: 'Los Angeles', capacity: 300, priceRange: '$3,000 - $8,000', venueType: 'outdoor', rating: 4.6, partnerStatus: 'active', phone: '+1 (213) 555-0202', email: 'book@sunsetgardens.com', eventsHosted: 89 },
  { id: 'hall-003', name: 'Miami Beach Resort', state: 'Florida', city: 'Miami Beach', capacity: 400, priceRange: '$4,000 - $12,000', venueType: 'both', rating: 4.9, partnerStatus: 'active', phone: '+1 (305) 555-0303', email: 'events@miamibeachresort.com', eventsHosted: 156 },
  { id: 'hall-004', name: 'The Crystal Palace', state: 'Texas', city: 'Houston', capacity: 600, priceRange: '$6,000 - $18,000', venueType: 'indoor', rating: 4.7, partnerStatus: 'pending', phone: '+1 (713) 555-0404', email: 'info@crystalpalace.com', eventsHosted: 0 },
  { id: 'hall-005', name: 'Desert Oasis Venue', state: 'Arizona', city: 'Phoenix', capacity: 250, priceRange: '$2,500 - $6,000', venueType: 'outdoor', rating: 4.5, partnerStatus: 'active', phone: '+1 (602) 555-0505', email: 'events@desertoasis.com', eventsHosted: 45 },
  { id: 'hall-006', name: 'Atlanta Grand Hall', state: 'Georgia', city: 'Atlanta', capacity: 450, priceRange: '$4,500 - $10,000', venueType: 'indoor', rating: 4.4, partnerStatus: 'inactive', phone: '+1 (404) 555-0606', email: 'book@atlantagrand.com', eventsHosted: 23 },
  { id: 'hall-007', name: 'Vegas Convention Center', state: 'Nevada', city: 'Las Vegas', capacity: 1000, priceRange: '$10,000 - $50,000', venueType: 'indoor', rating: 4.9, partnerStatus: 'active', phone: '+1 (702) 555-0707', email: 'events@vegascc.com', eventsHosted: 312 },
  { id: 'hall-008', name: 'Chicago Lakeside', state: 'Illinois', city: 'Chicago', capacity: 350, priceRange: '$3,500 - $9,000', venueType: 'both', rating: 4.6, partnerStatus: 'active', phone: '+1 (312) 555-0808', email: 'info@chicagolakeside.com', eventsHosted: 78 },
];

export default function UnforgettableEventHalls() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { simulationMode } = useSimulationMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('All States');
  const [venueTypeFilter, setVenueTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const halls = simulationMode ? SIMULATED_HALLS : [];

  const filteredHalls = halls.filter(hall => {
    const matchesSearch = hall.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          hall.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesState = stateFilter === 'All States' || hall.state === stateFilter;
    const matchesType = venueTypeFilter === 'all' || hall.venueType === venueTypeFilter;
    const matchesStatus = statusFilter === 'all' || hall.partnerStatus === statusFilter;
    return matchesSearch && matchesState && matchesType && matchesStatus;
  });

  const stats = {
    total: halls.length,
    active: halls.filter(h => h.partnerStatus === 'active').length,
    pending: halls.filter(h => h.partnerStatus === 'pending').length,
    totalCapacity: halls.reduce((sum, h) => sum + h.capacity, 0)
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            Event Halls
            {simulationMode && <SimulationBadge />}
          </h1>
          <p className="text-muted-foreground">Nationwide venue partnerships</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/crm/unforgettable_times_usa')}>← Back to CRM</Button>
          <Button><Plus className="h-4 w-4 mr-2" />Add Venue</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex justify-between"><div><p className="text-sm text-muted-foreground">Total Venues</p><p className="text-2xl font-bold">{stats.total}</p></div><Building2 className="h-6 w-6 text-muted-foreground" /></div></CardContent></Card>
        <Card className="border-green-500/30"><CardContent className="p-4"><div className="flex justify-between"><div><p className="text-sm text-muted-foreground">Active Partners</p><p className="text-2xl font-bold text-green-400">{stats.active}</p></div><Star className="h-6 w-6 text-green-400" /></div></CardContent></Card>
        <Card className="border-yellow-500/30"><CardContent className="p-4"><div className="flex justify-between"><div><p className="text-sm text-muted-foreground">Pending</p><p className="text-2xl font-bold text-yellow-400">{stats.pending}</p></div><Calendar className="h-6 w-6 text-yellow-400" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex justify-between"><div><p className="text-sm text-muted-foreground">Total Capacity</p><p className="text-2xl font-bold">{stats.totalCapacity.toLocaleString()}</p></div><Users className="h-6 w-6 text-muted-foreground" /></div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search venues..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={venueTypeFilter} onValueChange={setVenueTypeFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="indoor">Indoor</SelectItem>
                <SelectItem value="outdoor">Outdoor</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredHalls.map(hall => (
          <Card key={hall.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate(`/crm/unforgettable_times_usa/event-halls/${hall.id}`)}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{hall.name}</CardTitle>
                <Badge variant={hall.partnerStatus === 'active' ? 'default' : hall.partnerStatus === 'pending' ? 'secondary' : 'outline'}>
                  {hall.partnerStatus}
                </Badge>
              </div>
              <CardDescription className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{hall.city}, {hall.state}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1"><Users className="h-3 w-3 text-muted-foreground" /><span>Capacity: {hall.capacity}</span></div>
                <div className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-400" /><span>{hall.rating}</span></div>
                <div className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-muted-foreground" /><span className="text-xs">{hall.priceRange}</span></div>
                <div><Badge variant="outline" className="text-xs">{hall.venueType}</Badge></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1"><Phone className="h-3 w-3 mr-1" />Call</Button>
                <Button variant="outline" size="sm" className="flex-1"><Mail className="h-3 w-3 mr-1" />Email</Button>
                <Button size="sm"><ArrowRight className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredHalls.length === 0 && (
        <Card><CardContent className="p-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No Venues Found</h3>
          <p className="text-muted-foreground">{simulationMode ? 'No venues match your filters' : 'Enable Simulation Mode to see demo data'}</p>
        </CardContent></Card>
      )}
    </div>
  );
}
