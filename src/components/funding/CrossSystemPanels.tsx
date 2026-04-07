import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Home, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Read-only visibility panels for Surplus Funds + Real Estate
 * Used on the Funding Machine Dashboard — NO write logic, display only.
 */

export function SurplusVisibilityPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['funding-surplus-visibility'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surplus_funds_cases')
        .select('id, client_name, surplus_amount, status, our_expected_fee')
        .in('status', ['filed', 'hearing_scheduled', 'approved', 'funds_released'])
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const totalSurplus = (data || []).reduce((s, c) => s + Number(c.surplus_amount || 0), 0);
  const totalFees = (data || []).reduce((s, c) => s + Number(c.our_expected_fee || 0), 0);

  return (
    <Card className="border-amber-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-500" />
            Available Capital (Surplus Funds OS)
          </div>
          <Link to="/surplus-funds" className="text-xs text-muted-foreground hover:text-amber-500 flex items-center gap-1">
            View <ExternalLink className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">No active surplus cases</p>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active Cases</span>
              <span className="font-semibold">{data.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Surplus</span>
              <span className="font-semibold text-amber-500">${totalSurplus.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Expected Fees</span>
              <span className="font-semibold text-emerald-500">${totalFees.toLocaleString()}</span>
            </div>
            <div className="border-t border-border/50 pt-2 mt-2 space-y-1">
              {data.slice(0, 3).map(c => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <span className="truncate max-w-[60%]">{c.client_name}</span>
                  <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RealEstateVisibilityPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['funding-re-visibility'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('re_deals')
        .select('id, property_address, city, state, status, arv, purchase_price')
        .in('status', ['under_contract', 'pending', 'active', 'closing'])
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const totalARV = (data || []).reduce((s, d) => s + Number(d.arv || 0), 0);

  return (
    <Card className="border-emerald-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-emerald-500" />
            Active Deals (Real Estate OS)
          </div>
          <Link to="/real-estate" className="text-xs text-muted-foreground hover:text-emerald-500 flex items-center gap-1">
            View <ExternalLink className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">No active RE deals</p>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active Deals</span>
              <span className="font-semibold">{data.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total ARV</span>
              <span className="font-semibold text-emerald-500">${totalARV.toLocaleString()}</span>
            </div>
            <div className="border-t border-border/50 pt-2 mt-2 space-y-1">
              {data.slice(0, 3).map(d => (
                <div key={d.id} className="flex items-center justify-between text-xs">
                  <span className="truncate max-w-[60%]">{d.property_address}, {d.city}</span>
                  <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
