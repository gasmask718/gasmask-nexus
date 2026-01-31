import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Store, Plus, X, MapPin, Phone, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface ConnectedStoreData {
  id?: string;
  store_name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  isNew?: boolean;
}

interface ConnectedStoresSectionProps {
  currentStoreId: string;
  connectedStores: ConnectedStoreData[];
  onConnectedStoresChange: (stores: ConnectedStoreData[]) => void;
  isLoading?: boolean;
}

const REQUIRED_FIELDS = ['store_name', 'address', 'city', 'state', 'phone'] as const;

const EMPTY_STORE: ConnectedStoreData = {
  store_name: '',
  address: '',
  city: '',
  state: '',
  phone: '',
  isNew: true,
};

export function ConnectedStoresSection({
  currentStoreId,
  connectedStores,
  onConnectedStoresChange,
  isLoading = false,
}: ConnectedStoresSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStore, setNewStore] = useState<ConnectedStoreData>({ ...EMPTY_STORE });
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  const validateStore = (store: ConnectedStoreData): boolean => {
    const errors: Record<string, boolean> = {};
    let isValid = true;

    for (const field of REQUIRED_FIELDS) {
      if (!store[field]?.trim()) {
        errors[field] = true;
        isValid = false;
      }
    }

    setValidationErrors(errors);
    return isValid;
  };

  const addConnectedStore = () => {
    if (!validateStore(newStore)) {
      toast.error('All fields are required including telephone number');
      return;
    }

    onConnectedStoresChange([...connectedStores, { ...newStore }]);
    setNewStore({ ...EMPTY_STORE });
    setValidationErrors({});
    setShowAddForm(false);
    toast.success('Connected store added');
  };

  const removeConnectedStore = (index: number) => {
    const store = connectedStores[index];
    onConnectedStoresChange(connectedStores.filter((_, i) => i !== index));
    toast.success(`Removed ${store.store_name || 'store'}`);
  };

  const updateNewStoreField = (field: keyof ConnectedStoreData, value: string) => {
    setNewStore((prev) => ({ ...prev, [field]: value }));
    // Clear validation error when user types
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: false }));
    }
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    setNewStore({ ...EMPTY_STORE });
    setValidationErrors({});
  };

  // Derived store count (automatic from connected stores)
  const storeCount = connectedStores.length + 1; // +1 for current store

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Store className="h-5 w-5" />
              Connected Stores
              {connectedStores.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {storeCount} total locations
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Add other store locations owned by this operator
            </CardDescription>
          </div>
          <Button
            onClick={() => setShowAddForm(true)}
            size="sm"
            variant="outline"
            disabled={showAddForm || isLoading}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Connected Store
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Add New Store Form */}
        {showAddForm && (
          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">New Connected Store</Label>
                <Badge variant="outline" className="text-xs">All fields required</Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={cancelAdd}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4">
              {/* Store Name */}
              <div className="space-y-2">
                <Label className={validationErrors.store_name ? 'text-destructive' : ''}>
                  Store Name *
                </Label>
                <Input
                  value={newStore.store_name}
                  onChange={(e) => updateNewStoreField('store_name', e.target.value)}
                  placeholder="Store name"
                  className={validationErrors.store_name ? 'border-destructive' : ''}
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label className={validationErrors.address ? 'text-destructive' : ''}>
                  Address *
                </Label>
                <Input
                  value={newStore.address}
                  onChange={(e) => updateNewStoreField('address', e.target.value)}
                  placeholder="Street address"
                  className={validationErrors.address ? 'border-destructive' : ''}
                />
              </div>

              {/* City & State */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className={validationErrors.city ? 'text-destructive' : ''}>
                    City *
                  </Label>
                  <Input
                    value={newStore.city}
                    onChange={(e) => updateNewStoreField('city', e.target.value)}
                    placeholder="City"
                    className={validationErrors.city ? 'border-destructive' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={validationErrors.state ? 'text-destructive' : ''}>
                    State *
                  </Label>
                  <Input
                    value={newStore.state}
                    onChange={(e) => updateNewStoreField('state', e.target.value)}
                    placeholder="State"
                    className={validationErrors.state ? 'border-destructive' : ''}
                  />
                </div>
              </div>

              {/* Telephone Number */}
              <div className="space-y-2">
                <Label className={validationErrors.phone ? 'text-destructive' : ''}>
                  Telephone Number *
                </Label>
                <Input
                  value={newStore.phone}
                  onChange={(e) => updateNewStoreField('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                  type="tel"
                  className={validationErrors.phone ? 'border-destructive' : ''}
                />
              </div>
            </div>

            {/* Validation Warning */}
            {Object.values(validationErrors).some(Boolean) && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Please fill in all required fields before adding this store.</span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cancelAdd}>
                Cancel
              </Button>
              <Button size="sm" onClick={addConnectedStore}>
                Add Store
              </Button>
            </div>
          </div>
        )}

        {/* List of Connected Stores */}
        {!isLoading && connectedStores.length === 0 && !showAddForm ? (
          <div className="text-center py-8 text-muted-foreground">
            <Store className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No connected stores added yet.</p>
            <p className="text-xs mt-1">
              Add other locations this operator owns or manages.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {connectedStores.map((store, index) => (
              <div
                key={store.id || `new-${index}`}
                className="flex items-start justify-between p-4 rounded-lg border bg-secondary/30"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{store.store_name}</p>
                    {store.isNew && (
                      <Badge variant="secondary" className="text-xs">New</Badge>
                    )}
                  </div>
                  <div className="flex items-start gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span className="truncate">
                      {store.address}, {store.city}, {store.state}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{store.phone}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive flex-shrink-0"
                  onClick={() => removeConnectedStore(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Info Note */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Store count is automatic</p>
            <p className="text-xs">
              The total number of stores ({storeCount}) is derived from connected stores.
              No manual entry required.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
