import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Search, Store, Truck, User, Phone, MapPin } from 'lucide-react';

const typeBadgeColors: Record<string, string> = {
  store: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  wholesaler: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  direct_customer: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const typeIcons: Record<string, React.ReactNode> = {
  store: <Store className="h-4 w-4" />,
  wholesaler: <Truck className="h-4 w-4" />,
  direct_customer: <User className="h-4 w-4" />,
};

export default function Companies() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies', typeFilter],
    queryFn: async () => {
      let query = supabase
        .from('companies')
        .select('*')
        .order('name');
      
      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredCompanies = companies?.filter(company =>
    company.name.toLowerCase().includes(search.toLowerCase()) ||
    company.default_city?.toLowerCase().includes(search.toLowerCase()) ||
    company.default_state?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: companies?.length || 0,
    stores: companies?.filter(c => c.type === 'store').length || 0,
    wholesalers: companies?.filter(c => c.type === 'wholesaler').length || 0,
    direct: companies?.filter(c => c.type === 'direct_customer').length || 0,
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              Companies
            </h1>
            <p className="text-muted-foreground">All customers: stores, wholesalers, and direct buyers</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total Companies</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-4 cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => setTypeFilter('store')}>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Store className="h-4 w-4 text-blue-400" /> Stores
            </p>
            <p className="text-2xl font-bold">{stats.stores}</p>
          </Card>
          <Card className="p-4 cursor-pointer hover:border-purple-500/50 transition-colors" onClick={() => setTypeFilter('wholesaler')}>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4 text-purple-400" /> Wholesalers
            </p>
            <p className="text-2xl font-bold">{stats.wholesalers}</p>
          </Card>
          <Card className="p-4 cursor-pointer hover:border-green-500/50 transition-colors" onClick={() => setTypeFilter('direct_customer')}>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-green-400" /> Direct
            </p>
            <p className="text-2xl font-bold">{stats.direct}</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="store">Stores</SelectItem>
              <SelectItem value="wholesaler">Wholesalers</SelectItem>
              <SelectItem value="direct_customer">Direct Customers</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Company List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredCompanies && filteredCompanies.length > 0 ? (
              filteredCompanies.map((company) => (
                <Card
                  key={company.id}
                  className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/companies/${company.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        {typeIcons[company.type]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{company.name}</p>
                          <Badge className={typeBadgeColors[company.type] || 'bg-muted'}>
                            {company.type?.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {company.default_city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {company.default_city}, {company.default_state}
                            </span>
                          )}
                          {company.default_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {company.default_phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant="outline" 
                        className={company.health_score >= 80 ? 'border-green-500 text-green-500' : company.health_score >= 50 ? 'border-yellow-500 text-yellow-500' : 'border-red-500 text-red-500'}
                      >
                        {company.health_score}%
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No companies found</p>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
