import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Search, Eye, Plus, Phone, MessageSquare, Mail, UserPlus, Calendar, ExternalLink } from 'lucide-react';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { format, subDays, differenceInDays } from 'date-fns';

const TopTierNewCustomers = () => {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const generateNewCustomers = () => {
    const states = ['Florida', 'Texas', 'California', 'New York', 'Nevada', 'Arizona'];
    const firstNames = ['Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason'];
    const lastNames = ['Johnson', 'Williams', 'Smith', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson'];
    const sources = ['Website', 'Referral', 'Instagram', 'TikTok', 'Google Ads', 'Partner', 'Event'];
    const bookingStatuses = ['pending', 'confirmed', 'completed', 'none'];
    
    return Array.from({ length: 18 }, (_, i) => {
      const addedDaysAgo = Math.floor(Math.random() * 30);
      return {
        id: `new-${i + 1}`,
        name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
        email: `${firstNames[i % firstNames.length].toLowerCase()}.${lastNames[i % lastNames.length].toLowerCase()}@gmail.com`,
        phone: `+1 (${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        state: states[i % states.length],
        dateAdded: format(subDays(new Date(), addedDaysAgo), 'yyyy-MM-dd'),
        daysAgo: addedDaysAgo,
        source: sources[Math.floor(Math.random() * sources.length)],
        firstBookingStatus: bookingStatuses[Math.floor(Math.random() * bookingStatuses.length)] as 'pending' | 'confirmed' | 'completed' | 'none',
        bookings: Math.random() > 0.3 ? 1 : 0,
        sms_consent: Math.random() > 0.2,
        email_consent: Math.random() > 0.1,
      };
    }).sort((a, b) => a.daysAgo - b.daysAgo);
  };

  const customers = useMemo(() => simulationMode ? generateNewCustomers() : [], [simulationMode]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = stateFilter === 'all' || customer.state === stateFilter;
      const matchesSource = sourceFilter === 'all' || customer.source === sourceFilter;
      return matchesSearch && matchesState && matchesSource;
    });
  }, [customers, searchTerm, stateFilter, sourceFilter]);

  const states = [...new Set(customers.map(c => c.state))];
  const sources = [...new Set(customers.map(c => c.source))];

  const getBookingStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-500/10 text-green-500">Completed</Badge>;
      case 'confirmed': return <Badge className="bg-blue-500/10 text-blue-500">Confirmed</Badge>;
      case 'pending': return <Badge className="bg-yellow-500/10 text-yellow-500">Pending</Badge>;
      default: return <Badge variant="outline">No Booking</Badge>;
    }
  };

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
                <UserPlus className="h-6 w-6 text-green-500" />
                New Customers
              </h1>
              <p className="text-muted-foreground">Recently acquired customers (1 booking or added within 30 days)</p>
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

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search new customers..."
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
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {sources.map(source => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>New Customers ({filteredCustomers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>First Booking</TableHead>
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
                        <UserPlus className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-muted-foreground">{customer.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{customer.state}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p>{customer.dateAdded}</p>
                          <p className="text-xs text-muted-foreground">{customer.daysAgo} days ago</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{customer.source}</Badge>
                    </TableCell>
                    <TableCell>{getBookingStatusBadge(customer.firstBookingStatus)}</TableCell>
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

export default TopTierNewCustomers;
