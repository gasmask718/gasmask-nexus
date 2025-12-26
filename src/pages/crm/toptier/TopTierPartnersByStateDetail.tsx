/**
 * TopTier Partners by State Detail - Partners in a specific state
 */
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, Search, Eye, Plus, Building2, MapPin, 
  Users, DollarSign, Phone, Mail
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { CommunicationActions } from '@/components/crm/toptier/CommunicationActions';

export default function TopTierPartnersByStateDetail() {
  const navigate = useNavigate();
  const { state } = useParams<{ state: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  const simulatedPartners = getEntityData('partner');
  const { data: allPartners, isSimulated } = useResolvedData([], simulatedPartners);

  // Filter partners by state
  const statePartners = useMemo(() => {
    return allPartners.filter((p: any) => 
      p.state === state || (p.service_area && p.service_area.includes(state))
    );
  }, [allPartners, state]);

  // Apply additional filters
  const filteredPartners = useMemo(() => {
    return statePartners.filter((partner: any) => {
      const matchesSearch = searchTerm === '' ||
        partner.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || partner.partner_category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [statePartners, searchTerm, categoryFilter]);

  // Stats
  const stats = useMemo(() => {
    const active = statePartners.filter((p: any) => p.contract_status === 'active').length;
    const categories = new Set(statePartners.map((p: any) => p.partner_category));
    return {
      total: statePartners.length,
      active,
      categories: categories.size,
    };
  }, [statePartners]);

  const stateLabel = US_STATES.find(s => s.value === state)?.label || state;

  const getCategoryLabel = (value: string) => {
    return TOPTIER_PARTNER_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-fit"
          onClick={() => navigate('/crm/toptier-experience/partners/states')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to States
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">{stateLabel} Partners</h1>
              {isSimulated && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">Partners operating in {stateLabel}</p>
          </div>
          <Button onClick={() => navigate('/crm/toptier-experience/partners/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Partner
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Partners</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Building2 className="h-8 w-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold">{stats.categories}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search partners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {TOPTIER_PARTNER_CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Partners Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Partners ({filteredPartners.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPartners.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No partners found in {stateLabel}</h3>
              <p className="text-muted-foreground mb-4">Add a partner to get started</p>
              <Button onClick={() => navigate('/crm/toptier-experience/partners/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Partner
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Partner</th>
                    <th className="text-left py-3 px-4 font-medium">Category</th>
                    <th className="text-left py-3 px-4 font-medium">City</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPartners.map((partner: any) => (
                    <tr 
                      key={partner.id} 
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partner.id}`)}
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium">{partner.name}</p>
                        <p className="text-xs text-muted-foreground">{partner.primary_contact}</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(partner.partner_category)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">{partner.city || 'Multiple'}</td>
                      <td className="py-3 px-4">
                        <Badge className={partner.contract_status === 'active' ? 'bg-green-500/10 text-green-600' : 'bg-muted'}>
                          {partner.contract_status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <CommunicationActions
                            contact={{
                              id: partner.id,
                              name: partner.name,
                              phone: partner.phone,
                              email: partner.email,
                            }}
                            entityType="partner"
                            size="icon"
                          />
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
                        </div>
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
}
