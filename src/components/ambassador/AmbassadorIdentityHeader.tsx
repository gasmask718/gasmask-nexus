import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { 
  ArrowLeft, Edit, MapPin, Calendar, Star, 
  AlertTriangle, CheckCircle2, Clock, XCircle
} from 'lucide-react';

interface AmbassadorIdentityHeaderProps {
  ambassador: any;
  displayName: string;
  onBack: () => void;
  onEdit: () => void;
}

const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; label: string }> = {
  active: { variant: 'default', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Active' },
  inactive: { variant: 'secondary', icon: <XCircle className="h-3 w-3" />, label: 'Inactive' },
  probation: { variant: 'outline', icon: <Clock className="h-3 w-3" />, label: 'Probation' },
  suspended: { variant: 'destructive', icon: <AlertTriangle className="h-3 w-3" />, label: 'Suspended' },
  at_risk: { variant: 'destructive', icon: <AlertTriangle className="h-3 w-3" />, label: 'At Risk' },
};

export function AmbassadorIdentityHeader({ 
  ambassador, 
  displayName, 
  onBack, 
  onEdit 
}: AmbassadorIdentityHeaderProps) {
  const status = ambassador?.is_active ? 'active' : 'inactive';
  const statusInfo = statusConfig[status] || statusConfig.inactive;
  
  const territory = [
    ambassador?.neighborhood,
    ambassador?.city,
    ambassador?.region
  ].filter(Boolean).join(', ');

  const tags = ambassador?.tags 
    ? (typeof ambassador.tags === 'string' 
        ? ambassador.tags.split(',').map((t: string) => t.trim()).filter(Boolean) 
        : ambassador.tags) 
    : [];

  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const startDate = ambassador?.created_at 
    ? format(new Date(ambassador.created_at), 'MMM d, yyyy')
    : null;

  return (
    <div className="flex items-start gap-4">
      {/* Back Button */}
      <Button variant="ghost" size="icon" onClick={onBack} className="mt-1">
        <ArrowLeft className="h-5 w-5" />
      </Button>

      {/* Avatar */}
      <Avatar className="h-16 w-16 border-2 border-primary/20">
        <AvatarImage src={ambassador?.profiles?.avatar_url} alt={displayName} />
        <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Identity Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold truncate">{displayName}</h1>
          <Badge variant={statusInfo.variant} className="gap-1">
            {statusInfo.icon}
            {statusInfo.label}
          </Badge>
          {ambassador?.tier && (
            <Badge variant="outline" className="capitalize gap-1">
              <Star className="h-3 w-3" />
              {ambassador.tier}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
          {territory && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {territory}
            </span>
          )}
          {startDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Since {startDate}
            </span>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((tag: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Edit Button */}
      <Button variant="outline" onClick={onEdit} className="shrink-0">
        <Edit className="h-4 w-4 mr-2" />
        Edit
      </Button>
    </div>
  );
}
