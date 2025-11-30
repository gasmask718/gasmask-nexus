import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accessibility, Users, Calendar, Heart, BookOpen, Clock, MapPin, Phone, CheckCircle } from "lucide-react";

export default function SpecialNeedsDashboard() {
  const stats = [
    { label: "Registered Families", value: "248", icon: Users, change: "+12 this month", color: "text-blue-500" },
    { label: "Active Providers", value: "67", icon: Heart, change: "42 available", color: "text-rose-500" },
    { label: "Sessions This Month", value: "1,234", icon: Calendar, change: "+15%", color: "text-emerald-500" },
    { label: "Resources Available", value: "156", icon: BookOpen, change: "+8 new", color: "text-purple-500" },
  ];

  const upcomingSessions = [
    { id: "SN-001", family: "Thompson Family", provider: "Dr. Sarah Chen", service: "Speech Therapy", time: "9:00 AM", date: "Dec 2", status: "Confirmed" },
    { id: "SN-002", family: "Garcia Family", provider: "Maria Lopez", service: "ABA Therapy", time: "10:30 AM", date: "Dec 2", status: "Confirmed" },
    { id: "SN-003", family: "Williams Family", provider: "James Brown", service: "Occupational Therapy", time: "1:00 PM", date: "Dec 2", status: "Pending" },
    { id: "SN-004", family: "Johnson Family", provider: "Emily Davis", service: "Physical Therapy", time: "2:30 PM", date: "Dec 2", status: "Confirmed" },
    { id: "SN-005", family: "Lee Family", provider: "Dr. Michael Park", service: "Behavioral Support", time: "4:00 PM", date: "Dec 2", status: "Confirmed" },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      "Confirmed": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      "Pending": "bg-amber-500/10 text-amber-600 border-amber-500/20",
      "Completed": "bg-blue-500/10 text-blue-600 border-blue-500/20",
    };
    return styles[status] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-500 bg-clip-text text-transparent">
            Special Needs App OS
          </h1>
          <p className="text-muted-foreground mt-1">Compassionate Care Coordination & Support Services</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-700 hover:to-purple-600">
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Session
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-border/50 bg-gradient-to-br from-background to-muted/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  <p className="text-xs text-emerald-500 mt-1">{stat.change}</p>
                </div>
                <div className={`p-3 rounded-xl bg-muted/50 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="families">Families</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                Today's Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Session ID</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Family</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Provider</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Service</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Time</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingSessions.map((session) => (
                      <tr key={session.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono text-sm">{session.id}</td>
                        <td className="p-3 font-medium">{session.family}</td>
                        <td className="p-3 text-muted-foreground">{session.provider}</td>
                        <td className="p-3">{session.service}</td>
                        <td className="p-3">{session.time}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={getStatusBadge(session.status)}>
                            {session.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "Dr. Sarah Chen", specialty: "Speech Therapy", rating: 4.9, sessions: 234, available: true },
              { name: "Maria Lopez", specialty: "ABA Therapy", rating: 4.8, sessions: 312, available: true },
              { name: "James Brown", specialty: "Occupational Therapy", rating: 4.9, sessions: 189, available: false },
              { name: "Emily Davis", specialty: "Physical Therapy", rating: 4.7, sessions: 267, available: true },
              { name: "Dr. Michael Park", specialty: "Behavioral Support", rating: 4.9, sessions: 156, available: true },
              { name: "Lisa Wong", specialty: "Sensory Integration", rating: 4.8, sessions: 201, available: false },
            ].map((provider, i) => (
              <Card key={i} className="border-border/50 hover:border-blue-500/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                      <Heart className="h-6 w-6 text-rose-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{provider.name}</h3>
                      <p className="text-sm text-muted-foreground">{provider.specialty}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-amber-500">★</span> {provider.rating} • {provider.sessions} sessions
                    </div>
                    <Badge variant="outline" className={provider.available ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}>
                      {provider.available ? "Available" : "Busy"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="families">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Registered Families
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Thompson Family", child: "Emma (8)", services: ["Speech", "OT"], nextSession: "Dec 2" },
                  { name: "Garcia Family", child: "Lucas (6)", services: ["ABA", "PT"], nextSession: "Dec 2" },
                  { name: "Williams Family", child: "Noah (10)", services: ["OT", "Behavioral"], nextSession: "Dec 3" },
                  { name: "Johnson Family", child: "Sophia (7)", services: ["PT", "Sensory"], nextSession: "Dec 2" },
                  { name: "Lee Family", child: "Ethan (5)", services: ["ABA", "Speech"], nextSession: "Dec 4" },
                ].map((family, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                        {family.name[0]}
                      </div>
                      <div>
                        <p className="font-medium">{family.name}</p>
                        <p className="text-sm text-muted-foreground">{family.child}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex gap-1">
                        {family.services.map((s, j) => (
                          <Badge key={j} variant="outline" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">Next: {family.nextSession}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: "Early Intervention Guide", type: "PDF", category: "Education", downloads: 456 },
              { title: "IEP Meeting Checklist", type: "Document", category: "Planning", downloads: 312 },
              { title: "Sensory Activities at Home", type: "Video", category: "Activities", downloads: 678 },
              { title: "Communication Board Templates", type: "Download", category: "Tools", downloads: 234 },
              { title: "Behavior Tracking Sheet", type: "Spreadsheet", category: "Tracking", downloads: 567 },
              { title: "Transition Planning Guide", type: "PDF", category: "Planning", downloads: 189 },
            ].map((resource, i) => (
              <Card key={i} className="border-border/50 hover:border-purple-500/30 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <BookOpen className="h-8 w-8 text-purple-500 mb-3" />
                  <h3 className="font-semibold">{resource.title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">{resource.type}</Badge>
                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600">{resource.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">{resource.downloads} downloads</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="scheduling">
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-12">
                <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Scheduling Calendar</h3>
                <p className="text-muted-foreground mb-4">Manage appointments and recurring sessions</p>
                <Button className="bg-gradient-to-r from-blue-600 to-purple-500">
                  Open Calendar View
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
