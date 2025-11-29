// Phase 12 - Real-Time Status Badges

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { ValidationStatus } from '@/utils/validation/validationEngine';
import { cn } from '@/lib/utils';

interface ValidationBadgeProps {
  status: ValidationStatus;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const statusConfig: Record<ValidationStatus, {
  icon: React.ElementType;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
  label: string;
}> = {
  verified: {
    icon: CheckCircle,
    variant: 'default',
    className: 'bg-green-500/10 text-green-600 border-green-500/20',
    label: 'Verified',
  },
  warning: {
    icon: AlertTriangle,
    variant: 'secondary',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    label: 'Warning',
  },
  critical: {
    icon: XCircle,
    variant: 'destructive',
    className: 'bg-red-500/10 text-red-600 border-red-500/20',
    label: 'Critical',
  },
  unknown: {
    icon: HelpCircle,
    variant: 'outline',
    className: 'bg-muted text-muted-foreground',
    label: 'Unknown',
  },
};

export function ValidationBadge({ status, label, size = 'sm', className }: ValidationBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        config.className,
        size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
        className
      )}
    >
      <Icon className={cn('mr-1', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
      {label || config.label}
    </Badge>
  );
}

// Entity-specific badges
interface EntityStatusBadgeProps {
  entity: Record<string, unknown>;
  entityType: string;
  className?: string;
}

export function EntityStatusBadge({ entity, entityType, className }: EntityStatusBadgeProps) {
  const getStatus = (): { status: ValidationStatus; label: string } => {
    switch (entityType) {
      case 'stores':
        if (!entity.company_id) return { status: 'critical', label: 'Missing Company' };
        if (!entity.region) return { status: 'warning', label: 'Missing Region' };
        if (!entity.phone && !entity.email) return { status: 'warning', label: 'No Contact' };
        return { status: 'verified', label: 'Data OK' };

      case 'orders':
        if (!entity.store_id) return { status: 'critical', label: 'Missing Store' };
        if (!entity.invoice_id) return { status: 'warning', label: 'Missing Invoice' };
        return { status: 'verified', label: 'Complete' };

      case 'inventory':
        const stock = Number(entity.tubes_on_hand || 0);
        if (stock <= 0) return { status: 'critical', label: 'Out of Stock' };
        if (stock < 10) return { status: 'warning', label: 'Low Stock' };
        return { status: 'verified', label: 'In Stock' };

      case 'ambassadors':
        if (!entity.region) return { status: 'warning', label: 'Missing Region' };
        if (!entity.stores_assigned) return { status: 'warning', label: 'No Stores' };
        return { status: 'verified', label: 'Verified' };

      case 'drivers':
        if (!entity.region) return { status: 'warning', label: 'Unassigned' };
        return { status: 'verified', label: 'Active' };

      default:
        return { status: 'unknown', label: 'Unknown' };
    }
  };

  const { status, label } = getStatus();
  return <ValidationBadge status={status} label={label} className={className} />;
}
