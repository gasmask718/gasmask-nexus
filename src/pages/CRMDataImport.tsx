import { useState } from 'react';
import { useBusiness } from '@/contexts/BusinessContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { 
  Upload, FileJson, FileSpreadsheet, 
  Loader2, CheckCircle2, XCircle, Clock, AlertCircle 
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CRMDataImport = () => {
  const { currentBusiness, loading } = useBusiness();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading import...</p>
        </div>
      </div>
    );
  }

  // Show message if no business selected
  if (!currentBusiness) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-8 text-center max-w-md">
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Business Selected</h3>
          <p className="text-sm text-muted-foreground">
            Please select a business to import data.
          </p>
        </Card>
      </div>
    );
  }

  const { data: imports, refetch } = useQuery({
    queryKey: ['crm-imports', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];
      
      const { data, error } = await supabase
        .from('crm_imports')
        .select('*, created_by_profile:profiles!crm_imports_created_by_fkey(name)')
        .eq('business_id', currentBusiness.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentBusiness?.id,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['text/csv', 'application/json', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.json')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a CSV or JSON file',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !currentBusiness?.id) return;

    setIsImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Read file content
      const fileContent = await selectedFile.text();
      let parsedData: any[] = [];

      if (selectedFile.name.endsWith('.json')) {
        parsedData = JSON.parse(fileContent);
      } else if (selectedFile.name.endsWith('.csv')) {
        // Simple CSV parser
        const lines = fileContent.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        parsedData = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',');
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index]?.trim() || '';
          });
          return obj;
        });
      }

      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        throw new Error('No valid data found in file');
      }

      // Create import record
      const { data: importRecord, error: createError } = await supabase
        .from('crm_imports')
        .insert({
          business_id: currentBusiness.id,
          created_by: user.id,
          import_type: 'contacts',
          file_name: selectedFile.name,
          total_rows: parsedData.length,
          status: 'processing',
        })
        .select()
        .single();

      if (createError) throw createError;

      // Import data into crm_contacts
      let successCount = 0;
      let failCount = 0;
      let duplicateCount = 0;

      for (const row of parsedData) {
        try {
          // Map common fields (adjust based on your CSV structure)
          const contactData: any = {
            business_id: currentBusiness.id,
            name: row.name || row.Name || row.full_name || 'Unknown',
            email: row.email || row.Email || null,
            phone: row.phone || row.Phone || row.phone_number || null,
            type: row.type || row.Type || 'customer',
            tags: row.tags ? row.tags.split(';') : [],
          };

          // Check for duplicates
          if (contactData.email || contactData.phone) {
            const { data: existing } = await supabase
              .from('crm_contacts')
              .select('id')
              .eq('business_id', currentBusiness.id)
              .or(`email.eq.${contactData.email},phone.eq.${contactData.phone}`)
              .limit(1)
              .single();

            if (existing) {
              duplicateCount++;
              continue;
            }
          }

          const { error: insertError } = await supabase
            .from('crm_contacts')
            .insert(contactData);

          if (insertError) {
            failCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          failCount++;
        }
      }

      // Update import record
      await supabase
        .from('crm_imports')
        .update({
          status: 'completed',
          successful_rows: successCount,
          failed_rows: failCount,
          duplicate_rows: duplicateCount,
          completed_at: new Date().toISOString(),
        })
        .eq('id', importRecord.id);

      toast({
        title: 'Import completed',
        description: `Imported ${successCount} contacts. ${duplicateCount} duplicates skipped. ${failCount} failed.`,
      });

      setSelectedFile(null);
      refetch();
    } catch (error: any) {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import CRM Data</h1>
        <p className="text-muted-foreground mt-1">
          Import contacts and data from CSV or JSON files
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Import Upload */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Upload File</h2>
          
          <div className="space-y-6">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-sm font-medium">Choose a file</span>
                <span className="text-xs text-muted-foreground block mt-1">
                  CSV or JSON (max 10MB)
                </span>
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {selectedFile && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-secondary/20">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedFile(null)}
                >
                  Remove
                </Button>
              </div>
            )}

            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <p className="font-medium mb-1">CSV Format Requirements:</p>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    <li>Include headers: name, email, phone</li>
                    <li>One contact per line</li>
                    <li>Duplicates will be skipped automatically</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button
              onClick={handleImport}
              disabled={!selectedFile || isImporting || !currentBusiness}
              className="w-full"
              size="lg"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Now
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Import History */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Imports</h2>
          
          <div className="space-y-3">
            {imports?.map((imp) => (
              <div
                key={imp.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-secondary/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  {getStatusIcon(imp.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{imp.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(imp.created_at).toLocaleString()}
                  </p>
                  {imp.status === 'completed' && (
                    <div className="flex gap-3 mt-1 text-xs">
                      <span className="text-green-600">
                        ✓ {imp.successful_rows} imported
                      </span>
                      {imp.duplicate_rows > 0 && (
                        <span className="text-yellow-600">
                          ⊗ {imp.duplicate_rows} duplicates
                        </span>
                      )}
                      {imp.failed_rows > 0 && (
                        <span className="text-destructive">
                          ✗ {imp.failed_rows} failed
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <Badge variant="outline" className="capitalize">
                  {imp.status}
                </Badge>
              </div>
            ))}
            
            {(!imports || imports.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No imports yet
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CRMDataImport;
