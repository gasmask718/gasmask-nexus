import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Copy, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface StoreScore {
  store_id: string;
  score: number;
  priority_label: string;
  reason_summary: string | null;
}

interface Store {
  id: string;
  store_name: string;
  address?: string;
  borough?: { boro_name?: string; name?: string } | any;
  sticker_on_door?: boolean;
}

interface SuggestedVisitsWidgetProps {
  stores: Store[];
  storeScores: StoreScore[];
}

export function SuggestedVisitsWidget({ stores, storeScores }: SuggestedVisitsWidgetProps) {
  // Get stores with low scores
  const priorityStores = storeScores
    .filter((s) => s.score < 60 || s.priority_label === "Low")
    .slice(0, 10)
    .map((score) => {
      const store = stores.find((s) => s.id === score.store_id);
      return { ...score, store };
    })
    .filter((s) => s.store);

  const handleCopyList = () => {
    const list = priorityStores
      .map((s, i) => `${i + 1}. ${s.store?.store_name} - ${s.store?.address || "No address"} (Score: ${s.score})`)
      .join("\n");
    
    navigator.clipboard.writeText(list);
    toast.success("Visit list copied to clipboard");
  };

  if (priorityStores.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Suggested Visits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
            <p className="text-sm text-muted-foreground">
              All stores are in good standing!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Suggested Visits Today
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleCopyList}>
            <Copy className="h-4 w-4 mr-2" />
            Copy List
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {priorityStores.map((item, index) => (
            <div 
              key={item.store_id} 
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{item.store?.store_name}</p>
                  <Badge 
                    variant="secondary" 
                    className={
                      item.score < 40 
                        ? "bg-red-100 text-red-800" 
                        : "bg-amber-100 text-amber-800"
                    }
                  >
                    Score: {item.score}
                  </Badge>
                </div>
                {item.store?.address && (
                  <p className="text-sm text-muted-foreground truncate">
                    {item.store.address}
                  </p>
                )}
                {(item.store?.borough?.boro_name || item.store?.borough?.name) && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    {item.store.borough.boro_name || item.store.borough.name}
                  </Badge>
                )}
                {item.reason_summary && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {item.reason_summary}
                  </p>
                )}
              </div>
              {!item.store?.sticker_on_door && (
                <Badge variant="destructive" className="text-xs">
                  No Sticker
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
