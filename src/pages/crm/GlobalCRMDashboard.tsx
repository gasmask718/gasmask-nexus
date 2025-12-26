/**
 * Global CRM Dashboard - Floor 1 Business Selector
 * Shows ALL businesses and allows navigation to business-specific CRMs
 * This is the hub - actual CRM data is at /crm/:businessSlug
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import CRMLayout from './CRMLayout';
import {
  Building2, Search, Plus, Settings, RefreshCw, LayoutGrid, List, ChevronRight,
  Users, Briefcase, Calendar, Star
} from 'lucide-react';

interface BusinessCard {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  business_type?: string | null;
  industry?: string | null;
  is_active: boolean;
  created_at: string;
}

export default function GlobalCRMDashboard() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { simulationMode } = useSimulationMode();

  // Fetch ALL active businesses - this is the canonical source
  const { data: allBusinesses = [], isLoading: businessesLoading, refetch } = useQuery({
    queryKey: ['global-crm-all-businesses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, slug, logo_url, business_type, industry, is_active, created_at')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as BusinessCard[];
    },
  });

  // Filter businesses by search
  const filteredBusinesses = useMemo(() => {
    if (!searchTerm) return allBusinesses;
    const term = searchTerm.toLowerCase();
    return allBusinesses.filter(b => 
      b.name.toLowerCase().includes(term) ||
      b.industry?.toLowerCase().includes(term) ||
      b.business_type?.toLowerCase().includes(term)
    );
  }, [allBusinesses, searchTerm]);

  // Navigate to business-specific CRM using path-based routing
  const handleBusinessClick = (businessSlug: string) => {
    navigate(`/crm/${businessSlug}`);
  };

  return (
    <CRMLayout title="Global CRM">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Global CRM</h1>
              {simulationMode && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground mt-1">
              Business-configurable CRM for all entities • Select a business to view its CRM
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate('/crm/settings')}>
              <Settings className="h-4 w-4 mr-2" />
              CRM Settings
            </Button>
            <Button onClick={() => navigate('/crm/add-business')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Business
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="p-4 bg-cyan-500/10 border-cyan-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Businesses</p>
                <p className="text-2xl font-bold">{allBusinesses.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-green-500/10 border-green-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20 text-green-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active CRMs</p>
                <p className="text-2xl font-bold">{allBusinesses.filter(b => b.is_active).length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-purple-500/10 border-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-600">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Industries</p>
                <p className="text-2xl font-bold">
                  {new Set(allBusinesses.map(b => b.industry).filter(Boolean)).size}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-amber-500/10 border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">
                  {allBusinesses.filter(b => {
                    const created = new Date(b.created_at);
                    const now = new Date();
                    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and View Toggle */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search businesses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Businesses Grid/List */}
        {businessesLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-24 bg-muted rounded" />
              </Card>
            ))}
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchTerm ? 'No Matching Businesses' : 'No Businesses Found'}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {searchTerm 
                ? `No businesses match "${searchTerm}"`
                : 'Add your first business to get started with the Global CRM'
              }
            </p>
            <Button onClick={() => navigate('/crm/add-business')} size="lg">
              <Plus className="mr-2 h-5 w-5" />
              Add Business
            </Button>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBusinesses.map((business) => (
              <Card
                key={business.id}
                className="p-6 cursor-pointer hover:shadow-lg transition-all group border-t-4"
                style={{ borderTopColor: 'hsl(var(--primary))' }}
                onClick={() => handleBusinessClick(business.slug)}
              >
                <div className="flex items-start justify-between mb-4">
                  {business.logo_url ? (
                    <img
                      src={business.logo_url}
                      alt={business.name}
                      className="w-12 h-12 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {business.name.charAt(0)}
                    </div>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {business.industry || 'General'}
                  </Badge>
                </div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                  {business.name}
                </h3>
                {business.business_type && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {business.business_type}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>View CRM</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="divide-y">
              {filteredBusinesses.map((business) => (
                <div
                  key={business.id}
                  className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors group"
                  onClick={() => handleBusinessClick(business.slug)}
                >
                  {business.logo_url ? (
                    <img
                      src={business.logo_url}
                      alt={business.name}
                      className="w-10 h-10 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {business.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                      {business.name}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {business.industry || 'General'} • {business.business_type || 'Business'}
                    </p>
                  </div>
                  <Badge variant="outline">Active</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Data Management Links */}
        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <Button variant="outline" onClick={() => navigate('/crm/data')}>
                <Building2 className="h-4 w-4 mr-2" />
                View All Data
              </Button>
              <Button variant="outline" onClick={() => navigate('/crm/data/export')}>
                Export Data
              </Button>
              <Button variant="outline" onClick={() => navigate('/crm/data/import')}>
                Import Data
              </Button>
              <Button variant="outline" onClick={() => navigate('/crm/data/backup')}>
                Backup Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </CRMLayout>
  );
}
