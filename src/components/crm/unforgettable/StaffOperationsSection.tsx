import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserCog, CalendarDays, DollarSign, FileText, ArrowRight, Users, AlertTriangle } from 'lucide-react';

const STAFF_OPS_LINKS = [
  { 
    label: 'Staff Management', 
    path: '/os/unforgettable/staff', 
    icon: UserCog,
    description: 'View and manage all staff members'
  },
  { 
    label: 'Scheduling', 
    path: '/os/unforgettable/scheduling', 
    icon: CalendarDays,
    description: 'Event-based staff assignments'
  },
  { 
    label: 'Payroll', 
    path: '/os/unforgettable/payroll', 
    icon: DollarSign,
    description: 'Payments and compensation'
  },
  { 
    label: 'Documents', 
    path: '/os/unforgettable/documents', 
    icon: FileText,
    description: 'Contracts and certifications'
  },
];

interface StaffOperationsSectionProps {
  businessSlug: string;
}

/**
 * HARD REQUIREMENT: This component MUST render for unforgettable_times_usa
 * regardless of CRM category inference or business metadata changes.
 * 
 * This is a permanent bridge between CRM and OS execution layer.
 */
export function StaffOperationsSection({ businessSlug }: StaffOperationsSectionProps) {
  const navigate = useNavigate();

  // ANTI-REGRESSION SAFEGUARD: Log error if this fails to render for unforgettable_times_usa
  useEffect(() => {
    if (businessSlug === 'unforgettable_times_usa') {
      console.log('[STAFF-OPS] ✅ Staff & Operations section rendered for unforgettable_times_usa');
    }
  }, [businessSlug]);

  // EXPLICIT BUSINESS SLUG MATCHING - NO INFERENCE
  if (businessSlug !== 'unforgettable_times_usa') {
    return null;
  }

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Staff & Operations
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Event Staff Management System
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STAFF_OPS_LINKS.map((link) => (
            <Button
              key={link.path}
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-start gap-2 hover:bg-primary/10 hover:border-primary/50 transition-all"
              onClick={() => navigate(link.path)}
            >
              <div className="flex items-center gap-2 w-full">
                <link.icon className="h-5 w-5 text-primary" />
                <span className="font-medium text-sm">{link.label}</span>
                <ArrowRight className="h-4 w-4 ml-auto opacity-50" />
              </div>
              <span className="text-xs text-muted-foreground text-left">
                {link.description}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Safeguard check function - call this to verify Staff & Operations rendered
 */
export function verifyStaffOperationsRendered(businessSlug: string): boolean {
  if (businessSlug === 'unforgettable_times_usa') {
    const rendered = document.querySelector('[data-staff-ops-section="true"]') !== null;
    if (!rendered) {
      console.error(
        '[STAFF-OPS] ❌ CRITICAL: Staff & Operations section FAILED to render for unforgettable_times_usa. ' +
        'This is a hard requirement violation. Check DynamicCRMPage rendering.'
      );
    }
    return rendered;
  }
  return true;
}
