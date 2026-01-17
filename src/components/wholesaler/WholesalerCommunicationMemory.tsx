import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MessageSquare, Phone, Mail, MapPin, Video, 
  Plus, Clock, ArrowUpRight, ArrowDownLeft,
  ThumbsUp, Minus, ThumbsDown, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import type { WholesalerCommunication } from '@/hooks/useWholesalerIntelligence';

interface WholesalerCommunicationMemoryProps {
  communications: WholesalerCommunication[];
  onAddCommunication: (data: Partial<WholesalerCommunication>) => Promise<void>;
}

export function WholesalerCommunicationMemory({ 
  communications, 
  onAddCommunication 
}: WholesalerCommunicationMemoryProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    communication_type: 'call',
    direction: 'outbound',
    subject: '',
    summary: '',
    sentiment: 'neutral',
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onAddCommunication({
        ...formData,
        communicated_at: new Date().toISOString(),
      });
      setAddOpen(false);
      setFormData({
        communication_type: 'call',
        direction: 'outbound',
        subject: '',
        summary: '',
        sentiment: 'neutral',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'call': return Phone;
      case 'email': return Mail;
      case 'visit': return MapPin;
      case 'meeting': return Video;
      default: return MessageSquare;
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return { icon: ThumbsUp, color: 'text-green-400' };
      case 'negative': return { icon: ThumbsDown, color: 'text-red-400' };
      case 'escalated': return { icon: AlertCircle, color: 'text-orange-400' };
      default: return { icon: Minus, color: 'text-muted-foreground' };
    }
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'inbound' 
      ? <ArrowDownLeft className="h-3 w-3 text-green-400" />
      : <ArrowUpRight className="h-3 w-3 text-blue-400" />;
  };

  // Stats
  const totalComms = communications.length;
  const positiveComms = communications.filter(c => c.sentiment === 'positive').length;
  const negativeComms = communications.filter(c => c.sentiment === 'negative' || c.sentiment === 'escalated').length;

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            Communication & Relationship Memory
          </CardTitle>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Log
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log Communication</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Type</label>
                    <Select 
                      value={formData.communication_type}
                      onValueChange={(v) => setFormData(p => ({ ...p, communication_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="visit">Visit</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Direction</label>
                    <Select 
                      value={formData.direction}
                      onValueChange={(v) => setFormData(p => ({ ...p, direction: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="outbound">Outbound</SelectItem>
                        <SelectItem value="inbound">Inbound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Subject</label>
                  <Input 
                    value={formData.subject}
                    onChange={(e) => setFormData(p => ({ ...p, subject: e.target.value }))}
                    placeholder="Brief subject..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Summary</label>
                  <Textarea 
                    value={formData.summary}
                    onChange={(e) => setFormData(p => ({ ...p, summary: e.target.value }))}
                    placeholder="Key points discussed..."
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Sentiment</label>
                  <Select 
                    value={formData.sentiment}
                    onValueChange={(v) => setFormData(p => ({ ...p, sentiment: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="positive">Positive</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="negative">Negative</SelectItem>
                      <SelectItem value="escalated">Escalated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Log Communication'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <MessageSquare className="h-5 w-5 mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold">{totalComms}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <ThumbsUp className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold">{positiveComms}</p>
            <p className="text-xs text-muted-foreground">Positive</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <AlertCircle className="h-5 w-5 mx-auto text-red-500 mb-1" />
            <p className="text-2xl font-bold">{negativeComms}</p>
            <p className="text-xs text-muted-foreground">Escalated</p>
          </div>
        </div>

        {/* Communication Timeline */}
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {communications.map((comm) => {
              const TypeIcon = getTypeIcon(comm.communication_type);
              const sentiment = getSentimentIcon(comm.sentiment);
              const SentimentIcon = sentiment.icon;

              return (
                <div 
                  key={comm.id}
                  className="relative pl-6 pb-4 border-l border-border/50 last:border-0 last:pb-0"
                >
                  <div className="absolute left-0 top-0 -translate-x-1/2 h-3 w-3 rounded-full bg-background border-2 border-primary" />
                  
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        {getDirectionIcon(comm.direction)}
                        <span className="text-sm font-medium capitalize">{comm.communication_type}</span>
                        <SentimentIcon className={`h-4 w-4 ${sentiment.color}`} />
                      </div>
                      {comm.subject && (
                        <p className="text-sm font-medium">{comm.subject}</p>
                      )}
                      {comm.summary && (
                        <p className="text-sm text-muted-foreground mt-1">{comm.summary}</p>
                      )}
                      {comm.promises_made && comm.promises_made.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground">Promises:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {comm.promises_made.map((promise: any, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {typeof promise === 'string' ? promise : promise.text}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(comm.communicated_at), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(comm.communicated_at), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            {communications.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No communication history</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Log First Interaction
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
