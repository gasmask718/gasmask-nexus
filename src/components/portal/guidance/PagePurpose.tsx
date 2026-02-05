/**
 * PagePurpose - Role-aware page explanation component
 * Displays context-sensitive guidance based on user role and language
 */
import { Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

export interface PagePurposeContent {
  title: string;
  description: string;
  actions: string[];
  warnings?: string[];
}

export interface PagePurposeConfig {
  // Keyed by role, fallback to 'default'
  admin?: PagePurposeContent;
  ambassador?: PagePurposeContent;
  driver?: PagePurposeContent;
  biker?: PagePurposeContent;
  production?: PagePurposeContent;
  wholesaler?: PagePurposeContent;
  default: PagePurposeContent;
}

interface PagePurposeProps {
  pageKey: string; // Used to fetch translations like 'page.dashboard.purpose'
  config: PagePurposeConfig;
  variant?: 'default' | 'compact';
  className?: string;
}

export function PagePurpose({ pageKey, config, variant = 'default', className }: PagePurposeProps) {
  const { t, isRTL } = useTranslation();
  const { data: profileData } = useCurrentUserProfile();
  const role = profileData?.profile?.primary_role || 'default';
  
  // Get role-specific content or fallback to default
  const content = config[role as keyof PagePurposeConfig] || config.default;
  
  if (variant === 'compact') {
    return (
      <div className={cn(
        'flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50',
        isRTL && 'flex-row-reverse text-right',
        className
      )}>
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">{content.description}</p>
      </div>
    );
  }
  
  return (
    <div className={cn(
      'rounded-lg border bg-card/50 p-4 mb-6',
      isRTL && 'text-right',
      className
    )}>
      <div className={cn('flex items-start gap-3', isRTL && 'flex-row-reverse')}>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Info className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              {t('guidance.purpose') || 'Purpose'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {content.description}
            </p>
          </div>
          
          {content.actions.length > 0 && (
            <div>
              <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">
                {t('guidance.what_to_do') || 'What to do here'}
              </h4>
              <ul className="space-y-1.5">
                {content.actions.map((action, idx) => (
                  <li key={idx} className={cn('flex items-center gap-2 text-sm', isRTL && 'flex-row-reverse')}>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {content.warnings && content.warnings.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <h4 className="font-medium text-xs text-amber-600 uppercase tracking-wide mb-2">
                {t('guidance.important') || 'Important'}
              </h4>
              <ul className="space-y-1">
                {content.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-amber-600">
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
