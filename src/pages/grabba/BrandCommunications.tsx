import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Mail, Phone, Send, Users } from 'lucide-react';
import { useParams } from 'react-router-dom';

const brandColors = {
  gasmask: { primary: '#D30000', secondary: '#000000', name: 'GasMask' },
  hotmama: { primary: '#B76E79', secondary: '#000000', name: 'HotMama' },
  grabbarus: { primary: '#FFD400', secondary: '#245BFF', name: 'Grabba R Us' },
  hotscalati: { primary: '#5A3A2E', secondary: '#FF7A00', name: 'Hot Scalati' }
};

export default function BrandCommunications() {
  const { brand } = useParams();
  const brandConfig = brand ? brandColors[brand as keyof typeof brandColors] : null;

  if (!brandConfig) {
    return <div className="p-8 text-center">Brand not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: brandConfig.primary }}>
          {brandConfig.name} Communications
        </h1>
        <p className="text-muted-foreground mt-2">
          Brand-isolated messaging system - No cross-contamination
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card style={{ borderTop: `4px solid ${brandConfig.primary}` }}>
          <CardContent className="pt-6">
            <MessageSquare className="w-8 h-8 mb-2" style={{ color: brandConfig.primary }} />
            <div className="text-2xl font-bold">156</div>
            <div className="text-sm text-muted-foreground">SMS Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Mail className="w-8 h-8 mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">89</div>
            <div className="text-sm text-muted-foreground">Emails Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Phone className="w-8 h-8 mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">42</div>
            <div className="text-sm text-muted-foreground">Calls Made</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Users className="w-8 h-8 mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">73</div>
            <div className="text-sm text-muted-foreground">Active Contacts</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sms">
        <TabsList>
          <TabsTrigger value="sms">SMS Campaigns</TabsTrigger>
          <TabsTrigger value="email">Email Campaigns</TabsTrigger>
          <TabsTrigger value="calls">AI Calls</TabsTrigger>
          <TabsTrigger value="history">Message History</TabsTrigger>
        </TabsList>

        <TabsContent value="sms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Blast SMS - {brandConfig.name} Only</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Target Segment</label>
                  <select className="w-full mt-1 p-2 border rounded-lg">
                    <option>All {brandConfig.name} stores</option>
                    <option>VIP tier only</option>
                    <option>Inactive 30+ days</option>
                    <option>Gold tier</option>
                    <option>Recent orders</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Message</label>
                  <textarea 
                    className="w-full mt-1 p-3 border rounded-lg min-h-[120px]"
                    placeholder="Your message here..."
                  />
                </div>
                <div className="flex gap-3">
                  <Button style={{ backgroundColor: brandConfig.primary, color: 'white' }}>
                    <Send className="w-4 h-4 mr-2" />
                    Send Now
                  </Button>
                  <Button variant="outline">Schedule</Button>
                  <Button variant="outline">AI Generate</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent SMS Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3 rounded-lg border flex items-center justify-between">
                    <div>
                      <div className="font-medium">Reorder reminder</div>
                      <div className="text-sm text-muted-foreground">Sent to 45 stores • 92% delivered</div>
                    </div>
                    <div className="text-sm text-muted-foreground">2 days ago</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Campaign - {brandConfig.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Email campaign builder coming soon
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Voice Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                AI calling system integrated with {brandConfig.name} contacts
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Communication Log - {brandConfig.name} Only</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                All messages are brand-isolated. No cross-brand visibility.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
