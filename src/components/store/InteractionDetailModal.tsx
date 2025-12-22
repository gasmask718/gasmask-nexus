import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Phone, MessageSquare, Mail, Users, ArrowUpRight, ArrowDownLeft, Clock, User, Target, MessageCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Interaction {
  id: string;
  channel: string;
  direction: string;
  subject: string;
  summary: string | null;
  outcome: string | null;
  sentiment: string | null;
  next_action: string | null;
  follow_up_at: string | null;
  created_at: string;
  contact?: {
    id: string;
    name: string;
  } | null;
}

interface InteractionDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interaction: Interaction | null;
}

const CHANNEL_ICONS: Record<string, typeof Phone> = {
  CALL: Phone,
  SMS: MessageSquare,
  WHATSAPP: MessageSquare,
  IN_PERSON: Users,
  EMAIL: Mail,
  OTHER: MessageSquare,
};

const CHANNEL_LABELS: Record<string, string> = {
  CALL: 'Phone Call',
  SMS: 'Text Message',
  WHATSAPP: 'WhatsApp',
  IN_PERSON: 'In Person',
  EMAIL: 'Email',
  OTHER: 'Other',
};

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: 'bg-green-500/10 text-green-600 border-green-500/30',
  NEUTRAL: 'bg-gray-500/10 text-gray-600 border-gray-500/30',
  NEGATIVE: 'bg-red-500/10 text-red-600 border-red-500/30',
};

const OUTCOME_COLORS: Record<string, string> = {
  SUCCESSFUL: 'bg-green-500/10 text-green-600 border-green-500/30',
  NEEDS_FOLLOW_UP: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  NO_ANSWER: 'bg-gray-500/10 text-gray-600 border-gray-500/30',
  LEFT_VOICEMAIL: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  CALLBACK_REQUESTED: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  NOT_INTERESTED: 'bg-red-500/10 text-red-600 border-red-500/30',
};

export function InteractionDetailModal({ open, onOpenChange, interaction }: InteractionDetailModalProps) {
  if (!interaction) return null;

  const ChannelIcon = CHANNEL_ICONS[interaction.channel] || MessageSquare;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ChannelIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>{interaction.subject}</span>
              <p className="text-sm font-normal text-muted-foreground">
                {CHANNEL_LABELS[interaction.channel] || interaction.channel}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Meta Info */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              {interaction.direction === 'OUTBOUND' ? (
                <><ArrowUpRight className="h-3 w-3" /> Outbound</>
              ) : (
                <><ArrowDownLeft className="h-3 w-3" /> Inbound</>
              )}
            </Badge>
            {interaction.outcome && (
              <Badge className={OUTCOME_COLORS[interaction.outcome] || 'bg-muted'}>
                {interaction.outcome.replace(/_/g, ' ')}
              </Badge>
            )}
            {interaction.sentiment && (
              <Badge className={SENTIMENT_COLORS[interaction.sentiment] || 'bg-muted'}>
                {interaction.sentiment}
              </Badge>
            )}
          </div>

          <Separator />

          {/* Contact & Time */}
          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{format(new Date(interaction.created_at), 'EEEE, MMMM d, yyyy at h:mm a')}</span>
            </div>
            {interaction.contact?.name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Contact: <span className="text-foreground font-medium">{interaction.contact.name}</span></span>
              </div>
            )}
          </div>

          {/* Summary */}
          {interaction.summary && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  Summary
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-lg">
                  {interaction.summary}
                </p>
              </div>
            </>
          )}

          {/* Next Action */}
          {interaction.next_action && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Target className="h-4 w-4 text-primary" />
                  Next Action
                </div>
                <p className="text-sm bg-primary/5 p-3 rounded-lg border border-primary/20">
                  {interaction.next_action}
                </p>
              </div>
            </>
          )}

          {/* Follow-up Date */}
          {interaction.follow_up_at && (
            <>
              <Separator />
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-amber-500" />
                <span className="text-muted-foreground">Follow-up scheduled:</span>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                  {format(new Date(interaction.follow_up_at), 'MMM d, yyyy h:mm a')}
                </Badge>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}