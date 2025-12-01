import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  BarChart3, TrendingUp, Store, Package, DollarSign, MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GRABBA_BRAND_CONFIG, formatTubesAsBoxes } from '@/config/grabbaSkyscraper';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';

// Demo analytics data
const salesByBrand = [
  { brand: 'gasmask', tubes: 4500, revenue: 22500, growth: 12 },
  { brand: 'hotmama', tubes: 2800, revenue: 16800, growth: 8 },
  { brand: 'scalati', tubes: 1900, revenue: 11400, growth: 15 },
  { brand: 'grabba', tubes: 3200, revenue: 19200, growth: 5 },
];

const topStores = [
  { id: 's1', name: '282 Nostrand Ave', neighborhood: 'Bed-Stuy', tubes: 1100, revenue: 5500 },
  { id: 's2', name: 'Flatbush Corner', neighborhood: 'Flatbush', tubes: 980, revenue: 4900 },
  { id: 's3', name: '125th Smoke Shop', neighborhood: 'Harlem', tubes: 870, revenue: 4350 },
  { id: 's4', name: 'Atlantic Smoke', neighborhood: 'Crown Heights', tubes: 820, revenue: 4100 },
  { id: 's5', name: 'Brooklyn Smoke Shop', neighborhood: 'Bed-Stuy', tubes: 750, revenue: 3750 },
];

const neighborhoodStats = [
  { id: 'bed-stuy', name: 'Bed-Stuy', stores: 3, tubes: 2050, revenue: 10250 },
  { id: 'flatbush', name: 'Flatbush', stores: 3, tubes: 1900, revenue: 9500 },
  { id: 'harlem', name: 'Harlem', stores: 2, tubes: 1560, revenue: 7800 },
  { id: 'crown-heights', name: 'Crown Heights', stores: 2, tubes: 1290, revenue: 6450 },
];

export default function GrabbaClusterAnalytics() {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState('brand');

  const totalTubes = salesByBrand.reduce((sum, b) => sum + b.tubes, 0);
  const totalRevenue = salesByBrand.reduce((sum, b) => sum + b.revenue, 0);

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            Cross-Brand Analytics
          </h1>
          <p className="text-muted-foreground mt-2">
            Performance insights across GasMask, HotMama, Hot Scalati, and Grabba R Us
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <Package className="h-4 w-4" />
                <span className="text-xs">Total Tubes (MTD)</span>
              </div>
              <div className="text-2xl font-bold">{totalTubes.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{formatTubesAsBoxes(totalTubes).fractionLabel}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs">Total Revenue</span>
              </div>
              <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">+10% vs last month</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Store className="h-4 w-4" />
                <span className="text-xs">Active Stores</span>
              </div>
              <div className="text-2xl font-bold">10</div>
              <div className="text-xs text-muted-foreground">4 neighborhoods</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">Avg Growth</span>
              </div>
              <div className="text-2xl font-bold">+10%</div>
              <div className="text-xs text-muted-foreground">across all brands</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="brand">Sales by Brand</TabsTrigger>
            <TabsTrigger value="store">Top Stores</TabsTrigger>
            <TabsTrigger value="neighborhood">By Neighborhood</TabsTrigger>
          </TabsList>

          <TabsContent value="brand">
            <Card>
              <CardHeader>
                <CardTitle>Sales by Brand</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {salesByBrand.map(item => {
                    const config = GRABBA_BRAND_CONFIG[item.brand as keyof typeof GRABBA_BRAND_CONFIG];
                    return (
                      <div 
                        key={item.brand}
                        className="p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow"
                        style={{ borderLeft: `4px solid ${config.primary}` }}
                        onClick={() => navigate(`/grabba/brand/${item.brand}`)}
                      >
                        <Badge style={{ backgroundColor: config.primary, color: 'white' }}>
                          {config.name}
                        </Badge>
                        <div className="mt-3">
                          <div className="text-2xl font-bold">{item.tubes.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">tubes sold</div>
                        </div>
                        <div className="mt-2">
                          <div className="text-lg font-semibold text-green-500">${item.revenue.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> +{item.growth}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="store">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Stores</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Neighborhood</TableHead>
                      <TableHead className="text-right">Tubes</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topStores.map((store, i) => (
                      <TableRow 
                        key={store.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/stores/${store.id}`)}
                      >
                        <TableCell>
                          <Badge variant={i < 3 ? 'default' : 'outline'}>#{i + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            {store.name}
                          </div>
                        </TableCell>
                        <TableCell>{store.neighborhood}</TableCell>
                        <TableCell className="text-right font-medium">{store.tubes.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-500">${store.revenue.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">View</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="neighborhood">
            <Card>
              <CardHeader>
                <CardTitle>Performance by Neighborhood</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Neighborhood</TableHead>
                      <TableHead className="text-center">Stores</TableHead>
                      <TableHead className="text-right">Tubes</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {neighborhoodStats.map(hood => (
                      <TableRow 
                        key={hood.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/grabba/analytics/neighborhoods`)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {hood.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{hood.stores}</TableCell>
                        <TableCell className="text-right font-medium">{hood.tubes.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-500">${hood.revenue.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">Details</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </GrabbaLayout>
  );
}
