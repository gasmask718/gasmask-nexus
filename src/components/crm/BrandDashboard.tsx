import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Store, Users, CheckCircle2, ClipboardList, 
  TrendingUp, MapPin, AlertTriangle, Target 
} from "lucide-react";
import { BrandAISummary } from "./BrandAISummary";
import { SuggestedVisitsWidget } from "./SuggestedVisitsWidget";

interface BrandDashboardProps {
  brand: any;
  stores: any[];
  contacts: any[];
  openTasksCount: number;
  stickerCompliance: number;
  storesByBoro: { boro: string; count: number }[];
  storeScores: any[];
  insight: any;
  onGenerateInsights: () => void;
  isGeneratingInsights: boolean;
}

export function BrandDashboard({
  brand,
  stores,
  contacts,
  openTasksCount,
  stickerCompliance,
  storesByBoro,
  storeScores,
  insight,
  onGenerateInsights,
  isGeneratingInsights,
}: BrandDashboardProps) {
  const avgScore = storeScores.length > 0 
    ? Math.round(storeScores.reduce((a, b) => a + b.score, 0) / storeScores.length)
    : 0;

  const highPriorityCount = storeScores.filter(s => s.priority_label === "High").length;
  const lowPriorityCount = storeScores.filter(s => s.priority_label === "Low").length;

  return (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full -mr-10 -mt-10" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Store className="h-4 w-4" />
              Total Stores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stores.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {storesByBoro.length} boroughs covered
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -mr-10 -mt-10" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Sticker Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stickerCompliance}%</div>
            <Progress value={stickerCompliance} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -mr-10 -mt-10" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{contacts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stores.length > 0 ? (contacts.length / stores.length).toFixed(1) : 0} per store avg
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -mr-10 -mt-10" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Open Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openTasksCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending follow-ups
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Summary + Score Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <BrandAISummary
            insight={insight}
            onGenerate={onGenerateInsights}
            isGenerating={isGeneratingInsights}
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              Score Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <div className="text-5xl font-bold" style={{ color: brand?.color }}>
                {avgScore}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Average Store Score</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  High Priority
                </span>
                <Badge variant="secondary">{highPriorityCount}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  Medium Priority
                </span>
                <Badge variant="secondary">
                  {storeScores.length - highPriorityCount - lowPriorityCount}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  Low Priority
                </span>
                <Badge variant="secondary">{lowPriorityCount}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suggested Visits + Borough Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SuggestedVisitsWidget stores={stores} storeScores={storeScores} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-primary" />
              Coverage by Borough
            </CardTitle>
          </CardHeader>
          <CardContent>
            {storesByBoro.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No store data yet</p>
            ) : (
              <div className="space-y-3">
                {storesByBoro.map((item) => {
                  const percentage = stores.length > 0 
                    ? Math.round((item.count / stores.length) * 100) 
                    : 0;
                  return (
                    <div key={item.boro} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.boro}</span>
                        <span className="text-muted-foreground">{item.count} stores</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
