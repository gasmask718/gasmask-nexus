import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Store } from 'lucide-react';

interface BulkStoreSelectorProps {
  selectedStoreIds: string[];
  onSelectionChange: (storeIds: string[]) => void;
  excludeStoreId?: string;
}

export function BulkStoreSelector({
  selectedStoreIds,
  onSelectionChange,
  excludeStoreId,
}: BulkStoreSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['stores-for-bulk-invoice', excludeStoreId],
    queryFn: async () => {
      let query = supabase
        .from('store_master')
        .select('id, store_name')
        .order('store_name')
        .limit(500);

      if (excludeStoreId) {
        query = query.neq('id', excludeStoreId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filteredStores = stores.filter(store =>
    store.store_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleStore = (storeId: string) => {
    if (selectedStoreIds.includes(storeId)) {
      onSelectionChange(selectedStoreIds.filter(id => id !== storeId));
    } else {
      onSelectionChange([...selectedStoreIds, storeId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedStoreIds.length === filteredStores.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(filteredStores.map(s => s.id));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search stores..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-xs text-primary hover:underline"
        >
          {selectedStoreIds.length === filteredStores.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <div className="border rounded-lg">
        <ScrollArea className="h-64">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading stores...
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No stores found
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredStores.map((store) => (
                <div
                  key={store.id}
                  className="flex items-center space-x-2 p-2 rounded hover:bg-secondary/50 cursor-pointer"
                  onClick={() => handleToggleStore(store.id)}
                >
                  <Checkbox
                    checked={selectedStoreIds.includes(store.id)}
                    onCheckedChange={() => handleToggleStore(store.id)}
                  />
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <Label className="flex-1 cursor-pointer text-sm">
                    {store.store_name}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {selectedStoreIds.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {selectedStoreIds.length} store{selectedStoreIds.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}

