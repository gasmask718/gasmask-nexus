import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';
import { format, isToday, isThisWeek } from 'date-fns';
import { useGlobalTubeIntelligence, useTubeIntelSummary, TUBE_BRANDS } from '@/hooks/useTubeIntelligence';
import { ExportButton } from '@/components/crud/ExportButton';
import { DataTablePagination } from '@/components/crud/DataTablePagination';

type SignalTab = 'all' | 'needs_order' | 'bring_samples' | 'starter_kit' | 'not_introduced' | 'not_interested';
type TimeFilter = 'all' | 'today' | 'this_week';

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
  const [activeTab, setActiveTab] = useState<SignalTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch summary counts
  const { data: summary, isLoading: summaryLoading } = useTubeIntelSummary();

  // Build filter based on active tab
  const filters = useMemo(() => {
    const baseFilters: Record<string, boolean> = {};
    
    switch (activeTab) {
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
  }, [activeTab]);

  const { data: rawData, isLoading, refetch } = useGlobalTubeIntelligence(filters);

  // Transform and filter data
  const rows: StoreIntelRow[] = useMemo(() => {
    if (!rawData) return [];
    
    return rawData.map((item: any) => ({
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
  }, [rawData]);

  // Apply client-side filters
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          row.store_name.toLowerCase().includes(query) ||
          row.brand_name.toLowerCase().includes(query) ||
          (row.city?.toLowerCase().includes(query) ?? false) ||
          (row.borough?.toLowerCase().includes(query) ?? false);
        if (!matchesSearch) return false;
      }

      // Brand filter
      if (brandFilter !== 'all' && row.brand_id !== brandFilter) {
        return false;
      }

      // Role filter
      if (roleFilter !== 'all' && row.last_updated_by_role !== roleFilter) {
        return false;
      }

      // Time filter
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
  }, [rows, searchQuery, brandFilter, roleFilter, timeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset page when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const handleViewStore = (storeId: string) => {
    navigate(`/stores/${storeId}`);
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
  const exportColumns = [
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

  if (isLoading || summaryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Governance Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 flex items-center gap-2">
        <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">
          READ-ONLY
        </Badge>
        <span className="text-sm text-amber-800 font-medium">
          Signals Board — Observational Only. No actions are auto-created.
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            Store Intelligence Center
          </h1>
          <p className="text-muted-foreground mt-2">
            Operational signals from field teams — observe, filter, plan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <ExportButton 
            data={filteredRows as any} 
            filename="store-intelligence" 
            columns={exportColumns}
          />
        </div>
      </div>

      {/* Signal Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card 
          className={`cursor-pointer transition-all ${activeTab === 'needs_order' ? 'ring-2 ring-yellow-500' : 'hover:bg-muted/50'}`}
          onClick={() => { setActiveTab('needs_order'); handleFilterChange(); }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Needs Order</p>
                <p className="text-2xl font-bold text-yellow-600">{summary?.needsOrder || 0}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer transition-all ${activeTab === 'bring_samples' ? 'ring-2 ring-blue-500' : 'hover:bg-muted/50'}`}
          onClick={() => { setActiveTab('bring_samples'); handleFilterChange(); }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bring Samples</p>
                <p className="text-2xl font-bold text-blue-600">{summary?.bringSamples || 0}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer transition-all ${activeTab === 'starter_kit' ? 'ring-2 ring-purple-500' : 'hover:bg-muted/50'}`}
          onClick={() => { setActiveTab('starter_kit'); handleFilterChange(); }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Starter Kit</p>
                <p className="text-2xl font-bold text-purple-600">{summary?.bringStarterKit || 0}</p>
              </div>
              <Gift className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer transition-all ${activeTab === 'not_introduced' ? 'ring-2 ring-gray-500' : 'hover:bg-muted/50'}`}
          onClick={() => { setActiveTab('not_introduced'); handleFilterChange(); }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Not Introduced</p>
                <p className="text-2xl font-bold text-gray-600">{summary?.notIntroduced || 0}</p>
              </div>
              <Sparkles className="h-8 w-8 text-gray-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer transition-all ${activeTab === 'not_interested' ? 'ring-2 ring-red-500' : 'hover:bg-muted/50'}`}
          onClick={() => { setActiveTab('not_interested'); handleFilterChange(); }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Not Interested</p>
                <p className="text-2xl font-bold text-red-600">{summary?.introducedNotInterested || 0}</p>
              </div>
              <UserX className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Card */}
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
            
            {activeTab !== 'all' && (
              <Button 
                variant="outline" 
                onClick={() => { setActiveTab('all'); handleFilterChange(); }}
              >
                Clear Signal Filter
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Signals ({filteredRows.length})
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="font-normal">
              {activeTab === 'all' ? 'All Signals' : activeTab.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRows.length === 0 ? (
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
                    {paginatedRows.map((row) => (
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
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredRows.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
