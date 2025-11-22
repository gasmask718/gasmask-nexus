import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, FileText, DollarSign, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function HR() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalApplicants: 0,
    interviewsThisWeek: 0,
    activeEmployees: 0,
    pendingOnboarding: 0,
    payrollDue: 0,
  });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Get applicants count
      const { count: applicantsCount } = await supabase
        .from("hr_applicants")
        .select("*", { count: "exact", head: true });

      // Get interviews this week
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 7);

      const { count: interviewsCount } = await supabase
        .from("hr_interviews")
        .select("*", { count: "exact", head: true })
        .gte("scheduled_for", startOfWeek.toISOString())
        .lte("scheduled_for", endOfWeek.toISOString());

      // Get active employees
      const { count: employeesCount } = await supabase
        .from("hr_employees")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Get pending onboarding tasks
      const { count: onboardingCount } = await supabase
        .from("hr_onboarding_tasks")
        .select("*", { count: "exact", head: true })
        .neq("status", "completed");

      // Get upcoming payroll
      const { count: payrollCount } = await supabase
        .from("hr_payroll")
        .select("*", { count: "exact", head: true })
        .lte("next_pay_date", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

      // Get recent notifications
      const { data: notificationsData } = await supabase
        .from("hr_notifications")
        .select("*")
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(5);

      setStats({
        totalApplicants: applicantsCount || 0,
        interviewsThisWeek: interviewsCount || 0,
        activeEmployees: employeesCount || 0,
        pendingOnboarding: onboardingCount || 0,
        payrollDue: payrollCount || 0,
      });

      setAlerts(notificationsData || []);
    } catch (error) {
      console.error("Error fetching HR dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Applicants",
      value: stats.totalApplicants,
      icon: Users,
      color: "text-blue-500",
      link: "/hr/applicants",
    },
    {
      title: "Interviews This Week",
      value: stats.interviewsThisWeek,
      icon: Calendar,
      color: "text-green-500",
      link: "/hr/interviews",
    },
    {
      title: "Active Employees",
      value: stats.activeEmployees,
      icon: Users,
      color: "text-purple-500",
      link: "/hr/employees",
    },
    {
      title: "Pending Onboarding",
      value: stats.pendingOnboarding,
      icon: FileText,
      color: "text-orange-500",
      link: "/hr/onboarding",
    },
    {
      title: "Payroll Due (7 Days)",
      value: stats.payrollDue,
      icon: DollarSign,
      color: "text-red-500",
      link: "/hr/payroll",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">HR Dashboard</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/hr/applicants")}>View Applicants</Button>
          <Button onClick={() => navigate("/hr/employees")} variant="outline">
            View Employees
          </Button>
        </div>
      </div>

      {/* AI Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            AI Alerts & Notifications
          </h2>
          {alerts.map((alert) => (
            <Alert key={alert.id}>
              <AlertDescription>
                <div className="flex justify-between items-start">
                  <div>
                    <strong>{alert.title}</strong>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await supabase
                        .from("hr_notifications")
                        .update({ read: true })
                        .eq("id", alert.id);
                      setAlerts(alerts.filter((a) => a.id !== alert.id));
                    }}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(stat.link)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button onClick={() => navigate("/hr/applicants")} variant="outline" className="h-20">
              <div className="flex flex-col items-center gap-2">
                <Users className="h-6 w-6" />
                <span className="text-xs">Review Applicants</span>
              </div>
            </Button>
            <Button onClick={() => navigate("/hr/interviews")} variant="outline" className="h-20">
              <div className="flex flex-col items-center gap-2">
                <Calendar className="h-6 w-6" />
                <span className="text-xs">Schedule Interview</span>
              </div>
            </Button>
            <Button onClick={() => navigate("/hr/documents")} variant="outline" className="h-20">
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-6 w-6" />
                <span className="text-xs">Upload Document</span>
              </div>
            </Button>
            <Button onClick={() => navigate("/hr/payroll")} variant="outline" className="h-20">
              <div className="flex flex-col items-center gap-2">
                <DollarSign className="h-6 w-6" />
                <span className="text-xs">Process Payroll</span>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
