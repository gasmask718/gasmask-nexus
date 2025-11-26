import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, MessageSquare, Phone, Users } from 'lucide-react';

interface CampaignMethodModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (method: 'sms' | 'email' | 'ai-call' | 'va-call') => void;
  brandColor?: string;
}

export default function CampaignMethodModal({ open, onClose, onSelect, brandColor = '#6366f1' }: CampaignMethodModalProps) {
  const methods = [
    {
      id: 'sms' as const,
      label: 'Send SMS Campaign',
      description: 'Blast text message with template',
      icon: MessageSquare,
    },
    {
      id: 'email' as const,
      label: 'Send Email Campaign',
      description: 'Email blast with template',
      icon: Mail,
    },
    {
      id: 'ai-call' as const,
      label: 'AI Call Campaign',
      description: 'AI will call and log results',
      icon: Phone,
    },
    {
      id: 'va-call' as const,
      label: 'VA Call Queue',
      description: 'Add to manual calling queue',
      icon: Users,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Communication Method</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <Button
                key={method.id}
                variant="outline"
                className="h-auto p-4 flex items-start gap-3 hover:border-primary"
                onClick={() => {
                  onSelect(method.id);
                  onClose();
                }}
              >
                <Icon className="w-5 h-5 mt-1" style={{ color: brandColor }} />
                <div className="flex-1 text-left">
                  <div className="font-medium">{method.label}</div>
                  <div className="text-xs text-muted-foreground">{method.description}</div>
                </div>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
