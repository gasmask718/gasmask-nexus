import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Search, Phone, Mail, MapPin, Star, ExternalLink, MessageSquare, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GRABBA_BRANDS, GRABBA_BRAND_CONFIG, getBrandConfig } from "@/config/grabbaBrands";

export default function GrabbaCRM() {
  const navigate = useNavigate();
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch companies with Grabba activity
  const { data: companies, isLoading } = useQuery({
    queryKey: ["grabba-crm-companies", brandFilter],
    queryFn: async () => {
      // Get companies that have orders with Grabba brands
      const { data: ordersWithCompanies } = await supabase
        .from("wholesale_orders")
        .select("company_id, brand")
        .in("brand", GRABBA_BRANDS);

      const companyIds = [...new Set(ordersWithCompanies?.map(o => o.company_id).filter(Boolean))];
      
      if (companyIds.length === 0) {
        // Fallback: get all companies
        const { data } = await supabase.from("companies").select("*").limit(50);
        return data || [];
      }

      const { data } = await supabase
        .from("companies")
        .select("*")
        .in("id", companyIds);

      return data || [];
    },
  });

  // Fetch brand activity per company
  const { data: brandActivity } = useQuery({
    queryKey: ["grabba-brand-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wholesale_orders")
        .select("company_id, brand")
        .in("brand", GRABBA_BRANDS);
      
      const activityMap: Record<string, Set<string>> = {};
      data?.forEach(order => {
        if (order.company_id) {
          if (!activityMap[order.company_id]) activityMap[order.company_id] = new Set();
          activityMap[order.company_id].add(order.brand);
        }
      });
      
      return Object.fromEntries(
        Object.entries(activityMap).map(([k, v]) => [k, Array.from(v)])
      );
    },
  });

  const filteredCompanies = companies?.filter(company => {
    const matchesSearch = !searchQuery || 
      company.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.default_city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.default_phone?.includes(searchQuery);
    
    const matchesType = typeFilter === "all" || company.type === typeFilter;
    
    const companyBrands = brandActivity?.[company.id] || [];
    const matchesBrand = brandFilter === "all" || companyBrands.includes(brandFilter);
    
    return matchesSearch && matchesType && matchesBrand;
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              Grabba CRM & Stores
            </h1>
            <p className="text-muted-foreground mt-1">
              All Grabba stores, wholesalers, and direct customers – filterable by brand
            </p>
          </div>
          <div className="flex gap-2">
            {GRABBA_BRANDS.map(brand => {
              const config = getBrandConfig(brand);
              return (
                <Badge key={brand} className={config.pill}>
                  {config.icon} {config.label}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, city, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {GRABBA_BRANDS.map(brand => (
                    <SelectItem key={brand} value={brand}>
                      {getBrandConfig(brand).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="store">Store</SelectItem>
                  <SelectItem value="wholesaler">Wholesaler</SelectItem>
                  <SelectItem value="direct_customer">Direct Customer</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={() => { setBrandFilter("all"); setTypeFilter("all"); setSearchQuery(""); }}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Companies List */}
        <div className="grid gap-4">
          {isLoading ? (
            <Card className="p-8 text-center text-muted-foreground">Loading companies...</Card>
          ) : filteredCompanies?.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">No companies found</Card>
          ) : (
            filteredCompanies?.map(company => {
              const companyBrands = brandActivity?.[company.id] || [];
              return (
                <Card key={company.id} className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-foreground">{company.name}</h3>
                          <Badge variant="outline" className="capitalize">{company.type || 'store'}</Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          {company.neighborhood && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {company.neighborhood}{company.boro ? `, ${company.boro}` : ''}
                            </span>
                          )}
                          {company.default_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {company.default_phone}
                            </span>
                          )}
                          {company.default_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {company.default_email}
                            </span>
                          )}
                        </div>

                        {/* Brand Pills */}
                        <div className="flex gap-2 mt-3">
                          {companyBrands.map(brand => {
                            const config = getBrandConfig(brand);
                            return (
                              <Badge key={brand} className={config.pill}>
                                {config.icon} {config.label}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      {/* Payment Reliability */}
                      <div className="text-center px-4 border-l border-border">
                        <div className="flex items-center gap-1 text-amber-400">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} className={`h-4 w-4 ${i <= (company.payment_reliability_score || 0) / 20 ? 'fill-current' : 'opacity-30'}`} />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {company.payment_reliability_tier || 'Unrated'}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 ml-4">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/companies/${company.id}`)}>
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open Profile</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/grabba/communication?company=${company.id}`)}>
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Communication Center</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/grabba/inventory?company=${company.id}`)}>
                                <Package className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Inventory Intelligence</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
