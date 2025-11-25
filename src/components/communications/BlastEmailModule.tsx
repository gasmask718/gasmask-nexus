import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Mail, Sparkles, Send, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BlastEmailModuleProps {
  brand: {
    id: string;
    name: string;
    colors: { primary: string; secondary: string; accent: string };
    voicePersona: string;
  };
}

export default function BlastEmailModule({ brand }: BlastEmailModuleProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [emailType, setEmailType] = useState<'marketing' | 'transactional'>('marketing');
  const [scheduleDate, setScheduleDate] = useState('');

  const variables = ['{first_name}', '{company}', '{product}', '{discount}', '{link}'];

  const insertVariable = (variable: string) => {
    setBody(prev => prev + ' ' + variable);
  };

  const sendEmail = async (scheduled: boolean = false) => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Please enter subject and message');
      return;
    }

    try {
      const { error } = await supabase.from('campaigns').insert({
        business_id: brand.id,
        name: `${brand.name} Email - ${subject}`,
        channel: 'email',
        subject: subject,
        message_template: body,
        status: scheduled ? 'scheduled' : 'active',
        scheduled_at: scheduled ? scheduleDate : null,
        settings: {
          segment: selectedSegment,
          type: emailType,
          variables: variables.filter(v => body.includes(v))
        }
      });

      if (error) throw error;

      toast.success(scheduled ? 'Email campaign scheduled' : 'Email blast initiated');
      setSubject('');
      setBody('');
    } catch (error) {
      console.error('Send error:', error);
      toast.error('Failed to send email blast');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Compose Email Campaign</span>
            <div className="flex gap-2">
              <Badge variant={emailType === 'marketing' ? 'default' : 'outline'} 
                className="cursor-pointer"
                onClick={() => setEmailType('marketing')}>
                Marketing
              </Badge>
              <Badge variant={emailType === 'transactional' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setEmailType('transactional')}>
                Transactional
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Segment Selection */}
          <div className="space-y-2">
            <Label>Target Segment</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              value={selectedSegment}
              onChange={(e) => setSelectedSegment(e.target.value)}
            >
              <option value="all">All Contacts</option>
              <option value="customers">Customers</option>
              <option value="stores">Stores</option>
              <option value="subscribed">Email Subscribers</option>
              <option value="inactive">Inactive (60+ days)</option>
              <option value="vip">VIP Customers</option>
            </select>
          </div>

          {/* Subject Line */}
          <div className="space-y-2">
            <Label>Subject Line</Label>
            <Input
              placeholder="Enter email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Variables */}
          <div className="space-y-2">
            <Label>Insert Variables</Label>
            <div className="flex flex-wrap gap-2">
              {variables.map((variable) => (
                <Badge
                  key={variable}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => insertVariable(variable)}
                >
                  {variable}
                </Badge>
              ))}
            </div>
          </div>

          {/* Email Body */}
          <div className="space-y-2">
            <Label>Email Body</Label>
            <Textarea
              placeholder={`Compose your ${brand.name} email message...`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="resize-none font-mono text-sm"
            />
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="p-4 rounded-lg border bg-background">
              <div className="font-bold mb-2">{subject || 'Subject line...'}</div>
              <div className="text-sm whitespace-pre-wrap">
                {body || 'Email body will appear here...'}
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <Label>Schedule (Optional)</Label>
            <Input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => sendEmail(false)}
              style={{ backgroundColor: brand.colors.primary }}
            >
              <Send className="w-4 h-4 mr-2" />
              Send Now
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => sendEmail(true)}
              disabled={!scheduleDate}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedule
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
