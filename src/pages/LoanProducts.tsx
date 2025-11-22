import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, Clock, Percent, Building2, Hammer } from "lucide-react";

const PRODUCT_TYPES = [
  { id: "hard_money", name: "Hard Money", icon: DollarSign, color: "text-orange-600" },
  { id: "dscr", name: "DSCR Loans", icon: TrendingUp, color: "text-blue-600" },
  { id: "bridge", name: "Bridge Loans", icon: Clock, color: "text-purple-600" },
  { id: "fix_and_flip", name: "Fix & Flip", icon: Hammer, color: "text-green-600" },
  { id: "rental_30yr", name: "30-Year Rental", icon: Building2, color: "text-indigo-600" },
  { id: "portfolio", name: "Portfolio Loans", icon: TrendingUp, color: "text-pink-600" },
];

export default function LoanProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("all");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("loan_products")
        .select("*, lenders(*)")
        .eq("is_active", true)
        .order("interest_rate_min");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching loan products:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = selectedType === "all"
    ? products
    : products.filter(p => p.product_type === selectedType);

  const getStats = (type: string) => {
    const typeProducts = type === "all" ? products : products.filter(p => p.product_type === type);
    if (typeProducts.length === 0) return { count: 0, avgRate: 0, avgLtv: 0 };

    return {
      count: typeProducts.length,
      avgRate: typeProducts.reduce((sum, p) => sum + ((p.interest_rate_min + p.interest_rate_max) / 2), 0) / typeProducts.length,
      avgLtv: typeProducts.reduce((sum, p) => sum + p.max_ltv, 0) / typeProducts.length,
    };
  };

  if (loading) {
    return <div className="min-h-screen p-6">Loading loan products...</div>;
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Loan Products Dashboard</h1>
        <p className="text-muted-foreground">
          Explore financing options for real estate investments
        </p>
      </div>

      <Tabs value={selectedType} onValueChange={setSelectedType} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="all">All Products</TabsTrigger>
          {PRODUCT_TYPES.map(type => (
            <TabsTrigger key={type.id} value={type.id}>
              {type.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedType} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Products Available</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{getStats(selectedType).count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Interest Rate</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{getStats(selectedType).avgRate.toFixed(2)}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Max LTV</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{getStats(selectedType).avgLtv.toFixed(0)}%</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const typeInfo = PRODUCT_TYPES.find(t => t.id === product.product_type) || PRODUCT_TYPES[0];
              const Icon = typeInfo.icon;
              
              return (
                <Card key={product.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`h-6 w-6 ${typeInfo.color}`} />
                      <Badge variant="outline">{typeInfo.name}</Badge>
                    </div>
                    <CardTitle className="text-lg">{product.product_name}</CardTitle>
                    <CardDescription>{product.lenders.lender_name}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Interest Rate</div>
                        <div className="font-bold text-primary">
                          {product.interest_rate_min}% - {product.interest_rate_max}%
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Max LTV</div>
                        <div className="font-bold">{product.max_ltv}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Loan Range</div>
                        <div className="font-medium">
                          ${(product.min_loan / 1000).toFixed(0)}K - ${(product.max_loan / 1000000).toFixed(1)}M
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Term</div>
                        <div className="font-medium">{product.term_months} months</div>
                      </div>
                    </div>
                    
                    {product.origination_points && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Points: </span>
                        <span className="font-medium">{product.origination_points}%</span>
                      </div>
                    )}
                    
                    {product.min_credit_score && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Min Credit: </span>
                        <span className="font-medium">{product.min_credit_score}</span>
                      </div>
                    )}
                    
                    {product.min_dscr && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Min DSCR: </span>
                        <span className="font-medium">{product.min_dscr}</span>
                      </div>
                    )}
                    
                    <div className="flex gap-2 flex-wrap pt-2">
                      {product.rehab_holdback && (
                        <Badge variant="secondary" className="text-xs">Rehab Holdback</Badge>
                      )}
                      {product.cross_collateral_ok && (
                        <Badge variant="secondary" className="text-xs">Cross-Collateral OK</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
