/**
 * Ambassador Stores List - View all assigned/sourced stores
 * MASTER GENIUS ARCHITECT: Never delete stores, only unassign (deactivate assignment)
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Store, Search, Filter, MapPin, Phone, Calendar,
  ArrowRight, Users, Trash2, Route as RouteIcon
} from 'lucide-react';
import { useLastOrderSnapshotBatch } from '@/hooks/useLastOrderSnapshot';
import { LastOrderKPIBadge } from '@/components/store/LastOrderKPIBadge';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { DeleteConfirmModal } from '@/components/crud/DeleteConfirmModal';
import { RouteAssignmentDialog } from '@/components/delivery/RouteAssignmentDialog';
import { useAmbassadorPortfolio, type PortfolioStore } from '@/hooks/useAmbassadorPortfolio';
import { formatDistanceToNow } from 'date-fns';

interface StoreCardProps {
  store: PortfolioStore;
  onClick: () => void;
  onRemove: () => void;
  losSnapshots?: import('@/hooks/useLastOrderSnapshot').LastOrderSnapshot[];
}

function StoreCard({ store, onClick, onRemove, losSnapshots }: StoreCardProps) {
  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click navigation
    onRemove();
  };

  return (
    <Card 
      className="cursor-pointer hover:border-primary/50 transition-colors group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                {store.store_name}
              </h3>
              <Badge variant={store.assignment_type === 'sourced' ? 'default' : 'secondary'} className="text-xs shrink-0">
                {store.assignment_type}
              </Badge>
              {store.is_primary && (
                <Badge variant="outline" className="text-xs shrink-0">Primary</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate mb-2">
              {store.store_owner}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {store.store_city}, {store.store_state}
              </span>
              {store.store_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {store.store_phone}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDistanceToNow(new Date(store.assigned_at), { addSuffix: true })}
              </span>
              <LastOrderKPIBadge snapshots={losSnapshots} compact />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">Commission</span>
            <span className="font-semibold text-primary">{store.commission_rate}%</span>
            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={handleRemoveClick}
                title="Remove from My Stores"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StoresListContent() {
  const navigate = useNavigate();
  const { stores, metrics, isLoading, unassignStore, isUnassigningStore } = useAmbassadorPortfolio();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Batch fetch LOS for all portfolio stores
  const storeIds = useMemo(() => stores.map(s => s.store_id), [stores]);
  const { data: losMap } = useLastOrderSnapshotBatch(storeIds);
  
  // Remove store confirmation modal state
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [storeToRemove, setStoreToRemove] = useState<PortfolioStore | null>(null);

  const filteredStores = useMemo(() => {
    let result = stores;

    // Filter by tab
    if (activeTab === 'assigned') {
      result = result.filter(s => s.assignment_type === 'assigned');
    } else if (activeTab === 'sourced') {
      result = result.filter(s => s.assignment_type === 'sourced');
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.store_name.toLowerCase().includes(query) ||
        s.store_address.toLowerCase().includes(query) ||
        s.store_city.toLowerCase().includes(query) ||
        s.store_owner?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [stores, searchQuery, activeTab]);

  const handleStoreClick = (storeId: string) => {
    navigate(`/ambassador/stores/${storeId}`);
  };

  const handleRemoveClick = (store: PortfolioStore) => {
    setStoreToRemove(store);
    setRemoveModalOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!storeToRemove) return;
    await unassignStore(storeToRemove.store_id);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12" />
        <div className="grid gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{metrics.totalStores}</p>
            <p className="text-sm text-muted-foreground">Total Stores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{metrics.assignedStores}</p>
            <p className="text-sm text-muted-foreground">Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-500">{metrics.sourcedStores}</p>
            <p className="text-sm text-muted-foreground">Sourced</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search stores by name, address, or owner..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({stores.length})</TabsTrigger>
          <TabsTrigger value="assigned">Assigned ({metrics.assignedStores})</TabsTrigger>
          <TabsTrigger value="sourced">Sourced ({metrics.sourcedStores})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredStores.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Store className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium">No stores found</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Try a different search term' : 'No stores in this category'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredStores.map((store) => (
                <StoreCard 
                  key={store.assignment_id} 
                  store={store}
                  onClick={() => handleStoreClick(store.store_id)}
                  onRemove={() => handleRemoveClick(store)}
                  losSnapshots={losMap?.get(store.store_id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Remove Store Confirmation Modal */}
      <DeleteConfirmModal
        open={removeModalOpen}
        onOpenChange={setRemoveModalOpen}
        title="Remove Store from Portfolio"
        description={`This removes "${storeToRemove?.store_name}" from your portfolio. It does not delete the store - you can be reassigned to it later.`}
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}

export default function AmbassadorStoresList() {
  return (
    <PortalRBACGate allowedRoles={['ambassador']} portalName="Ambassador Portal">
      <AmbassadorLayout 
        title="My Stores" 
        subtitle="All stores in your portfolio"
        portalIcon={<Users className="h-4 w-4 text-primary-foreground" />}
      >
        <StoresListContent />
      </AmbassadorLayout>
    </PortalRBACGate>
  );
}
