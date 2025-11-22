import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, CheckCircle, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

const CRMCustomerImport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      // Show first 20 rows as preview
      setPreview(data.slice(0, 20));
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    const errors: string[] = [];
    let successCount = 0;

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        for (const row of data) {
          try {
            const customer = {
              name: row.name || row.Name,
              phone: row.phone || row.Phone || null,
              email: row.email || row.Email || null,
              business_type: row.business_type || row['Business Type'] || 'store',
              address: row.address || row.Address || null,
              city: row.city || row.City || null,
              state: row.state || row.State || null,
              zip: row.zip || row.ZIP || null,
              last_order_date: row.last_order_date || row['Last Order Date'] || null,
              total_lifetime_value: parseFloat(row.lifetime_value || row['Lifetime Value'] || 0),
              relationship_status: 'active',
            };

            if (!customer.name) {
              errors.push(`Row skipped: Missing name`);
              continue;
            }

            const { error } = await supabase
              .from('crm_customers')
              .insert([customer]);

            if (error) throw error;
            successCount++;
          } catch (error: any) {
            errors.push(`Error importing ${row.name || 'unknown'}: ${error.message}`);
          }
        }

        setResults({ success: successCount, errors });
        toast({
          title: "Import Complete",
          description: `Successfully imported ${successCount} customers`,
        });
      };
      reader.readAsBinaryString(file);
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/crm/customers')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Import Customers</h1>
          <p className="text-muted-foreground">Upload Excel or CSV file to batch import customers</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Expected columns: name, phone, email, business_type, address, city, state, zip, last_order_date, lifetime_value
            </p>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
            />
          </div>

          {preview.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Preview (First 20 rows)</h3>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-secondary/50">
                    <tr>
                      {Object.keys(preview[0]).map((key) => (
                        <th key={key} className="px-4 py-2 text-left font-semibold">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="border-b">
                        {Object.values(row).map((val: any, i) => (
                          <td key={i} className="px-4 py-2">
                            {val?.toString() || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setPreview([])}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={importing}>
                  <Upload className="mr-2 h-4 w-4" />
                  {importing ? 'Importing...' : 'Confirm Import'}
                </Button>
              </div>
            </div>
          )}

          {results && (
            <Card className="bg-secondary/30">
              <CardHeader>
                <CardTitle className="text-lg">Import Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold">{results.success} customers imported successfully</span>
                </div>
                {results.errors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-5 w-5" />
                      <span className="font-semibold">{results.errors.length} errors</span>
                    </div>
                    <div className="bg-background rounded-lg p-4 max-h-48 overflow-y-auto">
                      {results.errors.map((error, idx) => (
                        <p key={idx} className="text-sm text-muted-foreground">
                          {error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <Button onClick={() => navigate('/crm/customers')}>
                  View Customers
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CRMCustomerImport;
