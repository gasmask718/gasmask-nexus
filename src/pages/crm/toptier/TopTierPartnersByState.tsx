/**
 * TopTier Partners by State
 * State-based discovery view showing partner coverage
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, Search, MapPin, Building2, ChevronRight, 
  AlertCircle, CheckCircle, Users
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';

export default function TopTierPartnersByState() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState<string | null>(null);
  
  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  // Get partner data
  const simulatedPartners = getEntityData('partner');
  const { data: partners, isSimulated } = useResolvedData([], simulatedPartners);

  // Calculate state coverage
  const stateCoverage = useMemo(() => {
    const coverage: Record<string, {
      state: string;
      stateLabel: string;
      totalPartners: number;
      categories: Map<string, number>;
      partners: any[];
    }> = {};

    // Initialize all states
    US_STATES.forEach(state => {
      coverage[state.value] = {
        state: state.value,
        stateLabel: state.label,
        totalPartners: 0,
        categories: new Map(),
        partners: [],
      };
    });

    // Count partners per state
    partners.forEach((partner: any) => {
      const states = new Set<string>();
      if (partner.state) states.add(partner.state);
      if (partner.service_area) partner.service_area.forEach((s: string) => states.add(s));

      states.forEach(state => {
        if (coverage[state]) {
          coverage[state].totalPartners++;
          coverage[state].partners.push(partner);
          
          const category = partner.partner_category;
          const currentCount = coverage[state].categories.get(category) || 0;
          coverage[state].categories.set(category, currentCount + 1);
        }
      });
    });

    return Object.values(coverage)
      .filter(s => {
        if (!searchTerm) return true;
        return s.stateLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
               s.state.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => b.totalPartners - a.totalPartners);
  }, [partners, searchTerm]);

  // States with partners vs without
  const statesWithPartners = stateCoverage.filter(s => s.totalPartners > 0);
  const statesWithoutPartners = stateCoverage.filter(s => s.totalPartners === 0);

  // Get selected state details
  const selectedStateData = selectedState 
    ? stateCoverage.find(s => s.state === selectedState)
    : null;

  // Get category breakdown for selected state
  const categoryBreakdown = useMemo(() => {
    if (!selectedStateData) return [];
    
    return TOPTIER_PARTNER_CATEGORIES
      .filter(cat => cat.value !== 'other')
      .map(category => ({
        ...category,
        count: selectedStateData.categories.get(category.value) || 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [selectedStateData]);

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
              <h1 className="text-2xl font-bold">Partners by State</h1>
              {isSimulated && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">
              Discover partner coverage across all states
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{statesWithPartners.length}</p>
                <p className="text-sm text-muted-foreground">States with Partners</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{statesWithoutPartners.length}</p>
                <p className="text-sm text-muted-foreground">States Need Coverage</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-cyan-500" />
              <div>
                <p className="text-2xl font-bold">{partners.length}</p>
                <p className="text-sm text-muted-foreground">Total Partners</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* State List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search states..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* States with Partners */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                States with Partners ({statesWithPartners.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {statesWithPartners.map(state => (
                  <div 
                    key={state.state}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedState === state.state 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'hover:bg-muted/50 border border-transparent'
                    }`}
                    onClick={() => setSelectedState(state.state)}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{state.stateLabel}</p>
                        <p className="text-sm text-muted-foreground">
                          {state.categories.size} categories
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{state.totalPartners} partners</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* States without Partners */}
          {statesWithoutPartners.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  Need Coverage ({statesWithoutPartners.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {statesWithoutPartners.map(state => (
                    <Badge 
                      key={state.state} 
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => setSelectedState(state.state)}
                    >
                      {state.state}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* State Detail Panel */}
        <div className="space-y-4">
          {selectedStateData ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {selectedStateData.stateLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <p className="text-4xl font-bold">{selectedStateData.totalPartners}</p>
                    <p className="text-muted-foreground">Total Partners</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Categories Available</CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryBreakdown.filter(c => c.count > 0).length > 0 ? (
                    <div className="space-y-2">
                      {categoryBreakdown.filter(c => c.count > 0).map(category => (
                        <div 
                          key={category.value}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => navigate(`/crm/toptier-experience/partners/${category.value}?state=${selectedState}`)}
                        >
                          <span className="text-sm">{category.label}</span>
                          <Badge variant="secondary">{category.count}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <Building2 className="h-8 w-8 mx-auto mb-2" />
                      <p>No partners in this state yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedStateData.totalPartners > 0 && (
                <Button 
                  className="w-full"
                  onClick={() => navigate(`/crm/toptier-experience/partner?state=${selectedState}`)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  View All Partners in {selectedStateData.state}
                </Button>
              )}
            </>
          ) : (
            <Card className="p-8 text-center">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Select a State</h3>
              <p className="text-sm text-muted-foreground">
                Click on a state to see partner coverage details
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
