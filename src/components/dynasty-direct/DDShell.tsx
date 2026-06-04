/**
 * Wrapper for every Dynasty Direct page. Mounts the global AlertBar and
 * provides a consistent max-width content surface.
 */
import { ReactNode } from 'react';
import { DDAlertBar } from './DDAlertBar';
import { cn } from '@/lib/utils';

export function DDShell({
  children,
  className,
  noPadding = false,
}: {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div className={cn(noPadding ? '' : 'p-6', className)}>
      <DDAlertBar />
      {children}
    </div>
  );
}
