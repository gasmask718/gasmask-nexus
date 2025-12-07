import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Check, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface BoroughSelectorProps {
  value?: string;
  onChange: (boroughId: string) => void;
  businessId?: string;
}

interface Borough {
  id: string;
  name: string;
  created_at: string;
}

export const BoroughSelector = ({ value, onChange, businessId }: BoroughSelectorProps) => {
  const [showAddNew, setShowAddNew] = useState(false);
  const [newBoroughName, setNewBoroughName] = useState('');
  const queryClient = useQueryClient();

  const { data: boroughs = [], isLoading } = useQuery({
    queryKey: ['boroughs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boroughs')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Borough[];
    },
  });

  const addBoroughMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('boroughs')
        .insert({ name, business_id: businessId || null })
        .select()
        .single();
      
      if (error) throw error;
      return data as Borough;
    },
    onSuccess: (newBorough) => {
      queryClient.invalidateQueries({ queryKey: ['boroughs'] });
      setShowAddNew(false);
      setNewBoroughName('');
      onChange(newBorough.id);
      toast({
        title: 'Borough Added',
        description: `${newBorough.name} has been added successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add borough',
        variant: 'destructive',
      });
    },
  });

  const handleAddBorough = () => {
    const trimmedName = newBoroughName.trim();
    if (!trimmedName) {
      toast({
        title: 'Error',
        description: 'Borough name cannot be empty',
        variant: 'destructive',
      });
      return;
    }
    addBoroughMutation.mutate(trimmedName);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>Borough</Label>
        <div className="h-10 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Customer Borough</Label>
      
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="bg-background">
          <SelectValue placeholder="Select borough..." />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border z-50">
          {boroughs.map((borough) => (
            <SelectItem key={borough.id} value={borough.id}>
              {borough.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!showAddNew ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAddNew(true)}
          className="text-xs text-muted-foreground hover:text-primary"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add New Borough
        </Button>
      ) : (
        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
          <Input
            value={newBoroughName}
            onChange={(e) => setNewBoroughName(e.target.value)}
            placeholder="Enter borough name..."
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddBorough();
              } else if (e.key === 'Escape') {
                setShowAddNew(false);
                setNewBoroughName('');
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddBorough}
            disabled={addBoroughMutation.isPending}
            className="h-8 w-8 p-0"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowAddNew(false);
              setNewBoroughName('');
            }}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
