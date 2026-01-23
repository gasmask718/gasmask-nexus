import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, Plus, Phone, MessageSquare, User, 
  UserMinus, Loader2, Bike, Truck, Star, Eye, Factory
} from 'lucide-react';
import { toast } from 'sonner';
import { AssignPersonModal } from './AssignPersonModal';
import { useCall } from '@/components/communication/CallProvider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StoreRoleSectionProps {
  storeId: string;
  storeName: string;
  role: 'ambassador' | 'driver' | 'biker' | 'production';
  /** When true, renders without Card wrapper (for use inside tabs) */
  embedded?: boolean;
}

interface StorePerson {
  id: string;
  person_id: string;
  role: string;
  is_active: boolean;
  assigned_at: string;
  people: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    address_city: string | null;
  } | null;
}

const ROLE_CONFIG = {
  ambassador: {
    label: 'Ambassadors',
    singularLabel: 'Ambassador',
    icon: Star,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  driver: {
    label: 'Drivers',
    singularLabel: 'Driver',
    icon: Truck,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  biker: {
    label: 'Bikers',
    singularLabel: 'Biker',
    icon: Bike,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  production: {
    label: 'Production',
    singularLabel: 'Production Worker',
    icon: Factory,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
};

export function StoreRoleSection({ storeId, storeName, role, embedded = false }: StoreRoleSectionProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [personToRemove, setPersonToRemove] = useState<StorePerson | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;

  // Handle view profile for ambassadors
  const handleViewProfile = (personId: string) => {
    if (role === 'ambassador') {
      // Need to find the ambassador ID from the person ID
      // The person_id links to people table, but we need ambassador ID
      navigate(`/grabba/ambassadors/${personId}`);
    }
  };

  // Fetch people assigned to this store with this role
  const { data: storePeople, isLoading } = useQuery({
    queryKey: ['store-people', storeId, role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_people')
        .select(`
          id,
          person_id,
          role,
          is_active,
          assigned_at,
          people (
            id,
            name,
            phone,
            email,
            address_city
          )
        `)
        .eq('store_id', storeId)
        .eq('role', role)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return data as StorePerson[];
    },
  });

  // Remove person from store (soft delete - set is_active = false)
  const removeMutation = useMutation({
    mutationFn: async (storePersonId: string) => {
      const { error } = await supabase
        .from('store_people')
        .update({ is_active: false })
        .eq('id', storePersonId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${config.singularLabel} removed from ${storeName}`);
      queryClient.invalidateQueries({ queryKey: ['store-people', storeId, role] });
      setPersonToRemove(null);
      setRemoveDialogOpen(false);
    },
    onError: (error) => {
      console.error('Failed to remove person:', error);
      toast.error('Failed to remove person');
    },
  });

  const { initiateCall } = useCall();

  const handleCall = (phone: string | null, name: string | null) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    initiateCall({
      destinationPhone: phone,
      entityType: 'other',
      entityName: name || 'Person',
    });
  };

  const handleText = (phone: string | null, name: string | null) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    window.open(`sms:${phone}`);
    toast.info(`Opening SMS to ${name || 'person'}...`);
  };

  const handleRemoveClick = (person: StorePerson) => {
    setPersonToRemove(person);
    setRemoveDialogOpen(true);
  };

  // Loading state
  if (isLoading) {
    if (embedded) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Content for the role section (shared between embedded and card modes)
  const peopleList = (
    <>
      {!storePeople || storePeople.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Icon className={`h-10 w-10 mx-auto mb-2 opacity-30 ${config.color}`} />
          <p className="text-sm">No {config.label.toLowerCase()} assigned yet</p>
          <p className="text-xs mt-1">Click the button above to add one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {storePeople.map((sp) => (
            <div
              key={sp.id}
              className={`flex items-center justify-between p-3 rounded-lg ${config.bgColor} border ${config.borderColor}`}
            >
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-full ${config.bgColor} flex items-center justify-center`}>
                  <User className={`h-4 w-4 ${config.color}`} />
                </div>
                <div>
                  <div className="font-medium text-sm">
                    {sp.people?.name || 'Unknown'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {sp.people?.phone && <span>{sp.people.phone}</span>}
                    {sp.people?.address_city && (
                      <span className="opacity-70">• {sp.people.address_city}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* View Profile button for ambassadors */}
                {role === 'ambassador' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => handleViewProfile(sp.person_id)}
                    title="View Profile"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => handleCall(sp.people?.phone || null, sp.people?.name || null)}
                  disabled={!sp.people?.phone}
                  title="Call"
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => handleText(sp.people?.phone || null, sp.people?.name || null)}
                  disabled={!sp.people?.phone}
                  title="Text"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleRemoveClick(sp)}
                  title="Remove from store"
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  // Modals (shared)
  const modals = (
    <>
      <AssignPersonModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        storeId={storeId}
        storeName={storeName}
        role={role}
      />

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {config.singularLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{personToRemove?.people?.name || 'this person'}</strong> as 
              a {config.singularLabel.toLowerCase()} from {storeName}. 
              The person will still exist in the system and can be re-assigned later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => personToRemove && removeMutation.mutate(personToRemove.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserMinus className="h-4 w-4 mr-2" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  // Embedded mode: no Card wrapper, compact header + content
  if (embedded) {
    return (
      <>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Icon className={`h-4 w-4 ${config.color}`} />
            {config.label}
            {storePeople && storePeople.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {storePeople.length}
              </Badge>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
        {peopleList}
        {modals}
      </>
    );
  }

  // Card mode: full Card wrapper (for standalone use)
  return (
    <>
      <Card className={`glass-card border-border/50 border-l-4 ${config.borderColor}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Icon className={`h-5 w-5 ${config.color}`} />
            {config.label}
            {storePeople && storePeople.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {storePeople.length}
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add {config.singularLabel}
          </Button>
        </CardHeader>
        <CardContent>
          {peopleList}
        </CardContent>
      </Card>
      {modals}
    </>
  );
}