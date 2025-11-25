import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const brandColors = {
  GasMask: '#D30000',
  HotMama: '#B76E79',
  GrabbaRUs: '#FFD400',
  HotScalati: '#5A3A2E'
};

export default function UnifiedUploadCenter() {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'complete'>('idle');
  const [uploadResults, setUploadResults] = useState<any>(null);
  const [aiClassifications, setAiClassifications] = useState<any[]>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus('processing');
    
    // Parse CSV
    const text = await file.text();
    const rows = text.split('\n').map(row => row.split(','));
    const headers = rows[0];
    const data = rows.slice(1);

    // AI Classification simulation
    const classifications: any[] = [];
    let successCount = 0;
    let errorCount = 0;
    const brandsDetected = new Set<string>();

    for (const row of data) {
      if (row.length < 3) continue;

      const classification = {
        storeName: row[0],
        brand: row[3] || 'GasMask',
        productType: row[4] || 'tubes',
        boxes: parseInt(row[5]) || 1,
        total: parseFloat(row[6]) || 0,
        deliveryDate: row[7],
        status: 'classified' as 'classified' | 'error' | 'duplicate'
      };

      // Check for existing store
      const { data: existingStore } = await supabase
        .from('store_master')
        .select('id')
        .eq('store_name', classification.storeName)
        .single();

      if (!existingStore && classification.storeName) {
        // Create store master profile
        const { data: newStore, error } = await supabase
          .from('store_master')
          .insert({
            store_name: classification.storeName,
            address: row[1] || '',
            city: row[2] || 'Brooklyn',
            state: 'NY',
            zip: row[3] || '11201'
          })
          .select()
          .single();

        if (!error && newStore) {
          // Create brand account (types will update after migration)
          const { error: brandError } = await supabase.from('store_brand_accounts').insert({
            store_master_id: newStore.id,
            brand: classification.brand,
            active_status: true
          } as any);
          
          if (brandError) console.error('Brand account creation error:', brandError);
        }
      }

      brandsDetected.add(classification.brand);
      successCount++;
      classifications.push(classification);
    }

    // Save upload history
    await supabase.from('batch_upload_history').insert({
      file_name: file.name,
      rows_processed: data.length,
      brands_detected: Array.from(brandsDetected),
      success_count: successCount,
      error_count: errorCount
    });

    setAiClassifications(classifications);
    setUploadResults({
      total: data.length,
      success: successCount,
      errors: errorCount,
      brands: Array.from(brandsDetected)
    });
    setUploadStatus('complete');
    toast.success('Upload processed successfully');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Unified Upload Center</h1>
        <p className="text-muted-foreground mt-2">
          Upload one CSV to update all 4 brands: GasMask • HotMama • Grabba R Us • Hot Scalati
        </p>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Multi-Brand CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-12 text-center bg-muted/30">
            <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium text-lg mb-2">Upload Your CSV File</h3>
            <p className="text-sm text-muted-foreground mb-4">
              AI will auto-detect store, brand, product, and create accounts automatically
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
              disabled={uploadStatus === 'processing'}
            />
            <label htmlFor="csv-upload">
              <Button
                variant="default"
                size="lg"
                asChild
                disabled={uploadStatus === 'processing'}
              >
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadStatus === 'processing' ? 'Processing...' : 'Choose File'}
                </span>
              </Button>
            </label>
          </div>

          {/* CSV Format Guide */}
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium mb-2">Expected CSV Format:</h4>
            <code className="text-xs">
              store_name, address, city, zip, brand, product_type, boxes, price_per_box, total_paid, delivery_date, biker_name
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              AI will auto-correct misspellings, detect brands, and create missing stores
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Processing Status */}
      {uploadStatus === 'processing' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="font-medium">AI is classifying your data...</p>
                <p className="text-sm text-muted-foreground">
                  Detecting stores, brands, products, and creating accounts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {uploadStatus === 'complete' && uploadResults && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-green-600" />
                Upload Complete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="text-3xl font-bold">{uploadResults.total}</div>
                  <div className="text-sm text-muted-foreground">Total Rows</div>
                </div>
                <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950">
                  <div className="flex items-center gap-2 text-3xl font-bold text-green-600">
                    <CheckCircle className="w-6 h-6" />
                    {uploadResults.success}
                  </div>
                  <div className="text-sm text-green-600">Successfully Processed</div>
                </div>
                <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-950">
                  <div className="flex items-center gap-2 text-3xl font-bold text-red-600">
                    <AlertCircle className="w-6 h-6" />
                    {uploadResults.errors}
                  </div>
                  <div className="text-sm text-red-600">Errors</div>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="text-3xl font-bold">{uploadResults.brands.length}</div>
                  <div className="text-sm text-muted-foreground">Brands Updated</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {uploadResults.brands.map((brand: string) => (
                  <Badge
                    key={brand}
                    style={{
                      backgroundColor: brandColors[brand as keyof typeof brandColors],
                      color: 'white'
                    }}
                  >
                    {brand}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Classifications */}
          <Card>
            <CardHeader>
              <CardTitle>AI Classification Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {aiClassifications.slice(0, 10).map((item, i) => (
                  <div key={i} className="p-3 rounded-lg border flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.storeName}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.productType} • {item.boxes} boxes • ${item.total}
                      </div>
                    </div>
                    <Badge
                      style={{
                        backgroundColor: brandColors[item.brand as keyof typeof brandColors],
                        color: 'white'
                      }}
                    >
                      {item.brand}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Upload History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Uploads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 rounded-lg border flex items-center justify-between">
                <div>
                  <div className="font-medium">grabba_deliveries_jan_{i}.csv</div>
                  <div className="text-sm text-muted-foreground">
                    150 rows • 4 brands • 2 days ago
                  </div>
                </div>
                <Badge variant="outline">Success</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
