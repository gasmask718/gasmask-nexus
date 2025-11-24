import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import CommunicationLayout from './CommunicationLayout';

const CommunicationSettings = () => {
  return (
    <CommunicationLayout
      title="Communication Settings"
      subtitle="Configure system preferences and automation rules"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Settings interface coming soon. Contact support to configure:
            </p>
            <ul className="list-disc list-inside mt-4 space-y-2 text-sm text-muted-foreground">
              <li>Business hours and timezone</li>
              <li>Voicemail handling preferences</li>
              <li>Missed call recovery automation</li>
              <li>Escalation keywords and rules</li>
              <li>Call recording settings</li>
              <li>AI behavior tuning</li>
              <li>CRM synchronization options</li>
              <li>Notification preferences</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </CommunicationLayout>
  );
};

export default CommunicationSettings;
