import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, MapPin, Phone, Mail, Plus, Search, ArrowRight, Star, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';

const US_STATES = ['All States', 'California', 'Florida', 'Georgia', 'Illinois', 'New York', 'Texas', 'Nevada', 'Arizona'];

interface RentalCompany {
  id: string;
  name: string;
  statesServed: string[];
  city: string;
  primaryState: string;
  inventoryTypes: string[];
  priceRange: string;
  rating: number;
  partnerStatus: 'active' | 'pending' | 'inactive';
  phone: string;
  email: string;
  ordersCompleted: number;
}

const SIMULATED_RENTALS: RentalCompany[] = [
  { id: 'rental-001', name: 'Elite Party Rentals', statesServed: ['Florida', 'Georgia'], city: 'Miami', primaryState: 'Florida', inventoryTypes: ['Chairs', 'Tables', 'Linens', 'Decor'], priceRange: '$500 - $5,000', rating: 4.8, partnerStatus: 'active', phone: '+1 (305) 555-0101', email: 'orders@eliteparty.com', ordersCompleted: 234 },
  { id: 'rental-002', name: 'Premium Tents & More', statesServed: ['Arizona', 'Nevada', 'California'], city: 'Phoenix', primaryState: 'Arizona', inventoryTypes: ['Tents', 'Canopies', 'Lighting'], priceRange: '$1,000 - $10,000', rating: 4.6, partnerStatus: 'active', phone: '+1 (602) 555-0202', email: 'info@premiumtents.com', ordersCompleted: 156 },
  { id: 'rental-003', name: 'NYC Event Equipment', statesServed: ['New York', 'New Jersey', 'Connecticut'], city: 'Brooklyn', primaryState: 'New York', inventoryTypes: ['AV Equipment', 'Staging', 'Lighting', 'Sound'], priceRange: '$2,000 - $15,000', rating: 4.9, partnerStatus: 'active', phone: '+1 (718) 555-0303', email: 'rentals@nycevent.com', ordersCompleted: 312 },
  { id: 'rental-004', name: 'Texas Party Supply Co', statesServed: ['Texas', 'Oklahoma', 'Louisiana'], city: 'Houston', primaryState: 'Texas', inventoryTypes: ['Chairs', 'Tables', 'Bounce Houses', 'Games'], priceRange: '$300 - $3,000', rating: 4.5, partnerStatus: 'pending', phone: '+1 (713) 555-0404', email: 'sales@texasparty.com', ordersCompleted: 0 },
  { id: 'rental-005', name: 'LA Luxury Linens', statesServed: ['California'], city: 'Los Angeles', primaryState: 'California', inventoryTypes: ['Linens', 'Chair Covers', 'Table Runners', 'Napkins'], priceRange: '$200 - $2,000', rating: 4.7, partnerStatus: 'active', phone: '+1 (213) 555-0505', email: 'orders@laluxury.com', ordersCompleted: 189 },
  { id: 'rental-006', name: 'Chicago Event Pros', statesServed: ['Illinois', 'Indiana', 'Wisconsin'], city: 'Chicago', primaryState: 'Illinois', inventoryTypes: ['Full Event Setup', 'Decor', 'Furniture'], priceRange: '$1,500 - $8,000', rating: 4.4, partnerStatus: 'active', phone: '+1 (312) 555-0606', email: 'info@chicagoevent.com', ordersCompleted: 98 },
];

export default function UnforgettableRentals() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('All States');
  const [statusFilter, setStatusFilter] = useState('all');

  const rentals = simulationMode ? SIMULATED_RENTALS : [];

  const filteredRentals = rentals.filter(rental => {
    const matchesSearch = rental.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesState = stateFilter === 'All States' || rental.statesServed.includes(stateFilter);
    const matchesStatus = statusFilter === 'all' || rental.partnerStatus === statusFilter;
    return matchesSearch && matchesState && matchesStatus;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Truck className="h-8 w-8 text-primary" />
            Rental Companies
            {simulationMode && <SimulationBadge />}
          </h1>
          <p className="text-muted-foreground">Chairs, tables, decor, equipment partners</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/crm/unforgettable_times_usa')}>← Back to CRM</Button>
          <Button><Plus className="h-4 w-4 mr-2" />Add Company</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search companies..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
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
        {filteredRentals.map(rental => (
          <Card key={rental.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate(`/crm/unforgettable_times_usa/rentals/${rental.id}`)}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{rental.name}</CardTitle>
                <Badge variant={rental.partnerStatus === 'active' ? 'default' : 'secondary'}>{rental.partnerStatus}</Badge>
              </div>
              <CardDescription className="flex items-center gap-1"><MapPin className="h-3 w-3" />{rental.city}, {rental.primaryState}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {rental.inventoryTypes.slice(0, 3).map(type => <Badge key={type} variant="outline" className="text-xs">{type}</Badge>)}
                {rental.inventoryTypes.length > 3 && <Badge variant="outline" className="text-xs">+{rental.inventoryTypes.length - 3}</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-400" />{rental.rating}</div>
                <div className="flex items-center gap-1"><Package className="h-3 w-3" />{rental.ordersCompleted} orders</div>
              </div>
              <p className="text-sm text-muted-foreground">States: {rental.statesServed.join(', ')}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1"><Phone className="h-3 w-3 mr-1" />Call</Button>
                <Button variant="outline" size="sm" className="flex-1"><Mail className="h-3 w-3 mr-1" />Email</Button>
                <Button size="sm"><ArrowRight className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRentals.length === 0 && (
        <Card><CardContent className="p-12 text-center">
          <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No Companies Found</h3>
          <p className="text-muted-foreground">{simulationMode ? 'No companies match your filters' : 'Enable Simulation Mode to see demo data'}</p>
        </CardContent></Card>
      )}
    </div>
  );
}
