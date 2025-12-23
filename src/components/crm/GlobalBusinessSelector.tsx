import { useEffect } from 'react';
import { useBusinessStore } from '@/stores/businessStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Globe } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const ALL_BUSINESSES_ID = '__all__';

interface GlobalBusinessSelectorProps {
  showAllOption?: boolean;
  onAllSelected?: () => void;
  className?: string;
}

export const GlobalBusinessSelector = ({ 
  showAllOption = true, 
  onAllSelected,
  className 
}: GlobalBusinessSelectorProps) => {
  const { 
    businesses, 
    selectedBusiness, 
    loading, 
    switchBusiness, 
    fetchBusinesses,
    setSelectedBusiness
  } = useBusinessStore();

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  const handleValueChange = (value: string) => {
    if (value === ALL_BUSINESSES_ID) {
      setSelectedBusiness(null);
      onAllSelected?.();
    } else {
      switchBusiness(value);
    }
  };

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

  const getThemeColor = (business: typeof businesses[0]) => {
    const config = business.theme_config as { primary?: string; icon?: string } | null;
    return config?.primary || '#6366f1';
  };

  const getThemeIcon = (business: typeof businesses[0]) => {
    const config = business.theme_config as { primary?: string; icon?: string } | null;
    return config?.icon || '🏢';
  };

  const currentValue = selectedBusiness?.id || (showAllOption ? ALL_BUSINESSES_ID : '');

  return (
    <Select 
      value={currentValue} 
      onValueChange={handleValueChange}
    >
      <SelectTrigger className={`w-[240px] bg-background border-border ${className || ''}`}>
        <div className="flex items-center gap-2">
          {selectedBusiness ? (
            <>
              <div 
                className="h-3 w-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: getThemeColor(selectedBusiness) }}
              />
              <span className="mr-1">{getThemeIcon(selectedBusiness)}</span>
              <span className="truncate">{selectedBusiness.name}</span>
            </>
          ) : (
            <>
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">All Businesses</span>
            </>
          )}
        </div>
      </SelectTrigger>
      <SelectContent className="bg-popover border-border z-50 max-h-[300px]">
        {showAllOption && (
          <>
            <SelectItem value={ALL_BUSINESSES_ID}>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">All Businesses</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  {businesses.length}
                </Badge>
              </div>
            </SelectItem>
            <Separator className="my-1" />
          </>
        )}
        {businesses.map((business) => (
          <SelectItem key={business.id} value={business.id}>
            <div className="flex items-center gap-2">
              <div 
                className="h-3 w-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: getThemeColor(business) }}
              />
              <span className="mr-1">{getThemeIcon(business)}</span>
              <span>{business.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
