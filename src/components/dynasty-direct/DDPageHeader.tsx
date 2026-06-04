/**
 * Standardized page header for every Dynasty Direct sub-surface.
 * Title + purpose line + breadcrumb + optional primary action.
 */
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LucideIcon } from 'lucide-react';

interface Crumb { label: string; href?: string }

interface DDPageHeaderProps {
  icon?: LucideIcon;
  title: string;
  purpose?: string;
  crumbs?: Crumb[];
  action?: ReactNode;
}

export function DDPageHeader({ icon: Icon, title, purpose, crumbs, action }: DDPageHeaderProps) {
  return (
    <div className="mb-6">
      <nav className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
        <Link to="/dynasty-direct" className="hover:text-foreground">Dynasty Direct</Link>
        {(crumbs ?? []).map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            {c.href ? <Link to={c.href} className="hover:text-foreground">{c.label}</Link> : <span>{c.label}</span>}
          </span>
        ))}
      </nav>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="rounded-md bg-primary/10 text-primary p-2 mt-0.5">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {purpose && <p className="text-sm text-muted-foreground mt-0.5">{purpose}</p>}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
