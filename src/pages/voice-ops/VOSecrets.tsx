import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Shield, Eye, EyeOff, Save, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const SECRET_KEYS = [
  { key: 'DC_INBOUND_AGENT_ID', label: 'DC Inbound Agent ID' },
  { key: 'DC_SALES_AGENT_ID', label: 'DC Sales Agent ID' },
  { key: 'DC_FOLLOWUP_AGENT_ID', label: 'DC Follow-Up Agent ID' },
  { key: 'DC_REACTIVATION_AGENT_ID', label: 'DC Reactivation Agent ID' },
  { key: 'DC_PHONE_NUMBER', label: 'DC Phone Number' },
  { key: 'GASMASK_PHONE_NUMBER', label: 'GasMask Phone Number' },
  { key: 'ELEVENLABS_API_KEY', label: 'ElevenLabs API Key' },
];

export default function VOSecrets() {
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const toggle = (key: string) => setVisible((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      // In a real implementation, this would call the Supabase Management API
      // For now, we show a helpful message
      toast.info('Secret management requires the Lovable secrets tool. Use the chat to add/update secrets.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" /> Environment Secrets</h1>
        <p className="text-sm text-muted-foreground">View and manage edge function secrets for voice operations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edge Function Secrets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {SECRET_KEYS.map((s) => (
            <div key={s.key} className="space-y-1">
              <Label className="text-xs font-medium">{s.label}</Label>
              <div className="flex gap-2">
                <Input
                  type={visible[s.key] ? 'text' : 'password'}
                  placeholder={`Enter ${s.key}...`}
                  value={values[s.key] || ''}
                  onChange={(e) => setValues((p) => ({ ...p, [s.key]: e.target.value }))}
                  className="font-mono text-sm"
                />
                <Button variant="ghost" size="icon" onClick={() => toggle(s.key)}>
                  {visible[s.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{s.key}</p>
            </div>
          ))}

          <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Secrets
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
