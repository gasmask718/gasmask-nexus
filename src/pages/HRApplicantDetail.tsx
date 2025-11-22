import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, XCircle, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function HRApplicantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [applicant, setApplicant] = useState<any>(null);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplicantDetails();
  }, [id]);

  const fetchApplicantDetails = async () => {
    try {
      // Fetch applicant
      const { data: applicantData, error: applicantError } = await supabase
        .from("hr_applicants")
        .select("*")
        .eq("id", id)
        .single();

      if (applicantError) throw applicantError;

      // Fetch interviews
      const { data: interviewsData } = await supabase
        .from("hr_interviews")
        .select("*, interviewer:profiles(name)")
        .eq("applicant_id", id);

      // Fetch documents
      const { data: documentsData } = await supabase
        .from("hr_documents")
        .select("*")
        .eq("applicant_id", id);

      setApplicant(applicantData);
      setInterviews(interviewsData || []);
      setDocuments(documentsData || []);
      setNotes(applicantData?.notes || "");
    } catch (error) {
      console.error("Error fetching applicant details:", error);
      toast.error("Failed to load applicant details");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from("hr_applicants")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Applicant ${newStatus}`);
      fetchApplicantDetails();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleSaveNotes = async () => {
    try {
      const { error } = await supabase
        .from("hr_applicants")
        .update({ notes })
        .eq("id", id);

      if (error) throw error;
      toast.success("Notes saved");
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Failed to save notes");
    }
  };

  const handleHireApplicant = async () => {
    try {
      // Create employee record
      const { data: newEmployee, error: employeeError } = await supabase
        .from("hr_employees")
        .insert({
          full_name: applicant.name,
          phone: applicant.phone,
          email: applicant.email,
          job_title: applicant.position,
          status: "active",
          start_date: new Date().toISOString().split("T")[0],
        })
        .select()
        .single();

      if (employeeError) throw employeeError;

      // Create default onboarding tasks
      const onboardingTasks = [
        { task: "Complete I-9 Form", due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
        { task: "Submit W-4 Form", due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
        { task: "Watch Training Videos", due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
        { task: "Meet with Manager", due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
      ];

      for (const task of onboardingTasks) {
        await supabase.from("hr_onboarding_tasks").insert({
          employee_id: newEmployee.id,
          ...task,
        });
      }

      // Update applicant status
      await handleUpdateStatus("approved");

      toast.success("Applicant hired successfully!");
      navigate(`/hr/employees/${newEmployee.id}`);
    } catch (error) {
      console.error("Error hiring applicant:", error);
      toast.error("Failed to hire applicant");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!applicant) {
    return (
      <div className="container mx-auto p-6">
        <p>Applicant not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={() => navigate("/hr/applicants")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Applicants
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleUpdateStatus("interview")}>
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Interview
          </Button>
          <Button variant="outline" onClick={() => handleUpdateStatus("rejected")}>
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button onClick={handleHireApplicant}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Hire Applicant
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{applicant.name}</CardTitle>
              <p className="text-muted-foreground mt-1">{applicant.position}</p>
            </div>
            <Badge className={applicant.status === "approved" ? "bg-green-500" : ""}>
              {applicant.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{applicant.email || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{applicant.phone || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">City</p>
              <p className="font-medium">{applicant.city || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">State</p>
              <p className="font-medium">{applicant.state || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Applied Date</p>
              <p className="font-medium">{new Date(applicant.created_at).toLocaleDateString()}</p>
            </div>
            {applicant.ai_screening_score && (
              <div>
                <p className="text-sm text-muted-foreground">AI Screening Score</p>
                <p className="font-medium">{applicant.ai_screening_score}/100</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="interviews">Interviews ({interviews.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Notes & AI Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {applicant.ai_screening_summary && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">AI Screening Summary</p>
                  <p className="text-sm">{applicant.ai_screening_summary}</p>
                </div>
              )}
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this applicant..."
                rows={6}
              />
              <Button onClick={handleSaveNotes}>Save Notes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interviews">
          <Card>
            <CardHeader>
              <CardTitle>Interview History</CardTitle>
            </CardHeader>
            <CardContent>
              {interviews.length === 0 ? (
                <p className="text-muted-foreground">No interviews scheduled yet</p>
              ) : (
                <div className="space-y-4">
                  {interviews.map((interview) => (
                    <div key={interview.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            Scheduled: {new Date(interview.scheduled_for).toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Interviewer: {interview.interviewer?.name || "N/A"}
                          </p>
                          <p className="text-sm mt-2">{interview.notes}</p>
                        </div>
                        <Badge className={interview.result === "pass" ? "bg-green-500" : ""}>
                          {interview.result || "pending"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-muted-foreground">No documents uploaded yet</p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 p-2 border rounded">
                      <FileText className="h-4 w-4" />
                      <span className="flex-1">{doc.document_name}</span>
                      <Badge>{doc.document_type}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
