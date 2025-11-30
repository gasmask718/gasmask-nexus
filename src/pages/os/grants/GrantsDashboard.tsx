import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, DollarSign, FileText, CheckCircle, Clock, AlertTriangle, Users, Calendar, TrendingUp } from "lucide-react";

export default function GrantsDashboard() {
  const stats = [
    { label: "Active Applications", value: "78", icon: FileText, change: "+12 this week", color: "text-amber-500" },
    { label: "Approved Grants", value: "$1.8M", icon: CheckCircle, change: "This quarter", color: "text-emerald-500" },
    { label: "Pending Review", value: "34", icon: Clock, change: "8 urgent", color: "text-blue-500" },
    { label: "Success Rate", value: "68%", icon: TrendingUp, change: "+5% vs last Q", color: "text-purple-500" },
  ];

  const grantCases = [
    { id: "GR-001", client: "Community Health Center", grant: "HHS Community Grant", amount: "$250,000", deadline: "Dec 15", status: "Submitted" },
    { id: "GR-002", client: "Youth Education Fund", grant: "Dept of Ed Title I", amount: "$180,000", deadline: "Dec 20", status: "In Progress" },
    { id: "GR-003", client: "Green Energy Startup", grant: "DOE Clean Energy", amount: "$500,000", deadline: "Jan 5", status: "Approved" },
    { id: "GR-004", client: "Rural Development Corp", grant: "USDA Rural Grant", amount: "$150,000", deadline: "Dec 30", status: "Review" },
    { id: "GR-005", client: "Arts Foundation", grant: "NEA Arts Grant", amount: "$75,000", deadline: "Jan 15", status: "Drafting" },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      "Approved": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      "Submitted": "bg-blue-500/10 text-blue-600 border-blue-500/20",
      "In Progress": "bg-amber-500/10 text-amber-600 border-amber-500/20",
      "Review": "bg-purple-500/10 text-purple-600 border-purple-500/20",
      "Drafting": "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    };
    return styles[status] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
            Grant Company OS
          </h1>
          <p className="text-muted-foreground mt-1">Federal & State Grant Application Management</p>
        </div>
        <Button className="bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-700 hover:to-yellow-600 text-black">
          <FileText className="h-4 w-4 mr-2" />
          New Application
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
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all">All Cases</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="deadlines">Upcoming Deadlines</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Grant Cases Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Case ID</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Client</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Grant Program</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Amount</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Deadline</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grantCases.map((item) => (
                      <tr key={item.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer">
                        <td className="p-3 font-mono text-sm">{item.id}</td>
                        <td className="p-3 font-medium">{item.client}</td>
                        <td className="p-3 text-muted-foreground">{item.grant}</td>
                        <td className="p-3 font-semibold text-amber-600">{item.amount}</td>
                        <td className="p-3">{item.deadline}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={getStatusBadge(item.status)}>
                            {item.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Kanban View */}
          <div className="grid grid-cols-5 gap-4">
            {[
              { stage: "Drafting", count: 8, color: "border-cyan-500/50" },
              { stage: "Review", count: 12, color: "border-purple-500/50" },
              { stage: "In Progress", count: 15, color: "border-amber-500/50" },
              { stage: "Submitted", count: 23, color: "border-blue-500/50" },
              { stage: "Approved", count: 18, color: "border-emerald-500/50" },
            ].map((s, i) => (
              <Card key={i} className={`border-t-4 ${s.color}`}>
                <CardContent className="p-4">
                  <p className="font-semibold">{s.stage}</p>
                  <p className="text-3xl font-bold mt-2">{s.count}</p>
                  <p className="text-sm text-muted-foreground">cases</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="approved">
          <div className="space-y-4">
            {[
              { client: "Green Energy Startup", grant: "DOE Clean Energy", amount: "$500,000", approved: "Nov 28" },
              { client: "Tech Innovation Lab", grant: "NSF Research Grant", amount: "$320,000", approved: "Nov 15" },
              { client: "Healthcare Alliance", grant: "NIH Community Health", amount: "$450,000", approved: "Nov 10" },
            ].map((item, i) => (
              <Card key={i} className="border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{item.client}</h3>
                        <p className="text-sm text-muted-foreground">{item.grant}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600">{item.amount}</p>
                      <p className="text-sm text-muted-foreground">Approved {item.approved}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pending">
          <div className="space-y-4">
            {[
              { client: "Community Health Center", grant: "HHS Community Grant", amount: "$250,000", submitted: "Dec 1", daysWaiting: 4 },
              { client: "Rural Development Corp", grant: "USDA Rural Grant", amount: "$150,000", submitted: "Nov 25", daysWaiting: 10 },
              { client: "Education First", grant: "Dept of Ed Grant", amount: "$200,000", submitted: "Nov 20", daysWaiting: 15 },
            ].map((item, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{item.client}</h3>
                        <p className="text-sm text-muted-foreground">{item.grant}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{item.amount}</p>
                      <p className="text-sm text-muted-foreground">{item.daysWaiting} days waiting</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="deadlines">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-red-500" />
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { client: "Community Health Center", grant: "HHS Community Grant", deadline: "Dec 15", daysLeft: 13, urgency: "medium" },
                  { client: "Youth Education Fund", grant: "Dept of Ed Title I", deadline: "Dec 20", daysLeft: 18, urgency: "low" },
                  { client: "Rural Development Corp", grant: "USDA Rural Grant", deadline: "Dec 30", daysLeft: 28, urgency: "low" },
                  { client: "Arts Foundation", grant: "NEA Arts Grant", deadline: "Jan 15", daysLeft: 44, urgency: "low" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${item.urgency === 'high' ? 'bg-red-500' : item.urgency === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <div>
                        <p className="font-medium">{item.client}</p>
                        <p className="text-sm text-muted-foreground">{item.grant}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{item.deadline}</p>
                      <p className="text-sm text-muted-foreground">{item.daysLeft} days left</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
