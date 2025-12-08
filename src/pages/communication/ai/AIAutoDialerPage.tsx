import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Phone, Play, Pause, Square, Users, CheckCircle, Voicemail, XCircle, 
  RefreshCw, Headphones, Volume2, Clock, Zap, Target, BarChart3
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  segment: string;
  status: "running" | "paused" | "completed" | "scheduled";
  successRate: number;
  startedAt: string;
  total: number;
  completed: number;
}

const mockCampaigns: Campaign[] = [
  { id: "1", name: "Dead Stores Revival", segment: "Dead Stores", status: "running", successRate: 68, startedAt: "2024-01-15 09:00", total: 250, completed: 180 },
  { id: "2", name: "New Store Onboarding", segment: "New Stores", status: "completed", successRate: 82, startedAt: "2024-01-14 10:30", total: 45, completed: 45 },
  { id: "3", name: "High Value Check-in", segment: "High Value", status: "paused", successRate: 55, startedAt: "2024-01-15 14:00", total: 100, completed: 32 },
];

const mockActiveCalls = [
  { id: "1", storeName: "Mike's Corner Store", phone: "+1 555-0123", duration: "2:34", persona: "Sales Pro", sentiment: "positive" },
  { id: "2", storeName: "Quick Mart #42", phone: "+1 555-0456", duration: "1:12", persona: "Friendly Helper", sentiment: "neutral" },
  { id: "3", storeName: "Downtown Liquor", phone: "+1 555-0789", duration: "0:45", persona: "Sales Pro", sentiment: "positive" },
];

export default function AIAutoDialerPage() {
  const [campaignName, setCampaignName] = useState("");
  const [selectedPersona, setSelectedPersona] = useState("");
  const [selectedFlow, setSelectedFlow] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [throttle, setThrottle] = useState("5");
  const [isRunning, setIsRunning] = useState(false);

  const stats = {
    total: 250,
    completed: 180,
    answered: 145,
    voicemail: 28,
    failed: 7,
    retrying: 12,
  };

  const progress = (stats.completed / stats.total) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" />
            AI Auto Dialer
          </h1>
          <p className="text-muted-foreground">Automated bulk calling campaigns with AI voice agents</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            3 Active Calls
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="create" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="create">Create Campaign</TabsTrigger>
          <TabsTrigger value="live">Live Monitor</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Create Campaign Tab */}
        <TabsContent value="create" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Campaign Creator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Campaign Creator
                </CardTitle>
                <CardDescription>Configure your automated calling campaign</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input
                    placeholder="e.g., Q1 Store Revival"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Voice Persona</Label>
                  <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select AI persona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales-pro">Sales Pro - Confident & Persuasive</SelectItem>
                      <SelectItem value="friendly-helper">Friendly Helper - Warm & Casual</SelectItem>
                      <SelectItem value="professional">Professional - Formal & Direct</SelectItem>
                      <SelectItem value="empathetic">Empathetic Listener - Understanding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Call Flow</Label>
                  <Select value={selectedFlow} onValueChange={setSelectedFlow}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select call flow" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reactivation">Store Reactivation Flow</SelectItem>
                      <SelectItem value="new-product">New Product Introduction</SelectItem>
                      <SelectItem value="check-in">General Check-in</SelectItem>
                      <SelectItem value="payment-reminder">Payment Reminder</SelectItem>
                      <SelectItem value="feedback">Feedback Collection</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Segment</Label>
                  <Select value={selectedSegment} onValueChange={setSelectedSegment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target stores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stores</SelectItem>
                      <SelectItem value="new">New Stores (Last 30 days)</SelectItem>
                      <SelectItem value="dead">Dead Stores (No orders 60+ days)</SelectItem>
                      <SelectItem value="high-value">High Value Stores</SelectItem>
                      <SelectItem value="unresponsive">Unresponsive Stores</SelectItem>
                      <SelectItem value="custom">Custom List Import</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Simultaneous Calls</Label>
                  <Select value={throttle} onValueChange={setThrottle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 call at a time</SelectItem>
                      <SelectItem value="5">5 simultaneous calls</SelectItem>
                      <SelectItem value="10">10 simultaneous calls</SelectItem>
                      <SelectItem value="20">20 simultaneous calls</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4 flex gap-2">
                  <Button className="flex-1 gap-2" disabled={!campaignName || !selectedPersona || !selectedFlow || !selectedSegment}>
                    <Play className="h-4 w-4" />
                    Start Campaign
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Clock className="h-4 w-4" />
                    Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Campaign Controls & Stats */}
            <div className="space-y-6">
              {/* Control Panel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Campaign Control
                  </CardTitle>
                  <CardDescription>Manage running campaign</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Dead Stores Revival</span>
                    <Badge variant="default" className="gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                      Running
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{stats.completed} / {stats.total}</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1">
                      <Pause className="h-4 w-4" />
                      Pause
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 gap-1">
                      <Play className="h-4 w-4" />
                      Resume
                    </Button>
                    <Button variant="destructive" size="sm" className="flex-1 gap-1">
                      <Square className="h-4 w-4" />
                      Stop
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Live Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Live Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{stats.total}</p>
                        <p className="text-xs text-muted-foreground">Total Targets</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold text-green-600">{stats.answered}</p>
                        <p className="text-xs text-muted-foreground">Answered</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10">
                      <Voicemail className="h-5 w-5 text-yellow-500" />
                      <div>
                        <p className="text-2xl font-bold text-yellow-600">{stats.voicemail}</p>
                        <p className="text-xs text-muted-foreground">Voicemail</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10">
                      <XCircle className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                        <p className="text-xs text-muted-foreground">Failed</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 col-span-2">
                      <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{stats.retrying}</p>
                        <p className="text-xs text-muted-foreground">Retrying</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Live Monitor Tab */}
        <TabsContent value="live" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Headphones className="h-5 w-5 text-primary" />
                Active Calls ({mockActiveCalls.length})
              </CardTitle>
              <CardDescription>Monitor and manage live AI calls in real-time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mockActiveCalls.map((call) => (
                  <Card key={call.id} className="border-2 border-green-500/30 bg-green-500/5">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold truncate">{call.storeName}</span>
                        <Badge variant="outline" className="gap-1 text-green-600">
                          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          Live
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{call.phone}</div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {call.duration}
                        </span>
                        <Badge variant="secondary">{call.persona}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 gap-1">
                          <Volume2 className="h-3 w-3" />
                          Listen
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 gap-1">
                          <Headphones className="h-3 w-3" />
                          Whisper
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {mockActiveCalls.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active calls at the moment</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign History</CardTitle>
              <CardDescription>View past and ongoing campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Segment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockCampaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>{campaign.segment}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              campaign.status === "running" ? "default" :
                              campaign.status === "completed" ? "secondary" :
                              campaign.status === "paused" ? "outline" : "outline"
                            }
                          >
                            {campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={(campaign.completed / campaign.total) * 100} className="h-2 w-20" />
                            <span className="text-xs">{campaign.completed}/{campaign.total}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={campaign.successRate >= 70 ? "text-green-600" : campaign.successRate >= 50 ? "text-yellow-600" : "text-red-600"}>
                            {campaign.successRate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{campaign.startedAt}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost">View</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
