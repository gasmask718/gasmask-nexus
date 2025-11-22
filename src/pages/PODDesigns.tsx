import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Package, Eye, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PODDesigns() {
  const [designs, setDesigns] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchDesigns();
  }, [filter]);

  const fetchDesigns = async () => {
    try {
      let query = supabase.from("pod_designs").select("*").order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("category", filter);
      }

      const { data } = await query;
      setDesigns(data || []);
    } catch (error) {
      console.error("Error fetching designs:", error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-blue-500",
      queued: "bg-yellow-500",
      uploaded: "bg-green-500",
      performing: "bg-purple-500",
      winning: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      evergreen: "default",
      holiday: "secondary",
      hot_mama: "destructive",
      gasmask: "outline",
    };
    return colors[category] || "default";
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Design Library</h1>
        <p className="text-muted-foreground">Manage all your POD designs</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {["all", "evergreen", "holiday", "hot_mama", "gasmask"].map((cat) => (
          <Button
            key={cat}
            variant={filter === cat ? "default" : "outline"}
            onClick={() => setFilter(cat)}
          >
            {cat.replace("_", " ").toUpperCase()}
          </Button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Designs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{designs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {designs.filter((d) => d.approved_by_va).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Eye className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {designs.filter((d) => !d.approved_by_va && d.status === 'new').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Winners</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {designs.filter((d) => d.status === 'winning').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Design Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {designs.map((design) => (
          <Card key={design.id} className="overflow-hidden">
            <div className="aspect-square bg-muted flex items-center justify-center">
              {design.design_image_url ? (
                <img
                  src={design.design_image_url}
                  alt={design.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="h-16 w-16 text-muted-foreground" />
              )}
            </div>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm line-clamp-2">{design.title}</CardTitle>
                <Badge className={getStatusColor(design.status)}>{design.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Category</span>
                <Badge variant={getCategoryColor(design.category) as any}>
                  {design.category}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Variations</span>
                <span className="font-medium">{design.variations_created}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">AI Generated</span>
                {design.generated_by_ai ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">VA Approved</span>
                {design.approved_by_va ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Eye className="h-4 w-4 text-yellow-600" />
                )}
              </div>
              {design.platforms_uploaded && design.platforms_uploaded.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Uploaded to:</p>
                  <div className="flex flex-wrap gap-1">
                    {design.platforms_uploaded.map((platform: string) => (
                      <Badge key={platform} variant="outline" className="text-xs">
                        {platform}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {designs.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No designs yet. Start generating designs with AI!
          </p>
        </div>
      )}
    </div>
  );
}
