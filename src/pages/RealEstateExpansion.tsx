import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, DollarSign, MapPin, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function RealEstateExpansion() {
  const [cities, setCities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("expansion_cities")
        .select("*")
        .order("market_score", { ascending: false });

      if (error) throw error;
      setCities(data || []);
    } catch (error) {
      console.error("Error fetching expansion cities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge variant="default">Excellent</Badge>;
    if (score >= 60) return <Badge variant="secondary">Good</Badge>;
    return <Badge variant="outline">Fair</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      researching: "outline",
      analyzing: "secondary",
      ready: "default",
      deployed: "default",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Expansion Engine</h1>
        <p className="text-muted-foreground">AI-powered market analysis for geographic expansion</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Markets Analyzed</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{cities.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Cities evaluated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ready to Deploy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {cities.filter((c) => c.market_score >= 80).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">High-score markets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Markets</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {cities.filter((c) => c.deployment_status === "deployed").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Currently operating</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Expansion Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading cities...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>City</TableHead>
                  <TableHead>Population</TableHead>
                  <TableHead>Median Price</TableHead>
                  <TableHead>Market Score</TableHead>
                  <TableHead>Affordability</TableHead>
                  <TableHead>Rent Strength</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cities.map((city) => (
                  <TableRow key={city.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{city.city}</div>
                          <div className="text-sm text-muted-foreground">{city.state}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {city.population?.toLocaleString() || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        ${(city.median_home_price / 1000).toFixed(0)}K
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        {getScoreBadge(city.market_score)}
                        <Progress value={city.market_score} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{city.affordability_score}/100</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{city.rent_strength}/100</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(city.deployment_status)}</TableCell>
                    <TableCell>
                      {city.deployment_status === "ready" && (
                        <Button size="sm" variant="default">
                          Deploy Market
                        </Button>
                      )}
                      {city.deployment_status === "researching" && (
                        <Button size="sm" variant="outline">
                          View Analysis
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}