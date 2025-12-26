import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Search, Eye, Plus, Calendar, ChevronDown, ChevronRight, DollarSign } from 'lucide-react';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { format, subDays } from 'date-fns';

const TopTierCustomerBookings = () => {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  const categories = ['Yacht Charter', 'Helicopter Tour', 'Exotic Car Rental', 'Private Chef', 'VIP Club Access', 'Luxury Villa'];

  const generateCustomerBookings = () => {
    const states = ['Florida', 'Texas', 'California', 'New York', 'Nevada', 'Arizona'];
    const firstNames = ['Alexander', 'Victoria', 'James', 'Emily', 'Michael', 'Sarah', 'David', 'Jessica'];
    const lastNames = ['Worthington', 'Sterling', 'Anderson', 'Thompson', 'Martinez', 'Garcia', 'Wilson', 'Taylor'];
    
    return Array.from({ length: 15 }, (_, i) => {
      const bookingCount = Math.floor(Math.random() * 8) + 1;
      const bookings = Array.from({ length: bookingCount }, (_, j) => ({
        id: `booking-${i}-${j}`,
        date: format(subDays(new Date(), Math.floor(Math.random() * 180)), 'yyyy-MM-dd'),
        category: categories[Math.floor(Math.random() * categories.length)],
        amount: Math.floor(Math.random() * 15000) + 2000,
        status: ['completed', 'confirmed', 'pending'][Math.floor(Math.random() * 3)] as 'completed' | 'confirmed' | 'pending',
      }));
      
      return {
        id: `customer-${i + 1}`,
        name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
        email: `${firstNames[i % firstNames.length].toLowerCase()}@email.com`,
        state: states[i % states.length],
        bookingCount,
        totalSpend: bookings.reduce((sum, b) => sum + b.amount, 0),
        lastBookingDate: bookings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date || '',
        primaryCategory: bookings.length > 0 ? 
          bookings.reduce((acc, b) => {
            acc[b.category] = (acc[b.category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>) : {},
        bookings,
      };
    }).sort((a, b) => b.bookingCount - a.bookingCount);
  };

  const customers = useMemo(() => simulationMode ? generateCustomerBookings() : [], [simulationMode]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = stateFilter === 'all' || customer.state === stateFilter;
      const matchesCategory = categoryFilter === 'all' || 
        customer.bookings.some(b => b.category === categoryFilter);
      return matchesSearch && matchesState && matchesCategory;
    });
  }, [customers, searchTerm, stateFilter, categoryFilter]);

  const states = [...new Set(customers.map(c => c.state))];

  const toggleExpanded = (customerId: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId);
    } else {
      newExpanded.add(customerId);
    }
    setExpandedCustomers(newExpanded);
  };

  const getPrimaryCategory = (categoryMap: Record<string, number>) => {
    const entries = Object.entries(categoryMap);
    if (entries.length === 0) return 'N/A';
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-500/10 text-green-500">Completed</Badge>;
      case 'confirmed': return <Badge className="bg-blue-500/10 text-blue-500">Confirmed</Badge>;
      default: return <Badge className="bg-yellow-500/10 text-yellow-500">Pending</Badge>;
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
                <Calendar className="h-6 w-6 text-primary" />
                Customer Bookings
              </h1>
              <p className="text-muted-foreground">All bookings grouped by customer</p>
            </div>
          </div>
          <Button onClick={() => navigate('/crm/toptier-experience/deals/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Booking
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
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table with Expandable Rows */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Booking History ({filteredCustomers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredCustomers.map((customer) => (
                <Collapsible key={customer.id} open={expandedCustomers.has(customer.id)}>
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <div 
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleExpanded(customer.id)}
                      >
                        <div className="flex items-center gap-4">
                          {expandedCustomers.has(customer.id) ? 
                            <ChevronDown className="h-4 w-4" /> : 
                            <ChevronRight className="h-4 w-4" />
                          }
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-sm text-muted-foreground">{customer.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Bookings</p>
                            <Badge variant="secondary">{customer.bookingCount}</Badge>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Total Spend</p>
                            <p className="font-semibold text-green-600">${customer.totalSpend.toLocaleString()}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Primary Category</p>
                            <Badge variant="outline">{getPrimaryCategory(customer.primaryCategory)}</Badge>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Last Booking</p>
                            <p className="text-sm">{customer.lastBookingDate}</p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/crm/toptier-experience/customers/${customer.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Profile
                          </Button>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t p-4 bg-muted/30">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {customer.bookings.map((booking) => (
                              <TableRow key={booking.id}>
                                <TableCell>{booking.date}</TableCell>
                                <TableCell>{booking.category}</TableCell>
                                <TableCell className="font-medium">${booking.amount.toLocaleString()}</TableCell>
                                <TableCell>{getStatusBadge(booking.status)}</TableCell>
                                <TableCell>
                                  <Button size="sm" variant="ghost" onClick={() => navigate(`/crm/toptier-experience/deals/${booking.id}`)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TopTierCustomerBookings;
