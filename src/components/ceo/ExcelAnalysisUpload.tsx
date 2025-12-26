import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileSpreadsheet, Brain, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export function ExcelAnalysisUpload() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setAnalysis(null);

    try {
      // Read Excel file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      const columns = Object.keys(jsonData[0] || {});

      console.log('Parsed Excel:', {
        fileName: file.name,
        rows: jsonData.length,
        columns,
      });

      // Send to AI for analysis
      const { data: analysisData, error } = await supabase.functions.invoke('excel-analysis-ai', {
        body: {
          fileName: file.name,
          data: jsonData,
          columns,
          attachToBrand: (selectedBrand && selectedBrand !== '__none__') ? selectedBrand : null,
          attachToStore: null,
        },
      });

      if (error) throw error;

      setAnalysis(analysisData.analysis);

      toast({
        title: "Analysis Complete",
        description: `${file.name} has been analyzed by AI`,
      });
    } catch (error: any) {
      console.error('Error analyzing file:', error);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const brands = [
    'GasMask', 'HotMama', 'Grabba R Us', 'Hot Scalati', 'TopTier',
    'Playboxxx', 'iClean WeClean', 'Unforgettable Times', 'Funding',
    'Special Needs', 'Sports Betting', 'Dynasty Investments'
  ];

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Excel Analysis Engine</h2>
        </div>
        <p className="text-muted-foreground mb-6">
          Upload Excel files for deep AI-powered analysis with actionable insights
        </p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="brand-select">Attach to Brand (Optional)</Label>
            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
              <SelectTrigger>
                <SelectValue placeholder="Select a brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No Brand</SelectItem>
                {brands.map(brand => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="file-upload">Upload Excel File</Label>
            <div className="mt-2">
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </div>
          </div>

          {uploading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <p>AI analyzing your data...</p>
            </div>
          )}
        </div>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-bold">AI Analysis Results</h3>
          </div>

          {/* Summary */}
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Executive Summary</h4>
            <p className="text-sm whitespace-pre-line">{analysis.summary}</p>
          </div>

          {/* Trends */}
          {analysis.trends?.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold mb-3">Key Trends</h4>
              <div className="space-y-2">
                {analysis.trends.map((trend: any, i: number) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{trend.title}</p>
                      <span className={`text-xs px-2 py-1 rounded ${
                        trend.severity === 'high' ? 'bg-red-100 text-red-700' :
                        trend.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {trend.severity}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{trend.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Plan */}
          {analysis.actionPlan?.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3">Recommended Actions</h4>
              <div className="space-y-2">
                {analysis.actionPlan.map((action: any, i: number) => (
                  <div key={i} className="p-3 border rounded-lg flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{action.action}</p>
                        <span className="text-xs text-muted-foreground">{action.timeline}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                        action.priority === 'high' ? 'bg-red-100 text-red-700' :
                        action.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {action.priority} priority
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}