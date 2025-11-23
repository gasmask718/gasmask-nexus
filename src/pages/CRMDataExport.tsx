import { useState } from 'react';
import { useBusiness } from '@/contexts/BusinessContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { 
  Download, FileJson, FileSpreadsheet, FileText, 
  Loader2, CheckCircle2, XCircle, Clock 
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

const CRMDataExport = () => {
  const { currentBusiness } = useBusiness();
  const { toast } = useToast();
  const [exportType, setExportType] = useState<string>('contacts');
  const [format, setFormat] = useState<string>('csv');
  const [includeFilters, setIncludeFilters] = useState({
    includeArchived: false,
    includeDeleted: false,
  });
  const [isExporting, setIsExporting] = useState(false);

  const { data: exports, refetch } = useQuery({
    queryKey: ['crm-exports', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];
      
      const { data, error } = await supabase
        .from('crm_exports')
        .select('*, created_by_profile:profiles!crm_exports_created_by_fkey(name)')
        .eq('business_id', currentBusiness.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentBusiness?.id,
  });

  const handleExport = async () => {
    if (!currentBusiness?.id) return;

    setIsExporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create export record
      const { data: exportRecord, error: createError } = await supabase
        .from('crm_exports')
        .insert({
          business_id: currentBusiness.id,
          created_by: user.id,
          export_type: exportType,
          format: format,
          status: 'processing',
          filters: includeFilters,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Fetch data based on export type
      let data: any = null;
      let recordCount = 0;

      if (exportType === 'contacts') {
        const { data: contacts, error } = await supabase
          .from('crm_contacts')
          .select('*')
          .eq('business_id', currentBusiness.id);
        if (error) throw error;
        data = contacts || [];
        recordCount = data.length;
      } else if (exportType === 'logs') {
        const { data: logs, error } = await supabase
          .from('communication_logs')
          .select('*, contact:crm_contacts(name), store:stores(name)')
          .eq('business_id', currentBusiness.id);
        if (error) throw error;
        data = logs || [];
        recordCount = data.length;
      } else if (exportType === 'full') {
        // Export all CRM data
        const [contacts, logs] = await Promise.all([
          supabase.from('crm_contacts').select('*').eq('business_id', currentBusiness.id),
          supabase.from('communication_logs').select('*').eq('business_id', currentBusiness.id),
        ]);
        
        data = {
          contacts: contacts.data || [],
          communication_logs: logs.data || [],
        };
        recordCount = (contacts.data?.length || 0) + (logs.data?.length || 0);
      }

      // Generate file content based on format
      let fileContent = '';
      let mimeType = '';

      if (format === 'json') {
        fileContent = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
      } else if (format === 'csv') {
        // Simple CSV conversion (for contacts)
        if (Array.isArray(data) && data.length > 0) {
          const headers = Object.keys(data[0]).join(',');
          const rows = data.map(row => Object.values(row).join(','));
          fileContent = [headers, ...rows].join('\n');
        }
        mimeType = 'text/csv';
      }

      // Download file
      const blob = new Blob([fileContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportType}_${format}_${new Date().toISOString().split('T')[0]}.${format === 'json' ? 'json' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Update export record
      await supabase
        .from('crm_exports')
        .update({
          status: 'completed',
          record_count: recordCount,
          completed_at: new Date().toISOString(),
        })
        .eq('id', exportRecord.id);

      toast({
        title: 'Export completed',
        description: `Successfully exported ${recordCount} records`,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: 'Export failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'json':
        return <FileJson className="h-4 w-4" />;
      case 'excel':
        return <FileSpreadsheet className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Export CRM Data</h1>
        <p className="text-muted-foreground mt-1">
          Export your CRM data in various formats
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Export Configuration */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Configure Export</h2>
          
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium mb-3 block">Export Type</Label>
              <RadioGroup value={exportType} onValueChange={setExportType}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="contacts" id="contacts" />
                  <Label htmlFor="contacts" className="font-normal cursor-pointer">
                    Contacts Only
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="logs" id="logs" />
                  <Label htmlFor="logs" className="font-normal cursor-pointer">
                    Communication Logs
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="full" id="full" />
                  <Label htmlFor="full" className="font-normal cursor-pointer">
                    Full Export (All Data)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm font-medium mb-3 block">Format</Label>
              <RadioGroup value={format} onValueChange={setFormat}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="font-normal cursor-pointer">
                    CSV (Excel Compatible)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="json" id="json" />
                  <Label htmlFor="json" className="font-normal cursor-pointer">
                    JSON (Full Data)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm font-medium mb-3 block">Options</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="archived"
                    checked={includeFilters.includeArchived}
                    onCheckedChange={(checked) =>
                      setIncludeFilters({ ...includeFilters, includeArchived: checked as boolean })
                    }
                  />
                  <Label htmlFor="archived" className="font-normal cursor-pointer">
                    Include archived records
                  </Label>
                </div>
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={isExporting || !currentBusiness}
              className="w-full"
              size="lg"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export Now
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Export History */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Exports</h2>
          
          <div className="space-y-3">
            {exports?.map((exp) => (
              <div
                key={exp.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-secondary/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  {getFormatIcon(exp.format)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm capitalize">
                      {exp.export_type} Export
                    </p>
                    {getStatusIcon(exp.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(exp.created_at).toLocaleString()}
                  </p>
                  {exp.record_count && (
                    <p className="text-xs text-muted-foreground">
                      {exp.record_count} records
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="capitalize">
                  {exp.format}
                </Badge>
              </div>
            ))}
            
            {(!exports || exports.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No exports yet
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CRMDataExport;
