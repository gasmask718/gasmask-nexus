import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Search, Eye, Plus, Phone, MessageSquare, Mail, Crown, TrendingUp } from 'lucide-react';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { format, subDays } from 'date-fns';

const TopTierVIPCustomers = () => {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');

  const generateVIPCustomers = () => {
    const states = ['Florida', 'Texas', 'California', 'New York', 'Nevada', 'Arizona'];
    const firstNames = ['Alexander', 'Victoria', 'Sebastian', 'Isabella', 'Maximilian', 'Arabella', 'Theodore', 'Evangeline'];
    const lastNames = ['Worthington', 'Vanderbilt', 'Montgomery', 'Ashworth', 'Kensington', 'Sterling', 'Blackwood', 'Harrington'];
    
    return Array.from({ length: 15 }, (_, i) => ({
      id: `vip-${i + 1}`,
      name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
      email: `${firstNames[i % firstNames.length].toLowerCase()}@luxurymail.com`,
      phone: `+1 (${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      state: states[i % states.length],
      bookings: Math.floor(Math.random() * 20) + 5,
      lifetimeValue: Math.floor(Math.random() * 150000) + 50000,
      avgBookingValue: Math.floor(Math.random() * 15000) + 5000,
      lastBooking: format(subDays(new Date(), Math.floor(Math.random() * 30)), 'yyyy-MM-dd'),
      memberSince: format(subDays(new Date(), Math.floor(Math.random() * 730) + 365), 'yyyy-MM-dd'),
      sms_consent: Math.random() > 0.2,
      email_consent: Math.random() > 0.1,
    })).sort((a, b) => b.lifetimeValue - a.lifetimeValue);
  };

  const customers = useMemo(() => simulationMode ? generateVIPCustomers() : [], [simulationMode]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = stateFilter === 'all' || customer.state === stateFilter;
      return matchesSearch && matchesState;
    });
  }, [customers, searchTerm, stateFilter]);

  const stats = useMemo(() => ({
    totalVIPs: customers.length,
    avgSpend: customers.length > 0 ? Math.round(customers.reduce((sum, c) => sum + c.lifetimeValue, 0) / customers.length) : 0,
    avgBookings: customers.length > 0 ? Math.round(customers.reduce((sum, c) => sum + c.bookings, 0) / customers.length) : 0,
    totalRevenue: customers.reduce((sum, c) => sum + c.lifetimeValue, 0),
  }), [customers]);

  const states = [...new Set(customers.map(c => c.state))];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/crm/toptier-experience/customers')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Crown className="h-6 w-6 text-yellow-500" />
                VIP Customers
              </h1>
              <p className="text-muted-foreground">High-value clients with 5+ bookings or premium lifetime value</p>
            </div>
          </div>
          <Button onClick={() => navigate('/crm/toptier-experience/customers/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>

        {simulationMode && (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
            Simulation Mode - Demo Data
          </Badge>
        )}

        {/* VIP Stats Strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total VIPs</p>
                  <p className="text-2xl font-bold">{stats.totalVIPs}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg Spend per VIP</p>
                  <p className="text-2xl font-bold">${stats.avgSpend.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-muted-foreground">Avg Bookings per VIP</p>
                <p className="text-2xl font-bold">{stats.avgBookings}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-muted-foreground">Total VIP Revenue</p>
                <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search VIP customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {states.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>VIP Customer List ({filteredCustomers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Lifetime Value</TableHead>
                  <TableHead>Avg Booking</TableHead>
                  <TableHead>Last Booking</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow 
                    key={customer.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/crm/toptier-experience/customers/${customer.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-yellow-500" />
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-muted-foreground">{customer.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{customer.state}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{customer.bookings}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-green-600">
                      ${customer.lifetimeValue.toLocaleString()}
                    </TableCell>
                    <TableCell>${customer.avgBookingValue.toLocaleString()}</TableCell>
                    <TableCell>{customer.lastBooking}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" onClick={() => navigate(`/crm/toptier-experience/customers/${customer.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" disabled={!customer.sms_consent}>
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" disabled={!customer.sms_consent}>
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" disabled={!customer.email_consent}>
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TopTierVIPCustomers;
