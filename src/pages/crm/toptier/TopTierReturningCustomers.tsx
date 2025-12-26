import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Search, Eye, Plus, Phone, MessageSquare, Mail, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { format, subDays } from 'date-fns';

const TopTierReturningCustomers = () => {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [trendFilter, setTrendFilter] = useState('all');

  const generateReturningCustomers = () => {
    const states = ['Florida', 'Texas', 'California', 'New York', 'Nevada', 'Arizona'];
    const firstNames = ['James', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'Robert', 'Ashley'];
    const lastNames = ['Anderson', 'Thompson', 'Martinez', 'Garcia', 'Wilson', 'Taylor', 'Brown', 'Davis'];
    const trends = ['increasing', 'flat', 'decreasing'];
    
    return Array.from({ length: 20 }, (_, i) => ({
      id: `returning-${i + 1}`,
      name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
      email: `${firstNames[i % firstNames.length].toLowerCase()}.${lastNames[i % lastNames.length].toLowerCase()}@email.com`,
      phone: `+1 (${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      state: states[i % states.length],
      bookings: Math.floor(Math.random() * 3) + 2, // 2-4 bookings
      lifetimeValue: Math.floor(Math.random() * 25000) + 10000,
      lastBooking: format(subDays(new Date(), Math.floor(Math.random() * 60)), 'yyyy-MM-dd'),
      trend: trends[Math.floor(Math.random() * trends.length)] as 'increasing' | 'flat' | 'decreasing',
      nextBookingLikelihood: Math.floor(Math.random() * 40) + 50,
      sms_consent: Math.random() > 0.2,
      email_consent: Math.random() > 0.1,
    }));
  };

  const customers = useMemo(() => simulationMode ? generateReturningCustomers() : [], [simulationMode]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = stateFilter === 'all' || customer.state === stateFilter;
      const matchesTrend = trendFilter === 'all' || customer.trend === trendFilter;
      return matchesSearch && matchesState && matchesTrend;
    });
  }, [customers, searchTerm, stateFilter, trendFilter]);

  const states = [...new Set(customers.map(c => c.state))];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case 'increasing': return <Badge className="bg-green-500/10 text-green-500">Increasing</Badge>;
      case 'decreasing': return <Badge className="bg-red-500/10 text-red-500">Decreasing</Badge>;
      default: return <Badge className="bg-yellow-500/10 text-yellow-500">Flat</Badge>;
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
                <RefreshCw className="h-6 w-6 text-blue-500" />
                Returning Customers
              </h1>
              <p className="text-muted-foreground">Repeat clients with 2-4 completed bookings</p>
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
                  placeholder="Search returning customers..."
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
              <Select value={trendFilter} onValueChange={setTrendFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Trend" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trends</SelectItem>
                  <SelectItem value="increasing">Increasing</SelectItem>
                  <SelectItem value="flat">Flat</SelectItem>
                  <SelectItem value="decreasing">Decreasing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Returning Customers ({filteredCustomers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Lifetime Value</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead>Re-book Likelihood</TableHead>
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
                        {getTrendIcon(customer.trend)}
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
                    <TableCell className="font-semibold">
                      ${customer.lifetimeValue.toLocaleString()}
                    </TableCell>
                    <TableCell>{getTrendBadge(customer.trend)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ width: `${customer.nextBookingLikelihood}%` }}
                          />
                        </div>
                        <span className="text-sm">{customer.nextBookingLikelihood}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{customer.lastBooking}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" onClick={() => navigate(`/crm/toptier-experience/customers/${customer.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => navigate('/crm/toptier-experience/deals/new')}>
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" disabled={!customer.sms_consent}>
                          <Phone className="h-4 w-4" />
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

export default TopTierReturningCustomers;
