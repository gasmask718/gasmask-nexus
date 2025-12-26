/**
 * TopTier Partner Category Detail Page
 * Shows partners filtered by category with state filtering
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ArrowLeft, Search, Plus, Eye, FileText, Megaphone,
  MapPin, DollarSign, Percent, Building2, Users, Filter, CheckCircle, Clock
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';

export default function TopTierPartnerCategoryPage() {
  const navigate = useNavigate();
  const { category } = useParams<{ category: string }>();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  // Get partner data
  const simulatedPartners = getEntityData('partner');
  const { data: allPartners, isSimulated } = useResolvedData([], simulatedPartners);

  // Get category info
  const categoryInfo = TOPTIER_PARTNER_CATEGORIES.find(c => c.value === category);

  // Filter partners by category
  const filteredPartners = useMemo(() => {
    return allPartners
      .filter((p: any) => p.partner_category === category)
      .filter((p: any) => {
        if (stateFilter !== 'all') {
          const inPrimaryState = p.state === stateFilter;
          const inServiceArea = p.service_area && p.service_area.includes(stateFilter);
          if (!inPrimaryState && !inServiceArea) return false;
        }
        if (statusFilter !== 'all' && p.contract_status !== statusFilter) return false;
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          return (
            p.company_name?.toLowerCase().includes(search) ||
            p.contact_name?.toLowerCase().includes(search) ||
            p.city?.toLowerCase().includes(search)
          );
        }
        return true;
      });
  }, [allPartners, category, stateFilter, statusFilter, searchTerm]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const categoryPartners = allPartners.filter((p: any) => p.partner_category === category);
    const active = categoryPartners.filter((p: any) => p.contract_status === 'active');
    const pending = categoryPartners.filter((p: any) => p.contract_status === 'pending');
    
    const uniqueStates = new Set<string>();
    categoryPartners.forEach((p: any) => {
      if (p.state) uniqueStates.add(p.state);
      if (p.service_area) p.service_area.forEach((s: string) => uniqueStates.add(s));
    });

    const avgCommission = categoryPartners.length > 0
      ? categoryPartners.reduce((sum: number, p: any) => sum + (p.commission_rate || 0), 0) / categoryPartners.length
      : 0;

    return {
      total: categoryPartners.length,
      active: active.length,
      pending: pending.length,
      statesCovered: uniqueStates.size,
      avgCommission: avgCommission.toFixed(1),
    };
  }, [allPartners, category]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pending</Badge>;
      case 'expired':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Expired</Badge>;
      case 'terminated':
        return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">Terminated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-fit"
          onClick={() => navigate('/crm/toptier-experience/partners')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Partner Dashboard
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{categoryInfo?.label || 'Partners'}</h1>
              {isSimulated && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">
              {stats.total} partners • {stats.statesCovered} states covered
            </p>
          </div>
          <Button onClick={() => navigate('/crm/toptier-experience/partner/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Partner
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Partners</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats.statesCovered}</p>
                <p className="text-xs text-muted-foreground">States Covered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Percent className="h-5 w-5 text-cyan-500" />
              <div>
                <p className="text-2xl font-bold">{stats.avgCommission}%</p>
                <p className="text-xs text-muted-foreground">Avg Commission</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search partners..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {US_STATES.map(state => (
                  <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Partners Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Partners ({filteredPartners.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPartners.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner Name</TableHead>
                    <TableHead>Primary State</TableHead>
                    <TableHead>States Covered</TableHead>
                    <TableHead>Pricing Range</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPartners.map((partner: any) => (
                    <TableRow 
                      key={partner.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partner.id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{partner.company_name}</p>
                          <p className="text-sm text-muted-foreground">{partner.contact_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {partner.state}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {partner.service_area?.slice(0, 3).map((state: string) => (
                            <Badge key={state} variant="outline" className="text-xs">
                              {state}
                            </Badge>
                          ))}
                          {partner.service_area?.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{partner.service_area.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{partner.pricing_range || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{partner.commission_rate}%</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(partner.contract_status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/crm/toptier-experience/partners/profile/${partner.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/crm/toptier-experience/booking?partner=${partner.id}`);
                            }}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/crm/toptier-experience/promo_campaign?partner=${partner.id}`);
                            }}
                          >
                            <Megaphone className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No partners found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm || stateFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : `No partners in ${categoryInfo?.label || 'this category'} yet`}
              </p>
              <Button onClick={() => navigate('/crm/toptier-experience/partner/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Partner
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
