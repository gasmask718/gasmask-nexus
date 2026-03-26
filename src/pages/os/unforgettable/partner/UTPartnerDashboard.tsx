import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Building2, Package, Image, Calendar, BarChart3, Settings, 
  Sparkles, ListChecks, DollarSign, Users, ChevronRight,
  Star, Eye, MessageSquare, TrendingUp, CheckCircle2, Clock,
  Layers, UtensilsCrossed, Palette, UserCog, Brain
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAllPartners } from '@/hooks/useUTPartnerPortal';
import UTPartnerOverview from './tabs/UTPartnerOverview';
import UTPartnerProfile from './tabs/UTPartnerProfile';
import UTPartnerServices from './tabs/UTPartnerServices';
import UTPartnerListings from './tabs/UTPartnerListings';
import UTPartnerMedia from './tabs/UTPartnerMedia';
import UTPartnerBookings from './tabs/UTPartnerBookings';
import UTPartnerAvailability from './tabs/UTPartnerAvailability';
import UTPartnerAnalytics from './tabs/UTPartnerAnalytics';
import UTPartnerAIStudio from './tabs/UTPartnerAIStudio';
import UTAIBusinessBuilder from './tabs/UTAIBusinessBuilder';
import UTVenueModule from './modules/UTVenueModule';
import UTRentalModule from './modules/UTRentalModule';
import UTCateringModule from './modules/UTCateringModule';
import UTDecoratorModule from './modules/UTDecoratorModule';

const CATEGORY_ICONS: Record<string, any> = {
  event_hall: Building2,
  party_rental: Package,
  caterer: UtensilsCrossed,
  bartender: UtensilsCrossed,
  decorator: Palette,
  staff_provider: UserCog,
  photographer: Image,
  videographer: Image,
  dj: Sparkles,
  florist: Sparkles,
  planner: ListChecks,
  entertainment: Star,
  bakery: UtensilsCrossed,
  lighting: Sparkles,
  photo_booth: Image,
  other: Layers,
};

const CATEGORY_LABELS: Record<string, string> = {
  event_hall: 'Event Hall / Venue',
  party_rental: 'Party Rental Company',
  caterer: 'Catering',
  bartender: 'Bartending',
  decorator: 'Decorator / Creative',
  staff_provider: 'Staff / Service Provider',
  photographer: 'Photography',
  videographer: 'Videography',
  dj: 'DJ / Music',
  florist: 'Florist',
  planner: 'Event Planner',
  entertainment: 'Entertainment',
  bakery: 'Bakery / Desserts',
  lighting: 'Lighting',
  photo_booth: 'Photo Booth',
  other: 'Other',
};

export default function UTPartnerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  const selectedPartnerId = searchParams.get('partner');
  const { data: partners = [], isLoading } = useAllPartners();
  
  const selectedPartner = partners.find(p => p.id === selectedPartnerId);
  const partnerCategory = selectedPartner?.category || 'other';

  const setTab = (tab: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params);
  };

  const selectPartner = (id: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('partner', id);
    params.set('tab', 'overview');
    setSearchParams(params);
  };

  // Category-specific tabs
  const getCategoryTabs = () => {
    switch (partnerCategory) {
      case 'event_hall':
        return [{ id: 'venue', label: 'Spaces & Venue', icon: Building2 }];
      case 'party_rental':
        return [{ id: 'inventory', label: 'Inventory', icon: Package }];
      case 'caterer':
      case 'bartender':
        return [{ id: 'menus', label: 'Menus & Packages', icon: UtensilsCrossed }];
      case 'decorator':
        return [{ id: 'portfolio', label: 'Creative Studio', icon: Palette }];
      case 'staff_provider':
        return [{ id: 'team', label: 'Team & Roles', icon: UserCog }];
      default:
        return [];
    }
  };

  const coreTabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: Building2 },
    { id: 'services', label: 'Services', icon: ListChecks },
    { id: 'listings', label: 'Listings', icon: Layers },
    { id: 'media', label: 'Media Library', icon: Image },
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    { id: 'availability', label: 'Availability', icon: Clock },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'ai-studio', label: 'AI Studio', icon: Sparkles },
  ];

  const allTabs = [...coreTabs, ...getCategoryTabs()];

  // Partner selector view
  if (!selectedPartnerId) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Partner Portal
          </h1>
          <p className="text-muted-foreground mt-1">Manage marketplace partners and their listings</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Partners', value: partners.length, icon: Users, color: 'text-blue-500' },
            { label: 'Verified', value: partners.filter(p => p.is_verified).length, icon: CheckCircle2, color: 'text-emerald-500' },
            { label: 'Featured', value: partners.filter(p => p.is_featured).length, icon: Star, color: 'text-amber-500' },
            { label: 'Categories', value: new Set(partners.map(p => p.category)).size, icon: Layers, color: 'text-purple-500' },
          ].map(stat => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <stat.icon className={`h-8 w-8 ${stat.color} opacity-80`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Partners Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-40" />
              </Card>
            ))
          ) : partners.length === 0 ? (
            <Card className="col-span-full border-dashed">
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No partners yet</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Partners will appear here as they register</p>
              </CardContent>
            </Card>
          ) : (
            partners.map(partner => {
              const CatIcon = CATEGORY_ICONS[partner.category] || Layers;
              return (
                <Card 
                  key={partner.id}
                  className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                  onClick={() => selectPartner(partner.id)}
                >
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <CatIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                            {partner.business_name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {CATEGORY_LABELS[partner.category] || partner.category}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      {partner.is_verified && (
                        <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                        </Badge>
                      )}
                      {partner.is_featured && (
                        <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                          <Star className="h-3 w-3 mr-1" /> Featured
                        </Badge>
                      )}
                      {partner.address_city && (
                        <Badge variant="outline" className="text-[10px]">
                          {partner.address_city}, {partner.address_state}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {partner.total_bookings || 0} bookings
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" /> {partner.avg_rating || '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" /> {partner.profile_completeness || 0}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Partner detail dashboard
  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => {
            const params = new URLSearchParams(searchParams);
            params.delete('partner');
            params.set('tab', 'overview');
            setSearchParams(params);
          }}>
            ← Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{selectedPartner?.business_name || 'Partner'}</h1>
              {selectedPartner?.is_verified && (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {CATEGORY_LABELS[partnerCategory]} • {selectedPartner?.address_city}, {selectedPartner?.address_state}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {allTabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-xs gap-1.5 data-[state=active]:bg-background">
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <UTPartnerOverview partnerId={selectedPartnerId!} category={partnerCategory} />
        </TabsContent>
        <TabsContent value="profile">
          <UTPartnerProfile partnerId={selectedPartnerId!} />
        </TabsContent>
        <TabsContent value="services">
          <UTPartnerServices partnerId={selectedPartnerId!} />
        </TabsContent>
        <TabsContent value="listings">
          <UTPartnerListings partnerId={selectedPartnerId!} />
        </TabsContent>
        <TabsContent value="media">
          <UTPartnerMedia partnerId={selectedPartnerId!} />
        </TabsContent>
        <TabsContent value="bookings">
          <UTPartnerBookings partnerId={selectedPartnerId!} />
        </TabsContent>
        <TabsContent value="availability">
          <UTPartnerAvailability partnerId={selectedPartnerId!} />
        </TabsContent>
        <TabsContent value="analytics">
          <UTPartnerAnalytics partnerId={selectedPartnerId!} />
        </TabsContent>
        <TabsContent value="ai-studio">
          <UTPartnerAIStudio partnerId={selectedPartnerId!} category={partnerCategory} />
        </TabsContent>

        {/* Category-specific tabs */}
        <TabsContent value="venue">
          <UTVenueModule partnerId={selectedPartnerId!} />
        </TabsContent>
        <TabsContent value="inventory">
          <UTRentalModule partnerId={selectedPartnerId!} />
        </TabsContent>
        <TabsContent value="menus">
          <UTCateringModule partnerId={selectedPartnerId!} />
        </TabsContent>
        <TabsContent value="portfolio">
          <UTDecoratorModule partnerId={selectedPartnerId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
