/**
 * StaffDocumentsTab
 * 
 * SYSTEM LAW: Tabs are views into data, not decorations.
 * Store and manage staff-specific documents.
 * Files must be scoped to the staff member, not global.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, Upload, Download, Trash2, Eye, Calendar, 
  AlertCircle, CheckCircle, Clock, File
} from "lucide-react";
import { useStaffDocuments, UTStaffDocument, useDeleteStaffDocument } from '@/hooks/useUnforgettableStaffTabs';
import { format, parseISO, isPast, isFuture, differenceInDays } from 'date-fns';

interface StaffDocumentsTabProps {
  staffId: string;
}

export default function StaffDocumentsTab({ staffId }: StaffDocumentsTabProps) {
  const { data: documents, isLoading, error } = useStaffDocuments(staffId);
  const deleteDocument = useDeleteStaffDocument();

  const getDocTypeBadge = (type: UTStaffDocument['document_type']) => {
    const config: Record<string, { class: string; label: string }> = {
      contract: { class: 'bg-pink-500/10 text-pink-600 border-pink-500/20', label: 'Contract' },
      id: { class: 'bg-blue-500/10 text-blue-600 border-blue-500/20', label: 'ID' },
      certification: { class: 'bg-purple-500/10 text-purple-600 border-purple-500/20', label: 'Certification' },
      agreement: { class: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', label: 'Agreement' },
      tax_form: { class: 'bg-amber-500/10 text-amber-600 border-amber-500/20', label: 'Tax Form' },
      background_check: { class: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20', label: 'Background Check' },
      other: { class: 'bg-gray-500/10 text-gray-600 border-gray-500/20', label: 'Other' },
    };
    const { class: className, label } = config[type] || config.other;
    return <Badge variant="outline" className={className}>{label}</Badge>;
  };

  const getStatusBadge = (status: UTStaffDocument['status'], expiryDate: string | null) => {
    // Check expiry
    if (expiryDate) {
      const expiry = parseISO(expiryDate);
      const daysUntilExpiry = differenceInDays(expiry, new Date());
      
      if (isPast(expiry)) {
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Expired
          </Badge>
        );
      }
      if (daysUntilExpiry <= 30) {
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Expiring Soon
          </Badge>
        );
      }
    }

    const config: Record<string, { class: string; icon: React.ReactNode; label: string }> = {
      active: { class: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: <CheckCircle className="h-3 w-3" />, label: 'Active' },
      expired: { class: 'bg-red-500/10 text-red-600 border-red-500/20', icon: <AlertCircle className="h-3 w-3" />, label: 'Expired' },
      archived: { class: 'bg-gray-500/10 text-gray-600 border-gray-500/20', icon: <File className="h-3 w-3" />, label: 'Archived' },
      pending_review: { class: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: <Clock className="h-3 w-3" />, label: 'Pending Review' },
    };
    const { class: className, icon, label } = config[status] || config.active;
    return (
      <Badge variant="outline" className={`${className} flex items-center gap-1`}>
        {icon}
        {label}
      </Badge>
    );
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDelete = async (docId: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      await deleteDocument.mutateAsync({ id: docId, staffId });
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-pink-500" />
            Documents & Files
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load documents</p>
        </CardContent>
      </Card>
    );
  }

  // Group documents by type
  const documentsByType = documents?.reduce((acc, doc) => {
    if (!acc[doc.document_type]) acc[doc.document_type] = [];
    acc[doc.document_type].push(doc);
    return acc;
  }, {} as Record<string, UTStaffDocument[]>) || {};

  // Check for expiring documents
  const expiringDocs = documents?.filter(doc => {
    if (!doc.expiry_date) return false;
    const daysUntil = differenceInDays(parseISO(doc.expiry_date), new Date());
    return daysUntil > 0 && daysUntil <= 30;
  }) || [];

  const expiredDocs = documents?.filter(doc => {
    if (!doc.expiry_date) return false;
    return isPast(parseISO(doc.expiry_date));
  }) || [];

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {(expiringDocs.length > 0 || expiredDocs.length > 0) && (
        <div className="space-y-2">
          {expiredDocs.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-600">
                  {expiredDocs.length} document{expiredDocs.length > 1 ? 's' : ''} expired
                </p>
                <p className="text-xs text-muted-foreground">
                  {expiredDocs.map(d => d.document_name).join(', ')}
                </p>
              </div>
            </div>
          )}
          {expiringDocs.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Clock className="h-5 w-5 text-amber-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-600">
                  {expiringDocs.length} document{expiringDocs.length > 1 ? 's' : ''} expiring soon
                </p>
                <p className="text-xs text-muted-foreground">
                  {expiringDocs.map(d => d.document_name).join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Button */}
      <Button variant="outline">
        <Upload className="h-4 w-4 mr-2" />
        Upload Document
      </Button>

      {/* Documents List */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-pink-500" />
            Documents ({documents?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!documents || documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium mb-1">No documents uploaded</p>
              <p className="text-sm">Upload contracts, IDs, certifications, and other documents.</p>
              <Button variant="outline" size="sm" className="mt-4">
                <Upload className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-pink-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{doc.document_name}</span>
                      {getDocTypeBadge(doc.document_type)}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(doc.uploaded_at), 'MMM d, yyyy')}
                      </span>
                      <span>{formatFileSize(doc.file_size)}</span>
                      {doc.expiry_date && (
                        <span className="flex items-center gap-1">
                          Expires: {format(parseISO(doc.expiry_date), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(doc.status, doc.expiry_date)}
                    <Button variant="ghost" size="icon" disabled={!doc.file_url}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={!doc.file_url}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleteDocument.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
