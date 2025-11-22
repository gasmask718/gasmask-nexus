import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function HoldingsTenants() {
  const [rentRoll, setRentRoll] = useState<any[]>([]);
  const [expiringLeases, setExpiringLeases] = useState<any[]>([]);
  const [vacancies, setVacancies] = useState<any[]>([]);

  useEffect(() => {
    fetchTenantData();
  }, []);

  const fetchTenantData = async () => {
    try {
      const { data: rentData } = await supabase
        .from("holdings_rent_roll")
        .select(`
          *,
          holdings_assets(name, address, city, state)
        `)
        .order("lease_end_date", { ascending: true });

      if (rentData) {
        setRentRoll(rentData);

        // Find expiring leases (within 90 days)
        const ninetyDaysFromNow = new Date();
        ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

        const expiring = rentData.filter((lease) => {
          if (!lease.lease_end_date) return false;
          const endDate = new Date(lease.lease_end_date);
          return endDate <= ninetyDaysFromNow && lease.status === "occupied";
        });
        setExpiringLeases(expiring);

        // Find vacancies
        const vacant = rentData.filter((lease) => lease.status === "vacant");
        setVacancies(vacant);
      }
    } catch (error) {
      console.error("Error fetching tenant data:", error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      occupied: "bg-green-500",
      vacant: "bg-red-500",
      notice_to_vacate: "bg-orange-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const getTenantTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      residential: "default",
      retail: "secondary",
      office: "outline",
      industrial: "default",
      your_own_business: "destructive",
    };
    return colors[type] || "default";
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Tenant & Lease Center</h1>
        <p className="text-muted-foreground">Manage tenants and lease agreements</p>
      </div>

      {/* AI Suggestions */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            AI Lease Management Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Rent Adjustments</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Unit 3A: Increase rent by 5% on renewal (market rate is 8% higher)</li>
              <li>• Warehouse Bay 2: Maintain current rate (competitive with market)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Own Business Conversions</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Warehouse on 5th Ave: Perfect for GasMask inventory storage</li>
              <li>• Office Suite 200: Ideal for TopTier management HQ</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Units</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rentRoll.length}</div>
            <p className="text-xs text-muted-foreground">
              {rentRoll.filter((r) => r.status === "occupied").length} occupied
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{expiringLeases.length}</div>
            <p className="text-xs text-muted-foreground">Within 90 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vacancies</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{vacancies.length}</div>
            <p className="text-xs text-muted-foreground">Available for rent</p>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Leases Alert */}
      {expiringLeases.length > 0 && (
        <Card className="border-orange-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <Calendar className="h-5 w-5" />
              Leases Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expiringLeases.map((lease) => (
                <div key={lease.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{lease.unit_identifier}</div>
                    <div className="text-sm text-muted-foreground">
                      {lease.holdings_assets?.name} - {lease.tenant_name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-orange-600">
                      Expires: {lease.lease_end_date ? formatDate(lease.lease_end_date) : "N/A"}
                    </div>
                    <div className="text-sm text-muted-foreground">{formatCurrency(lease.monthly_rent)}/mo</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Leases */}
      <Card>
        <CardHeader>
          <CardTitle>All Leases & Units</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rentRoll.map((lease) => (
              <div key={lease.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{lease.unit_identifier}</span>
                      <Badge className={getStatusColor(lease.status)}>{lease.status}</Badge>
                      <Badge variant={getTenantTypeColor(lease.tenant_type) as any}>
                        {lease.tenant_type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {lease.holdings_assets?.name} • {lease.holdings_assets?.city}, {lease.holdings_assets?.state}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{formatCurrency(lease.monthly_rent)}</div>
                    <div className="text-xs text-muted-foreground">per month</div>
                  </div>
                </div>

                {lease.status === "occupied" && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t text-sm">
                    <div>
                      <div className="text-muted-foreground">Tenant</div>
                      <div className="font-medium">{lease.tenant_name || "N/A"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Lease Start</div>
                      <div className="font-medium">
                        {lease.lease_start_date ? formatDate(lease.lease_start_date) : "N/A"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Lease End</div>
                      <div className="font-medium">
                        {lease.lease_end_date ? formatDate(lease.lease_end_date) : "N/A"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Payment Day</div>
                      <div className="font-medium">Day {lease.payment_day || "N/A"}</div>
                    </div>
                  </div>
                )}

                {lease.status === "vacant" && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4" />
                      <span>Available for rent - Market this unit to potential tenants</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {rentRoll.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No lease data yet. Add units and tenants to get started.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
