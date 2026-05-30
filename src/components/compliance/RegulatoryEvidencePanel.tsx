import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  useEvidencePacks, 
  useGenerateEvidencePack,
  useCertifyEvidencePack,
  PACK_TYPES
} from "@/hooks/useRegulatoryEvidence";
import { 
  FileCheck, 
  Download,
  Shield,
  CheckCircle2,
  Clock,
  Award,
  FileJson,
  FileText,
  Table
} from "lucide-react";
import { format } from "date-fns";

interface Props {
  businessId: string | null;
}

export function RegulatoryEvidencePanel({ businessId }: Props) {
  const [selectedPackType, setSelectedPackType] = useState('full_compliance_pack');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedPack, setSelectedPack] = useState<string | null>(null);

  const { data: packs, isLoading } = useEvidencePacks(businessId);
  const generatePack = useGenerateEvidencePack();
  const certifyPack = useCertifyEvidencePack();

  const handleGenerate = () => {
    if (!businessId) return;
    generatePack.mutate({
      businessId,
      packType: selectedPackType,
      dateRangeStart: dateRange.start,
      dateRangeEnd: dateRange.end
    });
  };

  const selectedPackData = packs?.find(p => p.id === selectedPack);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileCheck className="h-6 w-6" />
            Regulatory Evidence Generator
          </h2>
          <p className="text-muted-foreground">
            One-click compliance proofs for regulators and auditors
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generator Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generate Evidence Pack</CardTitle>
            <CardDescription>Create certified compliance documentation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Pack Type</Label>
              <Select value={selectedPackType} onValueChange={setSelectedPackType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PACK_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range Start</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(d => ({ ...d, start: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Date Range End</Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(d => ({ ...d, end: e.target.value }))}
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleGenerate}
              disabled={generatePack.isPending || !businessId}
            >
              {generatePack.isPending ? (
                <>Generating...</>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Generate Evidence Pack
                </>
              )}
            </Button>

            <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
              <div className="font-medium">Pack Contents:</div>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Hash-verified audit logs</li>
                <li>Timestamped policy records</li>
                <li>System mode documentation</li>
                <li>Human approval signatures</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Generated Packs List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evidence Packs</CardTitle>
            <CardDescription>{packs?.length || 0} packs generated</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : packs?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No evidence packs generated yet
                  </div>
                ) : (
                  packs?.map(pack => (
                    <div
                      key={pack.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPack === pack.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedPack(pack.id)}
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant={pack.is_certified ? 'default' : 'secondary'}>
                          {pack.is_certified ? (
                            <><Award className="h-3 w-3 mr-1" /> Certified</>
                          ) : (
                            <><Clock className="h-3 w-3 mr-1" /> Pending</>
                          )}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(pack.generated_at), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      <div className="font-medium mt-2 text-sm">
                        {PACK_TYPES.find(t => t.value === pack.pack_type)?.label || pack.pack_type}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {pack.date_range_start && pack.date_range_end && (
                          <>
                            {format(new Date(pack.date_range_start), 'MMM d, yyyy')} - {format(new Date(pack.date_range_end), 'MMM d, yyyy')}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Pack Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pack Details</CardTitle>
            <CardDescription>
              {selectedPackData ? 'View and certify evidence' : 'Select a pack'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedPackData ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Select an evidence pack to view details
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm font-medium mb-2">Summary</div>
                  <div className="text-2xl font-bold">
                    {selectedPackData.pack_data?.summary?.title || 'Evidence Pack'}
                  </div>
                  {selectedPackData.pack_data?.summary?.overall_compliance && (
                    <Badge className="mt-2 bg-green-500">
                      {selectedPackData.pack_data.summary.overall_compliance}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Policy Version</div>
                    <div className="font-mono">{selectedPackData.policy_version || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">System Mode</div>
                    <div className="capitalize">{selectedPackData.system_mode_at_generation || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Log Hashes</div>
                    <div>{selectedPackData.log_hashes?.length || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Pack Hash</div>
                    <div className="font-mono text-xs truncate">{selectedPackData.row_hash || 'N/A'}</div>
                  </div>
                </div>

                {!selectedPackData.is_certified && (
                  <Button 
                    className="w-full"
                    onClick={() => certifyPack.mutate({ packId: selectedPackData.id })}
                    disabled={certifyPack.isPending}
                  >
                    <Award className="h-4 w-4 mr-2" />
                    Certify Evidence Pack
                  </Button>
                )}

                {selectedPackData.is_certified && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <div className="font-medium text-green-500">Certified</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedPackData.certified_at && format(new Date(selectedPackData.certified_at), 'MMM d, yyyy HH:mm')}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" size="sm">
                    <FileText className="h-4 w-4 mr-1" />
                    PDF
                  </Button>
                  <Button variant="outline" className="flex-1" size="sm">
                    <FileJson className="h-4 w-4 mr-1" />
                    JSON
                  </Button>
                  <Button variant="outline" className="flex-1" size="sm">
                    <Table className="h-4 w-4 mr-1" />
                    CSV
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}