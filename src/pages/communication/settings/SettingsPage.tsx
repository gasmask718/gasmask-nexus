import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Phone, UserCog, Clock, Moon, Shield } from 'lucide-react';
import CommSettingsPanel from "@/components/communication/CommSettingsPanel";

// Lazy-import the merged settings pages (they render as full components)
import DialerSettingsPage from '@/pages/communication/dialer/DialerSettingsPage';
import { UserCallSettingsPage } from '@/pages/communication/call-settings';
import { BusinessHoursPage } from '@/pages/communication/call-settings';
import { AfterHoursRoutingPage } from '@/pages/communication/call-settings';

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'general';
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="w-full min-h-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" /> Communication Settings
        </h2>
        <p className="text-muted-foreground">All system configuration in one place</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="general" className="gap-1.5 text-xs">
            <Settings className="h-3.5 w-3.5" /> General
          </TabsTrigger>
          <TabsTrigger value="dialer" className="gap-1.5 text-xs">
            <Phone className="h-3.5 w-3.5" /> Dialer
          </TabsTrigger>
          <TabsTrigger value="user" className="gap-1.5 text-xs">
            <UserCog className="h-3.5 w-3.5" /> User Call Settings
          </TabsTrigger>
          <TabsTrigger value="hours" className="gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" /> Business Hours
          </TabsTrigger>
          <TabsTrigger value="afterhours" className="gap-1.5 text-xs">
            <Moon className="h-3.5 w-3.5" /> After-Hours Routing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <CommSettingsPanel />
        </TabsContent>
        <TabsContent value="dialer" className="mt-4">
          <DialerSettingsPage />
        </TabsContent>
        <TabsContent value="user" className="mt-4">
          <UserCallSettingsPage />
        </TabsContent>
        <TabsContent value="hours" className="mt-4">
          <BusinessHoursPage />
        </TabsContent>
        <TabsContent value="afterhours" className="mt-4">
          <AfterHoursRoutingPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
