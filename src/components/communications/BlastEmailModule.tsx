import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Send, Calendar, Eye, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BlastEmailModuleProps {
  brand: string;
  brandColor?: string;
}

export default function BlastEmailModule({ brand, brandColor = '#6366f1' }: BlastEmailModuleProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [showPreview, setShowPreview] = useState(false);

  const dynamicFields = ['{name}', '{store}', '{email}', '{brand}', '{last_order}'];

  const insertField = (field: string) => {
    setMessage(prev => prev + ' ' + field);
  };

  const generateAIMessage = async () => {
    toast.success('AI email generated');
    setSubject(`New update from ${brand}`);
    setMessage(`Hi {name}!\n\nWe wanted to share some exciting news with you from ${brand}.\n\nBest regards,\nThe ${brand} Team`);
  };

  const sendEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('Please enter subject and message');
      return;
    }
    toast.success('Email campaign initiated');
    setSubject('');
    setMessage('');
  };

  const previewEmail = () => {
    setShowPreview(true);
  };

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
              className="w-full mt-1 p-2 border rounded-lg"
              value={selectedSegment}
              onChange={(e) => setSelectedSegment(e.target.value)}
            >
              <option value="all">All {brand} contacts</option>
              <option value="recent">Recent customers</option>
              <option value="inactive">Inactive 30+ days</option>
              <option value="vip">VIP tier only</option>
            </select>
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
              {dynamicFields.map(field => (
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
              style={{ backgroundColor: brandColor, color: 'white' }}
            >
              <Send className="w-4 h-4 mr-2" />
              Send Email Now
            </Button>
            <Button variant="outline" onClick={previewEmail}>
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button variant="outline">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule
            </Button>
            <Button variant="outline" onClick={generateAIMessage}>
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
              <Label className="font-bold">Subject:</Label>
              <p className="text-sm mt-1">{subject || '(No subject)'}</p>
            </div>
            <div>
              <Label className="font-bold">Message:</Label>
              <div className="text-sm mt-1 whitespace-pre-wrap border p-4 rounded-lg">
                {message || '(No message)'}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
