import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Settings, Key, Globe, Clock, Mic } from 'lucide-react';
import { toast } from 'sonner';

export default function CommunicationSettings() {
  const [settings, setSettings] = useState({
    elevenLabsKey: '',
    twilioSid: '',
    twilioToken: '',
    defaultLanguage: 'en',
    defaultPersona: '',
    autoCallStartTime: '09:00',
    autoCallEndTime: '18:00',
    enableWeekends: false,
  });

  const handleSave = () => {
    toast.success('Settings saved successfully');
  };

  return (
    <div className="space-y-6">
      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            API Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>ElevenLabs API Key</Label>
            <Input
              type="password"
              value={settings.elevenLabsKey}
              onChange={(e) => setSettings({ ...settings, elevenLabsKey: e.target.value })}
              placeholder="sk-..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Required for AI voice synthesis
            </p>
          </div>
          <Separator />
          <div>
            <Label>Twilio Account SID</Label>
            <Input
              value={settings.twilioSid}
              onChange={(e) => setSettings({ ...settings, twilioSid: e.target.value })}
              placeholder="AC..."
            />
          </div>
          <div>
            <Label>Twilio Auth Token</Label>
            <Input
              type="password"
              value={settings.twilioToken}
              onChange={(e) => setSettings({ ...settings, twilioToken: e.target.value })}
              placeholder="Your auth token"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Required for SMS and voice calls
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Default Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Default Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Default Language
            </Label>
            <Select
              value={settings.defaultLanguage}
              onValueChange={(v) => setSettings({ ...settings, defaultLanguage: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Default Voice Persona
            </Label>
            <Select
              value={settings.defaultPersona}
              onValueChange={(v) => setSettings({ ...settings, defaultPersona: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select default persona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="founder">Founder Voice</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Call Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Auto-Call Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Time</Label>
              <Input
                type="time"
                value={settings.autoCallStartTime}
                onChange={(e) => setSettings({ ...settings, autoCallStartTime: e.target.value })}
              />
            </div>
            <div>
              <Label>End Time</Label>
              <Input
                type="time"
                value={settings.autoCallEndTime}
                onChange={(e) => setSettings({ ...settings, autoCallEndTime: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Weekend Calls</Label>
              <p className="text-xs text-muted-foreground">Allow auto-calls on Saturday and Sunday</p>
            </div>
            <Switch
              checked={settings.enableWeekends}
              onCheckedChange={(v) => setSettings({ ...settings, enableWeekends: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full">
        Save Settings
      </Button>
    </div>
  );
}
