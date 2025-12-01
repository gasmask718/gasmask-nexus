import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  MapPin, Store, Package, Box, ShoppingBag, ChevronDown, ChevronRight,
  TrendingUp, BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GRABBA_BRAND_CONFIG, formatTubesAsBoxes } from '@/config/grabbaSkyscraper';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';

// Demo data - Neighborhoods with stores and brand performance
const neighborhoodData = [
  {
    id: 'bed-stuy',
    name: 'Bed-Stuy',
    borough: 'Brooklyn',
    stores: [
      { id: 's1', name: '282 Nostrand Ave', gasmask: 450, hotmama: 200, scalati: 150, grabba: 300, bags: 12 },
      { id: 's2', name: 'Brooklyn Smoke Shop', gasmask: 320, hotmama: 180, scalati: 90, grabba: 250, bags: 8 },
      { id: 's3', name: 'Empire Bodega', gasmask: 280, hotmama: 120, scalati: 100, grabba: 180, bags: 5 },
    ]
  },
  {
    id: 'crown-heights',
    name: 'Crown Heights',
    borough: 'Brooklyn',
    stores: [
      { id: 's4', name: 'Atlantic Smoke', gasmask: 380, hotmama: 220, scalati: 170, grabba: 290, bags: 10 },
      { id: 's5', name: 'Crown Deli', gasmask: 210, hotmama: 150, scalati: 80, grabba: 200, bags: 6 },
    ]
  },
  {
    id: 'flatbush',
    name: 'Flatbush',
    borough: 'Brooklyn',
    stores: [
      { id: 's6', name: 'Flatbush Corner', gasmask: 520, hotmama: 280, scalati: 200, grabba: 350, bags: 15 },
      { id: 's7', name: 'Church Ave Smoke', gasmask: 310, hotmama: 190, scalati: 110, grabba: 220, bags: 7 },
      { id: 's8', name: 'Island Mart', gasmask: 180, hotmama: 100, scalati: 60, grabba: 150, bags: 4 },
    ]
  },
  {
    id: 'harlem',
    name: 'Harlem',
    borough: 'Manhattan',
    stores: [
      { id: 's9', name: '125th Smoke Shop', gasmask: 400, hotmama: 250, scalati: 180, grabba: 320, bags: 11 },
      { id: 's10', name: 'Apollo Bodega', gasmask: 290, hotmama: 170, scalati: 120, grabba: 240, bags: 8 },
    ]
  },
];

function NeighborhoodRow({ neighborhood }: { neighborhood: typeof neighborhoodData[0] }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  // Calculate totals for the neighborhood
  const totals = neighborhood.stores.reduce((acc, store) => ({
    gasmask: acc.gasmask + store.gasmask,
    hotmama: acc.hotmama + store.hotmama,
    scalati: acc.scalati + store.scalati,
    grabba: acc.grabba + store.grabba,
    bags: acc.bags + store.bags,
    totalTubes: acc.totalTubes + store.gasmask + store.hotmama + store.scalati + store.grabba,
  }), { gasmask: 0, hotmama: 0, scalati: 0, grabba: 0, bags: 0, totalTubes: 0 });

  const totalBoxes = formatTubesAsBoxes(totals.totalTubes);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-4">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">{neighborhood.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{neighborhood.borough} • {neighborhood.stores.length} stores</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xl font-bold">{totals.totalTubes.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Tubes</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">{totalBoxes.fractionLabel}</div>
                  <div className="text-xs text-muted-foreground">Boxes</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">{totals.bags}</div>
                  <div className="text-xs text-muted-foreground">Bags</div>
                </div>
              </div>
            </div>
            {/* Brand breakdown badges */}
            <div className="flex gap-2 mt-3 pl-8">
              <Badge style={{ backgroundColor: GRABBA_BRAND_CONFIG.gasmask.primary }} className="text-white">
                GasMask: {totals.gasmask}
              </Badge>
              <Badge style={{ backgroundColor: GRABBA_BRAND_CONFIG.hotmama.primary }} className="text-white">
                HotMama: {totals.hotmama}
              </Badge>
              <Badge style={{ backgroundColor: GRABBA_BRAND_CONFIG.scalati.primary }} className="text-white">
                Scalati: {totals.scalati}
              </Badge>
              <Badge style={{ backgroundColor: GRABBA_BRAND_CONFIG.grabba.primary }} className="text-white">
                Grabba R Us: {totals.grabba}
              </Badge>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-center" style={{ color: GRABBA_BRAND_CONFIG.gasmask.primary }}>GasMask</TableHead>
                  <TableHead className="text-center" style={{ color: GRABBA_BRAND_CONFIG.hotmama.primary }}>HotMama</TableHead>
                  <TableHead className="text-center" style={{ color: GRABBA_BRAND_CONFIG.scalati.primary }}>Scalati</TableHead>
                  <TableHead className="text-center" style={{ color: GRABBA_BRAND_CONFIG.grabba.primary }}>Grabba R Us</TableHead>
                  <TableHead className="text-center">Total Tubes</TableHead>
                  <TableHead className="text-center">Boxes</TableHead>
                  <TableHead className="text-center">Bags</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {neighborhood.stores.map(store => {
                  const storeTotalTubes = store.gasmask + store.hotmama + store.scalati + store.grabba;
                  const storeBoxes = formatTubesAsBoxes(storeTotalTubes);
                  return (
                    <TableRow 
                      key={store.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/stores/${store.id}`)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-muted-foreground" />
                          {store.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">{store.gasmask}</TableCell>
                      <TableCell className="text-center font-medium">{store.hotmama}</TableCell>
                      <TableCell className="text-center font-medium">{store.scalati}</TableCell>
                      <TableCell className="text-center font-medium">{store.grabba}</TableCell>
                      <TableCell className="text-center font-bold">{storeTotalTubes}</TableCell>
                      <TableCell className="text-center">{storeBoxes.fractionLabel}</TableCell>
                      <TableCell className="text-center">{store.bags}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/stores/${store.id}`);
                        }}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function GrabbaNeighborhoodPerformance() {
  // Calculate grand totals
  const grandTotals = neighborhoodData.reduce((acc, neighborhood) => {
    neighborhood.stores.forEach(store => {
      acc.gasmask += store.gasmask;
      acc.hotmama += store.hotmama;
      acc.scalati += store.scalati;
      acc.grabba += store.grabba;
      acc.bags += store.bags;
    });
    acc.stores += neighborhood.stores.length;
    return acc;
  }, { gasmask: 0, hotmama: 0, scalati: 0, grabba: 0, bags: 0, stores: 0 });

  const grandTotalTubes = grandTotals.gasmask + grandTotals.hotmama + grandTotals.scalati + grandTotals.grabba;
  const grandTotalBoxes = formatTubesAsBoxes(grandTotalTubes);

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <MapPin className="h-8 w-8 text-primary" />
            Neighborhood Performance
          </h1>
          <p className="text-muted-foreground mt-2">
            Tubes, boxes, and bags breakdown by neighborhood and store — all 4 Grabba brands
          </p>
        </div>

        {/* Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-primary">
                <MapPin className="h-4 w-4" />
                <span className="text-xs">Neighborhoods</span>
              </div>
              <div className="text-2xl font-bold">{neighborhoodData.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Store className="h-4 w-4" />
                <span className="text-xs">Stores</span>
              </div>
              <div className="text-2xl font-bold">{grandTotals.stores}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <Package className="h-4 w-4" />
                <span className="text-xs">Total Tubes</span>
              </div>
              <div className="text-2xl font-bold">{grandTotalTubes.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Box className="h-4 w-4" />
                <span className="text-xs">Total Boxes</span>
              </div>
              <div className="text-2xl font-bold">{grandTotalBoxes.fractionLabel}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <ShoppingBag className="h-4 w-4" />
                <span className="text-xs">GasMask Bags</span>
              </div>
              <div className="text-2xl font-bold">{grandTotals.bags}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-cyan-400">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">Avg/Store</span>
              </div>
              <div className="text-2xl font-bold">{Math.round(grandTotalTubes / grandTotals.stores)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Brand totals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Brand Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${GRABBA_BRAND_CONFIG.gasmask.primary}20`, borderLeft: `4px solid ${GRABBA_BRAND_CONFIG.gasmask.primary}` }}>
                <div className="text-sm text-muted-foreground">GasMask</div>
                <div className="text-2xl font-bold">{grandTotals.gasmask.toLocaleString()} tubes</div>
                <div className="text-sm">{formatTubesAsBoxes(grandTotals.gasmask).fractionLabel}</div>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${GRABBA_BRAND_CONFIG.hotmama.primary}20`, borderLeft: `4px solid ${GRABBA_BRAND_CONFIG.hotmama.primary}` }}>
                <div className="text-sm text-muted-foreground">HotMama</div>
                <div className="text-2xl font-bold">{grandTotals.hotmama.toLocaleString()} tubes</div>
                <div className="text-sm">{formatTubesAsBoxes(grandTotals.hotmama).fractionLabel}</div>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${GRABBA_BRAND_CONFIG.scalati.primary}20`, borderLeft: `4px solid ${GRABBA_BRAND_CONFIG.scalati.primary}` }}>
                <div className="text-sm text-muted-foreground">Hot Scalati</div>
                <div className="text-2xl font-bold">{grandTotals.scalati.toLocaleString()} tubes</div>
                <div className="text-sm">{formatTubesAsBoxes(grandTotals.scalati).fractionLabel}</div>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${GRABBA_BRAND_CONFIG.grabba.primary}20`, borderLeft: `4px solid ${GRABBA_BRAND_CONFIG.grabba.primary}` }}>
                <div className="text-sm text-muted-foreground">Grabba R Us</div>
                <div className="text-2xl font-bold">{grandTotals.grabba.toLocaleString()} tubes</div>
                <div className="text-sm">{formatTubesAsBoxes(grandTotals.grabba).fractionLabel}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Neighborhood List */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Neighborhoods</h2>
          {neighborhoodData.map(neighborhood => (
            <NeighborhoodRow key={neighborhood.id} neighborhood={neighborhood} />
          ))}
        </div>
      </div>
    </GrabbaLayout>
  );
}
