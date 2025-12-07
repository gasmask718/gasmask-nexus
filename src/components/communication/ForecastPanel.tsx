import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MessageSquare, Phone, TrendingUp, Brain, Lightbulb } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface ForecastPanelProps {
  businessId?: string;
}

export function ForecastPanel({ businessId }: ForecastPanelProps) {
  // Mock forecast data - in production this would come from AI analysis
  const volumeForecast = [
    { day: "Mon", messages: 45, calls: 12 },
    { day: "Tue", messages: 52, calls: 15 },
    { day: "Wed", messages: 38, calls: 8 },
    { day: "Thu", messages: 65, calls: 20 },
    { day: "Fri", messages: 58, calls: 18 },
    { day: "Sat", messages: 30, calls: 5 },
    { day: "Sun", messages: 20, calls: 3 },
  ];

  const peakHours = [
    { hour: "9-10 AM", volume: 15 },
    { hour: "10-11 AM", volume: 22 },
    { hour: "11-12 PM", volume: 28 },
    { hour: "12-1 PM", volume: 18 },
    { hour: "1-2 PM", volume: 25 },
    { hour: "2-3 PM", volume: 35 },
    { hour: "3-4 PM", volume: 42 },
    { hour: "4-5 PM", volume: 38 },
    { hour: "5-6 PM", volume: 30 },
    { hour: "6-7 PM", volume: 22 },
  ];

  const aiInsights = [
    {
      type: "volume",
      message: "Expect high inbound traffic Thursday 3-7 PM",
      priority: "high",
    },
    {
      type: "region",
      message: "BX stores trending cold this week - schedule outreach",
      priority: "medium",
    },
    {
      type: "call",
      message: "Best AI call success times: Tuesday & Thursday mornings",
      priority: "info",
    },
    {
      type: "sentiment",
      message: "Positive sentiment wave expected Friday-Saturday",
      priority: "info",
    },
  ];

  const neighborhoodForecast = [
    { name: "Brooklyn", trend: "hot", change: "+12%" },
    { name: "Queens", trend: "warm", change: "+5%" },
    { name: "Bronx", trend: "cold", change: "-8%" },
    { name: "Manhattan", trend: "stable", change: "+2%" },
    { name: "Staten Island", trend: "warm", change: "+7%" },
  ];

  const getTrendColor = (trend: string) => {
    if (trend === "hot") return "text-green-500";
    if (trend === "warm") return "text-blue-500";
    if (trend === "cold") return "text-destructive";
    return "text-muted-foreground";
  };

  const getTrendBadge = (trend: string) => {
    if (trend === "hot") return <Badge className="bg-green-500">Hot</Badge>;
    if (trend === "warm") return <Badge className="bg-blue-500">Warm</Badge>;
    if (trend === "cold") return <Badge variant="destructive">Cold</Badge>;
    return <Badge variant="secondary">Stable</Badge>;
  };

  const getPriorityColor = (priority: string) => {
    if (priority === "high") return "border-l-destructive bg-destructive/5";
    if (priority === "medium") return "border-l-yellow-500 bg-yellow-500/5";
    return "border-l-blue-500 bg-blue-500/5";
  };

  return (
    <div className="space-y-4">
      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Forecast Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {aiInsights.map((insight, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 border-l-4 rounded-r-lg ${getPriorityColor(insight.priority)}`}
              >
                <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
                <p className="text-sm">{insight.message}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Volume Forecast Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              7-Day Volume Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeForecast}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="messages" name="Messages" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="calls" name="Calls" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Peak Hours Prediction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakHours} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" className="text-xs" angle={-45} textAnchor="end" height={60} />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="volume" name="Expected Volume" radius={[4, 4, 0, 0]}>
                    {peakHours.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.volume >= 35 ? "#ef4444" : entry.volume >= 25 ? "#f59e0b" : "hsl(var(--primary))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Neighborhood Forecast */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Neighborhood Engagement Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {neighborhoodForecast.map((hood) => (
              <div
                key={hood.name}
                className="p-4 border rounded-lg text-center"
              >
                <p className="font-medium mb-2">{hood.name}</p>
                {getTrendBadge(hood.trend)}
                <p className={`text-lg font-bold mt-2 ${getTrendColor(hood.trend)}`}>
                  {hood.change}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scheduling Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Recommended Scheduling Windows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="font-medium">SMS Campaigns</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Best times: <strong>Tuesday 10 AM, Thursday 2 PM</strong>
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-green-500" />
                <span className="font-medium">AI Calls</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Best times: <strong>Tuesday 9-11 AM, Thursday 9-11 AM</strong>
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Follow-ups</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Best day: <strong>Friday afternoon</strong>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
