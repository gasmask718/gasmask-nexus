/**
 * Communication Action Buttons - Call/Text/Email for TopTier CRM
 * Supports consent checking and simulation mode
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, Mail, Loader2 } from 'lucide-react';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { toast } from '@/hooks/use-toast';

interface ContactInfo {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  smsOptIn?: boolean;
  emailOptIn?: boolean;
}

interface CommunicationActionsProps {
  contact: ContactInfo;
  entityType: 'partner' | 'customer';
  size?: 'sm' | 'default' | 'icon';
  variant?: 'ghost' | 'outline' | 'default';
  showLabels?: boolean;
  onInteractionLogged?: (type: string) => void;
}

export function CommunicationActions({
  contact,
  entityType,
  size = 'sm',
  variant = 'ghost',
  showLabels = false,
  onInteractionLogged
}: CommunicationActionsProps) {
  const { simulationMode } = useSimulationMode();
  const [loading, setLoading] = useState<string | null>(null);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const hasPhone = !!contact.phone;
  const hasEmail = !!contact.email;
  const hasSmsConsent = contact.smsOptIn !== false; // Default to true if not explicitly false
  const hasEmailConsent = contact.emailOptIn !== false;

  const getDisabledReason = (type: 'call' | 'text' | 'email') => {
    if (type === 'call' && !hasPhone) return 'No phone number available';
    if (type === 'text') {
      if (!hasPhone) return 'No phone number available';
      if (!hasSmsConsent) return 'SMS opt-in not received';
    }
    if (type === 'email') {
      if (!hasEmail) return 'No email address available';
      if (!hasEmailConsent) return 'Email opt-in not received';
    }
    return null;
  };

  const logInteraction = async (type: string, content?: string) => {
    // In a real app, this would save to DB
    console.log(`[${simulationMode ? 'SIMULATED' : 'REAL'}] Logging ${type} interaction for ${contact.name}:`, content);
    onInteractionLogged?.(type);
  };

  const handleCall = async () => {
    if (!hasPhone) return;
    
    setLoading('call');
    try {
      if (simulationMode) {
        await new Promise(r => setTimeout(r, 1000));
        toast({
          title: '📞 Simulated Call',
          description: `Simulated call to ${contact.name} at ${contact.phone}`,
        });
      } else {
        // In real mode, initiate Twilio call or open dialer
        window.location.href = `tel:${contact.phone}`;
        toast({
          title: '📞 Initiating Call',
          description: `Calling ${contact.name}...`,
        });
      }
      await logInteraction('call', `Called ${contact.phone}`);
    } finally {
      setLoading(null);
    }
  };

  const handleSendSms = async () => {
    if (!messageContent.trim()) {
      toast({ title: 'Error', description: 'Please enter a message', variant: 'destructive' });
      return;
    }

    setLoading('text');
    try {
      if (simulationMode) {
        await new Promise(r => setTimeout(r, 1000));
        toast({
          title: '💬 Simulated SMS',
          description: `Simulated text to ${contact.name}: "${messageContent.slice(0, 50)}..."`,
        });
      } else {
        // In real mode, call Twilio API
        toast({
          title: '💬 SMS Sent',
          description: `Text sent to ${contact.name}`,
        });
      }
      await logInteraction('sms', messageContent);
      setSmsModalOpen(false);
      setMessageContent('');
    } finally {
      setLoading(null);
    }
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast({ title: 'Error', description: 'Please enter subject and body', variant: 'destructive' });
      return;
    }

    setLoading('email');
    try {
      if (simulationMode) {
        await new Promise(r => setTimeout(r, 1000));
        toast({
          title: '✉️ Simulated Email',
          description: `Simulated email to ${contact.name}: "${emailSubject}"`,
        });
      } else {
        // In real mode, call email API
        toast({
          title: '✉️ Email Sent',
          description: `Email sent to ${contact.name}`,
        });
      }
      await logInteraction('email', `Subject: ${emailSubject}\n\n${emailBody}`);
      setEmailModalOpen(false);
      setEmailSubject('');
      setEmailBody('');
    } finally {
      setLoading(null);
    }
  };

  const ButtonWithTooltip = ({ 
    type, 
    icon: Icon, 
    label, 
    onClick, 
    disabled 
  }: { 
    type: 'call' | 'text' | 'email'; 
    icon: any; 
    label: string; 
    onClick: () => void; 
    disabled: boolean;
  }) => {
    const disabledReason = getDisabledReason(type);
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant={variant}
                size={size}
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
                disabled={disabled || loading === type}
                className={disabled ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {loading === type ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                {showLabels && <span className="ml-1">{label}</span>}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {disabledReason || `${label} ${contact.name}`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <ButtonWithTooltip
          type="call"
          icon={Phone}
          label="Call"
          onClick={handleCall}
          disabled={!hasPhone}
        />
        <ButtonWithTooltip
          type="text"
          icon={MessageSquare}
          label="Text"
          onClick={() => setSmsModalOpen(true)}
          disabled={!hasPhone || !hasSmsConsent}
        />
        <ButtonWithTooltip
          type="email"
          icon={Mail}
          label="Email"
          onClick={() => setEmailModalOpen(true)}
          disabled={!hasEmail || !hasEmailConsent}
        />
      </div>

      {/* SMS Modal */}
      <Dialog open={smsModalOpen} onOpenChange={setSmsModalOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Send Text Message
              {simulationMode && <SimulationBadge />}
            </DialogTitle>
            <DialogDescription>
              Send SMS to {contact.name} at {contact.phone}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Type your message..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              rows={4}
            />
            <div className="text-sm text-muted-foreground">
              {messageContent.length} / 160 characters
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSendSms} disabled={loading === 'text'}>
              {loading === 'text' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-2" />
              )}
              {simulationMode ? 'Simulate Send' : 'Send SMS'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Modal */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Email
              {simulationMode && <SimulationBadge />}
            </DialogTitle>
            <DialogDescription>
              Send email to {contact.name} at {contact.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <input
              type="text"
              placeholder="Subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
            <Textarea
              placeholder="Email body..."
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={6}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={loading === 'email'}>
              {loading === 'email' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              {simulationMode ? 'Simulate Send' : 'Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CommunicationActions;
