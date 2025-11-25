import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot } from 'lucide-react';

interface AIVoiceCallModuleProps {
  brand: string;
  brandColor?: string;
}

export default function AIVoiceCallModule({ brand, brandColor = '#6366f1' }: AIVoiceCallModuleProps) {
  return (
    <Card style={{ borderTop: `4px solid ${brandColor}` }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5" style={{ color: brandColor }} />
          AI Voice Campaigns - {brand}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center py-8">
          AI calling system: Bulk calls, voicemail drops, lead qualification, CRM sync
        </p>
      </CardContent>
    </Card>
  );
}
