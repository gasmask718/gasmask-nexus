import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Phone, Mail, Calendar, MessageSquare, ClipboardList,
  AlertTriangle, UserPlus, DollarSign, MapPin, FileEdit
} from 'lucide-react';
import { toast } from 'sonner';
import { useCall } from '@/components/communication/CallProvider';

interface WholesalerActionBarProps {
  profile: any;
  onScheduleVisit?: () => void;
  onLogCommunication?: () => void;
  onCreateTask?: () => void;
  onAdjustPricing?: () => void;
  onFlagRenegotiation?: () => void;
  onAssignRep?: () => void;
  onEscalate?: () => void;
}

export function WholesalerActionBar({
  profile,
  onScheduleVisit,
  onLogCommunication,
  onCreateTask,
  onAdjustPricing,
  onFlagRenegotiation,
  onAssignRep,
  onEscalate,
}: WholesalerActionBarProps) {
  const { initiateCall } = useCall();

  const handleCall = () => {
    if (profile?.phone) {
      initiateCall({
        destinationPhone: profile.phone,
        entityType: 'wholesaler',
        entityId: profile.id,
        entityName: profile.name || profile.company_name || 'Wholesaler',
      });
    } else {
      toast.error('No phone number available');
    }
  };

  const handleEmail = () => {
    if (profile?.email) {
      window.open(`mailto:${profile.email}`, '_self');
    } else {
      toast.error('No email available');
    }
  };

  const handleWhatsApp = () => {
    if (profile?.phone_whatsapp || profile?.phone) {
      const phone = profile.phone_whatsapp || profile.phone;
      window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
    } else {
      toast.error('No WhatsApp number available');
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/50 py-3 px-4 -mx-6 mb-6">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wider shrink-0">Quick Actions:</span>
        
        {/* Communication Actions */}
        <div className="flex items-center gap-1 border-r border-border/50 pr-2 mr-2">
          <Button size="sm" variant="outline" onClick={handleCall}>
            <Phone className="h-4 w-4 mr-1" />
            Call
          </Button>
          <Button size="sm" variant="outline" onClick={handleEmail}>
            <Mail className="h-4 w-4 mr-1" />
            Email
          </Button>
          <Button size="sm" variant="outline" onClick={handleWhatsApp}>
            <MessageSquare className="h-4 w-4 mr-1" />
            WhatsApp
          </Button>
        </div>

        {/* Task Actions */}
        <div className="flex items-center gap-1 border-r border-border/50 pr-2 mr-2">
          <Button size="sm" variant="outline" onClick={onScheduleVisit}>
            <Calendar className="h-4 w-4 mr-1" />
            Schedule Visit
          </Button>
          <Button size="sm" variant="outline" onClick={onCreateTask}>
            <ClipboardList className="h-4 w-4 mr-1" />
            Create Task
          </Button>
        </div>

        {/* Business Actions */}
        <div className="flex items-center gap-1 border-r border-border/50 pr-2 mr-2">
          <Button size="sm" variant="outline" onClick={onAdjustPricing}>
            <DollarSign className="h-4 w-4 mr-1" />
            Adjust Pricing
          </Button>
          <Button size="sm" variant="outline" onClick={onFlagRenegotiation}>
            <FileEdit className="h-4 w-4 mr-1" />
            Flag Renegotiation
          </Button>
        </div>

        {/* Admin Actions */}
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={onAssignRep}>
            <UserPlus className="h-4 w-4 mr-1" />
            Assign Rep
          </Button>
          <Button size="sm" variant="destructive" onClick={onEscalate}>
            <AlertTriangle className="h-4 w-4 mr-1" />
            Escalate
          </Button>
        </div>
      </div>
    </div>
  );
}
