import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, Camera, Save, Send, RefreshCw, Flame, TrendingUp, X as XIcon, Zap, FileJson, Filter } from 'lucide-react';
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

interface ExtractedProp {
  player_name: string;
  team: string | null;
  prop_type: string;
  line: number;
  game: string | null;
  position: string | null;
  sportsbook: string;
  over_odds: number;
  under_odds: number;
}

interface ComparedProp extends ExtractedProp {
  dk_line: number | null;
  line_diff: number | null;
  line_edge: string;
  edge_direction: string | null;
  pp_advantage: string;
  ai_pick: string | null;
  ai_confidence: number | null;
  signal: string;
  signal_strength: number;
  dk_prop_id: string | null;
  db_prop_id?: string | null;
  reasoning?: string | null;
}

type FilterType = 'all' | 'strong' | 'ai_signal' | 'line_edge' | 'over' | 'under' | 'high_conf';
type PropTypeFilter = 'all' | string;

export function PrizePicksAnalyzer() {
  const [analyzing, setAnalyzing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [extractedProps, setExtractedProps] = useState<ExtractedProp[]>([]);
  const [comparedProps, setComparedProps] = useState<ComparedProp[]>([]);
  const [saving, setSaving] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentPlayer: '' });
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [propTypeFilter, setPropTypeFilter] = useState<PropTypeFilter>('all');
  const [chingWorldQueue, setChingWorldQueue] = useState<Set<string>>(new Set());
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    setImageFiles(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
    setExtractedProps([]);
    setComparedProps([]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')).slice(0, 5);
    if (files.length) {
      setImageFiles(files);
      setPreviews(files.map(f => URL.createObjectURL(f)));
      setExtractedProps([]);
      setComparedProps([]);
    }
  }, []);

  const analyzeImages = async () => {
    if (!imageFiles.length) return;
    setAnalyzing(true);
    setStatusMsg('Reading PrizePicks slate...');
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
        if (data?.props?.length) {
          allProps.push(...data.props);
        }
      }

      const deduped = deduplicateProps(allProps);
      setExtractedProps(deduped);
      setStatusMsg(`✅ Extracted ${deduped.length} props from ${imageFiles.length} image(s)`);
      await compareProps(deduped);
    } catch (e: any) {
      setStatusMsg(`❌ ${e.message}`);
      toast.error(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const deduplicateProps = (props: ExtractedProp[]) => {
    const seen = new Set<string>();
    return props.filter(p => {
      const key = `${p.player_name?.toLowerCase()}-${normalizePropType(p.prop_type)}-${p.line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const importFromJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      // Support both flat arrays and nested slates structure
      let allProps: any[] = [];
      if (Array.isArray(jsonData)) {
        allProps = jsonData;
      } else if (jsonData.slates) {
        for (const slateKey of Object.keys(jsonData.slates)) {
          const slate = jsonData.slates[slateKey];
          if (slate?.props && Array.isArray(slate.props)) {
            allProps.push(...slate.props);
          }
        }
      } else if (jsonData.props && Array.isArray(jsonData.props)) {
        allProps.push(...jsonData.props);
      }

      if (!allProps.length) {
        toast.error('No props found in JSON file');
        return;
      }

      const mapped: ExtractedProp[] = allProps.map(p => ({
        player_name: p.player_name || p.playerName || '',
        team: p.team || null,
        prop_type: p.prop_type || p.propType || p.stat_type || '',
        line: Number(p.line) || 0,
        game: p.game || null,
        position: p.position || null,
        sportsbook: 'prizepicks',
        over_odds: -122,
        under_odds: -122,
      })).filter(p => p.player_name && p.line > 0);

      const deduped = deduplicateProps(mapped);
      setExtractedProps(deduped);
      setStatusMsg(`✅ Imported ${deduped.length} props from JSON`);
      toast.success(`Imported ${deduped.length} props`);
      await compareProps(deduped);
    } catch (e: any) {
      toast.error(`JSON import failed: ${e.message}`);
    }

    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  const compareProps = async (ppProps: ExtractedProp[]) => {
    setStatusMsg('Comparing against DraftKings lines...');
    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    const { data: dkPropsRaw } = await (supabase as any)
      .from('sbo_player_props')
      .select('*, sbo_predictions(final_confidence, predicted_outcome)')
      .eq('sportsbook', 'draftkings')
      .gte('game_date', todayEST);
    const dkProps = dkPropsRaw as any[] | null;

    const comparisons: ComparedProp[] = ppProps.map(pp => {
      const dkMatch = (dkProps || []).find((dk: any) => {
        const lastName = pp.player_name?.split(' ').pop()?.toLowerCase() || '';
        const nameMatch = dk.player_name?.toLowerCase().includes(lastName);
        const typeMatch = normalizePropType(dk.prop_type) === normalizePropType(pp.prop_type);
        return nameMatch && typeMatch;
      });

      const dkLine = dkMatch?.line ?? null;
      const lineDiff = dkLine !== null ? pp.line - dkLine : null;

      let lineEdge = 'unknown';
      let edgeDirection: string | null = null;
      if (lineDiff !== null) {
        if (Math.abs(lineDiff) >= 1.5) { lineEdge = 'significant'; edgeDirection = lineDiff > 0 ? 'PP_HIGHER' : 'PP_LOWER'; }
        else if (Math.abs(lineDiff) >= 0.5) { lineEdge = 'moderate'; edgeDirection = lineDiff > 0 ? 'PP_HIGHER' : 'PP_LOWER'; }
        else { lineEdge = 'same'; }
      }

      const ppAdvantage = edgeDirection === 'PP_LOWER'
        ? `✅ PP line ${Math.abs(lineDiff || 0).toFixed(1)} LOWER — OVER easier on PP`
        : edgeDirection === 'PP_HIGHER'
        ? `✅ PP line ${Math.abs(lineDiff || 0).toFixed(1)} HIGHER — UNDER easier on PP`
        : dkLine !== null ? '➡️ Lines similar' : '⚠️ No DK line found';

      const aiPred = dkMatch?.sbo_predictions?.[0];
      const aiConf = aiPred?.final_confidence ?? null;
      const aiPick = aiPred?.predicted_outcome?.toUpperCase() ?? null;

      let signal = 'NO_EDGE';
      let signalStrength = 0;
      if (aiConf !== null && aiConf >= 70 && lineEdge !== 'unknown') {
        if (aiPick === 'OVER' && edgeDirection === 'PP_LOWER') {
          signal = 'STRONG_PLAY'; signalStrength = aiConf + 15;
        } else if (aiPick === 'UNDER' && edgeDirection === 'PP_HIGHER') {
          signal = 'STRONG_PLAY'; signalStrength = aiConf + 15;
        } else {
          signal = 'AI_SIGNAL'; signalStrength = aiConf;
        }
      } else if (aiConf !== null && aiConf >= 70) {
        signal = 'AI_SIGNAL'; signalStrength = aiConf;
      } else if (lineEdge === 'significant' || lineEdge === 'moderate') {
        signal = 'LINE_EDGE'; signalStrength = 50;
      }

      return {
        ...pp,
        dk_line: dkLine,
        dk_prop_id: dkMatch?.id || null,
        line_diff: lineDiff,
        line_edge: lineEdge,
        edge_direction: edgeDirection,
        pp_advantage: ppAdvantage,
        ai_pick: aiPick,
        ai_confidence: aiConf,
        signal,
        signal_strength: Math.min(signalStrength, 100),
      };
    });

    const sorted = comparisons.sort((a, b) => b.signal_strength - a.signal_strength);
    setComparedProps(sorted);
    setStatusMsg(`✅ ${sorted.length} props compared. ${sorted.filter(p => p.signal === 'STRONG_PLAY').length} strong plays found.`);
  };

  const saveAllProps = async () => {
    setSaving(true);
    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    try {
      for (const prop of extractedProps) {
        await (supabase as any).from('sbo_player_props').upsert({
          player_name: prop.player_name,
          team: prop.team || null,
          prop_type: prop.prop_type,
          line: prop.line,
          over_odds: -122,
          under_odds: -122,
          game_date: todayEST,
          sportsbook: 'prizepicks',
        }, { onConflict: 'player_name,prop_type,game_date,sportsbook' });
      }
      toast.success(`Saved ${extractedProps.length} PrizePicks props`);
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const runBatchAnalysis = async () => {
    if (!extractedProps.length) return;
    setBatchAnalyzing(true);

    // First save all props to DB
    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const savedIds: string[] = [];

    try {
      setStatusMsg('Saving props to database...');
      for (const prop of extractedProps) {
        const { data } = await (supabase as any).from('sbo_player_props').upsert({
          player_name: prop.player_name,
          team: prop.team || null,
          prop_type: prop.prop_type,
          line: prop.line,
          over_odds: -122,
          under_odds: -122,
          game_date: todayEST,
          sportsbook: 'prizepicks',
        }, { onConflict: 'player_name,prop_type,game_date,sportsbook' }).select('id').single();
        if (data?.id) savedIds.push(data.id);
      }

      // Now get the saved props with their IDs
      const { data: dbProps } = await (supabase as any)
        .from('sbo_player_props')
        .select('id, player_name, prop_type, sbo_predictions(id)')
        .eq('game_date', todayEST)
        .eq('sportsbook', 'prizepicks');

      const needsAnalysis = (dbProps || []).filter((p: any) => !p.sbo_predictions?.length);
      const total = needsAnalysis.length;
      setBatchProgress({ current: 0, total, currentPlayer: '' });

      for (let i = 0; i < needsAnalysis.length; i++) {
        const prop = needsAnalysis[i];
        setBatchProgress({ current: i + 1, total, currentPlayer: `${prop.player_name} ${normalizePropType(prop.prop_type)}` });
        setStatusMsg(`Analyzing ${i + 1}/${total}: ${prop.player_name}...`);

        try {
          await supabase.functions.invoke('sbo-run-predictions', {
            body: {
              prop_id: prop.id,
              prediction_type: 'player_prop',
              predicted_outcome: null,
              sportsbook: 'prizepicks',
            }
          });
        } catch (e) {
          console.error(`Analysis failed for ${prop.player_name}:`, e);
        }
        await new Promise(r => setTimeout(r, 400));
      }

      // Re-compare with updated predictions
      await compareProps(extractedProps);

      const strongCount = comparedProps.filter(p => p.signal === 'STRONG_PLAY' || (p.ai_confidence && p.ai_confidence >= 70)).length;
      setStatusMsg(`✅ ${total} props analyzed — ${strongCount} strong plays found`);
      setActiveFilter('strong');
      toast.success(`Analysis complete: ${total} props analyzed`);
    } catch (e: any) {
      setStatusMsg(`❌ Batch analysis failed: ${e.message}`);
      toast.error(e.message);
    } finally {
      setBatchAnalyzing(false);
    }
  };

  const toggleChingWorld = (propKey: string) => {
    setChingWorldQueue(prev => {
      const next = new Set(prev);
      if (next.has(propKey)) next.delete(propKey);
      else next.add(propKey);
      return next;
    });
  };

  const getSignalBadge = (signal: string, strength: number) => {
    switch (signal) {
      case 'STRONG_PLAY': return <Badge className="bg-green-600 text-white text-[10px]">🔥 STRONG ({strength})</Badge>;
      case 'AI_SIGNAL': return <Badge className="bg-blue-600 text-white text-[10px]">📊 AI ({strength})</Badge>;
      case 'LINE_EDGE': return <Badge className="bg-yellow-600 text-white text-[10px]">✅ EDGE</Badge>;
      case 'NO_EDGE': return <Badge variant="secondary" className="text-[10px]">➡️ NEUTRAL</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">—</Badge>;
    }
  };

  const confidenceColor = (c: number | null) => {
    if (!c) return 'text-muted-foreground';
    if (c >= 85) return 'text-green-500';
    if (c >= 70) return 'text-blue-500';
    if (c >= 55) return 'text-yellow-500';
    return 'text-destructive';
  };

  // Filters
  const propTypes = [...new Set(comparedProps.map(p => normalizePropType(p.prop_type)))].sort();

  const filteredProps = comparedProps.filter(p => {
    if (propTypeFilter !== 'all' && normalizePropType(p.prop_type) !== propTypeFilter) return false;
    switch (activeFilter) {
      case 'strong': return p.signal === 'STRONG_PLAY' || (p.ai_confidence !== null && p.ai_confidence >= 70);
      case 'ai_signal': return p.signal === 'AI_SIGNAL';
      case 'line_edge': return p.signal === 'LINE_EDGE';
      case 'over': return p.ai_pick === 'OVER';
      case 'under': return p.ai_pick === 'UNDER';
      case 'high_conf': return p.ai_confidence !== null && p.ai_confidence >= 90;
      default: return true;
    }
  });

  const strongPlays = comparedProps.filter(p => p.signal === 'STRONG_PLAY');
  const aiSignals = comparedProps.filter(p => p.signal === 'AI_SIGNAL');
  const overCount = comparedProps.filter(p => p.ai_pick === 'OVER').length;
  const underCount = comparedProps.filter(p => p.ai_pick === 'UNDER').length;

  const renderPropCard = (prop: ComparedProp) => {
    const propKey = `${prop.player_name}-${prop.prop_type}-${prop.line}`;
    const isQueued = chingWorldQueue.has(propKey);

    return (
      <div key={propKey} className={`border rounded-lg p-3 space-y-2 ${
        prop.signal === 'STRONG_PLAY' ? 'border-green-500/30 bg-green-500/5' :
        prop.signal === 'AI_SIGNAL' ? 'border-blue-500/20 bg-blue-500/5' :
        'bg-card'
      }`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-sm">{prop.player_name}</span>
            {prop.team && <span className="text-xs text-muted-foreground ml-1">({prop.team})</span>}
          </div>
          {getSignalBadge(prop.signal, prop.signal_strength)}
        </div>

        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{normalizePropType(prop.prop_type)}</span>
            <span className="font-mono font-bold">PP: {prop.line}</span>
            {prop.dk_line !== null && (
              <span className="font-mono">
                DK: {prop.dk_line}
                {prop.line_diff !== null && Math.abs(prop.line_diff) >= 0.5 && (
                  <span className={prop.edge_direction === 'PP_LOWER' ? 'text-green-500 ml-1' : 'text-orange-500 ml-1'}>
                    ({prop.line_diff > 0 ? '+' : ''}{prop.line_diff.toFixed(1)})
                  </span>
                )}
              </span>
            )}
          </div>
          <div>{prop.pp_advantage}</div>
          {prop.ai_pick && prop.ai_confidence !== null && (
            <div className={`font-medium ${confidenceColor(prop.ai_confidence)}`}>
              AI: {prop.ai_pick} {prop.line} @ {prop.ai_confidence}%
            </div>
          )}
          {prop.game && <div className="text-muted-foreground">{prop.game}</div>}
        </div>

        <div className="flex gap-1">
          <Button
            size="sm"
            variant={isQueued ? 'default' : 'outline'}
            className="text-[10px] h-7"
            onClick={() => toggleChingWorld(propKey)}
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
      {/* Upload & Import Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5" />
            🎯 PrizePicks Scanner
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Upload your PP slate → AI reads the lines and compares against DraftKings + AI picks
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload area */}
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

          {/* Image previews */}
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

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {imageFiles.length > 0 && (
              <Button onClick={analyzeImages} disabled={analyzing} className="flex-1">
                {analyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                {analyzing ? statusMsg : `Analyze ${imageFiles.length} Screenshot(s)`}
              </Button>
            )}
            <Input
              ref={jsonInputRef}
              type="file"
              accept=".json"
              onChange={importFromJSON}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => jsonInputRef.current?.click()}
              className="flex-shrink-0"
            >
              <FileJson className="h-4 w-4 mr-2" />
              Import JSON
            </Button>
          </div>

          {/* Status */}
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

      {/* Results */}
      {(extractedProps.length > 0 || comparedProps.length > 0) && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Card className="p-2 text-center">
              <p className="text-lg font-bold">{comparedProps.length}</p>
              <p className="text-[10px] text-muted-foreground">Total Props</p>
            </Card>
            <Card className="p-2 text-center border-green-500/30">
              <p className="text-lg font-bold text-green-500">{strongPlays.length}</p>
              <p className="text-[10px] text-muted-foreground">🔥 Strong Plays</p>
            </Card>
            <Card className="p-2 text-center border-blue-500/20">
              <p className="text-lg font-bold text-blue-500">{aiSignals.length}</p>
              <p className="text-[10px] text-muted-foreground">📊 AI Signals</p>
            </Card>
            <Card className="p-2 text-center">
              <p className="text-lg font-bold text-primary">{chingWorldQueue.size}</p>
              <p className="text-[10px] text-muted-foreground">📱 Queued</p>
            </Card>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={runBatchAnalysis} disabled={batchAnalyzing || !extractedProps.length} size="sm">
              {batchAnalyzing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Zap className="h-3 w-3 mr-1" />}
              ⚡ Run AI on All PP Props
            </Button>
            <Button onClick={saveAllProps} disabled={saving} size="sm" variant="outline">
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Save All
            </Button>
            <Button onClick={() => compareProps(extractedProps)} size="sm" variant="outline">
              <RefreshCw className="h-3 w-3 mr-1" /> Re-Compare
            </Button>
          </div>

          {/* Filter pills */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {([
                ['all', `All (${comparedProps.length})`],
                ['strong', `Strong (${strongPlays.length + aiSignals.length})`],
                ['over', `OVER (${overCount})`],
                ['under', `UNDER (${underCount})`],
                ['high_conf', `90%+ (${comparedProps.filter(p => p.ai_confidence !== null && p.ai_confidence >= 90).length})`],
              ] as [FilterType, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                    activeFilter === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/70'
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
                    {t} ({comparedProps.filter(p => normalizePropType(p.prop_type) === t).length})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Props list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filteredProps.map(renderPropCard)}
          </div>

          {filteredProps.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No props match the current filters. Try adjusting your selection.
            </p>
          )}
        </>
      )}
    </div>
  );
}
