import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { runMemoryExtractionV5 } from '@/services/profileExtractionService';
import { Brain, Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface BackfillResult {
  storeId: string;
  storeName: string;
  success: boolean;
  error?: string;
}

export default function MemoryBackfill() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<BackfillResult[]>([]);
  const [totalStores, setTotalStores] = useState(0);

  const runBackfill = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults([]);
    setStatus('Loading all stores...');

    try {
      const { data: stores, error } = await supabase
        .from('store_master')
        .select('id, store_name')
        .order('store_name');

      if (error) throw error;
      if (!stores || stores.length === 0) {
        setStatus('No stores found.');
        setIsRunning(false);
        return;
      }

      setTotalStores(stores.length);
      toast.info(`Starting extraction for ${stores.length} stores...`);

      const newResults: BackfillResult[] = [];

      for (let i = 0; i < stores.length; i++) {
        const store = stores[i];
        setStatus(`Extracting memory for: ${store.store_name} (${i + 1}/${stores.length})`);
        setProgress(((i + 1) / stores.length) * 100);

        const result = await runMemoryExtractionV5(store.id);

        newResults.push({
          storeId: store.id,
          storeName: store.store_name,
          success: result.success,
          error: result.error,
        });

        setResults([...newResults]);

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const successCount = newResults.filter(r => r.success).length;
      setStatus(`Backfill complete! ${successCount}/${stores.length} stores processed successfully.`);
      toast.success(`Backfill complete! ${successCount} stores extracted.`);

    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
      toast.error('Backfill failed: ' + error.message);
    }

    setIsRunning(false);
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" />
          AI Memory Backfill
        </h1>
        <p className="text-muted-foreground mt-2">
          Run V5 AI extraction on ALL stores to populate their memory profiles
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Memory Extraction</CardTitle>
          <CardDescription>
            This will process every store in your database and extract comprehensive memory profiles
            from their interactions, contacts, orders, and notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={runBackfill} 
            disabled={isRunning}
            size="lg"
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                Run Extraction for ALL Stores
              </>
            )}
          </Button>

          {isRunning && (
            <div className="space-y-2">
              <Progress value={progress} className="h-3" />
              <p className="text-sm text-muted-foreground">{status}</p>
            </div>
          )}

          {!isRunning && status && (
            <p className="text-sm font-medium">{status}</p>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              <span className="text-green-500">{successCount} successful</span>
              {failCount > 0 && <span className="text-red-500 ml-4">{failCount} failed</span>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {results.map((result, i) => (
                <div 
                  key={result.storeId} 
                  className={`flex items-center justify-between p-2 rounded ${
                    result.success ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                >
                  <span className="font-medium">{result.storeName}</span>
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <>
                        <span className="text-xs text-red-400">{result.error}</span>
                        <XCircle className="h-4 w-4 text-red-500" />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
