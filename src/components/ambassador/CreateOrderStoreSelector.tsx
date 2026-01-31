/**
 * Store selector for Ambassador Create Order flow
 * MASTER GENIUS ARCHITECT: Orders must always be created in context of a specific store
 * This component prompts ambassador to select a store before invoice creation
 */
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Store, Search, MapPin, ArrowRight, Package, AlertCircle } from 'lucide-react';
import { useAmbassadorPortfolio, type PortfolioStore } from '@/hooks/useAmbassadorPortfolio';

interface CreateOrderStoreSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStoreSelected: (store: PortfolioStore) => void;
}

export function CreateOrderStoreSelector({
  open,
  onOpenChange,
  onStoreSelected,
}: CreateOrderStoreSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { stores, isLoading } = useAmbassadorPortfolio();

  // Filter stores by search query
  const filteredStores = stores.filter((store) => {
    const query = searchQuery.toLowerCase();
    return (
      store.store_name.toLowerCase().includes(query) ||
      store.store_city?.toLowerCase().includes(query) ||
      store.store_address?.toLowerCase().includes(query)
    );
  });

  const handleStoreSelect = (store: PortfolioStore) => {
    onStoreSelected(store);
    setSearchQuery('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Create Order
          </DialogTitle>
          <DialogDescription>
            Select a store to create an invoice for
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search stores..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        {/* Store List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {stores.length === 0 ? (
              <>
                <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No stores in portfolio</p>
                <p className="text-sm">Add stores to your portfolio to create orders</p>
              </>
            ) : (
              <>
                <Store className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No stores match "{searchQuery}"</p>
              </>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-3">
            <div className="space-y-2">
              {filteredStores.map((store) => (
                <button
                  key={store.store_id}
                  onClick={() => handleStoreSelect(store)}
                  className="w-full p-3 rounded-lg border bg-card hover:bg-accent hover:border-primary/50 transition-colors text-left group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Store className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{store.store_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          {store.store_address}, {store.store_city}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={store.assignment_type === 'sourced' ? 'default' : 'secondary'} className="text-xs">
                        {store.assignment_type}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Cancel */}
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
