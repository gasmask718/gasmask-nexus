import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, Clock, User, DollarSign, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

interface VisitLog {
  id: string;
  visit_type: string;
  visit_datetime: string | null;
  created_at: string;
  customer_response: string | null;
  cash_collected: number | null;
  products_delivered: any;
  user?: {
    name: string;
    role?: string;
  } | null;
}

interface VisitDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visit: VisitLog | null;
}

// Helper function to determine source from role
const getSourceFromRole = (role?: string | null): string => {
  if (!role) return "System";
  const roleLower = role.toLowerCase();
  if (roleLower === 'va' || roleLower.includes('va')) return "VA";
  if (roleLower === 'biker' || roleLower === 'driver') return "Biker";
  if (roleLower === 'admin' || roleLower === 'owner') return "Admin";
  if (roleLower.includes('ai') || roleLower === 'ai') return "AI";
  return "User";
};

export function VisitDetailModal({ open, onOpenChange, visit }: VisitDetailModalProps) {
  if (!visit) return null;

  const visitTypeLabel = visit.visit_type?.replace(/([A-Z])/g, ' $1').trim() || 'Visit';
  const productCount = visit.products_delivered 
    ? (Array.isArray(visit.products_delivered) ? visit.products_delivered.length : 1) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>{visitTypeLabel}</span>
              <p className="text-sm font-normal text-muted-foreground">
                Store Visit
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Visit Type Badge */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              {visitTypeLabel}
            </Badge>
          </div>

          <Separator />

          {/* Visit Details */}
          <div className="grid gap-3 text-sm">
            {visit.visit_datetime && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Visit Date: <span className="text-foreground font-medium">
                    {format(new Date(visit.visit_datetime), 'EEEE, MMMM d, yyyy at h:mm a')}
                  </span>
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Logged: <span className="text-foreground font-medium">
                  {format(new Date(visit.created_at), 'EEEE, MMMM d, yyyy at h:mm a')}
                </span>
              </span>
            </div>
            {visit.user?.name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>
                  By: <span className="text-foreground font-medium">{visit.user.name}</span>
                </span>
                <Badge variant="outline" className="text-xs">
                  {getSourceFromRole(visit.user.role)}
                </Badge>
              </div>
            )}
          </div>

          {/* Customer Response */}
          {visit.customer_response && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Customer Response
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-lg">
                  {visit.customer_response}
                </p>
              </div>
            </>
          )}

          {/* Cash Collected */}
          {visit.cash_collected && visit.cash_collected > 0 && (
            <>
              <Separator />
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground">Cash Collected:</span>
                <span className="text-foreground font-medium text-green-600">
                  ${visit.cash_collected.toFixed(2)}
                </span>
              </div>
            </>
          )}

          {/* Products Delivered */}
          {productCount > 0 && (
            <>
              <Separator />
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Products Delivered:</span>
                <Badge variant="outline" className="text-xs">
                  {productCount} {productCount === 1 ? 'item' : 'items'}
                </Badge>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

