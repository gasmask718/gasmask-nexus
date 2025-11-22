import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PODUpload() {
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    fetchMarketplaceAccounts();
  }, []);

  const fetchMarketplaceAccounts = async () => {
    try {
      const { data } = await supabase
        .from("pod_marketplace_accounts")
        .select("*");
      setAccounts(data || []);
    } catch (error) {
      console.error("Error fetching marketplace accounts:", error);
    }
  };

  const platforms = [
    "etsy",
    "amazon",
    "tiktok_shop",
    "redbubble",
    "shopify",
    "teespring",
    "walmart",
  ];

  const getStatusBadge = (platformName: string) => {
    const account = accounts.find((a) => a.platform_name === platformName);
    if (!account) {
      return <Badge variant="outline">Not Connected</Badge>;
    }
    if (account.connection_status === "connected") {
      return (
        <Badge className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Connected
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Error
      </Badge>
    );
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Marketplace Upload Manager</h1>
        <p className="text-muted-foreground">
          Connect and upload to all POD marketplaces
        </p>
      </div>

      {/* Marketplace Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((platform) => (
          <Card key={platform}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg capitalize">
                  {platform.replace("_", " ")}
                </CardTitle>
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(platform)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Listings</span>
                <span className="font-medium">0</span>
              </div>
              <div className="pt-2 border-t space-y-2">
                <button className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
                  Configure Integration
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upload Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Total Uploads</div>
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">This Week</div>
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Active Listings</div>
            </div>
            <div>
              <div className="text-2xl font-bold">0%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
