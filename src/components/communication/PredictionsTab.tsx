import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, TrendingUp, Activity, Calendar, Zap } from "lucide-react";
import { ChurnPredictionPanel } from "./ChurnPredictionPanel";
import { OpportunityPredictionPanel } from "./OpportunityPredictionPanel";
import { TrendMatrixPanel } from "./TrendMatrixPanel";
import { ForecastPanel } from "./ForecastPanel";
import { PredictiveActionsPanel } from "./PredictiveActionsPanel";

interface PredictionsTabProps {
  businessId?: string;
}

export function PredictionsTab({ businessId }: PredictionsTabProps) {
  return (
    <Tabs defaultValue="churn" className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="churn" className="flex items-center gap-1">
          <AlertTriangle className="h-4 w-4" />
          <span className="hidden sm:inline">Churn Risk</span>
        </TabsTrigger>
        <TabsTrigger value="opportunities" className="flex items-center gap-1">
          <TrendingUp className="h-4 w-4" />
          <span className="hidden sm:inline">Opportunities</span>
        </TabsTrigger>
        <TabsTrigger value="trends" className="flex items-center gap-1">
          <Activity className="h-4 w-4" />
          <span className="hidden sm:inline">Trends</span>
        </TabsTrigger>
        <TabsTrigger value="forecast" className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Forecast</span>
        </TabsTrigger>
        <TabsTrigger value="actions" className="flex items-center gap-1">
          <Zap className="h-4 w-4" />
          <span className="hidden sm:inline">Actions</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="churn" className="mt-4">
        <ChurnPredictionPanel businessId={businessId} />
      </TabsContent>

      <TabsContent value="opportunities" className="mt-4">
        <OpportunityPredictionPanel businessId={businessId} />
      </TabsContent>

      <TabsContent value="trends" className="mt-4">
        <TrendMatrixPanel businessId={businessId} />
      </TabsContent>

      <TabsContent value="forecast" className="mt-4">
        <ForecastPanel businessId={businessId} />
      </TabsContent>

      <TabsContent value="actions" className="mt-4">
        <PredictiveActionsPanel businessId={businessId} />
      </TabsContent>
    </Tabs>
  );
}
