import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Search,
  Download,
  MapPin,
  Store,
  Eye,
  Building,
  Map,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function NeighborhoodIntelligencePage() {
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedBorough, setSelectedBorough] = useState('all');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('all');
  const [search, setSearch] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  
  // Fetch cities from stores
  const { data: cities = [] } = useQuery({
    queryKey: ['geo-cities'],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_master')
        .select('city')
        .not('city', 'is', null);
      
      const unique = [...new Set((data || []).map((s: any) => s.city).filter(Boolean))];
      return unique.sort();
    },
  });

  // Fetch boroughs
  const { data: boroughs = [] } = useQuery({
    queryKey: ['geo-boroughs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('boroughs')
        .select('id, name')
        .order('name');
      return data || [];
    },
  });

  // Fetch neighborhoods based on selected borough
  const { data: neighborhoods = [] } = useQuery({
    queryKey: ['geo-neighborhoods', selectedBorough],
    queryFn: async () => {
      if (selectedBorough === 'all') return [];
      const { data } = await supabase
        .from('neighborhoods')
        .select('id, name')
        .eq('borough_id', selectedBorough)
        .order('name');
      return data || [];
    },
    enabled: selectedBorough !== 'all',
  });

  // Fetch stores with filters
  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['neighborhood-stores', selectedCity, selectedBorough, selectedNeighborhood],
    queryFn: async () => {
      let query = supabase
        .from('store_master')
        .select(`
          id,
          store_name,
          address,
          city,
          state,
          zip,
          phone,
          store_type,
          notes,
          brand_id,
          borough_id,
          boroughs (id, name),
          brands (id, name)
        `)
        .order('store_name');
      
      if (selectedCity !== 'all') {
        query = query.eq('city', selectedCity);
      }
      if (selectedBorough !== 'all') {
        query = query.eq('borough_id', selectedBorough);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Filter by search
  const filtered = stores.filter((store: any) => {
    if (search) {
      const term = search.toLowerCase();
      return (
        store.store_name?.toLowerCase().includes(term) ||
        store.address?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Summary stats
  const totalStores = filtered.length;
  const byBorough = filtered.reduce((acc: Record<string, number>, s: any) => {
    const borough = (s.boroughs as any)?.name || 'Unknown';
    acc[borough] = (acc[borough] || 0) + 1;
    return acc;
  }, {});

  const handleExport = () => {
    const csv = [
      ['Store Name', 'Address', 'City', 'State', 'Borough', 'Brand', 'Phone', 'Type'],
      ...filtered.map((store: any) => [
        store.store_name || '',
        store.address || '',
        store.city || '',
        store.state || '',
        (store.boroughs as any)?.name || '',
        (store.brands as any)?.name || '',
        store.phone || '',
        store.store_type || '',
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neighborhood-stores.csv';
    a.click();
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/os/inventory">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Map className="h-8 w-8 text-primary" />
              Neighborhood Intelligence
            </h1>
            <p className="text-muted-foreground">Geographic store analysis and filtering</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Geo Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Geographic Filters
          </CardTitle>
          <CardDescription>Filter stores by location</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">City</label>
              <Select value={selectedCity} onValueChange={(v) => {
                setSelectedCity(v);
                setSelectedBorough('all');
                setSelectedNeighborhood('all');
              }}>
                <SelectTrigger>
                  <Building className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select City" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Borough</label>
              <Select value={selectedBorough} onValueChange={(v) => {
                setSelectedBorough(v);
                setSelectedNeighborhood('all');
              }}>
                <SelectTrigger>
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select Borough" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Boroughs</SelectItem>
                  {boroughs.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Neighborhood</label>
              <Select 
                value={selectedNeighborhood} 
                onValueChange={setSelectedNeighborhood}
                disabled={selectedBorough === 'all'}
              >
                <SelectTrigger>
                  <Map className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select Neighborhood" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Neighborhoods</SelectItem>
                  {neighborhoods.map((n: any) => (
                    <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search stores..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{totalStores}</p>
              <p className="text-sm text-muted-foreground">Total Stores</p>
            </div>
          </CardContent>
        </Card>
        {Object.entries(byBorough).slice(0, 3).map(([borough, count]) => (
          <Card key={borough}>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground">{borough}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stores Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Stores ({filtered.length})
          </CardTitle>
          <CardDescription>All stores matching your filters</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading stores...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Borough</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((store: any) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">{store.store_name}</TableCell>
                    <TableCell className="text-sm">{store.address}</TableCell>
                    <TableCell>{store.city}, {store.state}</TableCell>
                    <TableCell>
                      {(store.boroughs as any)?.name && (
                        <Badge variant="outline">{(store.boroughs as any).name}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {(store.brands as any)?.name && (
                        <Badge>{(store.brands as any).name}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{store.store_type || '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/os/crm/stores/${store.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No stores found matching your filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}