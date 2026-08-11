import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Upload, CheckCircle, AlertCircle, Loader2,
  FolderOpen, Package, Plus, Eye
} from "lucide-react";

/** Documents live in a PRIVATE bucket — access is always via short-lived signed URLs. */
const SIGNED_URL_TTL_SECONDS = 120;


interface DocumentVaultProps {
  clientId: string;
  readOnly?: boolean;
}

const DOCUMENT_CATEGORIES = {
  identity: {
    label: "Identity Documents",
    docs: [
      { type: "dl_front", name: "Driver License (Front)", required: true },
      { type: "dl_back", name: "Driver License (Back)", required: true },
      { type: "ssn_card", name: "Social Security Card", required: true },
      { type: "passport", name: "Passport", required: false },
      { type: "utility_bill", name: "Utility Bill (Address Verification)", required: true },
    ],
  },
  business: {
    label: "Business Documents",
    docs: [
      { type: "articles_of_inc", name: "Articles of Incorporation", required: true },
      { type: "ein_letter", name: "EIN Confirmation Letter", required: true },
      { type: "business_license", name: "Business License", required: true },
      { type: "registered_agent", name: "Registered Agent Confirmation", required: true },
      { type: "duns_confirm", name: "DUNS Number Confirmation", required: true },
      { type: "411_listing", name: "411 Directory Listing Screenshot", required: true },
      { type: "biz_bank_stmt", name: "Business Bank Statement (Most Recent)", required: true },
    ],
  },
  financial: {
    label: "Financial Documents",
    docs: [
      { type: "personal_tax_y1", name: "Personal Tax Return (Year 1)", required: true },
      { type: "personal_tax_y2", name: "Personal Tax Return (Year 2)", required: true },
      { type: "business_tax_y1", name: "Business Tax Return (Year 1)", required: true },
      { type: "business_tax_y2", name: "Business Tax Return (Year 2)", required: true },
      { type: "personal_bank_3m", name: "Personal Bank Statements (3 Months)", required: true },
      { type: "business_bank_3m", name: "Business Bank Statements (3 Months)", required: true },
      { type: "pnl_statement", name: "Profit & Loss Statement", required: true },
      { type: "balance_sheet", name: "Balance Sheet", required: true },
    ],
  },
};

export default function DocumentVault({ clientId, readOnly = false }: DocumentVaultProps) {
  const queryClient = useQueryClient();
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [packageName, setPackageName] = useState("");
  const [selectedPackageDocs, setSelectedPackageDocs] = useState<string[]>([]);

  const { data: documents = [] } = useQuery({
    queryKey: ["funding-documents", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funding_client_documents")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const allRequiredDocs = Object.values(DOCUMENT_CATEGORIES).flatMap(cat => cat.docs.filter(d => d.required));
  const uploadedTypes = new Set(documents.map((d) => d.document_type));
  const completedRequired = allRequiredDocs.filter(d => uploadedTypes.has(d.type)).length;
  const completionPct = allRequiredDocs.length > 0 ? Math.round((completedRequired / allRequiredDocs.length) * 100) : 0;

  const getDocForType = (type: string) => documents.find((d) => d.document_type === type);

  const openDocument = async (filePath: string) => {
    if (!filePath) {
      toast.error("This entry has no stored file");
      return;
    }
    const { data, error } = await supabase.storage
      .from("funding-documents")
      .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || "You are not authorized to view this document");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleUpload = async (docType: string, displayName: string, file: File) => {

    setUploadingType(docType);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${docType}.${fileExt}`;
      const category = Object.entries(DOCUMENT_CATEGORIES).find(([_, cat]) => cat.docs.some(d => d.type === docType))?.[0] || "misc";
      const storagePath = `${clientId}/${category}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("funding-documents").upload(storagePath, file);
      if (uploadError) throw uploadError;

      // Remove existing doc of this type
      const existing = getDocForType(docType);
      if (existing) {
        await supabase.from("funding_client_documents").delete().eq("id", existing.id);
      }

      const { error: insertError } = await supabase.from("funding_client_documents").insert({
        client_id: clientId,
        document_type: docType,
        file_name: displayName,
        file_path: storagePath,
      });
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["funding-documents", clientId] });
      toast.success(`${displayName} uploaded`);
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploadingType(null);
    }
  };

  const createPackage = async () => {
    if (!packageName || selectedPackageDocs.length === 0) return;
    try {
      const { error } = await supabase.from("funding_client_documents").insert({
        client_id: clientId,
        document_type: "lender_package",
        file_name: packageName,
        file_path: "",
        notes: JSON.stringify({ document_ids: selectedPackageDocs, created_at: new Date().toISOString() }),
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["funding-documents", clientId] });
      toast.success(`Package "${packageName}" created`);
      setShowPackageModal(false);
      setPackageName("");
      setSelectedPackageDocs([]);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const lenderPackages = documents.filter((d) => d.document_type === "lender_package");

  return (
    <div className="space-y-6">
      {/* Completion Bar */}
      <Card className="border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Vault Completion</span>
            <span className="text-sm font-bold text-amber-400">{completionPct}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${completionPct >= 80 ? "bg-emerald-500" : completionPct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {completedRequired} of {allRequiredDocs.length} required documents uploaded
          </p>
        </CardContent>
      </Card>

      {/* Document Categories */}
      <Accordion type="multiple" defaultValue={["identity", "business", "financial"]}>
        {Object.entries(DOCUMENT_CATEGORIES).map(([key, category]) => (
          <AccordionItem key={key} value={key} className="border-border/30">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-amber-500" />
                {category.label}
                <Badge variant="outline" className="text-xs ml-2">
                  {category.docs.filter(d => uploadedTypes.has(d.type)).length}/{category.docs.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {category.docs.map((doc) => {
                  const uploaded = getDocForType(doc.type);
                  const isUploading = uploadingType === doc.type;
                  return (
                    <div key={doc.type} className={`flex items-center justify-between p-3 rounded-lg border ${uploaded ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/30 bg-muted/10"}`}>
                      <div className="flex items-center gap-3">
                        {uploaded ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-400" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{doc.name}</p>
                          {uploaded && (
                            <p className="text-xs text-muted-foreground">
                              Uploaded {new Date(uploaded.created_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${doc.required ? "border-red-500/30 text-red-400" : "border-muted text-muted-foreground"}`}>
                          {doc.required ? "Required" : "Optional"}
                        </Badge>
                        {!readOnly && (
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUpload(doc.type, doc.name, file);
                                e.target.value = "";
                              }}
                              disabled={isUploading}
                            />
                            <Button variant="outline" size="sm" asChild>
                              <span>
                                {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                                {uploaded ? "Replace" : "Upload"}
                              </span>
                            </Button>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Lender Packages */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-500" />
              Lender Packages
            </div>
            {!readOnly && (
              <Button size="sm" onClick={() => setShowPackageModal(true)} className="bg-gradient-to-r from-amber-600 to-yellow-500 text-black">
                <Plus className="h-3 w-3 mr-1" /> Create Package
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lenderPackages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No lender packages created yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lenderPackages.map((pkg) => {
                const pkgInfo = pkg.notes ? JSON.parse(pkg.notes) : {};
                const docIds = pkgInfo.document_ids || [];
                return (
                  <Card key={pkg.id} className="border-border/30">
                    <CardContent className="p-4">
                      <p className="font-medium">{pkg.file_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{docIds.length} documents included</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Package Creation Modal */}
      {showPackageModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowPackageModal(false)}>
          <Card className="w-full max-w-md border-amber-500/20" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Create Lender Package</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Package Name</Label>
                <Input placeholder="e.g. Chase Business Line Package" value={packageName} onChange={(e) => setPackageName(e.target.value)} />
              </div>
              <div>
                <Label>Select Documents to Include</Label>
                <div className="space-y-1 max-h-60 overflow-y-auto mt-2">
                  {documents.filter((d) => d.document_type !== "lender_package").map((doc) => (
                    <label key={doc.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPackageDocs.includes(doc.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPackageDocs([...selectedPackageDocs, doc.id]);
                          else setSelectedPackageDocs(selectedPackageDocs.filter(id => id !== doc.id));
                        }}
                      />
                      <span className="text-sm">{doc.file_name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowPackageModal(false)}>Cancel</Button>
                <Button onClick={createPackage} disabled={!packageName || selectedPackageDocs.length === 0} className="bg-gradient-to-r from-amber-600 to-yellow-500 text-black">
                  Create Package
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
