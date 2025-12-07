import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { User, Mic } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FounderVoiceToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export default function FounderVoiceToggle({ enabled, onChange }: FounderVoiceToggleProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-primary/20">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <Label className="flex items-center gap-2 font-semibold">
            Founder Voice Mode
            <Badge variant="secondary" className="text-xs">Premium</Badge>
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use your personal cloned voice for authentic outreach
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {enabled && <Mic className="w-4 h-4 text-primary animate-pulse" />}
        <Switch checked={enabled} onCheckedChange={onChange} />
      </div>
    </div>
  );
}
