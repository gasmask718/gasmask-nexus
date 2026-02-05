/**
 * AccountUpdateGuide - Persistent guide for updating account information
 * Explains what users can edit and what requires approval
 */
import { useState } from 'react';
import { Settings, ChevronDown, ChevronUp, Shield, Pencil, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FieldPermission {
  name: string;
  canEdit: boolean;
  requiresApproval: boolean;
}

interface AccountUpdateGuideProps {
  className?: string;
  defaultExpanded?: boolean;
}

// Field permissions by role
const roleFieldPermissions: Record<string, FieldPermission[]> = {
  driver: [
    { name: 'Display Name', canEdit: true, requiresApproval: false },
    { name: 'Phone Number', canEdit: true, requiresApproval: true },
    { name: 'Email', canEdit: false, requiresApproval: false },
    { name: 'Profile Photo', canEdit: true, requiresApproval: false },
    { name: 'Emergency Contact', canEdit: true, requiresApproval: false },
    { name: 'Vehicle Information', canEdit: true, requiresApproval: true },
    { name: 'License Details', canEdit: false, requiresApproval: false },
  ],
  biker: [
    { name: 'Display Name', canEdit: true, requiresApproval: false },
    { name: 'Phone Number', canEdit: true, requiresApproval: true },
    { name: 'Email', canEdit: false, requiresApproval: false },
    { name: 'Profile Photo', canEdit: true, requiresApproval: false },
    { name: 'Emergency Contact', canEdit: true, requiresApproval: false },
  ],
  ambassador: [
    { name: 'Display Name', canEdit: true, requiresApproval: false },
    { name: 'Phone Number', canEdit: true, requiresApproval: true },
    { name: 'Email', canEdit: false, requiresApproval: false },
    { name: 'Profile Photo', canEdit: true, requiresApproval: false },
    { name: 'Payment Method', canEdit: true, requiresApproval: true },
    { name: 'Bank Details', canEdit: true, requiresApproval: true },
    { name: 'Referral Code', canEdit: false, requiresApproval: false },
  ],
  production: [
    { name: 'Display Name', canEdit: true, requiresApproval: false },
    { name: 'Phone Number', canEdit: true, requiresApproval: true },
    { name: 'Email', canEdit: false, requiresApproval: false },
    { name: 'Profile Photo', canEdit: true, requiresApproval: false },
    { name: 'Shift Preferences', canEdit: true, requiresApproval: false },
  ],
  default: [
    { name: 'Display Name', canEdit: true, requiresApproval: false },
    { name: 'Phone Number', canEdit: true, requiresApproval: true },
    { name: 'Email', canEdit: false, requiresApproval: false },
    { name: 'Profile Photo', canEdit: true, requiresApproval: false },
  ],
};

export function AccountUpdateGuide({ className, defaultExpanded = false }: AccountUpdateGuideProps) {
  const { t, isRTL } = useTranslation();
  const { data: profileData } = useCurrentUserProfile();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const role = profileData?.profile?.primary_role || 'default';
  const fields = roleFieldPermissions[role] || roleFieldPermissions.default;
  
  const editableFields = fields.filter(f => f.canEdit);
  const readOnlyFields = fields.filter(f => !f.canEdit);
  const approvalFields = fields.filter(f => f.requiresApproval);
  
  return (
    <Card className={cn('border-primary/20', className)}>
      <CardHeader 
        className="cursor-pointer py-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
          <CardTitle className={cn('text-sm flex items-center gap-2', isRTL && 'flex-row-reverse')}>
            <Settings className="h-4 w-4 text-primary" />
            {t('guidance.account_update') || 'How to Update Your Account'}
          </CardTitle>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Editable Fields */}
          <div>
            <div className={cn('flex items-center gap-2 mb-2', isRTL && 'flex-row-reverse')}>
              <Pencil className="h-3.5 w-3.5 text-green-500" />
              <h4 className="text-xs font-medium uppercase text-muted-foreground">
                {t('guidance.can_edit') || 'You Can Edit'}
              </h4>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {editableFields.map((field, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary" 
                  className="text-xs bg-green-500/10 text-green-700 border-green-500/20"
                >
                  {field.name}
                </Badge>
              ))}
            </div>
          </div>
          
          {/* Requires Approval */}
          {approvalFields.length > 0 && (
            <div>
              <div className={cn('flex items-center gap-2 mb-2', isRTL && 'flex-row-reverse')}>
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <h4 className="text-xs font-medium uppercase text-muted-foreground">
                  {t('guidance.needs_approval') || 'Requires Approval'}
                </h4>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {approvalFields.map((field, idx) => (
                  <Badge 
                    key={idx} 
                    variant="secondary" 
                    className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/20"
                  >
                    {field.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Read Only */}
          {readOnlyFields.length > 0 && (
            <div>
              <div className={cn('flex items-center gap-2 mb-2', isRTL && 'flex-row-reverse')}>
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <h4 className="text-xs font-medium uppercase text-muted-foreground">
                  {t('guidance.read_only') || 'Read Only (Contact Admin)'}
                </h4>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {readOnlyFields.map((field, idx) => (
                  <Badge 
                    key={idx} 
                    variant="outline" 
                    className="text-xs text-muted-foreground"
                  >
                    {field.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Process Explanation */}
          <div className={cn(
            'text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg border border-border/50',
            isRTL && 'text-right'
          )}>
            <p className="font-medium mb-1">
              {t('guidance.after_submit') || 'After you submit changes:'}
            </p>
            <ul className={cn('space-y-0.5', isRTL ? 'pr-3' : 'pl-3')}>
              <li>• {t('guidance.instant_changes') || 'Some changes apply instantly'}</li>
              <li>• {t('guidance.approval_wait') || 'Others go to admin for review'}</li>
              <li>• {t('guidance.notified') || "You'll be notified when approved"}</li>
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
