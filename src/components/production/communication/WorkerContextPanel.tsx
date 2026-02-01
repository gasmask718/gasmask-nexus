/**
 * WORKER CONTEXT PANEL
 * 
 * Side panel that shows worker details when selected from communications.
 * Provides quick action buttons for Text, Call, WhatsApp.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Phone, 
  MessageSquare, 
  Clock, 
  X,
  Briefcase
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface WorkerContextPanelProps {
  worker: {
    id: string;
    full_name: string;
    role: string;
    phone?: string;
    whatsapp?: string;
    status: string;
  } | null;
  lastContactAt?: string | null;
  onClose: () => void;
  onAction: (channel: 'sms' | 'whatsapp' | 'call') => void;
}

export function WorkerContextPanel({ 
  worker, 
  lastContactAt, 
  onClose, 
  onAction 
}: WorkerContextPanelProps) {
  if (!worker) return null;

  const hasPhone = !!worker.phone;
  const hasWhatsApp = !!worker.whatsapp;

  return (
    <Card className="w-72 shrink-0 border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Worker Details</CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Worker Identity */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold">{worker.full_name}</p>
            <div className="flex items-center gap-2">
              <Badge variant={worker.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                {worker.status}
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Worker Details */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Briefcase className="h-4 w-4" />
            <span>Role: <span className="text-foreground capitalize">{worker.role}</span></span>
          </div>
          
          {worker.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{worker.phone}</span>
            </div>
          )}
          
          {worker.whatsapp && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span>WA: {worker.whatsapp}</span>
            </div>
          )}

          {lastContactAt && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last contact: {formatDistanceToNow(new Date(lastContactAt), { addSuffix: true })}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Quick Actions */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Quick Actions</p>
          <div className="grid grid-cols-3 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              disabled={!hasPhone}
              onClick={() => onAction('sms')}
              className="flex-col h-auto py-2"
            >
              <MessageSquare className="h-4 w-4 mb-1" />
              <span className="text-xs">Text</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              disabled={!hasPhone}
              onClick={() => onAction('call')}
              className="flex-col h-auto py-2"
            >
              <Phone className="h-4 w-4 mb-1" />
              <span className="text-xs">Call</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              disabled={!hasWhatsApp && !hasPhone}
              onClick={() => onAction('whatsapp')}
              className="flex-col h-auto py-2"
            >
              <MessageSquare className="h-4 w-4 mb-1" />
              <span className="text-xs">WhatsApp</span>
            </Button>
          </div>
        </div>

        {!hasPhone && !hasWhatsApp && (
          <p className="text-xs text-destructive text-center">
            No contact info on file
          </p>
        )}
      </CardContent>
    </Card>
  );
}
