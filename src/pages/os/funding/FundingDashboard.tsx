import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, DollarSign, TrendingUp, Users, FileText, CheckCircle, Clock, AlertTriangle, ArrowRight } from "lucide-react";

export default function FundingDashboard() {
  const stats = [
    { label: "Active Applications", value: "156", icon: FileText, change: "+23 this week", color: "text-blue-500" },
    { label: "Approved This Month", value: "$2.4M", icon: CheckCircle, change: "+18%", color: "text-emerald-500" },
    { label: "Pending Review", value: "42", icon: Clock, change: "12 urgent", color: "text-amber-500" },
    { label: "Credit Repair Clients", value: "89", icon: CreditCard, change: "+15 new", color: "text-purple-500" },
  ];

  const fundingPipeline = [
    { id: "FD-001", client: "Johnson LLC", amount: "$75,000", type: "Business Loan", stage: "Underwriting", score: 720, days: 3 },
    { id: "FD-002", client: "Maria Santos", amount: "$25,000", type: "Personal Loan", stage: "Documentation", score: 680, days: 5 },
    { id: "FD-003", client: "Tech Startup Inc", amount: "$150,000", type: "SBA Loan", stage: "Approval", score: 740, days: 2 },
    { id: "FD-004", client: "David Chen", amount: "$50,000", type: "Equipment Finance", stage: "Funded", score: 695, days: 0 },
    { id: "FD-005", client: "Retail Express", amount: "$100,000", type: "Working Capital", stage: "Review", score: 710, days: 7 },
  ];

  const getStageBadge = (stage: string) => {
    const styles: Record<string, string> = {
      "Funded": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      "Approval": "bg-blue-500/10 text-blue-600 border-blue-500/20",
      "Underwriting": "bg-purple-500/10 text-purple-600 border-purple-500/20",
      "Documentation": "bg-amber-500/10 text-amber-600 border-amber-500/20",
      "Review": "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    };
    return styles[stage] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-blue-500 bg-clip-text text-transparent">
            Funding Company OS
          </h1>
          <p className="text-muted-foreground mt-1">Loan Origination, Credit Repair & Financial Services</p>
        </div>
        <Button className="bg-gradient-to-r from-emerald-600 to-blue-500 hover:from-emerald-700 hover:to-blue-600">
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
      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="pipeline">Funding Pipeline</TabsTrigger>
          <TabsTrigger value="requests">New Requests</TabsTrigger>
          <TabsTrigger value="credit">Credit Repair</TabsTrigger>
          <TabsTrigger value="products">Loan Products</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Active Funding Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">ID</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Client</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Amount</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Credit Score</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Stage</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Days in Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundingPipeline.map((item) => (
                      <tr key={item.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer">
                        <td className="p-3 font-mono text-sm">{item.id}</td>
                        <td className="p-3 font-medium">{item.client}</td>
                        <td className="p-3 font-semibold text-emerald-600">{item.amount}</td>
                        <td className="p-3 text-muted-foreground">{item.type}</td>
                        <td className="p-3">
                          <span className={item.score >= 700 ? "text-emerald-600" : item.score >= 650 ? "text-amber-600" : "text-red-600"}>
                            {item.score}
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={getStageBadge(item.stage)}>
                            {item.stage}
                          </Badge>
                        </td>
                        <td className="p-3">{item.days} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Visual */}
          <div className="grid grid-cols-5 gap-4">
            {[
              { stage: "Review", count: 12, amount: "$890K" },
              { stage: "Documentation", count: 8, amount: "$520K" },
              { stage: "Underwriting", count: 15, amount: "$1.2M" },
              { stage: "Approval", count: 5, amount: "$380K" },
              { stage: "Funded", count: 23, amount: "$2.1M" },
            ].map((s, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">{s.stage}</p>
                  <p className="text-2xl font-bold mt-1">{s.count}</p>
                  <p className="text-sm text-emerald-600">{s.amount}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="requests">
          <div className="space-y-4">
            {[
              { client: "New Restaurant LLC", amount: "$80,000", type: "Equipment Finance", submitted: "2 hours ago", urgency: "high" },
              { client: "Sarah Williams", amount: "$15,000", type: "Personal Loan", submitted: "4 hours ago", urgency: "medium" },
              { client: "Construction Pro", amount: "$200,000", type: "Business Line", submitted: "1 day ago", urgency: "low" },
            ].map((req, i) => (
              <Card key={i} className="border-border/50 hover:border-emerald-500/30 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${req.urgency === 'high' ? 'bg-red-500' : req.urgency === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <div>
                        <h3 className="font-semibold">{req.client}</h3>
                        <p className="text-sm text-muted-foreground">{req.type} • Submitted {req.submitted}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-bold text-emerald-600">{req.amount}</span>
                      <Button size="sm" variant="outline">
                        Review <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="credit">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-border/50">
              <CardContent className="p-6 text-center">
                <TrendingUp className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Avg Score Improvement</p>
                <p className="text-3xl font-bold">+84 pts</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-6 text-center">
                <Users className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Active Clients</p>
                <p className="text-3xl font-bold">89</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Items Removed (MTD)</p>
                <p className="text-3xl font-bold">234</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Credit Repair Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Michael Brown", start: 580, current: 652, target: 700, items: 12 },
                  { name: "Lisa Garcia", start: 520, current: 598, target: 650, items: 18 },
                  { name: "Robert Wilson", start: 610, current: 685, target: 720, items: 8 },
                ].map((client, i) => (
                  <div key={i} className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold">{client.name}</p>
                        <p className="text-sm text-muted-foreground">{client.items} items in dispute</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Target: {client.target}</p>
                        <p className="font-bold text-emerald-600">+{client.current - client.start} pts</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-red-500">{client.start}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                          style={{ width: `${((client.current - 300) / 550) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-emerald-600">{client.current}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "SBA 7(a) Loan", range: "$50K - $5M", rate: "Prime + 2.75%", term: "10-25 years" },
              { name: "Business Line of Credit", range: "$10K - $500K", rate: "8-24%", term: "Revolving" },
              { name: "Equipment Financing", range: "$5K - $2M", rate: "6-18%", term: "2-7 years" },
              { name: "Working Capital", range: "$5K - $500K", rate: "Factor 1.1-1.4", term: "3-18 months" },
              { name: "Personal Loan", range: "$1K - $100K", rate: "7-36%", term: "1-7 years" },
              { name: "Real Estate Bridge", range: "$100K - $10M", rate: "8-14%", term: "6-24 months" },
            ].map((product, i) => (
              <Card key={i} className="border-border/50 hover:border-emerald-500/30 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <CreditCard className="h-8 w-8 text-emerald-500 mb-3" />
                  <h3 className="font-semibold text-lg">{product.name}</h3>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-medium">{product.range}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rate:</span>
                      <span className="font-medium">{product.rate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Term:</span>
                      <span className="font-medium">{product.term}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
