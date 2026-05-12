import { ReactNode, useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useSearchParams } from "react-router-dom";
import { useDPAdminStatus } from "@/hooks/useDPAdmin";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Users, TrendingUp, Layers, Megaphone,
  DollarSign, Power, Activity, Wrench, Bell, Shield, ArrowLeft, RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dp } from "@/lib/dpClient";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/partners", label: "Partners", icon: Users },
  { to: "/admin/mrr", label: "MRR", icon: TrendingUp },
  { to: "/admin/platforms", label: "Platforms", icon: Layers },
  { to: "/admin/recruitment", label: "Recruitment", icon: Megaphone },
  { to: "/admin/financials", label: "Financials", icon: DollarSign },
  { to: "/admin/controls", label: "Kill Switches", icon: Power },
  { to: "/admin/activity", label: "Activity", icon: Activity },
  { to: "/admin/manual", label: "Manual Tools", icon: Wrench },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
];

function ImpersonationBanner() {
  const [params, setParams] = useSearchParams();
  const partnerId = params.get("as");
  const { data: partner } = useQuery({
    queryKey: ["dp-impersonate", partnerId],
    queryFn: async () => {
      if (!partnerId) return null;
      const { data } = await dp().from("partners").select("id, full_name, email").eq("id", partnerId).maybeSingle();
      return data;
    },
    enabled: !!partnerId,
  });
  if (!partnerId || !partner) return null;
  return (
    <div className="bg-amber-500/15 border-b border-amber-500/40 px-4 py-2 flex items-center justify-between">
      <div className="text-sm">
        <span className="font-semibold text-amber-600">Viewing as:</span>{" "}
        <span className="font-medium">{partner.full_name}</span>{" "}
        <span className="text-muted-foreground">({partner.email})</span>{" "}
        <span className="text-xs text-muted-foreground">— read-only impersonation</span>
      </div>
      <Button size="sm" variant="outline" onClick={() => { params.delete("as"); setParams(params); }}>
        <ArrowLeft className="h-3 w-3 mr-1" /> Exit
      </Button>
    </div>
  );
}

export default function DPAdminLayout({ children }: { children?: ReactNode }) {
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading: roleLoading } = useIsDPAdmin();
  const queryClient = useQueryClient();
  const [debugAdminCheck, setDebugAdminCheck] = useState<boolean | null>(null);
  const [refreshingSession, setRefreshingSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkAdminDirectly = async () => {
      if (!user?.id || isAdmin !== false) {
        if (!cancelled) setDebugAdminCheck(null);
        return;
      }

      const { data, error } = await dp()
        .from("partner_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setDebugAdminCheck(!error && !!data);
      }
    };

    void checkAdminDirectly();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isAdmin]);

  const handleRefreshSession = async () => {
    setRefreshingSession(true);
    try {
      await supabase.auth.refreshSession();
      await queryClient.invalidateQueries({ queryKey: ["dp-is-admin"] });
    } finally {
      setRefreshingSession(false);
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <Shield className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Admin access required</h1>
          <p className="text-muted-foreground">
            Your account is not in <code className="text-xs">partners.partner_admins</code>.
            Ask David to grant you access.
          </p>
          {debugAdminCheck ? (
            <Button onClick={handleRefreshSession} disabled={refreshingSession}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshingSession ? "animate-spin" : ""}`} />
              Refresh session
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-destructive" />
            <h1 className="font-semibold text-lg">Dynasty Partners</h1>
            <Badge variant="destructive" className="uppercase tracking-wide">Admin</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {user.email}
          </div>
        </div>
        <ImpersonationBanner />
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-56 border-r bg-card/50 p-3 space-y-1 shrink-0">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                }`
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 overflow-auto p-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
