import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Phone, Play, Upload, Sparkles, FileAudio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AIVoiceCallModuleProps {
  brand: {
    id: string;
    name: string;
    colors: { primary: string; secondary: string; accent: string };
    voicePersona: string;
  };
}

export default function AIVoiceCallModule({ brand }: AIVoiceCallModuleProps) {
  const [callScript, setCallScript] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [voicemailScript, setVoicemailScript] = useState('');
  const [askQuestions, setAskQuestions] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);

  const callOutcomes = [
    'No Answer',
    'Interested',
    'Call Back Later',
    'Not Interested',
    'Wrong Number',
    'Voicemail Left'
  ];

  const launchCampaign = async () => {
    if (!callScript.trim()) {
      toast.error('Please enter a call script');
      return;
    }

    try {
      const { error } = await supabase.from('call_center_dialer_campaigns').insert({
        business_name: brand.name,
        name: `${brand.name} AI Voice Campaign - ${new Date().toLocaleDateString()}`,
        call_script: callScript,
        voicemail_drop_url: voicemailScript,
        status: 'active',
        target_list: { segment: selectedSegment },
        retry_logic: {
          maxRetries: 3,
          retryInterval: '4 hours',
          outcomes: callOutcomes
        }
      });

      if (error) throw error;

      toast.success('AI voice campaign launched successfully');
      setCallScript('');
      setVoicemailScript('');
    } catch (error) {
      console.error('Launch error:', error);
      toast.error('Failed to launch AI campaign');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            AI Voice Call Campaign
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Voice Persona Info */}
          <div className="p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <div>
                <span className="font-medium">AI Voice Persona:</span>{' '}
                <span className="text-muted-foreground">{brand.voicePersona}</span>
              </div>
            </div>
          </div>

          {/* Target Selection */}
          <div className="space-y-2">
            <Label>Target Segment</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              value={selectedSegment}
              onChange={(e) => setSelectedSegment(e.target.value)}
            >
              <option value="all">All Contacts</option>
              <option value="leads">Leads</option>
              <option value="customers">Customers</option>
              <option value="inactive">Inactive (30+ days)</option>
              <option value="no-answer">Previous No Answer</option>
              <option value="callback">Callback Requested</option>
            </select>
          </div>

          {/* Call Script */}
          <div className="space-y-2">
            <Label>Call Script</Label>
            <Textarea
              placeholder={`Write the script AI will read when calling on behalf of ${brand.name}...`}
              value={callScript}
              onChange={(e) => setCallScript(e.target.value)}
              rows={8}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              AI will speak this script naturally using the {brand.voicePersona} tone
            </p>
          </div>

          {/* Voicemail Script */}
          <div className="space-y-2">
            <Label>Voicemail Message (Optional)</Label>
            <Textarea
              placeholder="Message to leave if no answer..."
              value={voicemailScript}
              onChange={(e) => setVoicemailScript(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Questions Configuration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ask Questions During Call</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAskQuestions(!askQuestions)}
              >
                {askQuestions ? 'Disable' : 'Enable'} Questions
              </Button>
            </div>
            {askQuestions && (
              <div className="space-y-2 p-3 rounded-lg border">
                <Input
                  placeholder="Enter question (e.g., 'When is a good time to call back?')"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value) {
                      setQuestions([...questions, e.currentTarget.value]);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {questions.map((q, i) => (
                    <Badge key={i} variant="secondary">
                      {q}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Expected Outcomes */}
          <div className="space-y-2">
            <Label>AI Will Track These Outcomes</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {callOutcomes.map((outcome) => (
                <Badge key={outcome} variant="outline" className="justify-center py-2">
                  {outcome}
                </Badge>
              ))}
            </div>
          </div>

          {/* CSV Upload Option */}
          <div className="space-y-2">
            <Label>Or Upload Contact List (CSV)</Label>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1">
                <Upload className="w-4 h-4 mr-2" />
                Upload CSV
              </Button>
              <Button variant="outline">
                <FileAudio className="w-4 h-4 mr-2" />
                Preview Voice
              </Button>
            </div>
          </div>

          {/* Launch Campaign */}
          <Button
            className="w-full"
            size="lg"
            onClick={launchCampaign}
            style={{ backgroundColor: brand.colors.primary }}
          >
            <Play className="w-5 h-5 mr-2" />
            Launch AI Voice Campaign
          </Button>

          {/* Info */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• AI will call contacts sequentially</p>
            <p>• Calls are recorded for compliance</p>
            <p>• AI logs all outcomes automatically</p>
            <p>• Retry logic handles no-answers</p>
            <p>• All transcripts saved to call logs</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
