/**
 * Empty State With Guidance - Reusable empty state component
 */
import { Button } from '@/components/ui/button';
import { ReactNode } from 'react';

interface EmptyStateWithGuidanceProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyStateWithGuidance({ 
  icon, 
  title, 
  description, 
  actionLabel, 
  onAction 
}: EmptyStateWithGuidanceProps) {
  return (
    <div className="text-center py-12">
      <div className="text-muted-foreground mb-4 flex justify-center">
        {icon}
      </div>
      <h3 className="font-medium mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
