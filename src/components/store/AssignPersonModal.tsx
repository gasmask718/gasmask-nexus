import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Search, UserPlus, User, Phone, MapPin, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AssignPersonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  role: 'ambassador' | 'driver' | 'biker' | 'production';
  onSuccess?: () => void;
}

interface Person {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address_city: string | null;
  type: string | null;
}

const ROLE_LABELS = {
  ambassador: 'Ambassador',
  driver: 'Driver',
  biker: 'Biker',
  production: 'Production Worker',
};

export function AssignPersonModal({
  open,
  onOpenChange,
  storeId,
  storeName,
  role,
  onSuccess,
}: AssignPersonModalProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  
  // New person form state
  const [newPerson, setNewPerson] = useState({
    name: '',
    phone: '',
    city: '',
  });

  // Search existing people
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['people-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      const { data, error } = await supabase
        .from('people')
        .select('id, name, phone, email, address_city, type')
        .or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(10);
      
      if (error) throw error;
      return data as Person[];
    },
    enabled: searchQuery.length >= 2,
  });

  // Assign existing person to store
  const assignMutation = useMutation({
    mutationFn: async (personId: string) => {
      // First, ensure the person has the role in person_roles
      const { error: roleError } = await supabase
        .from('person_roles')
        .upsert({
          person_id: personId,
          role: role,
          is_active: true,
        }, { onConflict: 'person_id,role' });
      
      if (roleError) throw roleError;

      // Then link to store via store_people
      const { error: linkError } = await supabase
        .from('store_people')
        .upsert({
          store_id: storeId,
          person_id: personId,
          role: role,
          is_active: true,
        }, { onConflict: 'store_id,person_id,role' });
      
      if (linkError) throw linkError;
    },
    onSuccess: () => {
      toast.success(`${ROLE_LABELS[role]} assigned to ${storeName}`);
      queryClient.invalidateQueries({ queryKey: ['store-people', storeId, role] });
      queryClient.invalidateQueries({ queryKey: ['people-search'] });
      resetAndClose();
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Failed to assign person:', error);
      toast.error('Failed to assign person');
    },
  });

  // Create new person and assign to store
  const createAndAssignMutation = useMutation({
    mutationFn: async () => {
      if (!newPerson.phone) {
        throw new Error('Phone number is required');
      }

      // Check if person with this phone already exists
      const { data: existing } = await supabase
        .from('people')
        .select('id')
        .eq('phone', newPerson.phone)
        .maybeSingle();

      let personId: string;

      if (existing) {
        // Person exists, just assign the role
        personId = existing.id;
      } else {
        // Create new person
        const { data: newPersonData, error: createError } = await supabase
          .from('people')
          .insert({
            name: newPerson.name,
            phone: newPerson.phone,
            address_city: newPerson.city,
            type: role,
          })
          .select('id')
          .single();
        
        if (createError) throw createError;
        personId = newPersonData.id;
      }

      // Add role to person_roles
      const { error: roleError } = await supabase
        .from('person_roles')
        .upsert({
          person_id: personId,
          role: role,
          is_active: true,
        }, { onConflict: 'person_id,role' });
      
      if (roleError) throw roleError;

      // Link to store
      const { error: linkError } = await supabase
        .from('store_people')
        .upsert({
          store_id: storeId,
          person_id: personId,
          role: role,
          is_active: true,
        }, { onConflict: 'store_id,person_id,role' });
      
      if (linkError) throw linkError;

      return personId;
    },
    onSuccess: () => {
      toast.success(`New ${ROLE_LABELS[role]} created and assigned to ${storeName}`);
      queryClient.invalidateQueries({ queryKey: ['store-people', storeId, role] });
      queryClient.invalidateQueries({ queryKey: ['people'] });
      resetAndClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error('Failed to create person:', error);
      toast.error(error.message || 'Failed to create person');
    },
  });

  const resetAndClose = () => {
    setSearchQuery('');
    setSelectedPerson(null);
    setNewPerson({ name: '', phone: '', city: '' });
    onOpenChange(false);
  };

  const handleAssignExisting = () => {
    if (selectedPerson) {
      assignMutation.mutate(selectedPerson.id);
    }
  };

  const handleCreateNew = () => {
    if (!newPerson.phone) {
      toast.error('Phone number is required');
      return;
    }
    createAndAssignMutation.mutate();
  };

  const isSubmitting = assignMutation.isPending || createAndAssignMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add {ROLE_LABELS[role]}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="existing" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">
              <Search className="h-4 w-4 mr-2" />
              Assign Existing
            </TabsTrigger>
            <TabsTrigger value="new">
              <UserPlus className="h-4 w-4 mr-2" />
              Create New
            </TabsTrigger>
          </TabsList>

          {/* Tab: Assign Existing Person */}
          <TabsContent value="existing" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search by name or phone</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search people..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="min-h-[200px] max-h-[300px] overflow-y-auto space-y-2">
              {isSearching && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {!isSearching && searchQuery.length < 2 && (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Type at least 2 characters to search</p>
                </div>
              )}

              {!isSearching && searchQuery.length >= 2 && searchResults?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No people found</p>
                  <p className="text-sm">Try creating a new person instead</p>
                </div>
              )}

              {searchResults?.map((person) => (
                <div
                  key={person.id}
                  onClick={() => setSelectedPerson(person)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPerson?.id === person.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{person.name || 'Unknown'}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {person.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {person.phone}
                          </span>
                        )}
                        {person.address_city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {person.address_city}
                          </span>
                        )}
                      </div>
                    </div>
                    {person.type && (
                      <Badge variant="secondary" className="text-xs">
                        {person.type}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={handleAssignExisting}
              disabled={!selectedPerson || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Assign as {ROLE_LABELS[role]}
            </Button>
          </TabsContent>

          {/* Tab: Create New Person */}
          <TabsContent value="new" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="+1 (555) 123-4567"
                    value={newPerson.phone}
                    onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Required — used as unique identifier
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Full name"
                  value={newPerson.name}
                  onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  value={newPerson.city}
                  onChange={(e) => setNewPerson({ ...newPerson, city: e.target.value })}
                />
              </div>
            </div>

            <Button
              onClick={handleCreateNew}
              disabled={!newPerson.phone || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Create & Assign as {ROLE_LABELS[role]}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}