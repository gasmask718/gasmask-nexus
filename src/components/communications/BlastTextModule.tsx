import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Send, Calendar, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BlastTextModuleProps {
  brand: {
    id: string;
    name: string;
    colors: { primary: string; secondary: string; accent: string };
    voicePersona: string;
  };
}

export default function BlastTextModule({ brand }: BlastTextModuleProps) {
  const [message, setMessage] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [scheduleDate, setScheduleDate] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiQualityScore, setAiQualityScore] = useState<number | null>(null);

  const dynamicFields = ['{name}', '{store}', '{date}', '{product}', '{amount}'];
  
  const insertField = (field: string) => {
    setMessage(prev => prev + ' ' + field);
  };

  const generateAIMessage = async () => {
    setIsGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-message', {
        body: {
          brand: brand.name,
          persona: brand.voicePersona,
          segment: selectedSegment,
          type: 'sms'
        }
      });

      if (error) throw error;
      
      setMessage(data.message);
      setAiQualityScore(data.qualityScore);
      toast.success('AI message generated successfully');
    } catch (error) {
      console.error('AI generation error:', error);
      toast.error('Failed to generate AI message');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const sendBlastText = async (scheduled: boolean = false) => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      const { error } = await supabase.from('campaigns').insert({
        business_id: brand.id,
        name: `${brand.name} SMS Blast - ${new Date().toLocaleDateString()}`,
        channel: 'sms',
        message_template: message,
        status: scheduled ? 'scheduled' : 'active',
        scheduled_at: scheduled ? scheduleDate : null,
        settings: {
          segment: selectedSegment,
          dynamicFields: dynamicFields.filter(f => message.includes(f))
        }
      });

      if (error) throw error;

      toast.success(scheduled ? 'SMS campaign scheduled successfully' : 'SMS blast initiated');
      setMessage('');
      setScheduleDate('');
    } catch (error) {
      console.error('Send error:', error);
      toast.error('Failed to send SMS blast');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Compose SMS Blast</span>
            <Button
              variant="outline"
              size="sm"
              onClick={generateAIMessage}
              disabled={isGeneratingAI}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isGeneratingAI ? 'Generating...' : 'AI Generate'}
            </Button>
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
              <option value="ambassadors">Ambassadors</option>
              <option value="inactive">Inactive (30+ days)</option>
              <option value="high-value">High Value Customers</option>
              <option value="new">New Contacts</option>
            </select>
          </div>

          {/* Dynamic Fields */}
          <div className="space-y-2">
            <Label>Insert Dynamic Fields</Label>
            <div className="flex flex-wrap gap-2">
              {dynamicFields.map((field) => (
                <Badge
                  key={field}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => insertField(field)}
                >
                  {field}
                </Badge>
              ))}
            </div>
          </div>

          {/* Message Composer */}
          <div className="space-y-2">
            <Label>Message ({message.length}/160 characters)</Label>
            <Textarea
              placeholder={`Write your ${brand.name} SMS message here...`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          {/* AI Quality Score */}
          {aiQualityScore !== null && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <Sparkles className="w-5 h-5 text-primary" />
              <div>
                <span className="font-medium">AI Quality Score:</span>{' '}
                <span className={aiQualityScore >= 80 ? 'text-green-600' : aiQualityScore >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                  {aiQualityScore}/100
                </span>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="p-4 rounded-lg bg-muted border">
              <p className="text-sm whitespace-pre-wrap">
                {message || 'Your message preview will appear here...'}
              </p>
            </div>
          </div>

          {/* Schedule Option */}
          <div className="space-y-2">
            <Label>Schedule (Optional)</Label>
            <Input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
          </div>

          {/* Compliance Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Compliance:</strong> Ensure all recipients have opted in to receive SMS messages. Messages will be logged for compliance.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => sendBlastText(false)}
              style={{ backgroundColor: brand.colors.primary }}
            >
              <Send className="w-4 h-4 mr-2" />
              Send Now
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => sendBlastText(true)}
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
