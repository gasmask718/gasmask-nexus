/**
 * Floor 8 — Ambassador Regions
 * Geographic command & expansion planning
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Map, Users, Store, DollarSign, Search, AlertTriangle,
  MapPin, TrendingUp, Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RegionData {
  state: string;
  cities: {
    city: string;
    neighborhoods: string[];
    ambassadorCount: number;
    storeCount: number;
    revenue: number;
    ambassadors: any[];
  }[];
  totalAmbassadors: number;
  totalStores: number;
  totalRevenue: number;
}

export default function AmbassadorRegionsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState<string | null>(null);

  // Fetch all ambassadors with location data
  const { data: ambassadors = [], isLoading } = useQuery({
    queryKey: ['floor8-ambassador-regions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id, name, state, city, neighborhood, tier, is_active, total_earnings')
        .eq('is_active', true)
        .order('state', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch store assignments for revenue calculation
  const { data: assignments = [] } = useQuery({
    queryKey: ['floor8-region-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_assignments')
        .select('ambassador_id, store_id, active, created_at')
        .eq('active', true);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch commission data for revenue by region
  const { data: commissions = [] } = useQuery({
    queryKey: ['floor8-region-commissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_ledger')
        .select('ambassador_id, gross_amount, commission_amount')
        .neq('status', 'reversed');
      if (error) throw error;
      return data || [];
    },
  });

  // Build region hierarchy
  const regionData: RegionData[] = [];
  const stateMap: Record<string, RegionData> = {};

  ambassadors.forEach((amb) => {
    const state = amb.state || 'Unknown';
    const city = amb.city || 'Unknown';
    const neighborhood = amb.neighborhood || '';

    if (!stateMap[state]) {
      stateMap[state] = {
        state,
        cities: [],
        totalAmbassadors: 0,
        totalStores: 0,
        totalRevenue: 0,
      };
    }

    const stateData = stateMap[state];
    stateData.totalAmbassadors++;

    // Get ambassador's stores and revenue
    const ambAssignments = assignments.filter(a => a.ambassador_id === amb.id);
    const ambCommissions = commissions.filter(c => c.ambassador_id === amb.id);
    const ambRevenue = ambCommissions.reduce((sum, c) => sum + Number(c.gross_amount || 0), 0);
    
    stateData.totalStores += ambAssignments.length;
    stateData.totalRevenue += ambRevenue;

    // Find or create city entry
    let cityEntry = stateData.cities.find(c => c.city === city);
    if (!cityEntry) {
      cityEntry = {
        city,
        neighborhoods: [],
        ambassadorCount: 0,
        storeCount: 0,
        revenue: 0,
        ambassadors: [],
      };
      stateData.cities.push(cityEntry);
    }

    cityEntry.ambassadorCount++;
    cityEntry.storeCount += ambAssignments.length;
    cityEntry.revenue += ambRevenue;
    cityEntry.ambassadors.push(amb);

    if (neighborhood && !cityEntry.neighborhoods.includes(neighborhood)) {
      cityEntry.neighborhoods.push(neighborhood);
    }
  });

  Object.values(stateMap).forEach((data) => regionData.push(data));
  regionData.sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Filter regions
  let filteredRegions = regionData;
  if (searchTerm) {
    filteredRegions = regionData.filter(r => 
      r.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.cities.some(c => c.city.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  // Calculate totals
  const totalAmbassadors = regionData.reduce((sum, r) => sum + r.totalAmbassadors, 0);
  const totalStores = regionData.reduce((sum, r) => sum + r.totalStores, 0);
  const totalRevenue = regionData.reduce((sum, r) => sum + r.totalRevenue, 0);

  // Find overlaps (ambassadors in same neighborhood)
  const neighborhoodOverlaps: { neighborhood: string; city: string; state: string; count: number }[] = [];
  regionData.forEach(stateData => {
    stateData.cities.forEach(cityData => {
      const neighborhoodCounts: Record<string, number> = {};
      cityData.ambassadors.forEach((amb: any) => {
        if (amb.neighborhood) {
          neighborhoodCounts[amb.neighborhood] = (neighborhoodCounts[amb.neighborhood] || 0) + 1;
        }
      });
      Object.entries(neighborhoodCounts).forEach(([neighborhood, count]) => {
        if (count > 1) {
          neighborhoodOverlaps.push({ 
            neighborhood, 
            city: cityData.city, 
            state: stateData.state, 
            count 
          });
        }
      });
    });
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Map className="h-8 w-8" />
            Ambassador Regions
          </h1>
          <p className="text-muted-foreground mt-1">
            Geographic distribution and expansion planning
          </p>
        </div>

        {/* Summary KPIs */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Active Regions</span>
              </div>
              <div className="text-3xl font-bold mt-2">{regionData.length}</div>
              <p className="text-xs text-muted-foreground">states covered</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Total Ambassadors</span>
              </div>
              <div className="text-3xl font-bold mt-2">{totalAmbassadors}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Stores Acquired</span>
              </div>
              <div className="text-3xl font-bold mt-2">{totalStores}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <span className="text-sm text-muted-foreground">Total Revenue</span>
              </div>
              <div className="text-3xl font-bold text-green-500 mt-2">
                ${totalRevenue.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overlap Warnings */}
        {neighborhoodOverlaps.length > 0 && (
          <Card className="border-amber-500/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-amber-500 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Territory Overlaps Detected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {neighborhoodOverlaps.map((overlap, i) => (
                  <Badge key={i} variant="outline" className="text-amber-500 border-amber-500/50">
                    {overlap.neighborhood}, {overlap.city} ({overlap.count} ambassadors)
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search states or cities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Regions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Region Performance</CardTitle>
            <CardDescription>Click a region to view city breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredRegions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Map className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No regions found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRegions.map((region) => (
                  <div key={region.state} className="border rounded-lg">
                    {/* State Header */}
                    <div 
                      className={cn(
                        "flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50",
                        selectedState === region.state && "bg-muted/30"
                      )}
                      onClick={() => setSelectedState(selectedState === region.state ? null : region.state)}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-bold text-lg">{region.state}</p>
                          <p className="text-sm text-muted-foreground">
                            {region.cities.length} cities
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-xl font-bold">{region.totalAmbassadors}</p>
                          <p className="text-xs text-muted-foreground">Ambassadors</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold">{region.totalStores}</p>
                          <p className="text-xs text-muted-foreground">Stores</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-green-500">
                            ${region.totalRevenue.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Revenue</p>
                        </div>
                      </div>
                    </div>

                    {/* City Breakdown */}
                    {selectedState === region.state && (
                      <div className="border-t p-4 bg-muted/10">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>City</TableHead>
                              <TableHead>Neighborhoods</TableHead>
                              <TableHead>Ambassadors</TableHead>
                              <TableHead>Stores</TableHead>
                              <TableHead>Revenue</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {region.cities.map((city) => (
                              <TableRow key={city.city}>
                                <TableCell className="font-medium">{city.city}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {city.neighborhoods.slice(0, 3).map((n, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {n}
                                      </Badge>
                                    ))}
                                    {city.neighborhoods.length > 3 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{city.neighborhoods.length - 3}
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {city.ambassadors.slice(0, 2).map((amb) => (
                                      <Badge 
                                        key={amb.id} 
                                        variant="secondary"
                                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/ambassadors/${amb.id}`);
                                        }}
                                      >
                                        {amb.name}
                                      </Badge>
                                    ))}
                                    {city.ambassadors.length > 2 && (
                                      <Badge variant="outline">
                                        +{city.ambassadors.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{city.storeCount}</TableCell>
                                <TableCell className="font-bold text-green-500">
                                  ${city.revenue.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
