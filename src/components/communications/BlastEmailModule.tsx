import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Send, Calendar, Eye, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

interface BlastEmailModuleProps {
  brand: string;
  brandColor?: string;
}

export default function BlastEmailModule({ brand, brandColor = '#6366f1' }: BlastEmailModuleProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);

  const dynamicFields = ['{name}', '{store}', '{email}', '{brand}', '{last_order}'];

  const insertField = (field: string) => {
    setMessage((prev) => prev + ' ' + field);
  };

  const generateAIMessage = async () => {
    toast.success('AI email generated');
    setSubject(`New update from ${brand}`);
    setMessage(
      `Hi {name}!\n\nWe wanted to share some exciting news with you from ${brand}.\n\nBest regards,\nThe ${brand} Team`,
    );
  };

  const renderVars = (s: string) =>
    s.replace(/\{brand\}/g, brand).replace(/\{name\}/g, 'there');

  const sendEmail = async () => {
    const to = recipient.trim();
    if (!to) {
      toast.error('Enter a recipient email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast.error('Invalid recipient email');
      return;
    }
    if (!subject.trim() || !message.trim()) {
      toast.error('Please enter subject and message');
      return;
    }

    setSending(true);
    try {
      const renderedSubject = renderVars(subject);
      const renderedBody = renderVars(message);
      const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap;">${renderedBody.replace(/</g, '&lt;')}</div>`;

      const { data, error } = await supabase.functions.invoke('va-send-email', {
        body: {
          to,
          subject: renderedSubject,
          html,
          text: renderedBody,
          from_name: brand,
        },
      });

      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || 'Send failed');

      toast.success(`Email sent to ${to}`);

      // Best-effort log; ignore failures so UX isn't blocked
      try {
        const { logCommunication } = await import('@/services/communicationLogger');
        await logCommunication({
          channel: 'email',
          direction: 'outbound',
          summary: renderedSubject,
          message_content: renderedBody,
          brand,
          performed_by: 'va',
          delivery_status: 'sent',
        });
      } catch (_) {
        /* logging is non-fatal */
      }
    } catch (err: any) {
      console.error('[BlastEmailModule] send failed', err);
      toast.error(err?.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const previewEmail = () => setShowPreview(true);

  return (
    <>
      <Card style={{ borderTop: `4px solid ${brandColor}` }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" style={{ color: brandColor }} />
            Email Campaign - {brand}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Target Segment</Label>
            <select
              className="w-full mt-1 p-2 border rounded-lg bg-background"
              value={selectedSegment}
              onChange={(e) => setSelectedSegment(e.target.value)}
            >
              <option value="all">All {brand} contacts</option>
              <option value="recent">Recent customers</option>
              <option value="inactive">Inactive 30+ days</option>
              <option value="vip">VIP tier only</option>
              <option value="test">Test send (single recipient)</option>
            </select>
          </div>

          <div>
            <Label>Recipient Email</Label>
            <Input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="you@example.com"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Send a real email immediately to this address.
            </p>
          </div>

          <div>
            <Label>Subject Line</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
            />
          </div>

          <div>
            <Label>Message Body</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              placeholder="Compose your email..."
            />
          </div>

          <div>
            <Label className="text-xs">Insert Variables</Label>
            <div className="flex gap-2 flex-wrap mt-2">
              {dynamicFields.map((field) => (
                <Button
                  key={field}
                  variant="outline"
                  size="sm"
                  onClick={() => insertField(field)}
                >
                  {field}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={sendEmail}
              disabled={sending}
              style={{ backgroundColor: brandColor, color: 'white' }}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {sending ? 'Sending...' : 'Send Email Now'}
            </Button>
            <Button variant="outline" onClick={previewEmail} disabled={sending}>
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button variant="outline" disabled={sending}>
              <Calendar className="w-4 h-4 mr-2" />
              Schedule
            </Button>
            <Button variant="outline" onClick={generateAIMessage} disabled={sending}>
              <Sparkles className="w-4 h-4 mr-2" />
              AI Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-bold">From:</Label>
              <p className="text-sm mt-1">{brand} &lt;via VA Notifications&gt;</p>
            </div>
            <div>
              <Label className="font-bold">To:</Label>
              <p className="text-sm mt-1">{recipient || '(no recipient)'}</p>
            </div>
            <div>
              <Label className="font-bold">Subject:</Label>
              <p className="text-sm mt-1">{renderVars(subject) || '(No subject)'}</p>
            </div>
            <div>
              <Label className="font-bold">Message:</Label>
              <div className="text-sm mt-1 whitespace-pre-wrap border p-4 rounded-lg">
                {renderVars(message) || '(No message)'}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
