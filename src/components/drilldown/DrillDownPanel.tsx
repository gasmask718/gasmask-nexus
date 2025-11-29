import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, ArrowLeft, RefreshCw, Download, Filter, 
  Store, FileText, Truck, Package, Users, Route, DollarSign, Bot
} from 'lucide-react';
import { useDrillDownData } from '@/hooks/useDrillDownData';
import { DrillDownEntity, DrillDownFilters, getEntityTitle, buildDrillDownUrl } from '@/lib/drilldown';
import { ResultsPanelActions, PanelType } from '@/components/results/ResultsPanelActions';
import { EntityDrawer } from '@/components/editing/EntityDrawer';
import { useGrabbaBrand } from '@/contexts/GrabbaBrandContext';
import { cn } from '@/lib/utils';

interface DrillDownPanelProps {
  entity: DrillDownEntity;
  filters: DrillDownFilters;
  title?: string;
  onBack?: () => void;
  embedded?: boolean;
}

const entityIcons: Record<DrillDownEntity, React.ElementType> = {
  stores: Store,
  invoices: FileText,
  deliveries: Truck,
  inventory: Package,
  drivers: Users,
  routes: Route,
  orders: DollarSign,
  ambassadors: Users,
  commissions: DollarSign,
};

const entityToPanelType: Record<DrillDownEntity, PanelType> = {
  stores: 'stores',
  invoices: 'invoices',
  deliveries: 'deliveries',
  inventory: 'inventory',
  drivers: 'deliveries',
  routes: 'deliveries',
  orders: 'orders',
  ambassadors: 'ambassadors',
  commissions: 'commissions',
};

export function DrillDownPanel({ 
  entity, 
  filters: initialFilters, 
  title: customTitle,
  onBack,
  embedded = false
}: DrillDownPanelProps) {
  const navigate = useNavigate();
  const { selectedBrand } = useGrabbaBrand();
  
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [localFilters, setLocalFilters] = useState<DrillDownFilters>(initialFilters);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{ id: string; data: any } | null>(null);
  
  // Merge brand from context if not in filters
  const effectiveFilters = useMemo(() => ({
    ...localFilters,
    brand: localFilters.brand || (selectedBrand !== 'all' ? selectedBrand : undefined),
  }), [localFilters, selectedBrand]);
  
  const { data, isLoading, refetch } = useDrillDownData({
    entity,
    filters: effectiveFilters,
  });
  
  const Icon = entityIcons[entity] || Store;
  const panelTitle = customTitle || `${getEntityTitle(entity)}${effectiveFilters.brand ? ` (${effectiveFilters.brand})` : ''}`;
  
  // Filter by search
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!search) return data;
    
    const searchLower = search.toLowerCase();
    return data.filter(item => 
      item.title?.toLowerCase().includes(searchLower) ||
      item.subtitle?.toLowerCase().includes(searchLower) ||
      item.status?.toLowerCase().includes(searchLower)
    );
  }, [data, search]);
  
  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.length === filteredData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map(item => item.id));
    }
  };
  
  const handleSelectRow = (id: string, e?: React.MouseEvent) => {
    // Only toggle selection, don't open drawer
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleRowClick = (item: any) => {
    setSelectedEntity({ id: item.id, data: item.raw || item });
    setDrawerOpen(true);
  };
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };
  
  const handleExport = () => {
    if (!filteredData.length) return;
    
    const csvContent = [
      ['ID', 'Title', 'Subtitle', 'Type', 'Status', 'Amount', 'Brand'].join(','),
      ...filteredData.map(item => [
        item.id,
        `"${item.title || ''}"`,
        `"${item.subtitle || ''}"`,
        item.type || '',
        item.status || '',
        item.amount || '',
        item.brand || '',
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entity}-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const selectedResults = filteredData.filter(item => selectedIds.includes(item.id));
  
  // Get status options based on entity
  const statusOptions = useMemo(() => {
    switch (entity) {
      case 'stores':
        return ['active', 'inactive', 'new', 'churned'];
      case 'invoices':
        return ['paid', 'unpaid', 'overdue', 'partial'];
      case 'deliveries':
        return ['pending', 'completed', 'skipped'];
      case 'drivers':
        return ['active', 'inactive'];
      case 'routes':
        return ['scheduled', 'in_progress', 'completed', 'cancelled'];
      case 'orders':
        return ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
      default:
        return ['active', 'inactive', 'pending', 'completed'];
    }
  }, [entity]);

  return (
    <Card className={cn(
      'bg-card/50 backdrop-blur border-border/50',
      embedded && 'border-0 shadow-none'
    )}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!embedded && (
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{panelTitle}</CardTitle>
              <CardDescription>
                {isLoading ? 'Loading...' : `${filteredData.length} results`}
                {selectedIds.length > 0 && ` • ${selectedIds.length} selected`}
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const params = new URLSearchParams();
                params.set('entity', entity);
                Object.entries(effectiveFilters).forEach(([key, value]) => {
                  if (value) params.set(key, String(value));
                });
                if (selectedIds.length > 0) {
                  params.set('selected', selectedIds.join(','));
                }
                navigate(`/grabba/ai-console?${params.toString()}`);
              }}
              className="gap-1"
            >
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">AI Copilot</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select 
            value={localFilters.status || 'all'} 
            onValueChange={(value) => setLocalFilters(prev => ({ 
              ...prev, 
              status: value === 'all' ? undefined : value 
            }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statusOptions.map(status => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {Object.keys(effectiveFilters).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(effectiveFilters).map(([key, value]) => {
                if (!value || key === 'status') return null;
                return (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}: {String(value)}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="mb-4">
            <ResultsPanelActions
              panelType={entityToPanelType[entity]}
              selectedResults={selectedResults.map(r => r.raw)}
              allResults={filteredData.map(r => r.raw)}
              brand={effectiveFilters.brand}
              onActionComplete={() => {
                setSelectedIds([]);
                refetch();
              }}
            />
          </div>
        )}
        
        {/* Data Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12">
            <Icon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No {entity} found matching your criteria</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  {['invoices', 'orders', 'commissions', 'inventory'].includes(entity) && (
                    <TableHead className="text-right">Amount</TableHead>
                  )}
                  <TableHead>Brand</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow 
                    key={item.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50',
                      selectedIds.includes(item.id) && 'bg-primary/5'
                    )}
                    onClick={() => handleRowClick(item)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(item.id)}
                        onCheckedChange={() => handleSelectRow(item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.subtitle}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          item.status === 'completed' || item.status === 'paid' || item.status === 'active' 
                            ? 'default' 
                            : item.status === 'pending' || item.status === 'unpaid'
                            ? 'secondary'
                            : 'destructive'
                        }
                        className="text-xs capitalize"
                      >
                        {item.status?.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    {['invoices', 'orders', 'commissions', 'inventory'].includes(entity) && (
                      <TableCell className="text-right font-medium">
                        {entity === 'inventory' 
                          ? item.amount?.toLocaleString()
                          : `$${(item.amount || 0).toLocaleString()}`
                        }
                      </TableCell>
                    )}
                    <TableCell>
                      {item.brand && (
                        <Badge variant="outline" className="text-xs">
                          {item.brand}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Entity Drawer */}
        <EntityDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          entity={entity}
          entityId={selectedEntity?.id || ''}
          data={selectedEntity?.data || {}}
          onSave={() => refetch()}
        />
      </CardContent>
    </Card>
  );
}
