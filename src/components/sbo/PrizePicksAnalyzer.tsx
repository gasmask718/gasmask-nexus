import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, Camera, Save, Send, RefreshCw, Zap, FileJson, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const PROP_LABELS: Record<string, string> = {
  points: 'Points', pts: 'Points', player_points: 'Points',
  rebounds: 'Rebounds', reb: 'Rebounds',
  assists: 'Assists', ast: 'Assists',
  threes: '3-Pointers', three_pointers: '3-Pointers', threes_made: '3-Pointers',
  blocks: 'Blocks', blk: 'Blocks', blocked_shots: 'Blocks',
  steals: 'Steals', stl: 'Steals',
  turnovers: 'Turnovers', tov: 'Turnovers',
  pra: 'Pts+Reb+Ast', pts_reb_ast: 'Pts+Reb+Ast',
  pr: 'Pts+Reb', pts_reb: 'Pts+Reb',
  pa: 'Pts+Ast', pts_ast: 'Pts+Ast',
  fantasy_points: 'Fantasy', minutes: 'Minutes',
};
const normalizePropType = (raw: string) => PROP_LABELS[raw?.toLowerCase()?.trim()] || raw;

interface SavedProp {
  id: string;
  player_name: string;
  team: string | null;
  prop_type: string;
  line: number;
  over_odds: number | null;
  under_odds: number | null;
  game_date: string;
  source: string;
  created_at: string;
  sbo_predictions: Array<{
    id: string;
    final_confidence: number | null;
    predicted_outcome: string | null;
    confidence_tier: string | null;
    stats_brain_score: number | null;
    market_brain_score: number | null;
    context_brain_score: number | null;
    data_quality: string | null;
    stats_brain_reasoning: string | null;
    market_brain_reasoning: string | null;
    context_brain_reasoning: string | null;
  }>;
}
  sbo_predictions: Array<{
    id: string;
    final_confidence: number | null;
    predicted_outcome: string | null;
    confidence_tier: string | null;
    stats_brain_score: number | null;
    market_brain_score: number | null;
    context_brain_score: number | null;
    data_quality: string | null;
    stats_brain_reasoning: string | null;
    market_brain_reasoning: string | null;
    context_brain_reasoning: string | null;
  }>;
}

interface ExtractedProp {
  player_name: string;
  team: string | null;
  prop_type: string;
  line: number;
  over_odds: number;
  under_odds: number;
}

type FilterType = 'all' | 'strong' | 'needs_analysis' | 'over' | 'under' | 'high_conf';
type PropTypeFilter = 'all' | string;

export function PrizePicksAnalyzer() {
  const [analyzing, setAnalyzing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [extractedProps, setExtractedProps] = useState<ExtractedProp[]>([]);
  const [savedProps, setSavedProps] = useState<SavedProp[]>([]);
  const [saving, setSaving] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentPlayer: '' });
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [propTypeFilter, setPropTypeFilter] = useState<PropTypeFilter>('all');
  const [chingWorldQueue, setChingWorldQueue] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Load saved PP props on mount
  useEffect(() => {
    loadSavedPPProps();
  }, []);

  const loadSavedPPProps = async () => {
    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    try {
      const { data, error } = await (supabase as any)
        .from('sbo_player_props')
        .select(`
          id, player_name, team, prop_type, line, over_odds, under_odds,
          game_date, source, created_at,
          sbo_predictions(
            id, final_confidence, predicted_outcome, confidence_tier,
            stats_brain_score, market_brain_score, context_brain_score,
            data_quality, stats_brain_reasoning, market_brain_reasoning, context_brain_reasoning
          )
        `)
        .eq('source', 'prizepicks')
        .eq('game_date', todayEST)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSavedProps(data);
        console.log(`Loaded ${data.length} saved PP props from DB`);
      }
    } catch (e) {
      console.error('Failed to load saved props:', e);
    } finally {
      setLoading(false);
    }
  };

  const savePropsToDB = async (props: ExtractedProp[]) => {
    setSaving(true);
    setStatusMsg('Saving props to database...');
    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    let saved = 0;
    let skipped = 0;

    for (const prop of props) {
      if (!prop.player_name || !prop.prop_type || prop.line == null) {
        skipped++;
        continue;
      }
      const { error } = await (supabase as any)
        .from('sbo_player_props')
        .upsert({
          player_name: prop.player_name,
          team: prop.team || null,
          prop_type: prop.prop_type?.toLowerCase().trim(),
          line: Number(prop.line),
          over_odds: -122,
          under_odds: -122,
          game_date: todayEST,
          source: 'prizepicks',
        }, { onConflict: 'player_name,prop_type,game_date,source', ignoreDuplicates: false });

      if (!error) saved++;
      else console.error(`Failed to save ${prop.player_name}:`, error);
    }

    setStatusMsg(`✅ Saved ${saved} props${skipped > 0 ? ` (${skipped} skipped)` : ''}`);
    toast.success(`Saved ${saved} PrizePicks props`);

    // Reload from DB to get IDs and any existing predictions
    await loadSavedPPProps();
    setExtractedProps([]);
    setSaving(false);
    return saved;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    setImageFiles(prev => [...prev, ...files].slice(0, 5));
    setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))].slice(0, 5));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')).slice(0, 5);
    if (files.length) {
      setImageFiles(prev => [...prev, ...files].slice(0, 5));
      setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))].slice(0, 5));
    }
  }, []);

  const deduplicateProps = (props: ExtractedProp[]) => {
    const seen = new Set<string>();
    return props.filter(p => {
      const key = `${p.player_name?.toLowerCase()}-${normalizePropType(p.prop_type)}-${p.line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const analyzeAndSave = async () => {
    if (!imageFiles.length) return;
    setAnalyzing(true);
    const allProps: ExtractedProp[] = [];

    try {
      for (let i = 0; i < imageFiles.length; i++) {
        setStatusMsg(`Analyzing image ${i + 1} of ${imageFiles.length}...`);
        const file = imageFiles[i];
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const { data, error } = await supabase.functions.invoke('sbo-analyze-prizepicks', {
          body: { image_base64: base64, media_type: file.type }
        });

        if (error) throw new Error(error.message);
        if (data?.props?.length) allProps.push(...data.props);
      }

      const deduped = deduplicateProps(allProps);
      setStatusMsg(`Extracted ${deduped.length} props — saving to database...`);
      await savePropsToDB(deduped);

      // Clear files after successful save
      setImageFiles([]);
      setPreviews([]);
    } catch (e: any) {
      setStatusMsg(`❌ ${e.message}`);
      toast.error(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const importFromJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      let allProps: any[] = [];
      if (Array.isArray(jsonData)) {
        allProps = jsonData;
      } else if (jsonData.slates) {
        for (const slateKey of Object.keys(jsonData.slates)) {
          const slate = jsonData.slates[slateKey];
          if (slate?.props && Array.isArray(slate.props)) allProps.push(...slate.props);
        }
      } else if (jsonData.props && Array.isArray(jsonData.props)) {
        allProps.push(...jsonData.props);
      }

      if (!allProps.length) { toast.error('No props found in JSON file'); return; }

      const mapped: ExtractedProp[] = allProps.map(p => ({
        player_name: p.player_name || p.playerName || '',
        team: p.team || null,
        prop_type: p.prop_type || p.propType || p.stat_type || '',
        line: Number(p.line) || 0,
        over_odds: -122,
        under_odds: -122,
      })).filter(p => p.player_name && p.line > 0);

      const deduped = deduplicateProps(mapped);
      await savePropsToDB(deduped);
    } catch (e: any) {
      toast.error(`JSON import failed: ${e.message}`);
    }
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  const runUnanalyzed = async () => {
    const needsAnalysis = savedProps.filter(p => !p.sbo_predictions?.length);
    if (!needsAnalysis.length) { toast.info('All props already analyzed'); return; }

    setBatchAnalyzing(true);
    const total = needsAnalysis.length;
    setBatchProgress({ current: 0, total, currentPlayer: '' });

    try {
      for (let i = 0; i < needsAnalysis.length; i++) {
        const prop = needsAnalysis[i];
        setBatchProgress({ current: i + 1, total, currentPlayer: `${prop.player_name} ${normalizePropType(prop.prop_type)}` });

        try {
          await supabase.functions.invoke('sbo-run-predictions', {
            body: { prop_id: prop.id, prediction_type: 'player_prop', predicted_outcome: null, source: 'prizepicks' }
          });
        } catch (e) {
          console.error(`Analysis failed for ${prop.player_name}:`, e);
        }

        // Reload every 5 props so cards update live
        if ((i + 1) % 5 === 0) await loadSavedPPProps();
        await new Promise(r => setTimeout(r, 400));
      }

      await loadSavedPPProps();
      toast.success(`Analysis complete: ${total} props analyzed`);
    } catch (e: any) {
      toast.error(`Batch analysis failed: ${e.message}`);
    } finally {
      setBatchAnalyzing(false);
      setBatchProgress({ current: 0, total: 0, currentPlayer: '' });
    }
  };

  const clearAllProps = async () => {
    if (!confirm('Clear all PrizePicks props for today?')) return;
    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    await (supabase as any)
      .from('sbo_player_props')
      .delete()
      .eq('source', 'prizepicks')
      .eq('game_date', todayEST);
    setSavedProps([]);
    toast.success('Cleared all PP props');
  };

  const toggleChingWorld = (propId: string) => {
    setChingWorldQueue(prev => {
      const next = new Set(prev);
      if (next.has(propId)) next.delete(propId);
      else next.add(propId);
      return next;
    });
  };

  const confidenceColor = (c: number | null) => {
    if (!c) return 'text-muted-foreground';
    if (c >= 85) return 'text-green-500';
    if (c >= 70) return 'text-blue-500';
    if (c >= 55) return 'text-yellow-500';
    return 'text-destructive';
  };

  const tierBadge = (tier: string | null, conf: number | null) => {
    if (!tier || !conf) return null;
    const colors: Record<string, string> = {
      elite: 'bg-green-600 text-white', strong: 'bg-blue-600 text-white',
      moderate: 'bg-yellow-600 text-white', weak: 'bg-red-500 text-white',
    };
    return <Badge className={`text-[10px] ${colors[tier] || 'bg-muted'}`}>{conf}% {tier.toUpperCase()}</Badge>;
  };

  // Compute stats from savedProps
  const analyzed = savedProps.filter(p => p.sbo_predictions?.length > 0);
  const unanalyzed = savedProps.filter(p => !p.sbo_predictions?.length);
  const eliteCount = analyzed.filter(p => (p.sbo_predictions[0]?.final_confidence || 0) >= 85).length;
  const strongCount = analyzed.filter(p => {
    const c = p.sbo_predictions[0]?.final_confidence || 0;
    return c >= 70 && c < 85;
  }).length;

  // Filters
  const propTypes = [...new Set(savedProps.map(p => normalizePropType(p.prop_type)))].sort();

  const filteredProps = savedProps.filter(p => {
    if (propTypeFilter !== 'all' && normalizePropType(p.prop_type) !== propTypeFilter) return false;
    const pred = p.sbo_predictions?.[0];
    const conf = pred?.final_confidence || 0;
    const pick = pred?.predicted_outcome?.toUpperCase();

    switch (activeFilter) {
      case 'strong': return conf >= 70;
      case 'needs_analysis': return !pred;
      case 'over': return pick === 'OVER';
      case 'under': return pick === 'UNDER';
      case 'high_conf': return conf >= 90;
      default: return true;
    }
  }).sort((a, b) => {
    const confA = a.sbo_predictions?.[0]?.final_confidence || 0;
    const confB = b.sbo_predictions?.[0]?.final_confidence || 0;
    return confB - confA;
  });

  const renderPropCard = (prop: SavedProp) => {
    const pred = prop.sbo_predictions?.[0];
    const conf = pred?.final_confidence || null;
    const pick = pred?.predicted_outcome?.toUpperCase();
    const isQueued = chingWorldQueue.has(prop.id);
    const hasPrediction = !!pred;

    return (
      <div key={prop.id} className={`border rounded-lg p-3 space-y-2 ${
        conf && conf >= 85 ? 'border-green-500/30 bg-green-500/5' :
        conf && conf >= 70 ? 'border-blue-500/20 bg-blue-500/5' :
        !hasPrediction ? 'border-orange-500/20 bg-orange-500/5' :
        'bg-card'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-sm">{prop.player_name}</span>
            {prop.team && <span className="text-xs text-muted-foreground ml-1">({prop.team})</span>}
          </div>
          {hasPrediction
            ? tierBadge(pred.confidence_tier, conf)
            : <Badge className="bg-orange-500 text-white text-[10px]">⚡ Needs Analysis</Badge>
          }
        </div>

        {/* Prop info */}
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{normalizePropType(prop.prop_type)}</span>
            <span className="font-mono font-bold">PP: {prop.line}</span>
          </div>
          </div>
        </div>

        {/* AI Analysis */}
        {hasPrediction && (
          <div className="border-t border-border pt-2 space-y-1.5">
            <div className={`text-sm font-semibold ${confidenceColor(conf)}`}>
              AI Pick: {pick} {prop.line} | {conf}%
            </div>

            {/* Brain Breakdown */}
            <div className="grid grid-cols-3 gap-1 text-[10px]">
              {pred.stats_brain_score != null && (
                <div className="text-center p-1 rounded bg-muted/30">
                  <div className="text-muted-foreground">📊 Stats</div>
                  <div className={`font-bold ${confidenceColor(pred.stats_brain_score)}`}>{pred.stats_brain_score}</div>
                </div>
              )}
              {pred.market_brain_score != null && (
                <div className="text-center p-1 rounded bg-muted/30">
                  <div className="text-muted-foreground">💰 Market</div>
                  <div className={`font-bold ${confidenceColor(pred.market_brain_score)}`}>{pred.market_brain_score}</div>
                </div>
              )}
              {pred.context_brain_score != null && (
                <div className="text-center p-1 rounded bg-muted/30">
                  <div className="text-muted-foreground">🧠 Context</div>
                  <div className={`font-bold ${confidenceColor(pred.context_brain_score)}`}>{pred.context_brain_score}</div>
                </div>
              )}
            </div>

            {/* Reasoning */}
            {pred.stats_brain_reasoning && (
              <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                {pred.stats_brain_reasoning}
              </p>
            )}

            {/* Data Quality */}
            {pred.data_quality && (
              <Badge variant="outline" className={`text-[8px] h-4 px-1 ${
                pred.data_quality === 'full' ? 'text-green-500 border-green-500/40' :
                pred.data_quality === 'partial' ? 'text-yellow-500 border-yellow-500/40' :
                'text-destructive border-destructive/40'
              }`}>
                {pred.data_quality === 'full' ? '✅ Full Stats' :
                 pred.data_quality === 'partial' ? '⚠️ Partial Stats' : '🔴 Odds Only'}
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1 pt-1">
          <Button
            size="sm"
            variant={isQueued ? 'default' : 'outline'}
            className="text-[10px] h-7"
            onClick={() => toggleChingWorld(prop.id)}
          >
            <Send className="h-3 w-3 mr-1" />
            {isQueued ? 'Queued ✓' : 'ChingWorld'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5" />
            🎯 PrizePicks Scanner
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Upload PP slates → AI reads lines → saves to DB → run AI analysis
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById('pp-file-input')?.click()}
          >
            <Input
              id="pp-file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Click or drag PrizePicks screenshot(s)</p>
            <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — up to 5 images</p>
          </div>

          {previews.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {previews.map((url, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <img src={url} alt={`Screenshot ${i + 1}`} className="h-20 rounded border" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setImageFiles(prev => prev.filter((_, j) => j !== i));
                      setPreviews(prev => prev.filter((_, j) => j !== i));
                    }}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-[10px]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {imageFiles.length > 0 && (
              <Button onClick={analyzeAndSave} disabled={analyzing} className="flex-1">
                {analyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                {analyzing ? statusMsg : `Extract & Save ${imageFiles.length} Screenshot(s)`}
              </Button>
            )}
            <Input ref={jsonInputRef} type="file" accept=".json" onChange={importFromJSON} className="hidden" />
            <Button variant="outline" onClick={() => jsonInputRef.current?.click()} className="flex-shrink-0">
              <FileJson className="h-4 w-4 mr-2" /> Import JSON
            </Button>
          </div>

          {statusMsg && !analyzing && (
            <p className="text-xs text-muted-foreground text-center">{statusMsg}</p>
          )}
        </CardContent>
      </Card>

      {/* Batch Analysis Progress */}
      {batchAnalyzing && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-medium">Analyzing PrizePicks Props...</span>
            </div>
            <Progress value={batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {batchProgress.current}/{batchProgress.total} — {batchProgress.currentPlayer}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Saved Props Section */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading saved props...
        </div>
      ) : (
        <>
          {/* Summary Stats Bar */}
          <div className="text-xs text-muted-foreground text-center py-1">
            {savedProps.length} total | {analyzed.length} analyzed | {unanalyzed.length} need analysis | 🔥 {eliteCount} elite (85%+) | 💪 {strongCount} strong (70%+)
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Card className="p-2 text-center">
              <p className="text-lg font-bold">{savedProps.length}</p>
              <p className="text-[10px] text-muted-foreground">Total Props</p>
            </Card>
            <Card className="p-2 text-center border-green-500/30">
              <p className="text-lg font-bold text-green-500">{eliteCount}</p>
              <p className="text-[10px] text-muted-foreground">🔥 Elite (85%+)</p>
            </Card>
            <Card className="p-2 text-center border-orange-500/20">
              <p className="text-lg font-bold text-orange-500">{unanalyzed.length}</p>
              <p className="text-[10px] text-muted-foreground">⚡ Need Analysis</p>
            </Card>
            <Card className="p-2 text-center">
              <p className="text-lg font-bold text-primary">{chingWorldQueue.size}</p>
              <p className="text-[10px] text-muted-foreground">📱 Queued</p>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={runUnanalyzed} disabled={batchAnalyzing || !unanalyzed.length} size="sm">
              {batchAnalyzing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Zap className="h-3 w-3 mr-1" />}
              ⚡ Run AI on {unanalyzed.length} Unanalyzed
            </Button>
            <Button onClick={loadSavedPPProps} size="sm" variant="outline">
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
            {savedProps.length > 0 && (
              <Button onClick={clearAllProps} size="sm" variant="outline" className="text-destructive">
                <Trash2 className="h-3 w-3 mr-1" /> Clear All
              </Button>
            )}
          </div>

          {/* Filters */}
          {savedProps.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {([
                  ['all', `All (${savedProps.length})`],
                  ['strong', `70%+ (${savedProps.filter(p => (p.sbo_predictions?.[0]?.final_confidence || 0) >= 70).length})`],
                  ['high_conf', `90%+ (${savedProps.filter(p => (p.sbo_predictions?.[0]?.final_confidence || 0) >= 90).length})`],
                  ['needs_analysis', `Needs AI (${unanalyzed.length})`],
                  ['over', `OVER (${analyzed.filter(p => p.sbo_predictions[0]?.predicted_outcome?.toUpperCase() === 'OVER').length})`],
                  ['under', `UNDER (${analyzed.filter(p => p.sbo_predictions[0]?.predicted_outcome?.toUpperCase() === 'UNDER').length})`],
                ] as [FilterType, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(key)}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                      activeFilter === key ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted/70'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {propTypes.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setPropTypeFilter('all')}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium ${
                      propTypeFilter === 'all' ? 'bg-primary/20 text-primary' : 'bg-muted/20 text-muted-foreground'
                    }`}
                  >
                    All Types
                  </button>
                  {propTypes.map(t => (
                    <button
                      key={t}
                      onClick={() => setPropTypeFilter(t)}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium ${
                        propTypeFilter === t ? 'bg-primary/20 text-primary' : 'bg-muted/20 text-muted-foreground'
                      }`}
                    >
                      {t} ({savedProps.filter(p => normalizePropType(p.prop_type) === t).length})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Props Grid */}
          {filteredProps.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredProps.map(renderPropCard)}
            </div>
          ) : savedProps.length > 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No props match the current filters.
            </p>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">
              No PrizePicks props saved today. Upload a screenshot or import JSON to get started.
            </p>
          )}
        </>
      )}
    </div>
  );
}
