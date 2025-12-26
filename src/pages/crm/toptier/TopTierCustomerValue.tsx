import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Search, Eye, Phone, Mail, DollarSign, Crown, TrendingUp, BarChart3 } from 'lucide-react';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { format, subDays } from 'date-fns';

const TopTierCustomerValue = () => {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [vipFilter, setVipFilter] = useState('all');

  const generateCustomerValue = () => {
    const states = ['Florida', 'Texas', 'California', 'New York', 'Nevada', 'Arizona'];
    const firstNames = ['Alexander', 'Victoria', 'Sebastian', 'Isabella', 'Maximilian', 'Arabella', 'Theodore', 'Evangeline', 'James', 'Sarah'];
    const lastNames = ['Worthington', 'Vanderbilt', 'Montgomery', 'Ashworth', 'Kensington', 'Sterling', 'Blackwood', 'Harrington', 'Anderson', 'Thompson'];
    
    return Array.from({ length: 20 }, (_, i) => {
      const lifetimeValue = Math.floor(Math.random() * 200000) + 5000;
      const bookingCount = Math.floor(Math.random() * 15) + 1;
      const isVIP = lifetimeValue > 50000 || bookingCount >= 5;
      
      return {
        id: `customer-${i + 1}`,
        name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
        email: `${firstNames[i % firstNames.length].toLowerCase()}@luxurymail.com`,
        phone: `+1 (${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        state: states[i % states.length],
        lifetimeValue,
        avgBookingValue: Math.round(lifetimeValue / bookingCount),
        bookingCount,
        isVIP,
        lastBooking: format(subDays(new Date(), Math.floor(Math.random() * 90)), 'yyyy-MM-dd'),
        sms_consent: Math.random() > 0.2,
        email_consent: Math.random() > 0.1,
      };
    }).sort((a, b) => b.lifetimeValue - a.lifetimeValue);
  };

  const customers = useMemo(() => simulationMode ? generateCustomerValue() : [], [simulationMode]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = stateFilter === 'all' || customer.state === stateFilter;
      const matchesVIP = vipFilter === 'all' || 
        (vipFilter === 'vip' && customer.isVIP) ||
        (vipFilter === 'regular' && !customer.isVIP);
      return matchesSearch && matchesState && matchesVIP;
    });
  }, [customers, searchTerm, stateFilter, vipFilter]);

  const states = [...new Set(customers.map(c => c.state))];

  const stats = useMemo(() => ({
    totalValue: customers.reduce((sum, c) => sum + c.lifetimeValue, 0),
    avgValue: customers.length > 0 ? Math.round(customers.reduce((sum, c) => sum + c.lifetimeValue, 0) / customers.length) : 0,
    topCustomerValue: customers[0]?.lifetimeValue || 0,
  }), [customers]);

  // Top 10 for chart
  const top10 = customers.slice(0, 10);

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
                <DollarSign className="h-6 w-6 text-green-500" />
                Customer Lifetime Value
              </h1>
              <p className="text-muted-foreground">Revenue by customer sorted by value</p>
            </div>
          </div>
        </div>

        {simulationMode && (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
            Simulation Mode - Demo Data
          </Badge>
        )}

        {/* Stats Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Customer Value</p>
                  <p className="text-2xl font-bold">${stats.totalValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg Customer Value</p>
                  <p className="text-2xl font-bold">${stats.avgValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Top Customer Value</p>
                  <p className="text-2xl font-bold">${stats.topCustomerValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top 10 Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top 10 Customers by Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {top10.map((customer, index) => (
                <div key={customer.id} className="flex items-center gap-4">
                  <span className="w-6 text-center font-bold text-muted-foreground">#{index + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium flex items-center gap-2">
                        {customer.name}
                        {customer.isVIP && <Crown className="h-4 w-4 text-yellow-500" />}
                      </span>
                      <span className="font-bold text-green-600">${customer.lifetimeValue.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
                        style={{ width: `${(customer.lifetimeValue / stats.topCustomerValue) * 100}%` }}
                      />
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => navigate(`/crm/toptier-experience/customers/${customer.id}`)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
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
              <Select value={vipFilter} onValueChange={setVipFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="VIP Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="vip">VIP Only</SelectItem>
                  <SelectItem value="regular">Regular Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Full Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Customers by Value ({filteredCustomers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Total Spend</TableHead>
                  <TableHead>Avg Booking</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>VIP Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer, index) => (
                  <TableRow 
                    key={customer.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/crm/toptier-experience/customers/${customer.id}`)}
                  >
                    <TableCell className="font-bold text-muted-foreground">#{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {customer.isVIP && <Crown className="h-4 w-4 text-yellow-500" />}
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-muted-foreground">{customer.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{customer.state}</TableCell>
                    <TableCell className="font-semibold text-green-600">
                      ${customer.lifetimeValue.toLocaleString()}
                    </TableCell>
                    <TableCell>${customer.avgBookingValue.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{customer.bookingCount}</Badge>
                    </TableCell>
                    <TableCell>
                      {customer.isVIP ? (
                        <Badge className="bg-yellow-500/10 text-yellow-600">VIP</Badge>
                      ) : (
                        <Badge variant="outline">Regular</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" onClick={() => navigate(`/crm/toptier-experience/customers/${customer.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => navigate(`/crm/toptier-experience/customers/${customer.id}/bookings`)}>
                          <BarChart3 className="h-4 w-4" />
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

export default TopTierCustomerValue;
