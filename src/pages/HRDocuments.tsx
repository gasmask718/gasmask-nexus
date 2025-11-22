import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Eye, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function HRDocuments() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("hr_documents")
        .select(`
          *,
          staff:hr_staff(id, name),
          applicant:hr_applicants(id, name)
        `)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDocTypeColor = (docType: string) => {
    switch (docType) {
      case "id":
        return "bg-blue-500";
      case "contract":
        return "bg-green-500";
      case "w9":
        return "bg-purple-500";
      case "license":
        return "bg-orange-500";
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
        <h1 className="text-3xl font-bold">HR Documents</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/hr")}>Back to Dashboard</Button>
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Library ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Related To</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {doc.document_name}
                  </TableCell>
                  <TableCell>
                    <Badge className={getDocTypeColor(doc.document_type)}>
                      {doc.document_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {doc.staff?.name || doc.applicant?.name || "N/A"}
                  </TableCell>
                  <TableCell>
                    {doc.uploaded_at
                      ? new Date(doc.uploaded_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {doc.verified ? (
                      <Badge className="bg-green-500">Verified</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
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
