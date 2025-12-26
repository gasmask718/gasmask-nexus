/**
 * TopTier Analytics - Revenue
 * Company-wide revenue breakdown by partner, category, and state
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, DollarSign, TrendingUp, Building2, MapPin, Eye
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';

export default function TopTierAnalyticsRevenue() {
  const navigate = useNavigate();
  const [groupBy, setGroupBy] = useState<'partner' | 'category' | 'state'>('partner');

  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  const simulatedBookings = getEntityData('booking');
  const simulatedPartners = getEntityData('partner');
  const { data: bookings, isSimulated } = useResolvedData([], simulatedBookings);
  const { data: partners } = useResolvedData([], simulatedPartners);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const totalRevenue = bookings.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0);
    const avgDealValue = bookings.length > 0 ? Math.round(totalRevenue / bookings.length) : 0;
    const paidBookings = bookings.filter((b: any) => b.deposit_paid);
    const collectedRevenue = paidBookings.reduce((sum: number, b: any) => sum + (b.deposit_amount || 0), 0);
    return { totalRevenue, avgDealValue, totalDeals: bookings.length, collectedRevenue };
  }, [bookings]);

  // Group revenue by partner
  const revenueByPartner = useMemo(() => {
    const partnerRevenue: Record<string, { partner: any; revenue: number; dealCount: number }> = {};
    
    bookings.forEach((booking: any) => {
      const linkedPartnerIds = booking.linked_partners || [];
      const amount = booking.total_amount || 0;
      const splitAmount = linkedPartnerIds.length > 0 ? amount / linkedPartnerIds.length : amount;
      
      linkedPartnerIds.forEach((pId: string) => {
        const partner = partners.find((p: any) => p.id === pId);
        if (partner) {
          if (!partnerRevenue[pId]) {
            partnerRevenue[pId] = { partner, revenue: 0, dealCount: 0 };
          }
          partnerRevenue[pId].revenue += splitAmount;
          partnerRevenue[pId].dealCount++;
        }
      });
    });

    return Object.values(partnerRevenue).sort((a, b) => b.revenue - a.revenue);
  }, [bookings, partners]);

  // Group revenue by category
  const revenueByCategory = useMemo(() => {
    const categoryRevenue: Record<string, { category: string; label: string; revenue: number; dealCount: number }> = {};
    
    bookings.forEach((booking: any) => {
      const categories = booking.partner_categories || ['other'];
      const amount = booking.total_amount || 0;
      const splitAmount = categories.length > 0 ? amount / categories.length : amount;
      
      categories.forEach((cat: string) => {
        const catInfo = TOPTIER_PARTNER_CATEGORIES.find(c => c.value === cat);
        if (!categoryRevenue[cat]) {
          categoryRevenue[cat] = { category: cat, label: catInfo?.label || cat, revenue: 0, dealCount: 0 };
        }
        categoryRevenue[cat].revenue += splitAmount;
        categoryRevenue[cat].dealCount++;
      });
    });

    return Object.values(categoryRevenue).sort((a, b) => b.revenue - a.revenue);
  }, [bookings]);

  // Group revenue by state
  const revenueByState = useMemo(() => {
    const stateRevenue: Record<string, { state: string; label: string; revenue: number; dealCount: number }> = {};
    
    bookings.forEach((booking: any) => {
      const state = booking.state || 'unknown';
      const amount = booking.total_amount || 0;
      const stateInfo = US_STATES.find(s => s.value === state);
      
      if (!stateRevenue[state]) {
        stateRevenue[state] = { state, label: stateInfo?.label || state, revenue: 0, dealCount: 0 };
      }
      stateRevenue[state].revenue += amount;
      stateRevenue[state].dealCount++;
    });

    return Object.values(stateRevenue).sort((a, b) => b.revenue - a.revenue);
  }, [bookings]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate('/crm/toptier-experience/partners')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Revenue Analytics</h1>
              {isSimulated && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">Company-wide revenue breakdown and insights</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${overallStats.totalRevenue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className="text-2xl font-bold">${overallStats.collectedRevenue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Deal Value</p>
                <p className="text-2xl font-bold">${overallStats.avgDealValue.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Deals</p>
                <p className="text-2xl font-bold">{overallStats.totalDeals}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grouped Tables */}
      <Tabs defaultValue="partner" className="space-y-4">
        <TabsList>
          <TabsTrigger value="partner">By Partner</TabsTrigger>
          <TabsTrigger value="category">By Category</TabsTrigger>
          <TabsTrigger value="state">By State</TabsTrigger>
        </TabsList>

        <TabsContent value="partner">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Revenue by Partner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Deals</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueByPartner.map((item) => (
                    <TableRow 
                      key={item.partner.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/crm/toptier-experience/partners/profile/${item.partner.id}`)}
                    >
                      <TableCell className="font-medium">{item.partner.company_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {TOPTIER_PARTNER_CATEGORIES.find(c => c.value === item.partner.partner_category)?.label || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.partner.state}</TableCell>
                      <TableCell className="text-right">{item.dealCount}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        ${Math.round(item.revenue).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/crm/toptier-experience/partners/profile/${item.partner.id}`); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenue by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Deals</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg per Deal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueByCategory.map((item) => (
                    <TableRow 
                      key={item.category}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/crm/toptier-experience/partners/${item.category}`)}
                    >
                      <TableCell className="font-medium">{item.label}</TableCell>
                      <TableCell className="text-right">{item.dealCount}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        ${Math.round(item.revenue).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        ${item.dealCount > 0 ? Math.round(item.revenue / item.dealCount).toLocaleString() : 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="state">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Revenue by State
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Deals</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg per Deal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueByState.map((item) => (
                    <TableRow key={item.state}>
                      <TableCell className="font-medium">{item.label}</TableCell>
                      <TableCell className="text-right">{item.dealCount}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        ${Math.round(item.revenue).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        ${item.dealCount > 0 ? Math.round(item.revenue / item.dealCount).toLocaleString() : 0}
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
  );
}
