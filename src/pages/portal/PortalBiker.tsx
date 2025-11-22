import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Camera, Package, MessageSquare, DollarSign, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function PortalBiker() {
  const [profile, setProfile] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchBikerData();
  }, []);

  async function fetchBikerData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(profileData);

      // Fetch today's assignments
      setAssignments([]);
    } catch (error) {
      console.error('Error fetching biker data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load biker data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{profile?.name || 'Biker Portal'}</h1>
              <p className="text-muted-foreground">GasMask Street Team</p>
            </div>
            <Badge variant="default">Active</Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <MapPin className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Today's Stops</p>
                    <p className="text-2xl font-bold">{assignments.length}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <Camera className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Photos Uploaded</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <DollarSign className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Earnings (Week)</p>
                    <p className="text-2xl font-bold">$0</p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Today's Assignments</h3>
              {assignments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No assignments for today</p>
              ) : (
                <div className="space-y-2">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{assignment.task_type}</p>
                        <p className="text-sm text-muted-foreground">{assignment.description}</p>
                      </div>
                      <Badge>{assignment.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="assignments">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">All Assignments</h3>
              <p className="text-muted-foreground">View your store visit assignments</p>
            </Card>
          </TabsContent>

          <TabsContent value="photos">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Upload Photos</h3>
              <Button>
                <Camera className="mr-2 h-4 w-4" />
                Upload Store Photo
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Messages</h3>
              <p className="text-muted-foreground">Chat with dispatch</p>
            </Card>
          </TabsContent>

          <TabsContent value="earnings">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Earnings</h3>
              <p className="text-muted-foreground">Track your payouts</p>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Performance Score</h3>
              <div className="flex items-center gap-4">
                <Award className="h-12 w-12 text-yellow-500" />
                <div>
                  <p className="text-4xl font-bold">0</p>
                  <p className="text-muted-foreground">Total XP</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
