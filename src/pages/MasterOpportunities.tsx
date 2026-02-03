import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Target, 
  Search,
  Store,
  Package,
  ShoppingCart,
  Sparkles,
  UserX,
  Gift,
  RefreshCw,
  ExternalLink,
  User,
  Clock,
  Lightbulb,
  CheckCircle2,
  Circle,
  Eye,
  AlertCircle,
  X,
} from 'lucide-react';
import { format, isToday, isThisWeek } from 'date-fns';
import { useGlobalTubeIntelligence, useTubeIntelSummary, TUBE_BRANDS } from '@/hooks/useTubeIntelligence';
import { useStoreOpportunities, useOpportunitiesSummary, useCompleteOpportunity, useReopenOpportunity } from '@/hooks/useStoreOpportunities';
import { ExportButton } from '@/components/crud/ExportButton';
import { DataTablePagination } from '@/components/crud/DataTablePagination';
import { toast } from 'sonner';

type SignalTab = 'all' | 'needs_order' | 'bring_samples' | 'starter_kit' | 'not_introduced' | 'not_interested';
type TimeFilter = 'all' | 'today' | 'this_week';
type OpportunityFilter = 'all' | 'pending' | 'completed';

interface StoreIntelRow {
  id: string;
  store_id: string;
  store_name: string;
  brand_id: string;
  brand_name: string;
  product_introduced: boolean;
  owner_interested: boolean | null;
  needs_order: boolean;
  bring_samples: boolean;
  bring_starter_kit: boolean;
  has_ever_ordered: boolean;
  last_order_date: string | null;
  last_updated_by: string | null;
  last_updated_by_role: string | null;
  last_updated_at: string;
  city: string | null;
  borough: string | null;
}

export default function MasterOpportunities() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Main section tabs
  const [mainTab, setMainTab] = useState<'signals' | 'opportunities'>('signals');
  
  // Derive active signal from URL (single source of truth)
  const activeSignalTab: SignalTab = (searchParams.get('signal') as SignalTab) || 'all';
  
  // Signals filters
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Opportunities filters
  const [oppSearchQuery, setOppSearchQuery] = useState('');
  const [oppStatusFilter, setOppStatusFilter] = useState<OpportunityFilter>('pending');
  const [oppCurrentPage, setOppCurrentPage] = useState(1);
  const [oppPageSize, setOppPageSize] = useState(25);

  // Fetch signal summary counts
  const { data: signalSummary, isLoading: signalSummaryLoading } = useTubeIntelSummary();

  // Fetch opportunities summary
  const { data: oppSummary, isLoading: oppSummaryLoading } = useOpportunitiesSummary();

  // Build filter based on active signal tab (derived from URL)
  const filters = useMemo(() => {
    const baseFilters: Record<string, boolean> = {};
    
    switch (activeSignalTab) {
      case 'needs_order':
        baseFilters.needsOrder = true;
        break;
      case 'bring_samples':
        baseFilters.bringSamples = true;
        break;
      case 'starter_kit':
        baseFilters.bringStarterKit = true;
        break;
      case 'not_introduced':
        baseFilters.notIntroduced = true;
        break;
      case 'not_interested':
        baseFilters.introducedNotInterested = true;
        break;
    }
    
    return baseFilters;
  }, [activeSignalTab]);

  const { data: rawSignalData, isLoading: signalsLoading, refetch: refetchSignals } = useGlobalTubeIntelligence(filters);
  const { data: rawOpportunities, isLoading: opportunitiesLoading, refetch: refetchOpportunities } = useStoreOpportunities();
  const completeOpportunity = useCompleteOpportunity();
  const reopenOpportunity = useReopenOpportunity();

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSignalTab]);

  // Transform signal data
  const signalRows: StoreIntelRow[] = useMemo(() => {
    if (!rawSignalData) return [];
    
    return rawSignalData.map((item: any) => ({
      id: item.id,
      store_id: item.store_id,
      store_name: item.store?.name || item.store?.store_name || 'Unknown Store',
      brand_id: item.brand_id,
      brand_name: item.brand_name,
      product_introduced: item.product_introduced,
      owner_interested: item.owner_interested,
      needs_order: item.needs_order,
      bring_samples: item.bring_samples,
      bring_starter_kit: item.bring_starter_kit,
      has_ever_ordered: item.has_ever_ordered,
      last_order_date: item.last_order_date,
      last_updated_by: item.last_updated_by,
      last_updated_by_role: item.last_updated_by_role,
      last_updated_at: item.last_updated_at,
      city: item.store?.address_city || item.store?.city || null,
      borough: item.store?.borough || null,
    }));
  }, [rawSignalData]);

  // Apply client-side filters to signals
  const filteredSignalRows = useMemo(() => {
    return signalRows.filter(row => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          row.store_name.toLowerCase().includes(query) ||
          row.brand_name.toLowerCase().includes(query) ||
          (row.city?.toLowerCase().includes(query) ?? false) ||
          (row.borough?.toLowerCase().includes(query) ?? false);
        if (!matchesSearch) return false;
      }

      if (brandFilter !== 'all' && row.brand_id !== brandFilter) {
        return false;
      }

      if (roleFilter !== 'all' && row.last_updated_by_role !== roleFilter) {
        return false;
      }

      if (timeFilter !== 'all') {
        const updateDate = new Date(row.last_updated_at);
        if (timeFilter === 'today' && !isToday(updateDate)) {
          return false;
        }
        if (timeFilter === 'this_week' && !isThisWeek(updateDate)) {
          return false;
        }
      }

      return true;
    });
  }, [signalRows, searchQuery, brandFilter, roleFilter, timeFilter]);

  // Apply client-side filters to opportunities
  const filteredOpportunities = useMemo(() => {
    if (!rawOpportunities) return [];
    
    return rawOpportunities.filter(opp => {
      if (oppSearchQuery) {
        const query = oppSearchQuery.toLowerCase();
        const matchesSearch = 
          opp.opportunity_text.toLowerCase().includes(query) ||
          (opp.store?.store_name?.toLowerCase().includes(query) ?? false);
        if (!matchesSearch) return false;
      }

      if (oppStatusFilter === 'pending' && opp.is_completed) {
        return false;
      }
      if (oppStatusFilter === 'completed' && !opp.is_completed) {
        return false;
      }

      return true;
    });
  }, [rawOpportunities, oppSearchQuery, oppStatusFilter]);

  // Pagination for signals
  const signalTotalPages = Math.ceil(filteredSignalRows.length / pageSize);
  const paginatedSignalRows = filteredSignalRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Pagination for opportunities
  const oppTotalPages = Math.ceil(filteredOpportunities.length / oppPageSize);
  const paginatedOpportunities = filteredOpportunities.slice(
    (oppCurrentPage - 1) * oppPageSize,
    oppCurrentPage * oppPageSize
  );

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const handleOppFilterChange = () => {
    setOppCurrentPage(1);
  };

  const handleViewStore = (storeId: string) => {
    navigate(`/stores/${storeId}`);
  };

  // Signal tab click handler - updates URL which triggers refetch
  const handleSignalTabClick = useCallback((tab: SignalTab) => {
    if (tab === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ signal: tab });
    }
  }, [setSearchParams]);

  // Clear filter handler
  const handleClearFilter = useCallback(() => {
    setSearchParams({});
    setSearchQuery('');
    setBrandFilter('all');
    setRoleFilter('all');
    setTimeFilter('all');
  }, [setSearchParams]);

  const handleCompleteOpportunity = async (id: string) => {
    try {
      await completeOpportunity.mutateAsync({ id });
      toast.success('Opportunity marked as completed');
    } catch (error) {
      toast.error('Failed to complete opportunity');
    }
  };

  const handleReopenOpportunity = async (id: string) => {
    try {
      await reopenOpportunity.mutateAsync(id);
      toast.success('Opportunity reopened');
    } catch (error) {
      toast.error('Failed to reopen opportunity');
    }
  };

  // Get signal badges for a row
  const getSignalBadges = (row: StoreIntelRow) => {
    const badges: JSX.Element[] = [];
    
    if (row.needs_order) {
      badges.push(
        <Badge key="needs_order" variant="default" className="bg-yellow-500 text-yellow-950 text-xs">
          <ShoppingCart className="h-3 w-3 mr-1" />
          Needs Order
        </Badge>
      );
    }
    if (row.bring_samples) {
      badges.push(
        <Badge key="bring_samples" variant="default" className="bg-blue-500 text-white text-xs">
          <Package className="h-3 w-3 mr-1" />
          Bring Samples
        </Badge>
      );
    }
    if (row.bring_starter_kit) {
      badges.push(
        <Badge key="starter_kit" variant="default" className="bg-purple-500 text-white text-xs">
          <Gift className="h-3 w-3 mr-1" />
          Starter Kit
        </Badge>
      );
    }
    if (!row.product_introduced) {
      badges.push(
        <Badge key="not_introduced" variant="outline" className="border-gray-400 text-gray-600 text-xs">
          <Sparkles className="h-3 w-3 mr-1" />
          Not Introduced
        </Badge>
      );
    }
    if (row.product_introduced && row.owner_interested === false) {
      badges.push(
        <Badge key="not_interested" variant="destructive" className="text-xs">
          <UserX className="h-3 w-3 mr-1" />
          Not Interested
        </Badge>
      );
    }
    
    return badges;
  };

  const getRoleBadge = (role: string | null) => {
    if (!role) return null;
    
    const roleColors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      va: 'bg-orange-100 text-orange-800',
      ambassador: 'bg-green-100 text-green-800',
      biker: 'bg-blue-100 text-blue-800',
      driver: 'bg-gray-100 text-gray-800',
    };
    
    return (
      <Badge variant="secondary" className={`text-xs ${roleColors[role] || ''}`}>
        <User className="h-3 w-3 mr-1" />
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  // Export data format
  const signalExportColumns = [
    { key: 'store_name', label: 'Store Name' },
    { key: 'brand_name', label: 'Brand' },
    { key: 'last_order_date', label: 'Last Order' },
    { key: 'needs_order', label: 'Needs Order' },
    { key: 'bring_samples', label: 'Bring Samples' },
    { key: 'bring_starter_kit', label: 'Starter Kit' },
    { key: 'product_introduced', label: 'Introduced' },
    { key: 'owner_interested', label: 'Interested' },
    { key: 'last_updated_by_role', label: 'Reported By' },
    { key: 'last_updated_at', label: 'Last Updated' },
  ];

  const oppExportColumns = [
    { key: 'store.store_name', label: 'Store Name' },
    { key: 'opportunity_text', label: 'Opportunity' },
    { key: 'source', label: 'Source' },
    { key: 'is_completed', label: 'Completed' },
    { key: 'created_at', label: 'Created At' },
  ];

  const isLoading = signalsLoading || signalSummaryLoading || opportunitiesLoading || oppSummaryLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            All Opportunities
          </h1>
          <p className="text-muted-foreground mt-2">
            Store Intelligence & Human-Created Action Candidates
          </p>
        </div>
      </div>

      {/* Main Section Tabs */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'signals' | 'opportunities')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="signals" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Store Intelligence
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Opportunities ({oppSummary?.pending || 0})
          </TabsTrigger>
        </TabsList>

        {/* SECTION 1: STORE INTELLIGENCE (SIGNALS) */}
        <TabsContent value="signals" className="space-y-6">
          {/* Governance Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Signals Board — Observational Only. No actions are auto-created.
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Observational signals from field teams — for route planning and visit preparation
              </p>
            </div>
          </div>

          {/* Signal Summary Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${activeSignalTab === 'needs_order' ? 'ring-2 ring-yellow-500 shadow-md' : 'hover:bg-muted/50'}`}
              onClick={() => handleSignalTabClick('needs_order')}
            >
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Needs Order</p>
                    <p className="text-2xl font-bold text-yellow-600">{signalSummary?.needsOrder || 0}</p>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-yellow-500 opacity-50" />
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-2 text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  View Details
                </Button>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${activeSignalTab === 'bring_samples' ? 'ring-2 ring-blue-500 shadow-md' : 'hover:bg-muted/50'}`}
              onClick={() => handleSignalTabClick('bring_samples')}
            >
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Bring Samples</p>
                    <p className="text-2xl font-bold text-blue-600">{signalSummary?.bringSamples || 0}</p>
                  </div>
                  <Package className="h-8 w-8 text-blue-500 opacity-50" />
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-2 text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  View Details
                </Button>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${activeSignalTab === 'starter_kit' ? 'ring-2 ring-purple-500 shadow-md' : 'hover:bg-muted/50'}`}
              onClick={() => handleSignalTabClick('starter_kit')}
            >
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Starter Kit</p>
                    <p className="text-2xl font-bold text-purple-600">{signalSummary?.bringStarterKit || 0}</p>
                  </div>
                  <Gift className="h-8 w-8 text-purple-500 opacity-50" />
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-2 text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  View Details
                </Button>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${activeSignalTab === 'not_introduced' ? 'ring-2 ring-gray-500 shadow-md' : 'hover:bg-muted/50'}`}
              onClick={() => handleSignalTabClick('not_introduced')}
            >
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Not Introduced</p>
                    <p className="text-2xl font-bold text-gray-600">{signalSummary?.notIntroduced || 0}</p>
                  </div>
                  <Sparkles className="h-8 w-8 text-gray-500 opacity-50" />
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-2 text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  View Details
                </Button>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${activeSignalTab === 'not_interested' ? 'ring-2 ring-red-500 shadow-md' : 'hover:bg-muted/50'}`}
              onClick={() => handleSignalTabClick('not_interested')}
            >
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Not Interested</p>
                    <p className="text-2xl font-bold text-red-600">{signalSummary?.introducedNotInterested || 0}</p>
                  </div>
                  <UserX className="h-8 w-8 text-red-500 opacity-50" />
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-2 text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  View Details
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Active Filter Indicator */}
          {activeSignalTab !== 'all' && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
              <span className="text-sm text-muted-foreground">Filtering by:</span>
              <Badge variant="secondary" className="flex items-center gap-1">
                {activeSignalTab === 'needs_order' && <><ShoppingCart className="h-3 w-3" /> Needs Order</>}
                {activeSignalTab === 'bring_samples' && <><Package className="h-3 w-3" /> Bring Samples</>}
                {activeSignalTab === 'starter_kit' && <><Gift className="h-3 w-3" /> Starter Kit</>}
                {activeSignalTab === 'not_introduced' && <><Sparkles className="h-3 w-3" /> Not Introduced</>}
                {activeSignalTab === 'not_interested' && <><UserX className="h-3 w-3" /> Not Interested</>}
              </Badge>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearFilter}
                className="ml-auto text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear Filter
              </Button>
            </div>
          )}

          {/* Signals Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search stores, brands, or locations..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); handleFilterChange(); }}
                    className="pl-10"
                  />
                </div>
                
                <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v); handleFilterChange(); }}>
                  <SelectTrigger className="w-full lg:w-[180px]">
                    <SelectValue placeholder="All Brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {TUBE_BRANDS.map(brand => (
                      <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); handleFilterChange(); }}>
                  <SelectTrigger className="w-full lg:w-[180px]">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="ambassador">Ambassador</SelectItem>
                    <SelectItem value="biker">Biker</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="va">VA</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={timeFilter} onValueChange={(v) => { setTimeFilter(v as TimeFilter); handleFilterChange(); }}>
                  <SelectTrigger className="w-full lg:w-[180px]">
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Updated Today</SelectItem>
                    <SelectItem value="this_week">This Week</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex gap-2">
                  {activeSignalTab !== 'all' && (
                    <Button 
                      variant="outline" 
                      onClick={() => handleSignalTabClick('all')}
                    >
                      Clear Filter
                    </Button>
                  )}
                  <Button variant="outline" size="icon" onClick={() => refetchSignals()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <ExportButton 
                    data={filteredSignalRows as any} 
                    filename="store-signals" 
                    columns={signalExportColumns}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Signals Data Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" />
                  Signals ({filteredSignalRows.length})
                </CardTitle>
                <CardDescription>
                  {activeSignalTab === 'all' ? 'All signals' : activeSignalTab.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {filteredSignalRows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No signals found</p>
                  <p className="text-sm mt-1">
                    {searchQuery || brandFilter !== 'all' || roleFilter !== 'all' || timeFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Signals will appear when field teams report store observations'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Store</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead>Last Order</TableHead>
                          <TableHead>Signals</TableHead>
                          <TableHead>Reported By</TableHead>
                          <TableHead>Last Updated</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedSignalRows.map((row) => (
                          <TableRow key={row.id} className="hover:bg-muted/50">
                            <TableCell>
                              <button 
                                onClick={() => handleViewStore(row.store_id)}
                                className="font-medium text-left hover:text-primary transition-colors"
                              >
                                {row.store_name}
                              </button>
                              {(row.city || row.borough) && (
                                <p className="text-xs text-muted-foreground">
                                  {[row.borough, row.city].filter(Boolean).join(', ')}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{row.brand_name}</span>
                            </TableCell>
                            <TableCell>
                              {row.last_order_date ? (
                                <span className="text-sm">
                                  {format(new Date(row.last_order_date), 'MMM d, yyyy')}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">Never</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {getSignalBadges(row)}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getRoleBadge(row.last_updated_by_role)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {format(new Date(row.last_updated_at), 'MMM d, h:mm a')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewStore(row.store_id)}
                                className="h-8 w-8"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <DataTablePagination
                    currentPage={currentPage}
                    totalPages={signalTotalPages}
                    pageSize={pageSize}
                    totalItems={filteredSignalRows.length}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTION 2: OPPORTUNITIES (HUMAN-CREATED) */}
        <TabsContent value="opportunities" className="space-y-6">
          {/* Opportunities Banner */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <Lightbulb className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Opportunities — Human-Created Action Candidates
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                Manually created items requiring human review and follow-up
              </p>
            </div>
          </div>

          {/* Opportunity Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Opportunities</p>
                    <p className="text-2xl font-bold">{oppSummary?.total || 0}</p>
                  </div>
                  <Lightbulb className="h-8 w-8 text-primary opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer transition-all ${oppStatusFilter === 'pending' ? 'ring-2 ring-amber-500' : 'hover:bg-muted/50'}`}
              onClick={() => { setOppStatusFilter('pending'); handleOppFilterChange(); }}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-amber-600">{oppSummary?.pending || 0}</p>
                  </div>
                  <Circle className="h-8 w-8 text-amber-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer transition-all ${oppStatusFilter === 'completed' ? 'ring-2 ring-green-500' : 'hover:bg-muted/50'}`}
              onClick={() => { setOppStatusFilter('completed'); handleOppFilterChange(); }}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{oppSummary?.completed || 0}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Opportunities Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search opportunities or stores..."
                    value={oppSearchQuery}
                    onChange={(e) => { setOppSearchQuery(e.target.value); handleOppFilterChange(); }}
                    className="pl-10"
                  />
                </div>
                
                <Select value={oppStatusFilter} onValueChange={(v) => { setOppStatusFilter(v as OpportunityFilter); handleOppFilterChange(); }}>
                  <SelectTrigger className="w-full lg:w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => refetchOpportunities()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <ExportButton 
                    data={filteredOpportunities as any} 
                    filename="store-opportunities" 
                    columns={oppExportColumns}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Opportunities Data Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  Opportunities ({filteredOpportunities.length})
                </CardTitle>
                <CardDescription>
                  {oppStatusFilter === 'all' ? 'All opportunities' : oppStatusFilter.charAt(0).toUpperCase() + oppStatusFilter.slice(1)}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {filteredOpportunities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Lightbulb className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No opportunities found</p>
                  <p className="text-sm mt-1">
                    {oppSearchQuery || oppStatusFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Opportunities are created manually from store profiles'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Store</TableHead>
                          <TableHead>Opportunity</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedOpportunities.map((opp) => (
                          <TableRow key={opp.id} className="hover:bg-muted/50">
                            <TableCell>
                              <button 
                                onClick={() => handleViewStore(opp.store_id)}
                                className="font-medium text-left hover:text-primary transition-colors"
                              >
                                {opp.store?.store_name || 'Unknown Store'}
                              </button>
                              {opp.store?.city && (
                                <p className="text-xs text-muted-foreground">{opp.store.city}</p>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{opp.opportunity_text}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs capitalize">
                                {opp.source}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {opp.is_completed ? (
                                <Badge variant="default" className="bg-green-500 text-white text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Completed
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  <Circle className="h-3 w-3 mr-1" />
                                  Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {format(new Date(opp.created_at), 'MMM d, yyyy')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewStore(opp.store_id)}
                                  className="h-8 w-8"
                                  title="View Store"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                {opp.is_completed ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleReopenOpportunity(opp.id)}
                                    className="h-8 w-8"
                                    title="Reopen"
                                    disabled={reopenOpportunity.isPending}
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleCompleteOpportunity(opp.id)}
                                    className="h-8 w-8 text-green-600 hover:text-green-700"
                                    title="Mark Complete"
                                    disabled={completeOpportunity.isPending}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <DataTablePagination
                    currentPage={oppCurrentPage}
                    totalPages={oppTotalPages}
                    pageSize={oppPageSize}
                    totalItems={filteredOpportunities.length}
                    onPageChange={setOppCurrentPage}
                    onPageSizeChange={(size) => { setOppPageSize(size); setOppCurrentPage(1); }}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
