import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Package, Search, Filter, ShoppingCart, FlaskConical, Gift, 
  Check, X, HelpCircle, ExternalLink, RefreshCw, Download
} from 'lucide-react';
import { 
  useGlobalTubeIntelligence, 
  useTubeIntelSummary,
  TUBE_BRANDS,
  TubeIntelFilters 
} from '@/hooks/useTubeIntelligence';
import { ExportButton } from '@/components/crud/ExportButton';
import { DataTablePagination } from '@/components/crud/DataTablePagination';
import { cn } from '@/lib/utils';
import { PagePurpose } from '@/components/portal/guidance';
import { useTranslation } from '@/hooks/useTranslation';

export default function TubeIntelligencePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<TubeIntelFilters>({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: summary, isLoading: summaryLoading } = useTubeIntelSummary();
  const { data: records, isLoading, refetch } = useGlobalTubeIntelligence(filters);

  // Filter by search query
  const filteredRecords = records?.filter(record => {
    if (!searchQuery) return true;
    const storeName = (record as any).store?.name?.toLowerCase() || '';
    const brandName = record.brand_name?.toLowerCase() || '';
    return storeName.includes(searchQuery.toLowerCase()) || brandName.includes(searchQuery.toLowerCase());
  }) || [];

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / pageSize);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const toggleFilter = (key: keyof TubeIntelFilters) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key] ? undefined : true,
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined);

  // Prepare export data
  const exportData = filteredRecords.map(record => ({
    store_name: (record as any).store?.name || 'Unknown',
    brand: record.brand_name,
    last_order_date: record.last_order_date || t('page.tube_intel.never'),
    introduced: record.product_introduced ? 'Yes' : 'No',
    interested: record.owner_interested === null ? 'Not Asked' : record.owner_interested ? 'Yes' : 'No',
    needs_order: record.needs_order ? 'Yes' : 'No',
    bring_samples: record.bring_samples ? 'Yes' : 'No',
    bring_starter_kit: record.bring_starter_kit ? 'Yes' : 'No',
    city: (record as any).store?.address_city || '',
    borough: (record as any).store?.borough || '',
  }));

  const exportColumns = [
    { key: 'store_name', label: t('page.tube_intel.col_store') },
    { key: 'brand', label: t('page.tube_intel.col_brand') },
    { key: 'last_order_date', label: t('page.tube_intel.col_last_order') },
    { key: 'introduced', label: t('page.tube_intel.col_introduced') },
    { key: 'interested', label: t('page.tube_intel.col_interested') },
    { key: 'needs_order', label: t('page.tube_intel.col_needs_order') },
    { key: 'bring_samples', label: t('page.tube_intel.col_samples') },
    { key: 'bring_starter_kit', label: t('page.tube_intel.col_starter_kit') },
    { key: 'city', label: 'City' },
    { key: 'borough', label: 'Borough' },
  ];

  // PagePurpose configuration
  const pagePurposeConfig = {
    admin: {
      title: t('page.tube_intel.title'),
      description: t('page.tube_intel.admin_purpose'),
      actions: [
        t('page.tube_intel.action.filter'),
        t('page.tube_intel.action.export'),
        t('page.tube_intel.action.click_store'),
        t('page.tube_intel.action.toggle_cards'),
      ],
      warnings: [t('page.tube_intel.warning.signals')],
    },
    default: {
      title: t('page.tube_intel.title'),
      description: t('page.tube_intel.default_purpose'),
      actions: [
        t('page.tube_intel.action.filter'),
        t('page.tube_intel.action.click_store'),
      ],
    },
  };

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* Page Purpose */}
      <PagePurpose pageKey="page.tube_intel" config={pagePurposeConfig} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('page.tube_intel.title')}</h1>
          <p className="text-muted-foreground">{t('page.tube_intel.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <ExportButton 
            data={exportData} 
            filename="tube-intelligence" 
            columns={exportColumns}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card 
          className={cn(
            'cursor-pointer transition-all hover:scale-105',
            filters.needsOrder && 'ring-2 ring-red-500'
          )}
          onClick={() => toggleFilter('needsOrder')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-500">
              <ShoppingCart className="h-5 w-5" />
              <span className="text-2xl font-bold">{summary?.needsOrder || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Need Order</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            'cursor-pointer transition-all hover:scale-105',
            filters.bringSamples && 'ring-2 ring-purple-500'
          )}
          onClick={() => toggleFilter('bringSamples')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-purple-500">
              <FlaskConical className="h-5 w-5" />
              <span className="text-2xl font-bold">{summary?.bringSamples || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Bring Samples</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            'cursor-pointer transition-all hover:scale-105',
            filters.bringStarterKit && 'ring-2 ring-amber-500'
          )}
          onClick={() => toggleFilter('bringStarterKit')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-500">
              <Gift className="h-5 w-5" />
              <span className="text-2xl font-bold">{summary?.bringStarterKit || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Starter Kit</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            'cursor-pointer transition-all hover:scale-105',
            filters.notIntroduced && 'ring-2 ring-gray-500'
          )}
          onClick={() => toggleFilter('notIntroduced')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-gray-500">
              <X className="h-5 w-5" />
              <span className="text-2xl font-bold">{summary?.notIntroduced || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Not Introduced</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            'cursor-pointer transition-all hover:scale-105',
            filters.introducedNotInterested && 'ring-2 ring-orange-500'
          )}
          onClick={() => toggleFilter('introducedNotInterested')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-orange-500">
              <HelpCircle className="h-5 w-5" />
              <span className="text-2xl font-bold">{summary?.introducedNotInterested || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Not Interested</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stores or brands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select 
              value={filters.brandId || 'all'} 
              onValueChange={(v) => setFilters(prev => ({ ...prev, brandId: v === 'all' ? undefined : v }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {TUBE_BRANDS.map(brand => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={filters.lastOrderDaysAgo?.toString() || 'all'} 
              onValueChange={(v) => setFilters(prev => ({ ...prev, lastOrderDaysAgo: v === 'all' ? undefined : parseInt(v) }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Last order..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any time</SelectItem>
                <SelectItem value="7">Last order &gt; 7 days</SelectItem>
                <SelectItem value="14">Last order &gt; 14 days</SelectItem>
                <SelectItem value="30">Last order &gt; 30 days</SelectItem>
                <SelectItem value="60">Last order &gt; 60 days</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}

            <div className="text-sm text-muted-foreground">
              {filteredRecords.length} results
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mb-4 opacity-50" />
              <p>No records match your filters</p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Last Order</TableHead>
                  <TableHead className="text-center">Introduced</TableHead>
                  <TableHead className="text-center">Interested</TableHead>
                  <TableHead className="text-center">Needs Order</TableHead>
                  <TableHead className="text-center">Samples</TableHead>
                  <TableHead className="text-center">Starter Kit</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRecords.map((record) => {
                  const store = (record as any).store;
                  const brand = TUBE_BRANDS.find(b => b.id === record.brand_id);
                  
                  return (
                    <TableRow 
                      key={record.id}
                      className={cn(
                        (record.needs_order || record.bring_starter_kit) && 'bg-orange-500/5'
                      )}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{store?.name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">
                            {store?.address_city}, {store?.address_state}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-2.5 w-2.5 rounded-full" 
                            style={{ backgroundColor: brand?.color || '#888' }}
                          />
                          <span>{record.brand_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.last_order_date ? (
                          <span>{new Date(record.last_order_date).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.product_introduced ? (
                          <Badge variant="default" className="bg-green-500">
                            <Check className="h-3 w-3" />
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <X className="h-3 w-3" />
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.owner_interested === null ? (
                          <Badge variant="outline" className="border-dashed">
                            <HelpCircle className="h-3 w-3" />
                          </Badge>
                        ) : record.owner_interested ? (
                          <Badge variant="default" className="bg-blue-500">
                            <Check className="h-3 w-3" />
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <X className="h-3 w-3" />
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.needs_order && (
                          <Badge variant="destructive">
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            Yes
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.bring_samples && (
                          <Badge className="bg-purple-500">
                            <FlaskConical className="h-3 w-3 mr-1" />
                            Yes
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.bring_starter_kit && (
                          <Badge className="bg-amber-500">
                            <Gift className="h-3 w-3 mr-1" />
                            Yes
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/stores/${store?.id}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredRecords.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              pageSizeOptions={[25, 50, 100, 250]}
            />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
