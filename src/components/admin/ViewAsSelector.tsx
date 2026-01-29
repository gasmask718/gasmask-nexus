/**
 * ViewAsSelector - Admin dropdown to select an ambassador to view as
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Search, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useViewAs } from '@/contexts/ViewAsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export function ViewAsSelector() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { startViewAs, isViewingAs } = useViewAs();

  const { data: ambassadors, isLoading } = useQuery({
    queryKey: ['all-ambassadors-for-viewas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id, name, user_id, city, state, tier, is_active')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const filteredAmbassadors = ambassadors?.filter(amb => 
    amb.name?.toLowerCase().includes(search.toLowerCase()) ||
    amb.city?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleSelect = async (ambassador: typeof filteredAmbassadors[0]) => {
    await startViewAs({
      id: ambassador.id,
      name: ambassador.name,
      user_id: ambassador.user_id,
    });
    setOpen(false);
  };

  if (isViewingAs) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          View As Ambassador
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>View Portal as Ambassador</DialogTitle>
          <DialogDescription>
            Select an ambassador to view the portal from their perspective (read-only mode).
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ambassadors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px] mt-2">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredAmbassadors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No ambassadors found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAmbassadors.map(amb => (
                <button
                  key={amb.id}
                  onClick={() => handleSelect(amb)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{amb.name || 'Unnamed Ambassador'}</p>
                    <p className="text-xs text-muted-foreground">
                      {amb.city}{amb.city && amb.state ? ', ' : ''}{amb.state}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {amb.tier && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {amb.tier}
                      </Badge>
                    )}
                    <Badge variant={amb.is_active ? 'default' : 'secondary'} className="text-xs">
                      {amb.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default ViewAsSelector;
