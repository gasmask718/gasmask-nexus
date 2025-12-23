import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CRMCategoryConfig } from '@/config/crmCategories';
import { 
  MessageSquare, 
  FileText, 
  Clock, 
  Bell, 
  Image, 
  Mic,
  Plus,
  User
} from 'lucide-react';

interface SharedCRMComponentsProps {
  config: CRMCategoryConfig;
  selectedEntityId?: string | null;
}

export function SharedCRMComponents({
  config,
  selectedEntityId,
}: SharedCRMComponentsProps) {
  const { sharedComponents } = config;
  
  // Build available tabs based on config
  const tabs = [
    { key: 'contacts', label: 'Contacts', icon: User, enabled: sharedComponents.contacts },
    { key: 'notes', label: 'Notes', icon: FileText, enabled: sharedComponents.notes },
    { key: 'timeline', label: 'Timeline', icon: Clock, enabled: sharedComponents.timeline },
    { key: 'followups', label: 'Follow-ups', icon: Bell, enabled: sharedComponents.followUps },
    { key: 'media', label: 'Media', icon: Image, enabled: sharedComponents.media },
    { key: 'voice', label: 'Voice Notes', icon: Mic, enabled: sharedComponents.voiceNotes },
  ].filter(tab => tab.enabled);

  if (tabs.length === 0) return null;

  // Mock timeline data
  const timelineItems = [
    { id: '1', type: 'call', description: 'Phone call with contact', time: '2 hours ago' },
    { id: '2', type: 'note', description: 'Added a new note', time: '1 day ago' },
    { id: '3', type: 'email', description: 'Email sent', time: '3 days ago' },
  ];

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Activity & Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={tabs[0]?.key} className="w-full">
          <TabsList className="w-full justify-start">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1.5">
                <tab.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Contacts Tab */}
          <TabsContent value="contacts">
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">Associated contacts</p>
                <Button size="sm" variant="outline">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Contact
                </Button>
              </div>
              {selectedEntityId ? (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    <div className="p-3 border rounded-lg flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">John Doe</p>
                        <p className="text-sm text-muted-foreground">Owner • (555) 123-4567</p>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select an entity to view contacts
                </p>
              )}
            </div>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes">
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">Notes & Comments</p>
                <Button size="sm" variant="outline">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Note
                </Button>
              </div>
              {selectedEntityId ? (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    <div className="p-3 border rounded-lg">
                      <p className="text-sm">Sample note content goes here...</p>
                      <p className="text-xs text-muted-foreground mt-2">Added 2 days ago</p>
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select an entity to view notes
                </p>
              )}
            </div>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <div className="pt-4">
              <ScrollArea className="h-[200px]">
                {selectedEntityId ? (
                  <div className="space-y-3">
                    {timelineItems.map((item) => (
                      <div key={item.id} className="flex items-start gap-3">
                        <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                        <div className="flex-1">
                          <p className="text-sm">{item.description}</p>
                          <p className="text-xs text-muted-foreground">{item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Select an entity to view timeline
                  </p>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Follow-ups Tab */}
          <TabsContent value="followups">
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">Scheduled follow-ups</p>
                <Button size="sm" variant="outline">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Schedule
                </Button>
              </div>
              {selectedEntityId ? (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    <div className="p-3 border rounded-lg flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Follow-up call</p>
                        <p className="text-xs text-muted-foreground">Tomorrow at 10:00 AM</p>
                      </div>
                      <Badge>Pending</Badge>
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select an entity to view follow-ups
                </p>
              )}
            </div>
          </TabsContent>

          {/* Media Tab */}
          <TabsContent value="media">
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">Photos & Files</p>
                <Button size="sm" variant="outline">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Upload
                </Button>
              </div>
              {selectedEntityId ? (
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                      <Image className="h-6 w-6 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select an entity to view media
                </p>
              )}
            </div>
          </TabsContent>

          {/* Voice Notes Tab */}
          <TabsContent value="voice">
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">Voice recordings</p>
                <Button size="sm" variant="outline">
                  <Mic className="h-3.5 w-3.5 mr-1" />
                  Record
                </Button>
              </div>
              {selectedEntityId ? (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    <div className="p-3 border rounded-lg flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Mic className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Voice Note</p>
                        <p className="text-xs text-muted-foreground">1:24 • 2 days ago</p>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select an entity to view voice notes
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
