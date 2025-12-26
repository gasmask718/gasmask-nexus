/**
 * TopTier Partner Dashboard
 * KPI grid with each partner category as its own card
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Building2, Users, MapPin, Search, Plus, Eye, 
  Car, Sparkles, Home, Plane, ChefHat, Truck, Bus, 
  PartyPopper, Shield, Hotel, Castle, Building, Camera, 
  Ticket, Ship, Waves, Utensils, Music, MoreHorizontal,
  ArrowRight, TrendingUp, Filter
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';

// Icon mapping for partner categories
const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  car_decor_promo: Car,
  exotic_rental_car_promo: Sparkles,
  room_decor_promo: Home,
  helicopter_promo: Plane,
  private_chef_promo: ChefHat,
  black_trucks_promo: Truck,
  sprinter_van_promo: Bus,
  party_bus_promo: PartyPopper,
  security_promo: Shield,
  hotel_rooms: Hotel,
  luxury_residences: Castle,
  eventspaces_rooftop: Building,
  photography_videography: Camera,
  amusementparks_affiliate: Ticket,
  yachts: Ship,
  car_jetskis: Waves,
  restaurant_decor_reservations: Utensils,
  club_lounge_package: Music,
  other: MoreHorizontal,
};

// Color mapping for categories
const CATEGORY_COLORS: Record<string, string> = {
  car_decor_promo: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  exotic_rental_car_promo: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  room_decor_promo: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  helicopter_promo: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  private_chef_promo: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  black_trucks_promo: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  sprinter_van_promo: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  party_bus_promo: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  security_promo: 'bg-red-500/10 text-red-500 border-red-500/20',
  hotel_rooms: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  luxury_residences: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  eventspaces_rooftop: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  photography_videography: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  amusementparks_affiliate: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  yachts: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  car_jetskis: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  restaurant_decor_reservations: 'bg-lime-500/10 text-lime-500 border-lime-500/20',
  club_lounge_package: 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20',
  other: 'bg-gray-400/10 text-gray-400 border-gray-400/20',
};

export default function TopTierPartnerDashboard() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  
  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  // Get partner data (real or simulated)
  const simulatedPartners = getEntityData('partner');
  const { data: partners, isSimulated } = useResolvedData([], simulatedPartners);

  // Calculate category stats
  const categoryStats = useMemo(() => {
    const filteredPartners = stateFilter === 'all' 
      ? partners 
      : partners.filter((p: any) => 
          p.state === stateFilter || 
          (p.service_area && p.service_area.includes(stateFilter))
        );

    return TOPTIER_PARTNER_CATEGORIES.filter(cat => cat.value !== 'other').map(category => {
      const categoryPartners = filteredPartners.filter((p: any) => p.partner_category === category.value);
      const uniqueStates = new Set<string>();
      
      categoryPartners.forEach((p: any) => {
        if (p.state) uniqueStates.add(p.state);
        if (p.service_area) {
          p.service_area.forEach((s: string) => uniqueStates.add(s));
        }
      });

      const activePartners = categoryPartners.filter((p: any) => p.contract_status === 'active');

      return {
        ...category,
        totalPartners: categoryPartners.length,
        activePartners: activePartners.length,
        statesCovered: uniqueStates.size,
        states: Array.from(uniqueStates),
      };
    }).filter(cat => {
      if (!searchTerm) return true;
      return cat.label.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [partners, stateFilter, searchTerm]);

  // Calculate total stats
  const totalStats = useMemo(() => {
    const uniqueStates = new Set<string>();
    partners.forEach((p: any) => {
      if (p.state) uniqueStates.add(p.state);
      if (p.service_area) {
        p.service_area.forEach((s: string) => uniqueStates.add(s));
      }
    });

    const activePartners = partners.filter((p: any) => p.contract_status === 'active');
    const categoriesWithPartners = new Set(partners.map((p: any) => p.partner_category));

    return {
      totalPartners: partners.length,
      activePartners: activePartners.length,
      statesCovered: uniqueStates.size,
      categoriesActive: categoriesWithPartners.size,
    };
  }, [partners]);

  const handleCategoryClick = (categoryValue: string) => {
    navigate(`/crm/toptier-experience/partners/${categoryValue}`);
  };

  const handleViewAllPartners = () => {
    navigate('/crm/toptier-experience/partner');
  };

  const handleViewByState = () => {
    navigate('/crm/toptier-experience/partners/states');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Partner Command Center</h1>
            {isSimulated && <SimulationBadge />}
          </div>
          <p className="text-muted-foreground">Manage your experience partners across all categories</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleViewByState}>
            <MapPin className="h-4 w-4 mr-2" />
            View by State
          </Button>
          <Button variant="outline" onClick={handleViewAllPartners}>
            <Users className="h-4 w-4 mr-2" />
            All Partners
          </Button>
          <Button onClick={() => navigate('/crm/toptier-experience/partner/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Partner
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Partners</p>
                <p className="text-3xl font-bold">{totalStats.totalPartners}</p>
              </div>
              <Building2 className="h-8 w-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Contracts</p>
                <p className="text-3xl font-bold">{totalStats.activePartners}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">States Covered</p>
                <p className="text-3xl font-bold">{totalStats.statesCovered}</p>
              </div>
              <MapPin className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Categories</p>
                <p className="text-3xl font-bold">{totalStats.categoriesActive}</p>
              </div>
              <Filter className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {US_STATES.map(state => (
              <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categoryStats.map((category) => {
          const IconComponent = CATEGORY_ICONS[category.value] || Building2;
          const colorClasses = CATEGORY_COLORS[category.value] || CATEGORY_COLORS.other;

          return (
            <Card 
              key={category.value}
              className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${category.totalPartners === 0 ? 'opacity-60' : ''}`}
              onClick={() => handleCategoryClick(category.value)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg border ${colorClasses}`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  {category.totalPartners > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {category.activePartners} active
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-sm font-medium mt-2 line-clamp-2">
                  {category.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Partners</span>
                    <span className="font-bold text-lg">{category.totalPartners}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">States Covered</span>
                    <span className="font-medium">{category.statesCovered}</span>
                  </div>
                  {category.statesCovered > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {category.states.slice(0, 4).map(state => (
                        <Badge key={state} variant="outline" className="text-xs">
                          {state}
                        </Badge>
                      ))}
                      {category.states.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{category.states.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2 text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCategoryClick(category.value);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {categoryStats.length === 0 && (
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No categories found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchTerm ? 'Try adjusting your search' : 'Add partners to see categories'}
          </p>
          <Button onClick={() => navigate('/crm/toptier-experience/partner/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Partner
          </Button>
        </Card>
      )}
    </div>
  );
}
