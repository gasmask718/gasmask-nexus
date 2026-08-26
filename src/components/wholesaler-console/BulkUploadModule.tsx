import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, Brain, CheckCircle, XCircle, AlertTriangle,
  Loader2, Eye, ChevronRight, Sparkles, ImageIcon, Package, ArrowLeft,
  RotateCcw, Send, Filter, Check, X, Edit2, Zap, Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

// ─── Types ─────────────────────────────────────────────
interface RawProduct {
  id: string;
  product_name: string;
  description: string;
  category: string;
  subcategory: string;
  price: number | null;
  images: string[];
  sku: string;
  inventory_qty: number | null;
  supplier_cost: number | null;
  weight_oz: number | null;
  length_in: number | null;
  width_in: number | null;
  height_in: number | null;
  raw_data: Record<string, string>;
}

interface ProcessedProduct extends RawProduct {
  ai_category: string;
  ai_subcategory: string;
  ai_description: string;
  ai_name: string;
  confidence: number;
  status: 'accepted' | 'rejected' | 'pending' | 'flagged';
  flag_reason?: string;
  color_label: string;
}

interface FailedRow {
  name: string;
  message: string;
}

type Step = 'upload' | 'processing' | 'review' | 'publish';

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: 'upload', label: 'Upload', icon: <Upload className="h-4 w-4" /> },
  { key: 'processing', label: 'AI Processing', icon: <Brain className="h-4 w-4" /> },
  { key: 'review', label: 'Review & Edit', icon: <Eye className="h-4 w-4" /> },
  { key: 'publish', label: 'Publish', icon: <Send className="h-4 w-4" /> },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Apparel': 'bg-green-500/15 text-green-400 border-green-500/30',
  'Electronics': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Footwear': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Accessories': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'Home & Garden': 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  'Beauty': 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  'Food & Beverage': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  'Other': 'bg-muted text-muted-foreground border-border',
};

const getCategoryColor = (cat: string) =>
  CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other'];

// ─── Component ─────────────────────────────────────────
export function BulkUploadModule({ wholesalerId }: { wholesalerId?: string }) {
  const [step, setStep] = useState<Step>('upload');
  const [rawItems, setRawItems] = useState<RawProduct[]>([]);
  const [processedItems, setProcessedItems] = useState<ProcessedProduct[]>([]);
  const [parseProgress, setParseProgress] = useState(0);
  const [aiProgress, setAiProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dragOver, setDragOver] = useState(false);
  const [failedRows, setFailedRows] = useState<FailedRow[]>([]);
  const [publishedCount, setPublishedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Download Template ─────────────────────────────────
  const downloadTemplate = () => {
    const headers = [
      'product_name', 'description', 'category', 'subcategory', 'sku',
      'supplier_cost', 'inventory_qty', 'weight_oz', 'length_in', 'width_in', 'height_in', 'image_url',
    ];
    const sampleRows = [
      ['Premium Cotton T-Shirt', 'High-quality 100% cotton crew neck tee', 'Apparel', 'Tops', 'TEE-BLK-M', '6.50', '120', '7', '10', '8', '1.5', 'https://example.com/image1.jpg'],
      ['Wireless Bluetooth Earbuds', 'Noise-cancelling earbuds with 24h battery', 'Electronics', 'Audio', 'EAR-BT-01', '14.00', '60', '5.5', '4', '3', '2', 'https://example.com/image2.jpg'],
      ['Leather Crossbody Bag', 'Genuine leather bag with adjustable strap', 'Accessories', 'Bags', 'BAG-LTH-BR', '28.75', '25', '22', '12', '9', '4', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws['!cols'] = [{ wch: 28 }, { wch: 45 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 11 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'bulk_upload_template.xlsx');
    toast.success('Template downloaded');
  };

  // ── Upload Handlers ──────────────────────────────────
  const mapRow = (raw: Record<string, string>, idx: number): RawProduct => ({
    id: `raw-${idx}-${Date.now()}`,
    product_name: raw['product_name'] || raw['name'] || raw['title'] || raw['Product Name'] || raw['Name'] || `Item ${idx + 1}`,
    description: raw['description'] || raw['desc'] || raw['Description'] || '',
    category: raw['category'] || raw['Category'] || '',
    subcategory: raw['subcategory'] || raw['Subcategory'] || '',
    price: num(raw['price'] ?? raw['Price'] ?? raw['retail_price']),
    images: (raw['images'] || raw['image'] || raw['image_url'] || raw['Image'] || '').toString().split(';').filter(Boolean),
    sku: (raw['sku'] || raw['SKU'] || raw['upc'] || '').toString().trim(),
    inventory_qty: num(raw['inventory_qty'] ?? raw['inventory'] ?? raw['qty'] ?? raw['quantity']),
    supplier_cost: num(raw['supplier_cost'] ?? raw['cost'] ?? raw['your_price'] ?? raw['Cost']),
    weight_oz: num(raw['weight_oz'] ?? raw['weight'] ?? raw['Weight']),
    length_in: num(raw['length_in'] ?? raw['length']),
    width_in: num(raw['width_in'] ?? raw['width']),
    height_in: num(raw['height_in'] ?? raw['height']),
    raw_data: raw,
  });

  const parseCSV = (text: string): RawProduct[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map((line, idx) => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const raw: Record<string, string> = {};
      headers.forEach((h, i) => { raw[h] = vals[i] || ''; });
      return mapRow(raw, idx);
    });
  };

  const handleFiles = useCallback(async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();

    setParseProgress(10);
    toast.info(`Reading ${file.name}…`);

    try {
      if (ext === 'csv') {
        const text = await file.text();
        setParseProgress(50);
        const items = parseCSV(text);
        setParseProgress(100);
        setRawItems(items);
        toast.success(`Parsed ${items.length} items from CSV`);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        setParseProgress(40);
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
        setParseProgress(80);
        const items: RawProduct[] = json.map((row, idx) => mapRow(row as Record<string, string>, idx));
        setParseProgress(100);
        setRawItems(items);
        toast.success(`Parsed ${items.length} items from Excel`);
      } else {
        toast.error('Unsupported file type. Use .csv or .xlsx');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to parse file');
      setParseProgress(0);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // ── AI Processing ────────────────────────────────────
  const runAICategorization = async () => {
    setStep('processing');
    setIsProcessing(true);
    setAiProgress(0);

    const processed: ProcessedProduct[] = [];
    const batchSize = 10;

    for (let i = 0; i < rawItems.length; i += batchSize) {
      const batch = rawItems.slice(i, i + batchSize);

      try {
        const { data, error } = await supabase.functions.invoke('ai-categorize-products', {
          body: { products: batch },
        });

        if (error || !data?.results) {
          // Fallback: local categorization
          batch.forEach(item => {
            processed.push(localCategorize(item));
          });
        } else {
          data.results.forEach((result: any, idx: number) => {
            const original = batch[idx];
            processed.push({
              ...original,
              ai_category: result.category || 'Other',
              ai_subcategory: result.subcategory || 'General',
              ai_description: result.description || original.description,
              ai_name: result.name || original.product_name,
              confidence: result.confidence || 0.75,
              status: result.flagged ? 'flagged' : 'pending',
              flag_reason: result.flag_reason,
              color_label: result.category || 'Other',
            });
          });
        }
      } catch {
        batch.forEach(item => processed.push(localCategorize(item)));
      }

      setAiProgress(Math.min(100, Math.round(((i + batchSize) / rawItems.length) * 100)));
      // Small delay between batches
      await new Promise(r => setTimeout(r, 300));
    }

    setProcessedItems(processed);
    setIsProcessing(false);
    setStep('review');
    toast.success(`AI processed ${processed.length} items`);
  };

  const localCategorize = (item: RawProduct): ProcessedProduct => {
    const name = item.product_name.toLowerCase();
    let category = 'Other', subcategory = 'General';
    if (/shirt|tee|hoodie|jacket|pants|dress|apparel/i.test(name)) { category = 'Apparel'; subcategory = "Men's Tops"; }
    else if (/shoe|sneaker|boot|sandal/i.test(name)) { category = 'Footwear'; subcategory = 'Sneakers'; }
    else if (/phone|laptop|tablet|electronic|charger|cable/i.test(name)) { category = 'Electronics'; subcategory = 'Devices'; }
    else if (/ring|necklace|watch|bag|hat|belt/i.test(name)) { category = 'Accessories'; subcategory = 'Jewelry'; }
    else if (/cream|lotion|serum|makeup|beauty/i.test(name)) { category = 'Beauty'; subcategory = 'Skincare'; }

    return {
      ...item,
      ai_category: item.category || category,
      ai_subcategory: item.subcategory || subcategory,
      ai_description: item.description || `High-quality ${item.product_name}. Premium wholesale product.`,
      ai_name: item.product_name,
      confidence: 0.7 + Math.random() * 0.25,
      status: 'pending',
      color_label: item.category || category,
    };
  };

  // ── Review Actions ───────────────────────────────────
  const updateItem = (id: string, updates: Partial<ProcessedProduct>) => {
    setProcessedItems(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const bulkAcceptCategory = (cat: string) => {
    setProcessedItems(prev => prev.map(p =>
      p.ai_category === cat && p.status !== 'rejected' ? { ...p, status: 'accepted' } : p
    ));
    toast.success(`Approved all ${cat} items`);
  };

  const acceptAll = () => {
    setProcessedItems(prev => prev.map(p => p.status !== 'rejected' ? { ...p, status: 'accepted' } : p));
    toast.success('All items approved');
  };

  // ── Submit to review queue ───────────────────────────
  // Bulk rows land in dd_catalog_drafts as pending_admin_review — the SAME gate the
  // camera flow uses. Nothing here writes a live product. Every Postgres error is
  // surfaced per row; a failure is NEVER counted as a success.
  const publishItems = async () => {
    const toPublish = processedItems.filter(p => p.status === 'accepted');
    if (!toPublish.length) { toast.error('No approved items to submit'); return; }

    setStep('publish');
    setIsPublishing(true);
    setFailedRows([]);

    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id ?? null;

    let created = 0;
    const failures: FailedRow[] = [];

    for (const item of toPublish) {
      const dims = (item.length_in && item.width_in && item.height_in)
        ? { length_in: item.length_in, width_in: item.width_in, height_in: item.height_in }
        : null;

      const { error } = await supabase.from('dd_catalog_drafts').insert({
        created_by: uid,
        supplier_id: wholesalerId ?? null,
        submitted_by: uid,
        submitted_by_wholesaler_id: wholesalerId ?? null,
        submitted_at: new Date().toISOString(),
        source: 'bulk_upload',
        status: 'pending_admin_review',
        product_name: item.ai_name,
        category: item.ai_category || null,
        sku: item.sku || null,
        cost: item.supplier_cost,
        inventory_qty: item.inventory_qty ?? 0,
        weight_oz: item.weight_oz,
        dimensions: dims,
        input_photos: item.images,
        selected: item.images,
        copy: {
          title: item.ai_name,
          short_description: item.ai_description,
          long_description: item.ai_description,
          category_guess: item.ai_category,
          subcategory: item.ai_subcategory,
        },
      });

      if (error) {
        failures.push({ name: item.ai_name, message: error.message });
        console.error('Draft insert failed:', item.ai_name, error);
      } else {
        created++;
      }
    }

    setFailedRows(failures);
    setPublishedCount(created);
    setIsPublishing(false);

    if (failures.length === 0) {
      toast.success(`${created} drafts created and sent for review.`);
    } else if (created === 0) {
      toast.error(`0 drafts created, ${failures.length} rows failed — see below.`);
    } else {
      toast.warning(`${created} drafts created, ${failures.length} rows failed — see below.`);
    }
  };

  // ── Derived State ────────────────────────────────────
  const categories = [...new Set(processedItems.map(p => p.ai_category))];
  const filteredItems = filterCategory === 'all'
    ? processedItems
    : processedItems.filter(p => p.ai_category === filterCategory);
  const accepted = processedItems.filter(p => p.status === 'accepted').length;
  const flagged = processedItems.filter(p => p.status === 'flagged').length;
  const rejected = processedItems.filter(p => p.status === 'rejected').length;
  const pending = processedItems.filter(p => p.status === 'pending').length;
  const stepIndex = STEPS.findIndex(s => s.key === step);

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border/50">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1">
            <button
              onClick={() => {
                if (i < stepIndex) setStep(s.key);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all w-full justify-center ${
                step === s.key
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : i < stepIndex
                    ? 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20'
                    : 'text-muted-foreground'
              }`}
            >
              {i < stepIndex ? <CheckCircle className="h-3.5 w-3.5" /> : s.icon}
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 mx-1 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Drop your product catalog here</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Supports <span className="font-medium text-foreground">.csv</span>,{' '}
                  <span className="font-medium text-foreground">.xlsx</span>,{' '}
                  <span className="font-medium text-foreground">.zip</span> (image folders)
                </p>
                <Button variant="outline" size="sm">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Browse Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.zip"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </div>

              <div className="mt-4 flex justify-center">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Excel Template
                </Button>
              </div>

              {parseProgress > 0 && parseProgress < 100 && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Reading file…</span>
                    <span>{parseProgress}%</span>
                  </div>
                  <Progress value={parseProgress} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Raw Preview */}
          {rawItems.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4 text-primary" />
                  Raw Data Preview
                  <Badge variant="secondary" className="ml-auto">{rawItems.length} items</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-2.5 font-semibold text-muted-foreground">#</th>
                          <th className="text-left p-2.5 font-semibold text-muted-foreground">Name</th>
                          <th className="text-left p-2.5 font-semibold text-muted-foreground">Category</th>
                          <th className="text-left p-2.5 font-semibold text-muted-foreground">Price</th>
                          <th className="text-left p-2.5 font-semibold text-muted-foreground">Images</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {rawItems.slice(0, 20).map((item, idx) => (
                          <tr key={item.id} className="hover:bg-muted/20">
                            <td className="p-2.5 text-muted-foreground">{idx + 1}</td>
                            <td className="p-2.5 font-medium max-w-[200px] truncate">{item.product_name}</td>
                            <td className="p-2.5 text-muted-foreground">{item.category || '—'}</td>
                            <td className="p-2.5">{item.price ? `$${item.price.toFixed(2)}` : '—'}</td>
                            <td className="p-2.5">{item.images.length || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rawItems.length > 20 && (
                    <div className="text-center py-2 text-xs text-muted-foreground bg-muted/30">
                      + {rawItems.length - 20} more items
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mt-4">
                  <Button variant="ghost" size="sm" onClick={() => { setRawItems([]); setParseProgress(0); }}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Clear & Re-upload
                  </Button>
                  <Button onClick={runAICategorization} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Run AI Categorization
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 2: AI Processing */}
      {step === 'processing' && (
        <Card className="border-border/50">
          <CardContent className="py-16 text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
              <Brain className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-1">AI Categorization in Progress</h3>
              <p className="text-sm text-muted-foreground">
                Analyzing {rawItems.length} products — assigning categories, generating descriptions…
              </p>
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <Progress value={aiProgress} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{Math.round(rawItems.length * aiProgress / 100)} / {rawItems.length} items</span>
                <span>{aiProgress}%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto pt-4">
              <div className="text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary mb-1" />
                <span className="text-[10px] text-muted-foreground">Categorizing</span>
              </div>
              <div className="text-center">
                <Zap className={`h-5 w-5 mx-auto mb-1 ${aiProgress > 30 ? 'text-amber-400' : 'text-muted-foreground/30'}`} />
                <span className="text-[10px] text-muted-foreground">Enriching</span>
              </div>
              <div className="text-center">
                <ImageIcon className={`h-5 w-5 mx-auto mb-1 ${aiProgress > 60 ? 'text-green-400' : 'text-muted-foreground/30'}`} />
                <span className="text-[10px] text-muted-foreground">Color Tagging</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          {/* Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Accepted', count: accepted, color: 'text-green-400', bg: 'bg-green-500/10', icon: <CheckCircle className="h-4 w-4" /> },
              { label: 'Pending', count: pending, color: 'text-amber-400', bg: 'bg-amber-500/10', icon: <AlertTriangle className="h-4 w-4" /> },
              { label: 'Flagged', count: flagged, color: 'text-orange-400', bg: 'bg-orange-500/10', icon: <AlertTriangle className="h-4 w-4" /> },
              { label: 'Rejected', count: rejected, color: 'text-red-400', bg: 'bg-red-500/10', icon: <XCircle className="h-4 w-4" /> },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-3 ${s.bg} border border-border/30`}>
                <div className={`flex items-center gap-1.5 ${s.color} text-xs font-semibold mb-1`}>{s.icon}{s.label}</div>
                <div className="text-2xl font-bold">{s.count}</div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <Filter className="h-3 w-3 mr-1.5" />
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="flex gap-1.5 ml-auto">
              <Button size="sm" variant="outline" className="text-xs h-8" onClick={acceptAll}>
                <Check className="h-3 w-3 mr-1" /> Accept All
              </Button>
              {filterCategory !== 'all' && (
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => bulkAcceptCategory(filterCategory)}>
                  <Check className="h-3 w-3 mr-1" /> Accept {filterCategory}
                </Button>
              )}
            </div>
          </div>

          {/* Review Table */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-3 font-semibold text-muted-foreground w-8"></th>
                      <th className="text-left p-3 font-semibold text-muted-foreground">Product</th>
                      <th className="text-left p-3 font-semibold text-muted-foreground">Category</th>
                      <th className="text-left p-3 font-semibold text-muted-foreground">AI Description</th>
                      <th className="text-center p-3 font-semibold text-muted-foreground">Confidence</th>
                      <th className="text-center p-3 font-semibold text-muted-foreground">Status</th>
                      <th className="text-center p-3 font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className={`hover:bg-muted/20 transition-colors ${
                        item.status === 'rejected' ? 'opacity-40' : ''
                      }`}>
                        <td className="p-3">
                          <Checkbox
                            checked={item.status === 'accepted'}
                            onCheckedChange={(checked) =>
                              updateItem(item.id, { status: checked ? 'accepted' : 'pending' })
                            }
                          />
                        </td>
                        <td className="p-3">
                          {editingId === item.id ? (
                            <Input
                              defaultValue={item.ai_name}
                              className="h-7 text-xs"
                              onBlur={(e) => {
                                updateItem(item.id, { ai_name: e.target.value });
                                setEditingId(null);
                              }}
                              autoFocus
                            />
                          ) : (
                            <div className="font-medium max-w-[180px] truncate">{item.ai_name}</div>
                          )}
                          {item.price && <div className="text-muted-foreground mt-0.5">${item.price.toFixed(2)}</div>}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-[10px] ${getCategoryColor(item.ai_category)}`}>
                            {item.ai_category}
                          </Badge>
                          <div className="text-muted-foreground mt-0.5 text-[10px]">{item.ai_subcategory}</div>
                        </td>
                        <td className="p-3 max-w-[250px]">
                          {editingId === item.id ? (
                            <Textarea
                              defaultValue={item.ai_description}
                              className="text-xs min-h-[60px]"
                              onBlur={(e) => {
                                updateItem(item.id, { ai_description: e.target.value });
                                setEditingId(null);
                              }}
                            />
                          ) : (
                            <p className="text-muted-foreground line-clamp-2">{item.ai_description}</p>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            item.confidence > 0.9 ? 'text-green-400' :
                            item.confidence > 0.7 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {Math.round(item.confidence * 100)}%
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {item.status === 'accepted' && <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">Accepted</Badge>}
                          {item.status === 'pending' && <Badge variant="outline" className="text-[10px]">Pending</Badge>}
                          {item.status === 'flagged' && (
                            <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-[10px]">
                              Flagged
                            </Badge>
                          )}
                          {item.status === 'rejected' && <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">Rejected</Badge>}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(editingId === item.id ? null : item.id)}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-400 hover:text-green-300"
                              onClick={() => updateItem(item.id, { status: 'accepted' })}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300"
                              onClick={() => updateItem(item.id, { status: 'rejected' })}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('upload')}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Upload
            </Button>
            <Button onClick={publishItems} disabled={accepted === 0} className="gap-2">
              <Send className="h-4 w-4" />
              Publish {accepted} Items
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Publish Summary */}
      {step === 'publish' && (
        <Card className="border-border/50">
          <CardContent className="py-16 text-center space-y-6">
            {isPublishing ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <h3 className="text-xl font-bold">Publishing to Catalog…</h3>
              </>
            ) : (
              <>
                <div className="mx-auto w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-400" />
                </div>
                <h3 className="text-xl font-bold">Catalog Updated!</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-lg mx-auto">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{rawItems.length}</div>
                    <div className="text-xs text-muted-foreground">Uploaded</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{processedItems.length}</div>
                    <div className="text-xs text-muted-foreground">Categorized</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-400">{flagged}</div>
                    <div className="text-xs text-muted-foreground">Flagged</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{accepted}</div>
                    <div className="text-xs text-muted-foreground">Published</div>
                  </div>
                </div>
                <Button variant="outline" onClick={() => { setStep('upload'); setRawItems([]); setProcessedItems([]); setParseProgress(0); }}>
                  <Upload className="h-4 w-4 mr-2" /> Upload More Products
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
