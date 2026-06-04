/**
 * DDDrillMenu — consistent context menu for cross-surface drill-through.
 *
 * Renders a (…) trigger; menu items are `to` links so right-click "Open in
 * new tab" works. Use this on every entity reference in the hub so an
 * operator can hop order → supplier → inventory → fulfillments in ≤3 clicks.
 */
import { Link } from 'react-router-dom';
import { MoreHorizontal, ChevronRight, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface DDDrillItem {
  label: string;
  to?: string;                  // react-router link
  href?: string;                // external link
  onSelect?: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Tiny badge text rendered on the right (e.g. count). */
  badge?: string | number;
}

interface DDDrillMenuProps {
  label?: string;                 // header label, e.g. "This order"
  items: DDDrillItem[];
  align?: 'start' | 'end' | 'center';
  size?: 'sm' | 'icon';
  className?: string;
  /** Custom trigger; defaults to a (…) icon button. */
  trigger?: React.ReactNode;
}

export function DDDrillMenu({
  label, items, align = 'end', size = 'icon', className, trigger,
}: DDDrillMenuProps) {
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size={size === 'sm' ? 'sm' : 'icon'}
            className={cn('h-7 w-7 p-0', className)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drill into"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[200px]">
        {label && (
          <>
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {label}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {items.map((it, i) => {
          const Icon = it.icon;
          const body = (
            <div className="flex items-center gap-2 w-full">
              {Icon && <Icon className="h-3.5 w-3.5 opacity-70" />}
              <span className="flex-1">{it.label}</span>
              {it.badge != null && (
                <span className="text-[10px] rounded bg-muted px-1.5 py-0.5">{it.badge}</span>
              )}
              {(it.to || it.href) && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
            </div>
          );
          if (it.to) {
            return (
              <DropdownMenuItem key={i} asChild disabled={it.disabled}>
                <Link to={it.to} onClick={(e) => e.stopPropagation()}>{body}</Link>
              </DropdownMenuItem>
            );
          }
          if (it.href) {
            return (
              <DropdownMenuItem key={i} asChild disabled={it.disabled}>
                <a href={it.href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{body}</a>
              </DropdownMenuItem>
            );
          }
          return (
            <DropdownMenuItem
              key={i}
              disabled={it.disabled}
              onSelect={(e) => { e.preventDefault(); it.onSelect?.(); }}
            >
              {body}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Convenience builders so every surface emits the same canonical drill items.
 */
export const ddDrill = {
  order: (id: string): DDDrillItem => ({
    label: `Open order ${id.slice(0, 8)}`,
    to: `/dynasty-direct/orders?focus=${id}`,
  }),
  supplier: (id: string, name?: string): DDDrillItem => ({
    label: name ? `Open ${name}` : `Open supplier`,
    to: `/dynasty-direct/supplier-network?focus=${id}`,
  }),
  supplierOrders: (id: string): DDDrillItem => ({
    label: 'Orders from this supplier',
    to: `/dynasty-direct/orders?supplier=${id}`,
  }),
  supplierProducts: (id: string): DDDrillItem => ({
    label: 'Products from this supplier',
    to: `/dynasty-direct/catalog?supplier=${id}`,
  }),
  supplierInvite: (id: string): DDDrillItem => ({
    label: 'Invite status',
    to: `/dynasty-direct/invites?wholesaler=${id}`,
  }),
  fulfillment: (orderId: string): DDDrillItem => ({
    label: 'Fulfillment console',
    to: `/dynasty-direct/fulfillment?order=${orderId}`,
  }),
  inventory: (whId: string): DDDrillItem => ({
    label: 'Inventory snapshot',
    to: `/dynasty-direct/supplier-network?focus=${whId}#inventory`,
  }),
  customer: (orderId: string): DDDrillItem => ({
    label: 'Customer history',
    to: `/dynasty-direct/orders?customer_of=${orderId}`,
  }),
};
