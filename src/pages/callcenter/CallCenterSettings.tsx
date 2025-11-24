import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Settings, Clock, PhoneForwarded, Mail } from "lucide-react";
import CallCenterLayout from "./CallCenterLayout";

export default function CallCenterSettings() {
  const [businessHours, setBusinessHours] = useState({
    start: "09:00",
    end: "17:00",
    timezone: "America/New_York",
  });

  const [callbackSettings, setCallbackSettings] = useState({
    enabled: true,
    maxRetries: 3,
    retryInterval: 60,
  });

  const [voicemailSettings, setVoicemailSettings] = useState({
    enabled: true,
    greeting: "Thank you for calling. Please leave a message after the tone.",
    emailNotifications: true,
    transcription: true,
  });

  const [escalationRules, setEscalationRules] = useState({
    sentimentThreshold: 2.0,
    keywordDetection: true,
    autoEscalate: true,
    escalationEmail: "support@example.com",
  });

  const handleSaveSettings = () => {
    // In a real implementation, this would save to call_center_settings table
    toast.success("Settings saved successfully");
  };

  return (
    <CallCenterLayout title="Call Center Settings">
      <div className="space-y-6">
        {/* Business Hours */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Business Hours</CardTitle>
                <CardDescription>Configure operating hours for call routing</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={businessHours.start}
                  onChange={(e) => setBusinessHours({ ...businessHours, start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={businessHours.end}
                  onChange={(e) => setBusinessHours({ ...businessHours, end: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={businessHours.timezone} onValueChange={(val) => setBusinessHours({ ...businessHours, timezone: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Callback Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PhoneForwarded className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Callback Rules</CardTitle>
                <CardDescription>Automated callback handling for missed calls</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Automatic Callbacks</Label>
                <p className="text-sm text-muted-foreground">Automatically schedule callbacks for missed calls</p>
              </div>
              <Switch
                checked={callbackSettings.enabled}
                onCheckedChange={(checked) => setCallbackSettings({ ...callbackSettings, enabled: checked })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Max Retry Attempts</Label>
                <Input
                  type="number"
                  value={callbackSettings.maxRetries}
                  onChange={(e) => setCallbackSettings({ ...callbackSettings, maxRetries: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Retry Interval (minutes)</Label>
                <Input
                  type="number"
                  value={callbackSettings.retryInterval}
                  onChange={(e) => setCallbackSettings({ ...callbackSettings, retryInterval: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Voicemail Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Voicemail Handling</CardTitle>
                <CardDescription>Configure voicemail greetings and notifications</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Voicemail</Label>
                <p className="text-sm text-muted-foreground">Allow callers to leave voicemail messages</p>
              </div>
              <Switch
                checked={voicemailSettings.enabled}
                onCheckedChange={(checked) => setVoicemailSettings({ ...voicemailSettings, enabled: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Voicemail Greeting</Label>
              <Textarea
                value={voicemailSettings.greeting}
                onChange={(e) => setVoicemailSettings({ ...voicemailSettings, greeting: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Email Notifications</Label>
                <Switch
                  checked={voicemailSettings.emailNotifications}
                  onCheckedChange={(checked) => setVoicemailSettings({ ...voicemailSettings, emailNotifications: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto Transcription</Label>
                <Switch
                  checked={voicemailSettings.transcription}
                  onCheckedChange={(checked) => setVoicemailSettings({ ...voicemailSettings, transcription: checked })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Escalation Rules */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>AI Escalation Rules</CardTitle>
                <CardDescription>Configure when AI agents should escalate to human agents</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Sentiment Score Threshold</Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={escalationRules.sentimentThreshold}
                onChange={(e) => setEscalationRules({ ...escalationRules, sentimentThreshold: parseFloat(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">Escalate calls with sentiment below this score (1-5)</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Keyword Detection</Label>
                  <p className="text-sm text-muted-foreground">Escalate on keywords like "manager", "complaint"</p>
                </div>
                <Switch
                  checked={escalationRules.keywordDetection}
                  onCheckedChange={(checked) => setEscalationRules({ ...escalationRules, keywordDetection: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Escalate</Label>
                  <p className="text-sm text-muted-foreground">Automatically transfer without confirmation</p>
                </div>
                <Switch
                  checked={escalationRules.autoEscalate}
                  onCheckedChange={(checked) => setEscalationRules({ ...escalationRules, autoEscalate: checked })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Escalation Email</Label>
              <Input
                type="email"
                value={escalationRules.escalationEmail}
                onChange={(e) => setEscalationRules({ ...escalationRules, escalationEmail: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} size="lg">
            Save All Settings
          </Button>
        </div>
      </div>
    </CallCenterLayout>
  );
}
