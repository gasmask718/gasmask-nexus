import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, Download, Calendar, User, CheckCircle, AlertCircle, Clock } from 'lucide-react';

const SIMULATED_DOCUMENTS = {
  'doc-001': {
    id: 'doc-001',
    title: 'Event Coordinator Contract',
    type: 'contract',
    status: 'active',
    staffName: 'Maria Garcia',
    staffId: 'stf-001',
    uploadedAt: 'Nov 15, 2025',
    expiresAt: 'Nov 15, 2026',
    description: 'Standard employment contract for event coordination services.',
    fileSize: '245 KB',
  },
  'doc-002': {
    id: 'doc-002',
    title: 'Food Handling Certification',
    type: 'certification',
    status: 'active',
    staffName: 'Sarah Chen',
    staffId: 'stf-003',
    uploadedAt: 'Oct 1, 2025',
    expiresAt: 'Oct 1, 2027',
    description: 'ServSafe Food Handler certification for catering events.',
    fileSize: '128 KB',
  },
  'doc-003': {
    id: 'doc-003',
    title: 'Security License',
    type: 'certification',
    status: 'expiring_soon',
    staffName: 'John Smith',
    staffId: 'stf-011',
    uploadedAt: 'Jan 5, 2024',
    expiresAt: 'Jan 5, 2026',
    description: 'State security guard license for event security services.',
    fileSize: '89 KB',
  },
};

const DEFAULT_DOCUMENT = {
  id: 'doc-default',
  title: 'Document',
  type: 'document',
  status: 'active',
  staffName: 'Staff Member',
  staffId: 'stf-000',
  uploadedAt: 'Dec 1, 2025',
  expiresAt: 'Dec 1, 2026',
  description: 'Document details will be displayed here.',
  fileSize: '100 KB',
};

export default function UnforgettableDocumentDetail() {
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();
  
  const document = SIMULATED_DOCUMENTS[documentId as keyof typeof SIMULATED_DOCUMENTS] || DEFAULT_DOCUMENT;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'expiring_soon':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            Expiring Soon
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'contract':
        return <Badge variant="secondary">Contract</Badge>;
      case 'certification':
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">Certification</Badge>;
      case 'license':
        return <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">License</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/unforgettable/documents')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{document.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            {getTypeBadge(document.type)}
            {getStatusBadge(document.status)}
          </div>
        </div>
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
          Simulated Data
        </Badge>
      </div>

      {/* Document Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-pink-500" />
              Document Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Description</p>
              <p>{document.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Uploaded</p>
                <p className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {document.uploadedAt}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Expires</p>
                <p className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {document.expiresAt}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">File Size</p>
              <p>{document.fileSize}</p>
            </div>

            {/* Document Preview Placeholder */}
            <div className="border-2 border-dashed border-border rounded-lg p-12 text-center bg-muted/20">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Document preview would appear here</p>
              <Button variant="outline" className="mt-4">
                <Download className="h-4 w-4 mr-2" />
                Download Document
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Staff Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-pink-500" />
              Associated Staff
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="p-4 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
              onClick={() => navigate(`/os/unforgettable/staff/${document.staffId}`)}
            >
              <p className="font-medium">{document.staffName}</p>
              <p className="text-sm text-muted-foreground">View Profile →</p>
            </div>

            <div className="mt-6 space-y-3">
              <Button className="w-full" variant="outline" onClick={() => navigate(`/os/unforgettable/staff/${document.staffId}`)}>
                View Staff Profile
              </Button>
              <Button className="w-full" variant="outline" onClick={() => navigate(`/os/unforgettable/payroll/${document.staffId}`)}>
                View Payroll
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
