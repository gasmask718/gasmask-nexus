import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Send, Calendar, Sparkles, AlertCircle, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BlastTextModuleProps {
  brand: string;
  brandColor?: string;
}

export default function BlastTextModule({ brand, brandColor = '#6366f1' }: BlastTextModuleProps) {
  const [message, setMessage] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [scheduleDate, setScheduleDate] = useState('');

  const dynamicFields = ['{name}', '{store}', '{date}', '{product}', '{amount}'];
  
  const insertField = (field: string) => {
    setMessage(prev => prev + ' ' + field);
  };

  const generateAIMessage = async () => {
    toast.success('AI message generated');
    setMessage(`Hi {name}! This is ${brand}. We have new products available. Reply YES to learn more.`);
  };

  const sendBlastText = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    toast.success('SMS blast initiated');
    setMessage('');
  };

  return (
    <Card style={{ borderTop: `4px solid ${brandColor}` }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" style={{ color: brandColor }} />
          Blast SMS - {brand}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Target Segment</label>
          <select className="w-full mt-1 p-2 border rounded-lg" value={selectedSegment} onChange={(e) => setSelectedSegment(e.target.value)}>
            <option value="all">All {brand} contacts</option>
            <option value="recent">Recent customers</option>
            <option value="inactive">Inactive 30+ days</option>
            <option value="vip">VIP tier only</option>
          </select>
        </div>
        <div>
          <Label>Message ({message.length}/160)</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Your message..." />
        </div>
        <div className="flex gap-3">
          <Button onClick={sendBlastText} style={{ backgroundColor: brandColor, color: 'white' }}>
            <Send className="w-4 h-4 mr-2" />
            Send Now
          </Button>
          <Button variant="outline">Schedule</Button>
          <Button variant="outline" onClick={generateAIMessage}>
            <Sparkles className="w-4 h-4 mr-2" />
            AI Generate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
