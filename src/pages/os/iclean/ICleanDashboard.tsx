import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, Calendar, Users, DollarSign, FileText, Clock, MapPin, CheckCircle, AlertTriangle } from "lucide-react";

export default function ICleanDashboard() {
  const stats = [
    { label: "Active Jobs", value: "34", icon: Calendar, change: "+8 today", color: "text-cyan-500" },
    { label: "Staff Members", value: "45", icon: Users, change: "12 on shift", color: "text-blue-500" },
    { label: "Monthly Revenue", value: "$89,400", icon: DollarSign, change: "+15%", color: "text-emerald-500" },
    { label: "Active Contracts", value: "28", icon: FileText, change: "+3 new", color: "text-purple-500" },
  ];

  const todaysJobs = [
    { id: "IC-001", client: "ABC Corporation", type: "Commercial", address: "123 Business Ave", time: "8:00 AM", status: "In Progress", team: "Team Alpha" },
    { id: "IC-002", client: "Smith Residence", type: "Residential", address: "456 Oak Street", time: "9:30 AM", status: "Completed", team: "Team Beta" },
    { id: "IC-003", client: "Plaza Medical", type: "Medical", address: "789 Health Blvd", time: "11:00 AM", status: "Scheduled", team: "Team Gamma" },
    { id: "IC-004", client: "Johnson Home", type: "Residential", address: "321 Maple Dr", time: "1:00 PM", status: "Scheduled", team: "Team Alpha" },
    { id: "IC-005", client: "Tech Hub Office", type: "Commercial", address: "555 Innovation Way", time: "3:00 PM", status: "Scheduled", team: "Team Delta" },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      "Completed": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      "In Progress": "bg-blue-500/10 text-blue-600 border-blue-500/20",
      "Scheduled": "bg-amber-500/10 text-amber-600 border-amber-500/20",
    };
    return styles[status] || "bg-muted text-muted-foreground";
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      "Commercial": "bg-purple-500/10 text-purple-600 border-purple-500/20",
      "Residential": "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
      "Medical": "bg-red-500/10 text-red-600 border-red-500/20",
    };
    return styles[type] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-500 bg-clip-text text-transparent">
            iClean WeClean OS
          </h1>
          <p className="text-muted-foreground mt-1">Commercial & Residential Cleaning Management</p>
        </div>
        <Button className="bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-700 hover:to-blue-600">
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Job
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
      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="jobs">Today's Jobs</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-cyan-500" />
                Today's Jobs - {new Date().toLocaleDateString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Job ID</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Client</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Address</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Time</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Team</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todaysJobs.map((job) => (
                      <tr key={job.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono text-sm">{job.id}</td>
                        <td className="p-3 font-medium">{job.client}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={getTypeBadge(job.type)}>{job.type}</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground text-sm">{job.address}</td>
                        <td className="p-3">{job.time}</td>
                        <td className="p-3 text-muted-foreground">{job.team}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={getStatusBadge(job.status)}>
                            {job.status}
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

        <TabsContent value="staff">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "Team Alpha", members: 5, status: "On Job", lead: "Maria Garcia" },
              { name: "Team Beta", members: 4, status: "Available", lead: "John Smith" },
              { name: "Team Gamma", members: 5, status: "En Route", lead: "Sarah Lee" },
              { name: "Team Delta", members: 4, status: "Available", lead: "Mike Johnson" },
              { name: "Team Echo", members: 3, status: "Break", lead: "Lisa Wong" },
              { name: "Team Foxtrot", members: 4, status: "On Job", lead: "David Brown" },
            ].map((team, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10">
                      <Users className="h-8 w-8 text-cyan-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{team.name}</h3>
                      <p className="text-sm text-muted-foreground">Lead: {team.lead}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{team.members} members</span>
                    <Badge variant="outline" className={
                      team.status === "Available" ? "bg-emerald-500/10 text-emerald-600" :
                      team.status === "On Job" ? "bg-blue-500/10 text-blue-600" :
                      team.status === "En Route" ? "bg-amber-500/10 text-amber-600" :
                      "bg-muted text-muted-foreground"
                    }>
                      {team.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="contracts">
          <div className="space-y-4">
            {[
              { client: "ABC Corporation", type: "Weekly", value: "$2,400/mo", next: "Dec 4", status: "Active" },
              { client: "Plaza Medical Center", type: "Daily", value: "$8,500/mo", next: "Dec 2", status: "Active" },
              { client: "Tech Hub Office Park", type: "Bi-Weekly", value: "$1,800/mo", next: "Dec 8", status: "Active" },
              { client: "Downtown Mall", type: "Daily", value: "$12,000/mo", next: "Dec 2", status: "Active" },
              { client: "Riverside Apartments", type: "Monthly", value: "$950/mo", next: "Dec 15", status: "Renewal" },
            ].map((contract, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <FileText className="h-8 w-8 text-purple-500" />
                      <div>
                        <h3 className="font-semibold">{contract.client}</h3>
                        <p className="text-sm text-muted-foreground">{contract.type} cleaning • Next: {contract.next}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{contract.value}</p>
                      <Badge variant="outline" className={contract.status === "Active" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}>
                        {contract.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="schedules">
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-12">
                <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Weekly Schedule View</h3>
                <p className="text-muted-foreground">Calendar integration coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border/50">
              <CardContent className="p-6">
                <DollarSign className="h-8 w-8 text-emerald-500 mb-3" />
                <p className="text-sm text-muted-foreground">Invoices Sent</p>
                <p className="text-3xl font-bold">$124,500</p>
                <p className="text-xs text-muted-foreground mt-1">This month</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-6">
                <CheckCircle className="h-8 w-8 text-blue-500 mb-3" />
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className="text-3xl font-bold">$89,400</p>
                <p className="text-xs text-emerald-500 mt-1">71.6% collection rate</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-6">
                <AlertTriangle className="h-8 w-8 text-amber-500 mb-3" />
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-3xl font-bold">$35,100</p>
                <p className="text-xs text-amber-500 mt-1">8 invoices pending</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
