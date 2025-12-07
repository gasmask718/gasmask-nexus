import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Bot, Phone, TestTube, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import VoiceProfileSelector from '@/components/communication/VoiceProfileSelector';
import ToneSelector from '@/components/communication/ToneSelector';
import FounderVoiceToggle from '@/components/communication/FounderVoiceToggle';
import VoicePreviewButton from '@/components/communication/VoicePreviewButton';

interface VoiceProfile {
  id: string;
  name: string;
  voice_type: 'personal' | 'brand' | 'neutral';
  voice_model_id: string | null;
  description: string | null;
  is_founder_voice: boolean;
  business_id: string | null;
}

interface AIVoiceCallModuleProps {
  brand: string;
  brandColor?: string;
  businessId?: string;
}

export default function AIVoiceCallModule({ brand, brandColor = '#6366f1', businessId }: AIVoiceCallModuleProps) {
  const [selectedScript, setSelectedScript] = useState('reorder');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [showCallLog, setShowCallLog] = useState(false);
  const [callTranscript, setCallTranscript] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile | null>(null);
  const [selectedTone, setSelectedTone] = useState('professional');
  const [founderVoiceEnabled, setFounderVoiceEnabled] = useState(false);

  const callScripts = [
    { id: 'reorder', name: 'Reorder Call', description: 'Follow up on product reorders' },
    { id: 'welcome', name: 'Welcome Call', description: 'New customer onboarding' },
    { id: 'followup', name: 'Follow-Up Call', description: 'Check-in with existing customers' },
    { id: 'promo', name: 'Promotional Call', description: 'Announce new products or deals' },
    { id: 'payment', name: 'Payment Reminder', description: 'Friendly payment reminder' },
  ];

  const startAICall = async (type: 'single' | 'test' | 'campaign') => {
    if (type === 'single') {
      try {
        const { logCommunication } = await import('@/services/communicationLogger');
        
        // Log AI call
        await logCommunication({
          channel: 'ai_call',
          direction: 'outbound',
          summary: `AI call - ${callScripts.find(s => s.id === selectedScript)?.name}`,
          message_content: `AI voice call with script: ${selectedScript}`,
          brand,
          performed_by: 'ai',
          delivery_status: 'initiated',
        });
        
        toast.success('Starting AI call to selected contact...');
      } catch (error) {
        console.error('Failed to log AI call:', error);
        toast.error('Failed to start AI call');
      }
    } else if (type === 'test') {
      const voiceName = founderVoiceEnabled ? 'Founder Voice' : (selectedVoice?.name || 'Default');
      toast.info('Running AI call simulation...');
      setTimeout(() => {
        setCallTranscript(`AI Call Test - ${brand}\n\nVoice Profile: ${voiceName}\nTone: ${selectedTone}\nScript: ${callScripts.find(s => s.id === selectedScript)?.name}\n\nSimulated conversation:\n- AI: Hello! This is a call from ${brand}...\n- Customer: [Response simulated]\n- AI: [Continues conversation based on script]\n\nOutcome: Successful simulation\nDuration: 2:34\nClassification: Interested`);
        setShowCallLog(true);
      }, 1500);
    } else {
      const voiceName = founderVoiceEnabled ? 'Founder Voice' : (selectedVoice?.name || 'Default');
      toast.success(`AI call campaign started for ${selectedSegment} segment using ${voiceName}`);
    }
  };

  return (
    <>
      <Card style={{ borderTop: `4px solid ${brandColor}` }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" style={{ color: brandColor }} />
            AI Voice Campaigns - {brand}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Founder Voice Toggle */}
          <FounderVoiceToggle 
            enabled={founderVoiceEnabled} 
            onChange={setFounderVoiceEnabled} 
          />

          {/* Voice Profile Selection */}
          {!founderVoiceEnabled && (
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <VoiceProfileSelector
                  value={selectedVoiceId}
                  onChange={(id, profile) => {
                    setSelectedVoiceId(id);
                    setSelectedVoice(profile);
                  }}
                  businessId={businessId}
                />
              </div>
              <VoicePreviewButton voiceModelId={selectedVoice?.voice_model_id} />
            </div>
          )}

          {/* Tone Selection */}
          <ToneSelector value={selectedTone} onChange={setSelectedTone} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Call Script Template</Label>
              <select
                className="w-full mt-1 p-2 border rounded-lg bg-background"
                value={selectedScript}
                onChange={(e) => setSelectedScript(e.target.value)}
              >
                {callScripts.map(script => (
                  <option key={script.id} value={script.id}>
                    {script.name} - {script.description}
                  </option>
                ))}
              </select>
            </div>

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
                <option value="no_answer">Previous no-answer</option>
                <option value="interested">Previously interested</option>
              </select>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <Label className="text-xs font-semibold">AI Call Features:</Label>
            <ul className="text-xs mt-2 space-y-1 text-muted-foreground">
              <li>✓ Natural voice conversation with your chosen profile</li>
              <li>✓ Automatic transcription & summary</li>
              <li>✓ Lead qualification & classification</li>
              <li>✓ CRM sync & outcome logging</li>
              <li>✓ Voicemail detection & drop</li>
              {founderVoiceEnabled && <li>✓ Founder Voice Mode active</li>}
            </ul>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() => startAICall('single')}
              style={{ backgroundColor: brandColor, color: 'white' }}
            >
              <Phone className="w-4 h-4 mr-2" />
              Start AI Call
            </Button>
            <Button variant="outline" onClick={() => startAICall('test')}>
              <TestTube className="w-4 h-4 mr-2" />
              Test AI Call
            </Button>
            <Button variant="outline" onClick={() => startAICall('campaign')}>
              <Users className="w-4 h-4 mr-2" />
              Start Campaign
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCallLog} onOpenChange={setShowCallLog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Call Log & Transcript</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <pre className="text-xs whitespace-pre-wrap font-mono">{callTranscript}</pre>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                Save to CRM
              </Button>
              <Button size="sm" variant="outline">
                Schedule Follow-Up
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
