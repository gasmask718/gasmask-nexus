import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Lightbulb, ArrowRight, Store, Phone, Package, DollarSign, 
  Target, CheckCircle2, Clock
} from "lucide-react";
import { useGrabbaIntelligence } from "@/hooks/useGrabbaIntelligence";
import { useNavigate } from "react-router-dom";

const priorityColors = {
  high: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20',
  medium: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20',
  low: 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20',
};

export function AINextBestActions() {
  const navigate = useNavigate();
  const { data, isLoading } = useGrabbaIntelligence();
  const topStores = data?.topStoresToCheck || [];
  const insights = data?.insights || [];

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border-amber-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            AI Recommended Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted/30 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generate action items from data
  const actions = [
    ...topStores.slice(0, 5).map(store => ({
      id: `store-${store.id}`,
      type: 'store',
      title: `Check ${store.name}`,
      description: store.reason,
      priority: store.priority > 50 ? 'high' : store.priority > 25 ? 'medium' : 'low',
      action: () => navigate(`/stores/${store.id}`),
      icon: Store,
    })),
    ...insights.slice(0, 3).map((insight, i) => ({
      id: `insight-${i}`,
      type: 'insight',
      title: insight.category,
      description: insight.insight.substring(0, 100) + '...',
      priority: 'medium' as const,
      action: () => {},
      icon: Target,
    })),
  ].slice(0, 8);

  return (
    <Card className="bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border-amber-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              AI Recommended Actions
            </CardTitle>
            <CardDescription>Priority tasks for maximum impact</CardDescription>
          </div>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            {actions.length} Actions
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-lg font-medium text-green-600">All Caught Up!</p>
            <p className="text-sm text-muted-foreground">No priority actions needed right now</p>
          </div>
        ) : (
          <ScrollArea className="h-[350px] pr-4">
            <div className="space-y-3">
              {actions.map((action, index) => {
                const Icon = action.icon;
                const priority = action.priority as keyof typeof priorityColors;
                
                return (
                  <div
                    key={action.id}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${priorityColors[priority]}`}
                    onClick={action.action}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background/50 text-muted-foreground">
                        <span className="text-sm font-bold">#{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{action.title}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs capitalize ${
                              priority === 'high' ? 'border-red-500 text-red-500' :
                              priority === 'medium' ? 'border-amber-500 text-amber-500' :
                              'border-blue-500 text-blue-500'
                            }`}
                          >
                            {priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{action.description}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
