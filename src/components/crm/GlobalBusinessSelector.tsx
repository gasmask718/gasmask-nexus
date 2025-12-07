import { useEffect } from 'react';
import { useBusinessStore } from '@/stores/businessStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export const GlobalBusinessSelector = () => {
  const { 
    businesses, 
    selectedBusiness, 
    loading, 
    switchBusiness, 
    fetchBusinesses,
    ensureBusinessSelected 
  } = useBusinessStore();

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading...
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        No businesses
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Select 
      value={selectedBusiness?.id || ''} 
      onValueChange={switchBusiness}
    >
      <SelectTrigger className="w-[220px] bg-background border-border">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={selectedBusiness?.logo_url || ''} />
            <AvatarFallback className="text-xs bg-primary/10">
              {selectedBusiness ? getInitials(selectedBusiness.name) : '??'}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{selectedBusiness?.name || 'Select Business'}</span>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-popover border-border z-50">
        {businesses.map((business) => (
          <SelectItem key={business.id} value={business.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={business.logo_url || ''} />
                <AvatarFallback className="text-xs bg-primary/10">
                  {getInitials(business.name)}
                </AvatarFallback>
              </Avatar>
              <span>{business.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
