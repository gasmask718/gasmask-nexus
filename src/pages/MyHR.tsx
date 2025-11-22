import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, CheckCircle, Clock, DollarSign } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function MyHR() {
  const [employee, setEmployee] = useState<any>(null);
  const [onboardingTasks, setOnboardingTasks] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyHRData();
  }, []);

  const fetchMyHRData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch employee record
      const { data: employeeData } = await supabase
        .from("hr_employees")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (employeeData) {
        setEmployee(employeeData);

        // Fetch onboarding tasks
        const { data: tasksData } = await supabase
          .from("hr_onboarding_tasks")
          .select("*")
          .eq("employee_id", employeeData.id)
          .order("due_date", { ascending: true });

        // Fetch documents
        const { data: documentsData } = await supabase
          .from("hr_documents")
          .select("*")
          .eq("staff_id", employeeData.id);

        // Fetch payroll
        const { data: payrollData } = await supabase
          .from("hr_payroll")
          .select("*")
          .eq("employee_id", employeeData.id)
          .single();

        setOnboardingTasks(tasksData || []);
        setDocuments(documentsData || []);
        setPayroll(payrollData);
      }
    } catch (error) {
      console.error("Error fetching HR data:", error);
    } finally {
      setLoading(false);
    }
  };

  const completedTasks = onboardingTasks.filter((t) => t.status === "completed").length;
  const onboardingProgress =
    onboardingTasks.length > 0 ? (completedTasks / onboardingTasks.length) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No employee record found. Please contact HR.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">My HR Portal</h1>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={employee.avatar_url} />
              <AvatarFallback>
                {employee.full_name
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-2xl">{employee.full_name}</CardTitle>
              <p className="text-muted-foreground mt-1">{employee.job_title}</p>
              {employee.department && (
                <p className="text-sm text-muted-foreground mt-1">{employee.department}</p>
              )}
              <Badge className="mt-2 bg-green-500">{employee.status}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{employee.email || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{employee.phone || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p className="font-medium">
                {employee.start_date ? new Date(employee.start_date).toLocaleDateString() : "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onboarding Progress</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onboardingProgress.toFixed(0)}%</div>
            <Progress value={onboardingProgress} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {completedTasks} of {onboardingTasks.length} tasks completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
            <p className="text-xs text-muted-foreground mt-2">Uploaded files</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pay Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${payroll?.pay_rate || "—"}
              {payroll?.pay_type === "hourly" ? "/hr" : ""}
            </div>
            <p className="text-xs text-muted-foreground mt-2 capitalize">
              {payroll?.pay_type || "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tasks">My Tasks</TabsTrigger>
          <TabsTrigger value="documents">My Documents</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Info</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>My Onboarding Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {onboardingTasks.length === 0 ? (
                <p className="text-muted-foreground">No tasks assigned</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {onboardingTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>{task.task}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              task.status === "completed" ? "bg-green-500" : "bg-yellow-500"
                            }
                          >
                            {task.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>My Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-muted-foreground">No documents uploaded</p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 p-3 border rounded">
                      <FileText className="h-5 w-5" />
                      <div className="flex-1">
                        <p className="font-medium">{doc.document_name}</p>
                        <p className="text-sm text-muted-foreground">{doc.document_type}</p>
                      </div>
                      {doc.verified && <Badge className="bg-green-500">Verified</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Information</CardTitle>
            </CardHeader>
            <CardContent>
              {payroll ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Pay Type</p>
                    <p className="font-medium capitalize">{payroll.pay_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pay Rate</p>
                    <p className="font-medium">
                      ${payroll.pay_rate}
                      {payroll.pay_type === "hourly" ? "/hr" : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Pay Date</p>
                    <p className="font-medium">
                      {payroll.last_pay_date
                        ? new Date(payroll.last_pay_date).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Next Pay Date</p>
                    <p className="font-medium">
                      {payroll.next_pay_date
                        ? new Date(payroll.next_pay_date).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No payroll information available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
