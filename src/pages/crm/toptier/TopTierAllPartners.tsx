/**
 * TopTier All Partners - Full list view of all partners
 */
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, Search, Eye, Plus, Building2, MapPin, 
  Users, Phone, Mail, TrendingUp, Filter
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { supabase } from '@/integrations/supabase/client';
import { PartnerCsvImportDialog } from '@/components/crm/toptier/PartnerCsvImportDialog';

/** Sourced-supply categories (crm_partners.category) — mirrors the DB check constraint. */
const SOURCED_CATEGORIES = [
  'chauffeur', 'exotic car rental', 'party bus', 'helicopter', 'yacht charter',
  'powersports rental', 'nightlife venue', 'rooftop venue', 'event hall',
  'decorator', 'decor rental', 'florist', 'private chef', 'photographer',
  'beauty-hair-makeup', 'security-exec protection', 'rose-gifting supplier', 'authenticator',
];

const STAGES = ['identified', 'contacted', 'interested', 'applied', 'activated', 'declined'] as const;

const STAGE_STYLES: Record<string, string> = {
  identified: 'bg-muted text-muted-foreground',
  contacted: 'bg-blue-500/15 text-blue-500',
  interested: 'bg-amber-500/15 text-amber-500',
  applied: 'bg-violet-500/15 text-violet-500',
  activated: 'bg-emerald-500/15 text-emerald-500',
  declined: 'bg-destructive/15 text-destructive',
};

export default function TopTierAllPartners() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<string>(searchParams.get('state') || 'all');
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get('category') || 'all');
  const [sourcedCategoryFilter, setSourcedCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [coverageSearch, setCoverageSearch] = useState('');

  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');

  // Fetch real partners from database
  const { data: realPartners = [], isLoading, refetch } = useQuery({
    queryKey: ['crm_partners', 'toptier-experience', 'all', simulationMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_partners')
        .select('*')
        .eq('business_slug', 'toptier-experience')
        .eq('is_simulation', simulationMode)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Get partner data (real or simulated)
  const simulatedPartners = getEntityData('partner');
  const { data: partners, isSimulated } = useResolvedData(realPartners, simulatedPartners, 'toptier-experience');

  // Filter partners
  const filteredPartners = useMemo(() => {
    return partners.filter((partner: any) => {
      const matchesSearch = searchTerm === '' ||
        partner.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        partner.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        partner.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = stateFilter === 'all' || 
        partner.state === stateFilter || 
        (partner.service_area && partner.service_area.includes(stateFilter));
      const matchesCategory = categoryFilter === 'all' || partner.partner_category === categoryFilter;
      const matchesSourced = sourcedCategoryFilter === 'all' || partner.category === sourcedCategoryFilter;
      const matchesStatus = statusFilter === 'all' || partner.contract_status === statusFilter;
      const matchesStage = stageFilter === 'all' || (partner.stage || 'identified') === stageFilter;
      const coverage = coverageSearch.trim().toLowerCase();
      const matchesCoverage = coverage === '' ||
        partner.coverage_areas?.toLowerCase().includes(coverage) ||
        partner.city?.toLowerCase().includes(coverage) ||
        partner.state?.toLowerCase().includes(coverage) ||
        (partner.service_area || []).some((a: string) => a?.toLowerCase().includes(coverage));
      return matchesSearch && matchesState && matchesCategory && matchesSourced &&
        matchesStatus && matchesStage && matchesCoverage;
    });
  }, [partners, searchTerm, stateFilter, categoryFilter, sourcedCategoryFilter, statusFilter, stageFilter, coverageSearch]);

  // Stats
  const stats = useMemo(() => ({
    total: partners.length,
    active: partners.filter((p: any) => p.contract_status === 'active').length,
    pending: partners.filter((p: any) => p.contract_status === 'pending').length,
    inactive: partners.filter((p: any) => p.contract_status === 'inactive').length,
  }), [partners]);

  // Stage pipeline counts (sourced supply pipeline)
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(STAGES.map((s) => [s, 0]));
    partners.forEach((p: any) => {
      const s = p.stage || 'identified';
      if (s in counts) counts[s] += 1;
    });
    return counts;
  }, [partners]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-500/10 text-green-600',
      pending: 'bg-yellow-500/10 text-yellow-600',
      inactive: 'bg-gray-500/10 text-gray-600',
      suspended: 'bg-red-500/10 text-red-600',
    };
    return <Badge className={styles[status] || 'bg-muted'}>{status}</Badge>;
  };

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
          onClick={() => navigate('/crm/toptier-experience/partners')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">All Partners</h1>
              {isSimulated && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">View and manage all TopTier experience partners</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PartnerCsvImportDialog onImported={() => refetch()} />
            <Button onClick={() => navigate('/crm/toptier-experience/partner/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Partner
            </Button>
          </div>
        </div>
      </div>

      {/* Sourcing pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Sourcing pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {STAGES.map((stage) => {
              const selected = stageFilter === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setStageFilter(selected ? 'all' : stage)}
                  className={`rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${
                    selected ? 'border-primary ring-1 ring-primary' : 'border-border'
                  }`}
                >
                  <p className="text-2xl font-bold">{stageCounts[stage]}</p>
                  <Badge className={`mt-1 text-xs capitalize ${STAGE_STYLES[stage]}`}>{stage}</Badge>
                </button>
              );
            })}
          </div>
          {stageFilter !== 'all' && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setStageFilter('all')}>
              Clear stage filter
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Filter className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-gray-600">{stats.inactive}</p>
              </div>
              <Users className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, contact, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {US_STATES.map(state => (
              <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Partners Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Partners ({filteredPartners.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Loading partners...</p>
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No partners found</h3>
              <p className="text-muted-foreground mb-4">
                {partners.length === 0 
                  ? "Add your first partner to get started"
                  : "Try adjusting your filters"}
              </p>
              <Button onClick={() => navigate('/crm/toptier-experience/partner/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Partner
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Company</th>
                    <th className="text-left py-3 px-4 font-medium">Contact</th>
                    <th className="text-left py-3 px-4 font-medium">Category</th>
                    <th className="text-left py-3 px-4 font-medium">Location</th>
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
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{partner.company_name}</p>
                            {partner.website && (
                              <p className="text-xs text-muted-foreground">{partner.website}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <p className="text-sm">{partner.contact_name || 'No contact'}</p>
                          {partner.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {partner.phone}
                            </div>
                          )}
                          {partner.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {partner.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(partner.partner_category)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {partner.city ? `${partner.city}, ` : ''}{partner.state || 'N/A'}
                          </span>
                        </div>
                        {partner.service_area && partner.service_area.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            +{partner.service_area.length} service area(s)
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(partner.contract_status || 'pending')}
                      </td>
                      <td className="py-3 px-4 text-right">
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
