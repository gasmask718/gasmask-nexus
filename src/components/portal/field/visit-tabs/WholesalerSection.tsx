import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, X, Search, Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { toast } from 'sonner';

export interface GlobalWholesaler {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
}

export interface WholesalerAssociation {
  wholesaler_id: string;
  wholesaler: GlobalWholesaler;
  isNew?: boolean;
}

interface WholesalerSectionProps {
  storeId: string;
  associations: WholesalerAssociation[];
  onAssociationsChange: (associations: WholesalerAssociation[]) => void;
  isLoading?: boolean;
}

const EMPTY_WHOLESALER = {
  name: '',
  address: '',
  city: '',
  state: '',
  phone: '',
};

export function WholesalerSection({
  storeId,
  associations,
  onAssociationsChange,
  isLoading = false,
}: WholesalerSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalWholesaler[]>([]);
  const [searching, setSearching] = useState(false);
  const [newWholesaler, setNewWholesaler] = useState(EMPTY_WHOLESALER);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<'search' | 'create'>('search');

  // Search global wholesalers
  useEffect(() => {
    const searchWholesalers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const { data } = await supabase
          .from('wholesalers')
          .select('id, name, address, city, state, phone')
          .ilike('name', `%${searchQuery}%`)
          .limit(10);

        // Filter out already associated wholesalers
        const associatedIds = associations.map(a => a.wholesaler_id);
        const filtered = (data || []).filter(w => !associatedIds.includes(w.id));
        setSearchResults(filtered);
      } catch (error) {
        console.error('Error searching wholesalers:', error);
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(searchWholesalers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, associations]);

  const validateNewWholesaler = (): boolean => {
    const errors: Record<string, boolean> = {};
    
    if (!newWholesaler.name.trim()) {
      errors.name = true;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const selectExistingWholesaler = (wholesaler: GlobalWholesaler) => {
    const newAssociation: WholesalerAssociation = {
      wholesaler_id: wholesaler.id,
      wholesaler,
      isNew: true,
    };
    onAssociationsChange([...associations, newAssociation]);
    setSearchQuery('');
    setSearchResults([]);
    toast.success(`Associated with ${wholesaler.name}`);
  };

  const createAndAssociateWholesaler = async () => {
    if (!validateNewWholesaler()) {
      toast.error('Wholesaler name is required');
      return;
    }

    // Create a temporary wholesaler object for the UI
    // Actual DB insert happens on submission
    const tempWholesaler: GlobalWholesaler = {
      id: `temp-${Date.now()}`, // Temporary ID
      name: newWholesaler.name,
      address: newWholesaler.address || null,
      city: newWholesaler.city || null,
      state: newWholesaler.state || null,
      phone: newWholesaler.phone || null,
    };

    const newAssociation: WholesalerAssociation = {
      wholesaler_id: tempWholesaler.id,
      wholesaler: tempWholesaler,
      isNew: true,
    };

    onAssociationsChange([...associations, newAssociation]);
    setNewWholesaler(EMPTY_WHOLESALER);
    setValidationErrors({});
    setShowAddForm(false);
    setMode('search');
    toast.success(`Added ${tempWholesaler.name} to network`);
  };

  const removeAssociation = (wholesalerId: string) => {
    const assoc = associations.find(a => a.wholesaler_id === wholesalerId);
    onAssociationsChange(associations.filter(a => a.wholesaler_id !== wholesalerId));
    toast.success(`Removed association with ${assoc?.wholesaler.name || 'wholesaler'}`);
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    setSearchQuery('');
    setSearchResults([]);
    setNewWholesaler(EMPTY_WHOLESALER);
    setValidationErrors({});
    setMode('search');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Wholesaler Contacts
              {associations.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {associations.length} associated
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Add or link wholesalers this store purchases from
            </CardDescription>
          </div>
          <Button
            onClick={() => setShowAddForm(true)}
            size="sm"
            variant="outline"
            disabled={showAddForm || isLoading}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Wholesaler
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

        {/* Add/Search Form */}
        {showAddForm && (
          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-4">
            {/* Mode Toggle */}
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant={mode === 'search' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('search')}
              >
                <Search className="h-4 w-4 mr-1" />
                Find Existing
              </Button>
              <Button
                variant={mode === 'create' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('create')}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create New
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={cancelAdd}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Search Mode */}
            {mode === 'search' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Search existing wholesalers</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Type to search..."
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Search Results */}
                {searching && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-auto">
                    {searchResults.map((wholesaler) => (
                      <button
                        key={wholesaler.id}
                        onClick={() => selectExistingWholesaler(wholesaler)}
                        className="w-full p-3 text-left hover:bg-muted/50 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{wholesaler.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[wholesaler.city, wholesaler.state].filter(Boolean).join(', ')}
                            {wholesaler.phone && ` • ${wholesaler.phone}`}
                          </p>
                        </div>
                        <Check className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <p>No wholesalers found matching "{searchQuery}"</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => {
                        setMode('create');
                        setNewWholesaler({ ...EMPTY_WHOLESALER, name: searchQuery });
                      }}
                    >
                      Create "{searchQuery}" as new wholesaler
                    </Button>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Can't find what you're looking for? Switch to "Create New" to add a new wholesaler to the network.
                </p>
              </div>
            )}

            {/* Create Mode */}
            {mode === 'create' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">New Global Wholesaler</Label>
                  <Badge variant="outline" className="text-xs">Name required</Badge>
                </div>

                <div className="grid gap-4">
                  {/* Name (Required) */}
                  <div className="space-y-2">
                    <Label className={validationErrors.name ? 'text-destructive' : ''}>
                      Wholesaler Name *
                    </Label>
                    <Input
                      value={newWholesaler.name}
                      onChange={(e) => {
                        setNewWholesaler({ ...newWholesaler, name: e.target.value });
                        if (validationErrors.name) {
                          setValidationErrors({ ...validationErrors, name: false });
                        }
                      }}
                      placeholder="Company name"
                      className={validationErrors.name ? 'border-destructive' : ''}
                    />
                  </div>

                  {/* Address */}
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <AddressAutocomplete
                      value={newWholesaler.address}
                      onChange={(val) => setNewWholesaler({ ...newWholesaler, address: val })}
                      onSelect={(parsed) => setNewWholesaler(prev => ({
                        ...prev,
                        address: parsed.street,
                        city: parsed.city,
                        state: parsed.state,
                      }))}
                      placeholder="Street address"
                    />
                  </div>

                  {/* City & State */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={newWholesaler.city}
                        onChange={(e) => setNewWholesaler({ ...newWholesaler, city: e.target.value })}
                        placeholder="City"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input
                        value={newWholesaler.state}
                        onChange={(e) => setNewWholesaler({ ...newWholesaler, state: e.target.value })}
                        placeholder="State"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label>Telephone Number</Label>
                    <Input
                      value={newWholesaler.phone}
                      onChange={(e) => setNewWholesaler({ ...newWholesaler, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                      type="tel"
                    />
                  </div>
                </div>

                {/* Validation Warning */}
                {validationErrors.name && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Wholesaler name is required.</span>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={cancelAdd}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={createAndAssociateWholesaler}>
                    Add to Network
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* List of Associated Wholesalers */}
        {!isLoading && associations.length === 0 && !showAddForm ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No wholesalers associated yet.</p>
            <p className="text-xs mt-1">
              Add wholesalers this store purchases from.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {associations.map((assoc) => (
              <div
                key={assoc.wholesaler_id}
                className="flex items-start justify-between p-4 rounded-lg border bg-secondary/30"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{assoc.wholesaler.name}</p>
                    {assoc.isNew && (
                      <Badge variant="secondary" className="text-xs">New</Badge>
                    )}
                  </div>
                  {(assoc.wholesaler.address || assoc.wholesaler.city) && (
                    <p className="text-sm text-muted-foreground truncate">
                      {[assoc.wholesaler.address, assoc.wholesaler.city, assoc.wholesaler.state]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                  {assoc.wholesaler.phone && (
                    <p className="text-sm text-muted-foreground">
                      {assoc.wholesaler.phone}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive flex-shrink-0"
                  onClick={() => removeAssociation(assoc.wholesaler_id)}
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
            <p className="font-medium">Global wholesaler network</p>
            <p className="text-xs">
              Wholesalers are shared across all stores. Adding a new wholesaler makes it available to the entire network.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
