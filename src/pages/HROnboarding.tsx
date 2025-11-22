import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

export default function HROnboarding() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
  });

  useEffect(() => {
    fetchOnboardingTasks();
  }, []);

  const fetchOnboardingTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("hr_onboarding_tasks")
        .select(`
          *,
          employee:hr_employees(id, full_name, job_title)
        `)
        .order("due_date", { ascending: true });

      if (error) throw error;

      const today = new Date();
      const completed = data?.filter((t) => t.status === "completed").length || 0;
      const pending = data?.filter((t) => t.status === "pending").length || 0;
      const overdue =
        data?.filter(
          (t) => t.status !== "completed" && t.due_date && new Date(t.due_date) < today
        ).length || 0;

      setStats({
        total: data?.length || 0,
        completed,
        pending,
        overdue,
      });

      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching onboarding tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "in_progress":
        return "bg-blue-500";
      case "pending":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === "completed") return false;
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

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
        <h1 className="text-3xl font-bold">Onboarding Management</h1>
        <Button onClick={() => navigate("/hr")}>Back to Dashboard</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdue}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overall Completion Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress value={completionRate} />
            <p className="text-sm text-muted-foreground">
              {completionRate.toFixed(1)}% of all onboarding tasks completed
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Onboarding Tasks ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow
                  key={task.id}
                  className={
                    isOverdue(task.due_date, task.status) ? "bg-red-50 dark:bg-red-950/20" : ""
                  }
                >
                  <TableCell className="font-medium">
                    <div>
                      <div>{task.employee?.full_name || "N/A"}</div>
                      <div className="text-sm text-muted-foreground">
                        {task.employee?.job_title || ""}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{task.task}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {task.due_date ? (
                      <div className="flex items-center gap-2">
                        {isOverdue(task.due_date, task.status) && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        {new Date(task.due_date).toLocaleDateString()}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {task.completed_at
                      ? new Date(task.completed_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
