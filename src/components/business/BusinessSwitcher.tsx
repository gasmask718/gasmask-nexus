import { Building2, ChevronDown, Plus } from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export function BusinessSwitcher() {
  const { currentBusiness, businesses, switchBusiness } = useBusiness();

  if (!currentBusiness) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getTierBadge = (tier: string) => {
    const variants: Record<string, any> = {
      free: 'secondary',
      starter: 'default',
      professional: 'default',
      enterprise: 'default'
    };
    return <Badge variant={variants[tier] || 'secondary'}>{tier}</Badge>;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full justify-between gap-2 border-border/40 hover:border-border"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={currentBusiness.logo_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getInitials(currentBusiness.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium truncate max-w-[160px]">
                {currentBusiness.name}
              </span>
              <span className="text-xs text-muted-foreground capitalize">
                {currentBusiness.member_role}
              </span>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Switch Business</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {businesses.map((business) => (
          <DropdownMenuItem
            key={business.id}
            onClick={() => switchBusiness(business.id)}
            className="cursor-pointer p-3"
          >
            <div className="flex items-center gap-3 w-full">
              <Avatar className="h-10 w-10">
                <AvatarImage src={business.logo_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getInitials(business.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate">
                    {business.name}
                  </span>
                  {business.id === currentBusiness.id && (
                    <Badge variant="outline" className="text-xs">Current</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground capitalize">
                    {business.member_role}
                  </span>
                  {getTierBadge(business.subscription_tier)}
                </div>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-primary">
          <Plus className="h-4 w-4 mr-2" />
          Create New Business
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
