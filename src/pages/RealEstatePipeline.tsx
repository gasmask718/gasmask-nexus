import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calendar, User } from "lucide-react";

export default function RealEstatePipeline() {
  const [pipeline, setPipeline] = useState<any>({
    new: [],
    contacted: [],
    negotiating: [],
    offer_sent: [],
    signed: [],
    assigned: [],
    closed: [],
  });

  useEffect(() => {
    fetchPipeline();
  }, []);

  const fetchPipeline = async () => {
    try {
      const { data, error } = await supabase
        .from("acquisitions_pipeline")
        .select(`
          *,
          leads_raw(address, city, state, property_type),
          profiles(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const grouped = (data || []).reduce((acc: any, deal: any) => {
        const status = deal.status || "new";
        if (!acc[status]) acc[status] = [];
        acc[status].push(deal);
        return acc;
      }, {});

      setPipeline(grouped);
    } catch (error) {
      console.error("Error fetching pipeline:", error);
    }
  };

  const stages = [
    { key: "new", label: "New", color: "bg-blue-500" },
    { key: "contacted", label: "Contacted", color: "bg-purple-500" },
    { key: "negotiating", label: "Negotiating", color: "bg-yellow-500" },
    { key: "offer_sent", label: "Offer Sent", color: "bg-orange-500" },
    { key: "signed", label: "Signed", color: "bg-green-500" },
    { key: "assigned", label: "Assigned", color: "bg-teal-500" },
    { key: "closed", label: "Closed", color: "bg-emerald-500" },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Acquisition Pipeline</h1>
        <p className="text-muted-foreground">Deal flow from lead to close</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        {stages.map((stage) => (
          <Card key={stage.key} className="flex flex-col">
            <CardHeader className={`${stage.color} text-white rounded-t-lg`}>
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                {stage.label}
                <Badge variant="secondary" className="bg-white/20 text-white">
                  {pipeline[stage.key]?.length || 0}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[600px]">
              {pipeline[stage.key]?.map((deal: any) => (
                <Card key={deal.id} className="p-3 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="space-y-2">
                    <div className="font-medium text-sm truncate">
                      {deal.leads_raw?.address || "Unknown Property"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {deal.leads_raw?.city}, {deal.leads_raw?.state}
                    </div>
                    {deal.offer_amount && (
                      <div className="flex items-center gap-1 text-xs">
                        <DollarSign className="h-3 w-3" />
                        ${(deal.offer_amount / 1000).toFixed(0)}K
                      </div>
                    )}
                    {deal.assigned_to && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {deal.profiles?.name || "Unassigned"}
                      </div>
                    )}
                    {deal.closing_date && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(deal.closing_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}