import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, Users } from "lucide-react";
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

export default function HRInterviews() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    try {
      const { data, error } = await supabase
        .from("hr_interviews")
        .select(`
          *,
          applicant:hr_applicants(id, name, position),
          interviewer:profiles(id, name)
        `)
        .order("scheduled_for", { ascending: true });

      if (error) throw error;
      setInterviews(data || []);
    } catch (error) {
      console.error("Error fetching interviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case "pass":
        return "bg-green-500";
      case "fail":
        return "bg-red-500";
      case "pending":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

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
        <h1 className="text-3xl font-bold">Interviews</h1>
        <Button onClick={() => navigate("/hr")}>
          <Users className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled Interviews ({interviews.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Interviewer</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interviews.map((interview) => (
                <TableRow key={interview.id}>
                  <TableCell className="font-medium">
                    {interview.applicant?.name || "N/A"}
                  </TableCell>
                  <TableCell>{interview.applicant?.position || "N/A"}</TableCell>
                  <TableCell>{interview.interviewer?.name || "N/A"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {interview.scheduled_for
                          ? new Date(interview.scheduled_for).toLocaleDateString()
                          : "Not scheduled"}
                      </span>
                      <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                      <span>
                        {interview.scheduled_for
                          ? new Date(interview.scheduled_for).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getResultColor(interview.result || "pending")}>
                      {interview.result || "pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{interview.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
