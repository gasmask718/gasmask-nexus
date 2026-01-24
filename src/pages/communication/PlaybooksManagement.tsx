import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Mic, Sparkles, BarChart3 } from 'lucide-react';
import CommunicationLayout from './CommunicationLayout';
import { PlaybooksManager } from '@/components/communication/playbooks/PlaybooksManager';
import { StylesManager } from '@/components/communication/styles/StylesManager';
import { TechniqueReviewPanel } from '@/components/communication/techniques/TechniqueReviewPanel';
import { PlaybookAnalytics } from '@/components/communication/analytics/PlaybookAnalytics';

export default function PlaybooksManagement() {
  return (
    <CommunicationLayout
      title="Playbooks & Styles"
      subtitle="Govern what AI does and how it sounds — with human-in-the-loop control"
    >
      <Tabs defaultValue="playbooks" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="playbooks" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Playbooks
          </TabsTrigger>
          <TabsTrigger value="styles" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Styles
          </TabsTrigger>
          <TabsTrigger value="techniques" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Techniques
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="playbooks">
          <PlaybooksManager />
        </TabsContent>

        <TabsContent value="styles">
          <StylesManager />
        </TabsContent>

        <TabsContent value="techniques">
          <TechniqueReviewPanel />
        </TabsContent>

        <TabsContent value="analytics">
          <PlaybookAnalytics />
        </TabsContent>
      </Tabs>
    </CommunicationLayout>
  );
}
