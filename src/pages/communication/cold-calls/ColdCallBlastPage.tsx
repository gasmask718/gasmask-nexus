import { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Megaphone, Upload, Play, Rocket, Phone, PhoneForwarded, 
  Loader2, CheckCircle2, XCircle, Clock, PhoneCall, Volume2, 
  FileText, Users, ArrowRight, Pause
} from 'lucide-react';
import { useColdCallBlast, type CallItemStatus } from '@/hooks/useColdCallBlast';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<CallItemStatus, { label: string; color: string; icon: any }> = {
  queued: { label: 'Queued', color: 'bg-muted text-muted-foreground', icon: Clock },
  dialing: { label: 'Dialing', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', icon: Phone },
  answered: { label: 'Answered', color: 'bg-green-500/15 text-green-700 dark:text-green-400', icon: PhoneCall },
  transferred: { label: 'Transferred', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400', icon: PhoneForwarded },
  no_answer: { label: 'No Answer', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', icon: XCircle },
  failed: { label: 'Failed', color: 'bg-destructive/15 text-destructive', icon: XCircle },
  completed: { label: 'Completed', color: 'bg-green-500/15 text-green-700 dark:text-green-400', icon: CheckCircle2 },
  opted_out: { label: 'Opted Out', color: 'bg-muted text-muted-foreground', icon: Pause },
};

const VOICE_OPTIONS = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'Adam (Male, Deep)' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Female, Warm)' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Female, Soft)' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (Male, Calm)' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli (Female, Young)' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh (Male, Deep)' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (Male, Strong)' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Sam (Male, Raspy)' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam (Female, Raspy)' },
];

function parsePhoneNumbers(input: string): string[] {
  return input
    .split(/[\n,;]+/)
    .map(n => n.trim().replace(/[^\d+]/g, ''))
    .filter(n => n.length >= 10);
}

export default function ColdCallBlastPage() {
  const {
    campaigns,
    activeCampaign,
    callItems,
    isLaunching,
    isPreviewingTTS,
    previewAudioUrl,
    previewTTS,
    launchTTSBlast,
    launchNormalBlast,
    selectCampaign,
  } = useColdCallBlast();

  // TTS Tab state
  const [ttsNumbers, setTtsNumbers] = useState('');
  const [ttsScript, setTtsScript] = useState('');
  const [ttsHandoff, setTtsHandoff] = useState('');
  const [ttsVoice, setTtsVoice] = useState('JBFqnCBsd6RMkjVDRZzb');
  
  // Normal Tab state
  const [normalNumbers, setNormalNumbers] = useState('');
  const [normalHandoff, setNormalHandoff] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'tts' | 'normal'>('tts');

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'tts' | 'normal') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      // Extract phone numbers from CSV (first column or any column with phone-like data)
      const numbers = text
        .split('\n')
        .map(line => {
          const cols = line.split(',');
          // Find first column that looks like a phone number
          const phone = cols.find(c => /^\+?\d{10,15}$/.test(c.trim().replace(/[^\d+]/g, '')));
          return phone?.trim() || cols[0]?.trim() || '';
        })
        .filter(n => n && /\d{10,}/.test(n.replace(/\D/g, '')));
      
      const joined = numbers.join('\n');
      if (target === 'tts') setTtsNumbers(prev => prev ? prev + '\n' + joined : joined);
      else setNormalNumbers(prev => prev ? prev + '\n' + joined : joined);
      toast.success(`Imported ${numbers.length} phone numbers from CSV`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLaunchTTS = () => {
    const numbers = parsePhoneNumbers(ttsNumbers);
    if (numbers.length === 0) { toast.error('Enter at least one phone number'); return; }
    if (!ttsScript.trim()) { toast.error('Enter a TTS message script'); return; }
    if (!ttsHandoff.trim()) { toast.error('Enter a handoff number'); return; }
    launchTTSBlast({
      phoneNumbers: numbers,
      ttsScript: ttsScript.trim(),
      handoffNumber: ttsHandoff.trim(),
      voiceId: ttsVoice,
    });
  };

  const handleLaunchNormal = () => {
    const numbers = parsePhoneNumbers(normalNumbers);
    if (numbers.length === 0) { toast.error('Enter at least one phone number'); return; }
    if (!normalHandoff.trim()) { toast.error('Enter a destination number'); return; }
    launchNormalBlast({
      phoneNumbers: numbers,
      handoffNumber: normalHandoff.trim(),
    });
  };

  const ttsCount = parsePhoneNumbers(ttsNumbers).length;
  const normalCount = parsePhoneNumbers(normalNumbers).length;

  // Stats for active campaign
  const stats = {
    total: callItems.length,
    queued: callItems.filter(i => i.status === 'queued').length,
    dialing: callItems.filter(i => i.status === 'dialing').length,
    answered: callItems.filter(i => i.status === 'answered').length,
    transferred: callItems.filter(i => i.status === 'transferred').length,
    failed: callItems.filter(i => i.status === 'failed' || i.status === 'no_answer').length,
    completed: callItems.filter(i => i.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Megaphone className="h-7 w-7 text-primary" />
            Cold Call Blast
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Launch automated TTS or normal call blasts to multiple numbers
          </p>
        </div>
        {campaigns.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Setup Panel */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tts' | 'normal')}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="tts" className="gap-2">
                <Volume2 className="h-4 w-4" />
                TTS Blast
              </TabsTrigger>
              <TabsTrigger value="normal" className="gap-2">
                <Phone className="h-4 w-4" />
                Normal Calls
              </TabsTrigger>
            </TabsList>

            {/* TTS Blast Tab */}
            <TabsContent value="tts" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Phone Numbers</CardTitle>
                  <CardDescription>One number per line, or comma-separated. Upload CSV for bulk.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder={"+1234567890\n+1987654321\n+1555555555"}
                    value={ttsNumbers}
                    onChange={(e) => setTtsNumbers(e.target.value)}
                    rows={5}
                    className="font-mono text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".csv,.txt"
                        className="hidden"
                        onChange={(e) => handleCSVUpload(e, 'tts')}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload CSV
                      </Button>
                    </div>
                    <Badge variant="secondary">
                      <Users className="h-3 w-3 mr-1" />
                      {ttsCount} number{ttsCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">TTS Message Script</CardTitle>
                  <CardDescription>This message will be spoken by ElevenLabs AI voice to each recipient.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="Hello, this is a courtesy call from Dynasty. We have an exclusive offer for you today. If you're interested in learning more, please press 1 or say yes to speak with a representative."
                    value={ttsScript}
                    onChange={(e) => setTtsScript(e.target.value)}
                    rows={4}
                  />
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground mb-1 block">Voice</Label>
                      <Select value={ttsVoice} onValueChange={setTtsVoice}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VOICE_OPTIONS.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="pt-5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => ttsScript && previewTTS(ttsScript, ttsVoice)}
                        disabled={!ttsScript || isPreviewingTTS}
                        className="gap-2"
                      >
                        {isPreviewingTTS ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        Preview
                      </Button>
                    </div>
                  </div>
                  {previewAudioUrl && (
                    <audio controls src={previewAudioUrl} className="w-full mt-2" />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Handoff Number</CardTitle>
                  <CardDescription>When recipient shows interest (presses 1 or says "yes"), transfer them to this number.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <PhoneForwarded className="h-5 w-5 text-muted-foreground" />
                    <Input
                      placeholder="+1234567890"
                      value={ttsHandoff}
                      onChange={(e) => setTtsHandoff(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </CardContent>
              </Card>

              <Button
                size="lg"
                onClick={handleLaunchTTS}
                disabled={isLaunching || ttsCount === 0 || !ttsScript || !ttsHandoff}
                className="w-full gap-3 h-12 text-base"
              >
                {isLaunching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Rocket className="h-5 w-5" />
                )}
                Launch TTS Blast ({ttsCount} numbers)
              </Button>
            </TabsContent>

            {/* Normal Calls Tab */}
            <TabsContent value="normal" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Phone Numbers</CardTitle>
                  <CardDescription>Enter numbers to dial. Each will be connected to the destination number.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder={"+1234567890\n+1987654321"}
                    value={normalNumbers}
                    onChange={(e) => setNormalNumbers(e.target.value)}
                    rows={5}
                    className="font-mono text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        id="normal-csv"
                        onChange={(e) => handleCSVUpload(e, 'normal')}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('normal-csv')?.click()}
                        className="gap-2"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload CSV
                      </Button>
                    </div>
                    <Badge variant="secondary">
                      <Users className="h-3 w-3 mr-1" />
                      {normalCount} number{normalCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Destination Number</CardTitle>
                  <CardDescription>Each answered call will be bridged to this number.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <PhoneForwarded className="h-5 w-5 text-muted-foreground" />
                    <Input
                      placeholder="+1234567890"
                      value={normalHandoff}
                      onChange={(e) => setNormalHandoff(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </CardContent>
              </Card>

              <Button
                size="lg"
                onClick={handleLaunchNormal}
                disabled={isLaunching || normalCount === 0 || !normalHandoff}
                className="w-full gap-3 h-12 text-base"
              >
                {isLaunching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Phone className="h-5 w-5" />
                )}
                Launch Normal Blast ({normalCount} numbers)
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Campaign History & Live Status */}
        <div className="space-y-4">
          {/* Active Campaign Status */}
          {activeCampaign && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Live Campaign</CardTitle>
                  <Badge variant={activeCampaign.status === 'running' ? 'default' : 'secondary'}>
                    {activeCampaign.status}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {activeCampaign.campaign_type === 'tts_blast' ? 'TTS Blast' : 'Normal Blast'} • {new Date(activeCampaign.created_at).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold">{stats.total}</p>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-green-500/10">
                    <p className="text-lg font-bold text-green-600">{stats.transferred}</p>
                    <p className="text-[10px] text-muted-foreground">Transferred</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-blue-500/10">
                    <p className="text-lg font-bold text-blue-600">{stats.dialing}</p>
                    <p className="text-[10px] text-muted-foreground">Dialing</p>
                  </div>
                </div>

                {/* Call Items List */}
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1.5">
                    {callItems.map(item => {
                      const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.queued;
                      const Icon = cfg.icon;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-md border text-sm"
                        >
                          <span className="font-mono text-xs truncate flex-1">{item.phone_number}</span>
                          <Badge variant="outline" className={`text-[10px] gap-1 ${cfg.color}`}>
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </div>
                      );
                    })}
                    {callItems.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">No calls yet</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Campaign History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Campaign History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {campaigns.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectCampaign(c)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                        activeCampaign?.id === c.id ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]">
                          {c.campaign_type === 'tts_blast' ? 'TTS' : 'Normal'}
                        </Badge>
                        <Badge variant={c.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                          {c.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {c.total_numbers} numbers • {c.transferred_count} transferred
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleString()}
                      </p>
                    </button>
                  ))}
                  {campaigns.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No campaigns yet</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
