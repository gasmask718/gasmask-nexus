import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, Camera, Save, Send, RefreshCw, Flame, TrendingUp, ArrowRight, X as XIcon } from 'lucide-react';
import { toast } from 'sonner';

const PROP_LABELS: Record<string, string> = {
  points: 'Points', pts: 'Points', player_points: 'Points',
  rebounds: 'Rebounds', reb: 'Rebounds',
  assists: 'Assists', ast: 'Assists',
  threes: '3-Pointers', three_pointers: '3-Pointers', threes_made: '3-Pointers',
  blocks: 'Blocks', blk: 'Blocks',
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
}

export function PrizePicksAnalyzer() {
  const [analyzing, setAnalyzing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [extractedProps, setExtractedProps] = useState<ExtractedProp[]>([]);
  const [comparedProps, setComparedProps] = useState<ComparedProp[]>([]);
  const [saving, setSaving] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

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

      // Deduplicate by player + prop_type
      const seen = new Set<string>();
      const deduped = allProps.filter(p => {
        const key = `${p.player_name?.toLowerCase()}-${p.prop_type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setExtractedProps(deduped);
      setStatusMsg(`✅ Extracted ${deduped.length} props from ${imageFiles.length} image(s)`);

      // Auto-compare
      await compareProps(deduped);
    } catch (e: any) {
      setStatusMsg(`❌ ${e.message}`);
      toast.error(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const compareProps = async (ppProps: ExtractedProp[]) => {
    setStatusMsg('Comparing against DraftKings lines...');
    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    const { data: dkPropsRaw } = await supabase
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

  const getSignalBadge = (signal: string, strength: number) => {
    switch (signal) {
      case 'STRONG_PLAY': return <Badge className="bg-green-600 text-white">🔥 STRONG PLAY ({strength})</Badge>;
      case 'AI_SIGNAL': return <Badge className="bg-blue-600 text-white">📊 AI SIGNAL ({strength})</Badge>;
      case 'LINE_EDGE': return <Badge className="bg-yellow-600 text-white">✅ LINE EDGE</Badge>;
      case 'NO_EDGE': return <Badge variant="secondary">➡️ NEUTRAL</Badge>;
      default: return <Badge variant="outline">—</Badge>;
    }
  };

  const strongPlays = comparedProps.filter(p => p.signal === 'STRONG_PLAY');
  const aiSignals = comparedProps.filter(p => p.signal === 'AI_SIGNAL');
  const lineEdges = comparedProps.filter(p => p.signal === 'LINE_EDGE');
  const neutrals = comparedProps.filter(p => p.signal === 'NO_EDGE');

  const renderPropCard = (prop: ComparedProp) => (
    <div key={`${prop.player_name}-${prop.prop_type}`} className="border rounded-lg p-3 space-y-1 bg-card">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{prop.player_name} {prop.team ? `(${prop.team})` : ''}</span>
        {getSignalBadge(prop.signal, prop.signal_strength)}
      </div>
      <div className="text-xs text-muted-foreground">
        {normalizePropType(prop.prop_type)} | Line: {prop.line} (PrizePicks)
      </div>
      {prop.dk_line !== null && (
        <div className="text-xs">
          DK Line: {prop.dk_line}
          {prop.line_diff !== null && Math.abs(prop.line_diff) >= 0.5 && (
            <span className={prop.edge_direction === 'PP_LOWER' ? 'text-green-500 ml-1' : 'text-orange-500 ml-1'}>
              ({prop.line_diff > 0 ? '+' : ''}{prop.line_diff.toFixed(1)})
            </span>
          )}
        </div>
      )}
      <div className="text-xs">{prop.pp_advantage}</div>
      {prop.ai_pick && prop.ai_confidence !== null && (
        <div className="text-xs">
          AI: {prop.ai_pick} @ {prop.ai_confidence}% confidence
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5" />
            📸 PrizePicks Scanner
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
                    onClick={() => {
                      const newFiles = imageFiles.filter((_, j) => j !== i);
                      const newPreviews = previews.filter((_, j) => j !== i);
                      setImageFiles(newFiles);
                      setPreviews(newPreviews);
                    }}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-[10px]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Analyze button */}
          {imageFiles.length > 0 && (
            <Button onClick={analyzeImages} disabled={analyzing} className="w-full">
              {analyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
              {analyzing ? statusMsg : `Analyze ${imageFiles.length} Screenshot(s)`}
            </Button>
          )}

          {/* Status */}
          {statusMsg && !analyzing && extractedProps.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">{statusMsg}</p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {comparedProps.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-2">
            <Card className="p-2 text-center">
              <p className="text-lg font-bold text-green-500">{strongPlays.length}</p>
              <p className="text-[10px] text-muted-foreground">🔥 Strong Plays</p>
            </Card>
            <Card className="p-2 text-center">
              <p className="text-lg font-bold text-blue-500">{aiSignals.length}</p>
              <p className="text-[10px] text-muted-foreground">📊 AI Signals</p>
            </Card>
            <Card className="p-2 text-center">
              <p className="text-lg font-bold text-yellow-500">{lineEdges.length}</p>
              <p className="text-[10px] text-muted-foreground">✅ Line Edges</p>
            </Card>
            <Card className="p-2 text-center">
              <p className="text-lg font-bold">{neutrals.length}</p>
              <p className="text-[10px] text-muted-foreground">➡️ Neutral</p>
            </Card>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button onClick={saveAllProps} disabled={saving} size="sm" variant="outline">
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Save All Props
            </Button>
            <Button onClick={() => compareProps(extractedProps)} size="sm" variant="outline">
              <RefreshCw className="h-3 w-3 mr-1" /> Re-Compare
            </Button>
          </div>

          {/* Strong Plays */}
          {strongPlays.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-500">🔥 STRONG PLAYS (AI + Line Edge)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {strongPlays.map(renderPropCard)}
              </CardContent>
            </Card>
          )}

          {/* AI Signals */}
          {aiSignals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-500">📊 AI SIGNALS (70%+ Confidence)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aiSignals.map(renderPropCard)}
              </CardContent>
            </Card>
          )}

          {/* Line Edges */}
          {lineEdges.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-yellow-500">✅ LINE EDGES (PP vs DK)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lineEdges.map(renderPropCard)}
              </CardContent>
            </Card>
          )}

          {/* Neutral */}
          {neutrals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">➡️ NEUTRAL</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {neutrals.map(renderPropCard)}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
