import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Store, Search, X } from 'lucide-react';
import { useStoreOptions, useProductAssignedStores } from '@/hooks/useProductStoreAssignments';

interface StoreAssignmentSectionProps {
  productId?: string;
  selectedStores: string[];
  onStoresChange: (storeIds: string[]) => void;
}

export function StoreAssignmentSection({ 
  productId, 
  selectedStores, 
  onStoresChange 
}: StoreAssignmentSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: stores = [], isLoading } = useStoreOptions();
  const { data: assignedStoreIds = [] } = useProductAssignedStores(productId);

  // Initialize from existing assignments when editing
  useEffect(() => {
    if (productId && assignedStoreIds.length > 0 && selectedStores.length === 0) {
      onStoresChange(assignedStoreIds);
    }
  }, [productId, assignedStoreIds]);

  const filteredStores = stores.filter(store =>
    store.store_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    store.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    store.state?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleStore = (storeId: string) => {
    if (selectedStores.includes(storeId)) {
      onStoresChange(selectedStores.filter(id => id !== storeId));
    } else {
      onStoresChange([...selectedStores, storeId]);
    }
  };

  const clearAll = () => onStoresChange([]);
  const selectAll = () => onStoresChange(filteredStores.map(s => s.id));

  const getStoreName = (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    return store?.store_name || 'Unknown Store';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Store className="h-4 w-4" />
          Assign Stores ({selectedStores.length} selected)
        </Label>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
            Select All
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            Clear
          </Button>
        </div>
      </div>

      {/* Selected Stores Tags */}
      {selectedStores.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedStores.slice(0, 8).map(storeId => (
            <Badge 
              key={storeId} 
              variant="secondary" 
              className="flex items-center gap-1 cursor-pointer hover:bg-destructive/20"
              onClick={() => toggleStore(storeId)}
            >
              {getStoreName(storeId)}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          {selectedStores.length > 8 && (
            <Badge variant="outline">+{selectedStores.length - 8} more</Badge>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search stores..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Store List */}
      <ScrollArea className="h-48 border rounded-md">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-4">Loading stores...</div>
          ) : filteredStores.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">No stores found</div>
          ) : (
            filteredStores.map(store => (
              <div
                key={store.id}
                className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                onClick={() => toggleStore(store.id)}
              >
                <Checkbox
                  checked={selectedStores.includes(store.id)}
                  onCheckedChange={() => toggleStore(store.id)}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{store.store_name}</span>
                  {(store.city || store.state) && (
                    <span className="text-xs text-muted-foreground">
                      {[store.city, store.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
