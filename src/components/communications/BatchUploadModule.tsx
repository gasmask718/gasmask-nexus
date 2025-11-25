import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface BatchUploadModuleProps {
  brand: {
    id: string;
    name: string;
    colors: { primary: string; secondary: string; accent: string };
  };
}

export default function BatchUploadModule({ brand }: BatchUploadModuleProps) {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'complete'>('idle');
  const [uploadResults, setUploadResults] = useState<{
    total: number;
    success: number;
    errors: number;
    duplicates: number;
  } | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus('processing');
    
    // Simulate processing
    setTimeout(() => {
      setUploadResults({
        total: 150,
        success: 142,
        errors: 3,
        duplicates: 5
      });
      setUploadStatus('complete');
      toast.success('Batch upload completed');
    }, 2000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Batch Contact Upload for {brand.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Area */}
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium mb-2">Upload CSV File</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Drag and drop or click to browse
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload">
              <Button
                variant="outline"
                asChild
                style={uploadStatus === 'idle' ? { borderColor: brand.colors.primary } : {}}
              >
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </span>
              </Button>
            </label>
          </div>

          {/* Processing Status */}
          {uploadStatus === 'processing' && (
            <div className="p-4 rounded-lg bg-muted animate-pulse">
              <p className="text-center font-medium">Processing contacts...</p>
            </div>
          )}

          {/* Results */}
          {uploadStatus === 'complete' && uploadResults && (
            <div className="space-y-3">
              <Label>Upload Results</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="text-2xl font-bold">{uploadResults.total}</div>
                  <div className="text-xs text-muted-foreground">Total Rows</div>
                </div>
                <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950">
                  <div className="flex items-center gap-2 text-2xl font-bold text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    {uploadResults.success}
                  </div>
                  <div className="text-xs text-green-600">Successfully Added</div>
                </div>
                <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-950">
                  <div className="flex items-center gap-2 text-2xl font-bold text-red-600">
                    <XCircle className="w-5 h-5" />
                    {uploadResults.errors}
                  </div>
                  <div className="text-xs text-red-600">Errors</div>
                </div>
                <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-950">
                  <div className="flex items-center gap-2 text-2xl font-bold text-yellow-600">
                    <AlertCircle className="w-5 h-5" />
                    {uploadResults.duplicates}
                  </div>
                  <div className="text-xs text-yellow-600">Duplicates</div>
                </div>
              </div>
            </div>
          )}

          {/* Column Mapping */}
          <div className="space-y-2">
            <Label>CSV Column Requirements</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {['Name', 'Email', 'Phone', 'Company', 'Tags', 'Notes'].map((col) => (
                <Badge key={col} variant="outline" className="justify-center py-2">
                  {col}
                </Badge>
              ))}
            </div>
          </div>

          {/* Auto-Detect Options */}
          <div className="space-y-2">
            <Label>AI Auto-Detection</Label>
            <div className="p-3 rounded-lg border space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Auto-detect brand</span>
                <Badge variant="default">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Auto-map columns</span>
                <Badge variant="default">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Remove duplicates</span>
                <Badge variant="default">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Validate phone numbers</span>
                <Badge variant="default">Enabled</Badge>
              </div>
            </div>
          </div>

          {/* Saved Batches */}
          <div className="space-y-2">
            <Label>Previously Uploaded Batches</Label>
            <div className="space-y-2">
              {[
                { name: 'Store Owners Q4', contacts: 142, date: '2 days ago' },
                { name: 'Ambassador List', contacts: 67, date: '1 week ago' },
                { name: 'Inactive Customers', contacts: 210, date: '2 weeks ago' },
              ].map((batch, i) => (
                <div key={i} className="p-3 rounded-lg border flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{batch.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {batch.contacts} contacts • {batch.date}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Use Again</Button>
                </div>
              ))}
            </div>
          </div>

          {/* Template Download */}
          <Button variant="outline" className="w-full">
            <FileText className="w-4 h-4 mr-2" />
            Download CSV Template
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
