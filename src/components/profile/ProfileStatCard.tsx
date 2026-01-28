/**
 * ProfileStatCard - Reusable stat card for profile pages
 */
import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ProfileStatCardProps {
  icon: ReactNode;
  iconClassName?: string;
  value: string | number;
  label: string;
  onClick?: () => void;
}

export function ProfileStatCard({
  icon,
  iconClassName,
  value,
  label,
  onClick,
}: ProfileStatCardProps) {
  return (
    <Card 
      className={cn(
        'transition-colors',
        onClick && 'cursor-pointer hover:border-primary/40'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', iconClassName || 'bg-primary/10')}>
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ProfileStatCard;
