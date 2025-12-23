import CommSystemsLayout from "../CommSystemsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Phone, TrendingUp, Clock, Users, Bot } from "lucide-react";

export default function CallAnalyticsPage() {
  return (
    <CommSystemsLayout title="Call Analytics" subtitle="Operational performance visibility">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">1,234</div><p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />Total Calls</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-green-600">68%</div><p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" />Conversion Rate</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">3:42</div><p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Avg Duration</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-purple-600">78%</div><p className="text-xs text-muted-foreground flex items-center gap-1"><Bot className="h-3 w-3" />AI Handled</p></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Call Volume by Business</CardTitle></CardHeader><CardContent className="h-64 flex items-center justify-center text-muted-foreground">Analytics charts will display here</CardContent></Card>
    </CommSystemsLayout>
  );
}
