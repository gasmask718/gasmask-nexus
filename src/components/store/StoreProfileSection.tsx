import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StoreProfileSectionProps {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function StoreProfileSection({
  id,
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: StoreProfileSectionProps) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn('border-t border-border/60 pt-5', className)}>
        <header className="mb-4 sm:flex sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
        <div className={contentClassName}>{children}</div>
    </section>
  );
}