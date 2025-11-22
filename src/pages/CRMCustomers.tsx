import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Search, Users } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CRMCustomers = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [businessType, setBusinessType] = useState<string>('all');
  const [relationshipStatus, setRelationshipStatus] = useState<string>('all');

  const { data: customers, isLoading } = useQuery({
    queryKey: ['crm-customers', search, businessType, relationshipStatus],
    queryFn: async () => {
      let query = supabase
        .from('crm_customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
      }

      if (businessType !== 'all') {
        query = query.eq('business_type', businessType);
      }

      if (relationshipStatus !== 'all') {
        query = query.eq('relationship_status', relationshipStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getBusinessTypeBadge = (type: string) => {
    switch (type) {
      case 'store':
        return <Badge className="bg-blue-500">Store</Badge>;
      case 'wholesaler':
        return <Badge className="bg-purple-500">Wholesaler</Badge>;
      case 'direct_buyer':
        return <Badge className="bg-green-500">Direct Buyer</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getRelationshipBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600">Active</Badge>;
      case 'warm':
        return <Badge className="bg-yellow-600">Warm</Badge>;
      case 'cold':
        return <Badge className="bg-orange-600">Cold</Badge>;
      case 'lost':
        return <Badge variant="destructive">Lost</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Customer CRM
          </h1>
          <p className="text-muted-foreground">Manage customers, orders, and financials</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => navigate('/crm/customers/import')}
          >
            <Upload className="mr-2 h-4 w-4" />
            Excel Import
          </Button>
          <Button onClick={() => navigate('/crm/customers/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={businessType} onValueChange={setBusinessType}>
              <SelectTrigger>
                <SelectValue placeholder="Business Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="store">Store</SelectItem>
                <SelectItem value="wholesaler">Wholesaler</SelectItem>
                <SelectItem value="direct_buyer">Direct Buyer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={relationshipStatus} onValueChange={setRelationshipStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Relationship Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="cold">Cold</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading customers...</div>
            </div>
          ) : !customers || customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No customers found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate('/crm/customers/new')}
              >
                Add your first customer
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="py-3 px-4 font-semibold">Name</th>
                    <th className="py-3 px-4 font-semibold">Type</th>
                    <th className="py-3 px-4 font-semibold">Contact</th>
                    <th className="py-3 px-4 font-semibold">Last Order</th>
                    <th className="py-3 px-4 font-semibold">LTV</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer: any) => (
                    <tr
                      key={customer.id}
                      className="border-b hover:bg-secondary/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/crm/customers/${customer.id}`)}
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-semibold">{customer.name}</p>
                          {customer.city && customer.state && (
                            <p className="text-sm text-muted-foreground">
                              {customer.city}, {customer.state}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getBusinessTypeBadge(customer.business_type)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          {customer.phone && <p>{customer.phone}</p>}
                          {customer.email && (
                            <p className="text-muted-foreground">{customer.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {customer.last_order_date ? (
                          <p className="text-sm">
                            {new Date(customer.last_order_date).toLocaleDateString()}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">No orders</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold">
                          ${(customer.total_lifetime_value || 0).toFixed(2)}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        {getRelationshipBadge(customer.relationship_status)}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/customers/${customer.id}`);
                          }}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CRMCustomers;
