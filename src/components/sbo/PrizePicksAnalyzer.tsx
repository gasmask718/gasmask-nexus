import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataQualityBadge } from '@/components/sbo/DataQualityBadge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, Camera, Save, Send, RefreshCw, Zap, FileJson, Trash2, Database } from 'lucide-react';
import { toast } from 'sonner';
import { PropStatContextCard } from './PropStatContextCard';

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
  ra: 'Reb+Ast', reb_ast: 'Reb+Ast',
  fantasy_points: 'Fantasy', minutes: 'Minutes',
  blks_stls: 'Blks+Stls',
};
const normalizePropType = (raw: string) => PROP_LABELS[raw?.toLowerCase()?.trim()] || raw;

// ═══ AUDIT-DRIVEN INTELLIGENCE CONSTANTS ═══
const BLOCKED_PROP_TYPES = [
  'pts_ast', 'points_assists', 'pts+ast', 'pa',
  'pts_reb', 'points_rebounds', 'pts+reb', 'pr',
];
const isBadPropType = (propType: string): boolean => {
  const pt = (propType || '').toLowerCase().trim().replace(/[\s_\-+]/g, '');
  return BLOCKED_PROP_TYPES.some(b => b.replace(/[\s_\-+]/g, '') === pt);
};

const PROP_TYPE_AUDIT_BADGES: Record<string, string> = {
  'Blocks': '🔥 91%',
  'Steals': '💪 83%',
  'Pts+Ast': '❌ 45%',
  'Pts+Reb': '❌ 46%',
};

interface VerificationResult {
  verdict: string | null;
  was_correct: boolean | null;
  actual_result: string | null;
  actual_value: number | null;
  verdict_note: string | null;
  verified_at: string | null;
}

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
  actual_value: number | null;
  verdict: string | null;
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
    was_correct: boolean | null;
    verified: boolean | null;
    sbo_results_verification: VerificationResult[];
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

type FilterType = 'all' | 'strong' | 'needs_analysis' | 'over' | 'under' | 'high_conf' | 'won' | 'lost';
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
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyDate, setVerifyDate] = useState<'today' | 'yesterday'>('today');
  const [viewDate, setViewDate] = useState<'today' | 'yesterday'>('today');
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProcessProgress, setBatchProcessProgress] = useState({
    step: '', current: 0, total: 0,
    results: { correct: 0, incorrect: 0, push: 0, pending: 0 }
  });
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const getDateEST = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  };

  useEffect(() => { loadSavedPPProps(); }, [viewDate]);

  const loadSavedPPProps = async () => {
    const targetDate = viewDate === 'yesterday' ? getDateEST(-1) : getDateEST(0);
    console.log('Loading PP props for date:', targetDate, 'viewDate:', viewDate);
    try {
      const { data, error } = await (supabase as any)
        .from('sbo_player_props')
        .select(`
          id, player_name, team, prop_type, line, over_odds, under_odds,
          game_date, source, created_at, actual_value, verdict,
          sbo_predictions(
            id, final_confidence, predicted_outcome, confidence_tier,
            stats_brain_score, market_brain_score, context_brain_score,
            data_quality, stats_brain_reasoning, market_brain_reasoning, context_brain_reasoning,
            was_correct, verified,
            sbo_results_verification(
              verdict, actual_result, actual_value, verdict_note, verified_at
            )
          )
        `)
        .eq('source', 'prizepicks')
        .eq('game_date', targetDate)
        // PHASE 3 / ITEM 8 — bounded read (analyzer board); table exceeds the 1k PostgREST default.
        .limit(500)
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

  const runVerification = async (forceYesterday = false, forceRerun = false) => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const { data, error } = await supabase.functions.invoke('sbo-verify-results', {
        body: {
          force_yesterday: forceYesterday,
          force_rerun: forceRerun,
          specific_date: forceYesterday ? null : todayEST,
        }
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setVerifyResult(data);

      const gameRecord = `${data.correct ?? 0}W-${data.incorrect ?? 0}L`;
      const propRecord = `${data.props_correct ?? 0}W-${data.props_incorrect ?? 0}L`;
      toast.success(`✅ Games: ${gameRecord} (${data.accuracy ?? 0}%) | Props: ${propRecord} (${data.props_accuracy ?? 0}%)`);

      await loadSavedPPProps();
    } catch (e: any) {
      toast.error(`Verification failed: ${e.message}`);
    } finally {
      setVerifying(false);
    }
  };

  // ═══════════════════════════════════════
  // INTELLIGENCE AUDIT
  // ═══════════════════════════════════════
  const runIntelligenceAudit = async () => {
    setAuditRunning(true);
    setAuditData(null);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-intelligence-audit');
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setAuditData(data);
      toast.success(`Audit complete: ${data.summary?.total || 0} predictions analyzed`);
    } catch (e: any) {
      toast.error(`Audit failed: ${e.message}`);
    } finally {
      setAuditRunning(false);
    }
  };

  const applyOptimalWeights = async () => {
    if (!auditData?.optimal_weights) return;
    try {
      const { error } = await (supabase as any)
        .from('sbo_model_performance')
        .update({
          stats_weight: auditData.optimal_weights.stats,
          market_weight: auditData.optimal_weights.market,
          context_weight: auditData.optimal_weights.context,
          updated_at: new Date().toISOString(),
          update_reason: `Auto-optimized from ${auditData.summary.total} verified predictions`
        })
        .eq('is_active', true);
      if (error) throw error;
      toast.success(`✅ Weights updated: Stats ${Math.round(auditData.optimal_weights.stats*100)}% / Market ${Math.round(auditData.optimal_weights.market*100)}% / Context ${Math.round(auditData.optimal_weights.context*100)}%`);
    } catch (e: any) {
      toast.error(`Failed to apply weights: ${e.message}`);
    }
  };


  // ═══════════════════════════════════════
  const batchProcessAllProps = async () => {
    setBatchProcessing(true);
    setBatchProcessProgress({ step: 'Starting...', current: 0, total: 0, results: { correct: 0, incorrect: 0, push: 0, pending: 0 } });

    try {
      const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

      // Step 1: Load all PP props
      setBatchProcessProgress(p => ({ ...p, step: 'Loading all props...' }));
      const { data: allProps } = await (supabase as any)
        .from('sbo_player_props')
        .select('id, player_name, prop_type, line, sbo_predictions(id)')
        .eq('source', 'prizepicks')
        // PHASE 3 / ITEM 8 — bounded read (today's prizepicks slate); table exceeds the 1k PostgREST default.
        .limit(500)
        .eq('game_date', todayEST);

      const total = allProps?.length || 0;
      const needsAnalysis = (allProps || []).filter((p: any) => !p.sbo_predictions?.length);

      setBatchProcessProgress(p => ({ ...p, total, step: `Found ${total} props, ${needsAnalysis.length} need AI` }));

      // Step 2: Run AI on unanalyzed
      if (needsAnalysis.length > 0) {
        for (let i = 0; i < needsAnalysis.length; i++) {
          const prop = needsAnalysis[i];
          setBatchProcessProgress(p => ({
            ...p, current: i + 1,
            step: `AI: ${prop.player_name} ${normalizePropType(prop.prop_type)} ${prop.line}`
          }));
          try {
            await supabase.functions.invoke('sbo-run-predictions', {
              body: { prop_id: prop.id, prediction_type: 'player_prop', predicted_outcome: null, source: 'prizepicks' }
            });
          } catch {}
          if ((i + 1) % 5 === 0) await loadSavedPPProps();
          await new Promise(r => setTimeout(r, 350));
        }
      }

      // Step 3: Verify all
      setBatchProcessProgress(p => ({ ...p, step: 'Verifying against real scores...', current: 0 }));
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('sbo-verify-results', {
        body: { force_yesterday: false, verify_props: true, force_rerun: true, specific_date: todayEST }
      });
      if (verifyError) throw verifyError;

      setBatchProcessProgress(p => ({
        ...p, step: 'Complete!', current: total,
        results: {
          correct: verifyData?.props_correct || 0,
          incorrect: verifyData?.props_incorrect || 0,
          push: verifyData?.pushes || 0,
          pending: verifyData?.props_pending || 0,
        }
      }));

      await loadSavedPPProps();
      setVerifyResult(verifyData);

      toast.success(
        `✅ Batch complete! Props: ${verifyData?.props_correct || 0}W-${verifyData?.props_incorrect || 0}L (${verifyData?.props_accuracy || 0}%)`
      );
    } catch (e: any) {
      toast.error(`Batch process failed: ${e.message}`);
    } finally {
      setBatchProcessing(false);
    }
  };

  const savePropsToDB = async (props: ExtractedProp[]) => {
    setSaving(true);
    setStatusMsg('Saving props to database...');
    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    let saved = 0, skipped = 0;

    for (const prop of props) {
      if (!prop.player_name || !prop.prop_type || prop.line == null) { skipped++; continue; }
      const { error } = await (supabase as any)
        .from('sbo_player_props')
        .upsert({
          player_name: prop.player_name, team: prop.team || null,
          prop_type: prop.prop_type?.toLowerCase().trim(), line: Number(prop.line),
          over_odds: -122, under_odds: -122, game_date: todayEST, source: 'prizepicks',
        }, { onConflict: 'player_name,prop_type,game_date,source', ignoreDuplicates: false });
      if (!error) saved++;
      else console.error(`Failed to save ${prop.player_name}:`, error);
    }

    setStatusMsg(`✅ Saved ${saved} props${skipped > 0 ? ` (${skipped} skipped)` : ''}`);
    toast.success(`Saved ${saved} PrizePicks props`);
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
      setStatusMsg(`Extracted ${deduped.length} props — saving...`);
      await savePropsToDB(deduped);
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
      if (Array.isArray(jsonData)) allProps = jsonData;
      else if (jsonData.slates) {
        for (const slateKey of Object.keys(jsonData.slates)) {
          const slate = jsonData.slates[slateKey];
          if (slate?.props && Array.isArray(slate.props)) allProps.push(...slate.props);
        }
      } else if (jsonData.props && Array.isArray(jsonData.props)) allProps.push(...jsonData.props);

      if (!allProps.length) { toast.error('No props found in JSON file'); return; }
      const mapped: ExtractedProp[] = allProps.map(p => ({
        player_name: p.player_name || p.playerName || '',
        team: p.team || null,
        prop_type: p.prop_type || p.propType || p.stat_type || '',
        line: Number(p.line) || 0, over_odds: -122, under_odds: -122,
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
        } catch {}
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
    await (supabase as any).from('sbo_player_props').delete().eq('source', 'prizepicks').eq('game_date', todayEST);
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

  // Compute stats
  const analyzed = savedProps.filter(p => p.sbo_predictions?.length > 0);
  const unanalyzed = savedProps.filter(p => !p.sbo_predictions?.length);
  const eliteCount = analyzed.filter(p => (p.sbo_predictions[0]?.final_confidence || 0) >= 85).length;
  const strongCount = analyzed.filter(p => {
    const c = p.sbo_predictions[0]?.final_confidence || 0;
    return c >= 70 && c < 85;
  }).length;

  // Verdict counts from prop-level verdict field
  const wonCount = savedProps.filter(p => p.verdict === 'correct' || p.sbo_predictions?.[0]?.sbo_results_verification?.[0]?.verdict === 'correct').length;
  const lostCount = savedProps.filter(p => p.verdict === 'incorrect' || p.sbo_predictions?.[0]?.sbo_results_verification?.[0]?.verdict === 'incorrect').length;
  const verifiedTotal = wonCount + lostCount;
  const verifiedAccuracy = verifiedTotal > 0 ? Math.round((wonCount / verifiedTotal) * 100) : 0;

  // Accuracy by prop type
  const accuracyByType: Record<string, { correct: number; incorrect: number }> = {};
  for (const p of savedProps) {
    const v = p.verdict || p.sbo_predictions?.[0]?.sbo_results_verification?.[0]?.verdict;
    if (!v || (v !== 'correct' && v !== 'incorrect')) continue;
    const pt = normalizePropType(p.prop_type);
    if (!accuracyByType[pt]) accuracyByType[pt] = { correct: 0, incorrect: 0 };
    if (v === 'correct') accuracyByType[pt].correct++;
    else accuracyByType[pt].incorrect++;
  }

  const propTypes = [...new Set(savedProps.map(p => normalizePropType(p.prop_type)))].sort();

  const filteredProps = savedProps.filter(p => {
    if (propTypeFilter !== 'all' && normalizePropType(p.prop_type) !== propTypeFilter) return false;
    const pred = p.sbo_predictions?.[0];
    const conf = pred?.final_confidence || 0;
    const pick = pred?.predicted_outcome?.toUpperCase();
    const verdict = p.verdict || pred?.sbo_results_verification?.[0]?.verdict;

    switch (activeFilter) {
      case 'strong': return conf >= 70;
      case 'needs_analysis': return !pred;
      case 'over': return pick === 'OVER';
      case 'under': return pick === 'UNDER';
      case 'high_conf': return conf >= 90;
      case 'won': return verdict === 'correct';
      case 'lost': return verdict === 'incorrect';
      default: return true;
    }
  }).sort((a, b) => {
    const confA = a.sbo_predictions?.[0]?.final_confidence || 0;
    const confB = b.sbo_predictions?.[0]?.final_confidence || 0;
    return confB - confA;
  });

  const getVerdictBadge = (prop: SavedProp) => {
    const verdict = prop.verdict || prop.sbo_predictions?.[0]?.sbo_results_verification?.[0]?.verdict;
    if (!verdict) return null;

    const configs: Record<string, { label: string; cls: string }> = {
      correct: { label: '✅ WON', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
      incorrect: { label: '❌ LOST', cls: 'bg-red-500/15 text-red-500 border-red-500/30' },
      push: { label: '➖ PUSH', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
    };
    const config = configs[verdict] || { label: verdict.toUpperCase(), cls: 'bg-muted/30 text-muted-foreground' };

    return (
      <span className={`px-2 py-0.5 rounded border text-xs font-bold ${config.cls}`}>
        {config.label}
      </span>
    );
  };

  const renderPropCard = (prop: SavedProp) => {
    const pred = prop.sbo_predictions?.[0];
    const conf = pred?.final_confidence || null;
    const pick = pred?.predicted_outcome?.toUpperCase();
    const isQueued = chingWorldQueue.has(prop.id);
    const hasPrediction = !!pred;
    const verification = pred?.sbo_results_verification?.[0];
    const verdict = prop.verdict || verification?.verdict;
    const actualVal = prop.actual_value ?? verification?.actual_value;

    return (
      <div key={prop.id} className={`border rounded-lg p-3 space-y-2 ${
        verdict === 'correct' ? 'border-emerald-500/30 bg-emerald-500/5' :
        verdict === 'incorrect' ? 'border-red-500/20 bg-red-500/5' :
        isBadPropType(prop.prop_type) ? 'border-red-500/20 bg-red-900/5' :
        conf && conf >= 85 ? 'border-green-500/30 bg-green-500/5' :
        conf && conf >= 70 ? 'border-blue-500/20 bg-blue-500/5' :
        !hasPrediction ? 'border-orange-500/20 bg-orange-500/5' :
        'bg-card'
      }`}>
        {/* FADE BANNER for losing combo props */}
        {isBadPropType(prop.prop_type) && (
          <div className="w-full text-center py-1 rounded bg-red-500/20 text-red-500 text-xs font-bold border border-red-500/30">
            ❌ SYSTEM FADE — {normalizePropType(prop.prop_type)} props hit {normalizePropType(prop.prop_type) === 'Pts+Ast' ? '45' : '46'}% historically. DO NOT PLAY.
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-sm">{prop.player_name}</span>
            {prop.team && <span className="text-xs text-muted-foreground ml-1">({prop.team})</span>}
          </div>
          <div className="flex items-center gap-1">
            {getVerdictBadge(prop)}
            {!verdict && hasPrediction && tierBadge(pred.confidence_tier, conf)}
            {!hasPrediction && <Badge className="bg-orange-500 text-white text-[10px]">⚡ Needs Analysis</Badge>}
          </div>
        </div>

        {/* Prop info + actual value */}
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{normalizePropType(prop.prop_type)}</span>
            <span className="font-mono font-bold">PP: {prop.line}</span>
            {actualVal != null && (
              <span className={`font-mono font-bold ${verdict === 'correct' ? 'text-emerald-500' : verdict === 'incorrect' ? 'text-red-500' : 'text-foreground'}`}>
                Actual: {actualVal}
              </span>
            )}
          </div>
        </div>

        {/* AI Analysis */}
        {hasPrediction && (
          <div className="border-t border-border pt-2 space-y-1.5">
            <div className={`text-sm font-semibold ${confidenceColor(conf)}`}>
              AI Pick: {pick} {prop.line} | {conf}%
            </div>

            {/* UNDER EDGE indicator */}
            {pred?.predicted_outcome?.toLowerCase() === 'under' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-medium border border-blue-500/30">
                📊 UNDER EDGE — 68% hist. accuracy
              </span>
            )}

            {/* Sweet Spot indicator */}
            {conf && conf >= 80 && conf <= 89 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-medium border border-amber-500/30">
                🎯 SWEET SPOT — 81% hist. accuracy in 80-89% range
              </span>
            )}

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

            {pred.stats_brain_reasoning && (
              <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                {pred.stats_brain_reasoning}
              </p>
            )}

            {pred.data_quality && <DataQualityBadge quality={pred.data_quality} compact />}

            {/* Verdict Note */}
            {(verification?.verdict_note) && (
              <p className="text-[10px] text-muted-foreground italic border-t border-border pt-1">
                {verification.verdict_note}
              </p>
            )}
          </div>
        )}

        {/* Stat Intelligence Context */}
        <PropStatContextCard
          propId={prop.id}
          playerName={prop.player_name}
          propType={prop.prop_type}
          line={prop.line}
          compact={!hasPrediction}
        />

        {/* Actions */}
        <div className="flex gap-1 pt-1">
          <Button size="sm" variant={isQueued ? 'default' : 'outline'} className="text-[10px] h-7"
            onClick={() => toggleChingWorld(prop.id)}>
            <Send className="h-3 w-3 mr-1" />
            {isQueued ? 'Queued ✓' : 'ChingWorld'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 🧠 System Intelligence Card */}
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base">🧠 System Intelligence</h3>
          <span className="text-[10px] text-muted-foreground">Based on 600+ verified picks</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <div className="text-lg font-bold text-emerald-500">62.7%</div>
            <div className="text-[10px] text-muted-foreground">Overall Accuracy</div>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <div className="text-lg font-bold text-emerald-500">91%</div>
            <div className="text-[10px] text-muted-foreground">🛡️ Blocks Edge</div>
          </div>
          <div className="rounded-lg bg-blue-500/10 p-2">
            <div className="text-lg font-bold text-blue-500">68%</div>
            <div className="text-[10px] text-muted-foreground">📊 UNDER Bias</div>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-2">
            <div className="text-lg font-bold text-amber-500">81%</div>
            <div className="text-[10px] text-muted-foreground">🎯 Sweet Spot 80-89%</div>
          </div>
        </div>
        <div className="mt-2 flex gap-2 flex-wrap">
          <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">❌ Fade: Pts+Ast (45%)</span>
          <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">❌ Fade: Pts+Reb (46%)</span>
          <span className="text-[10px] px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">📊 UNDER first priority</span>
          <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">🔥 Market Brain 45%</span>
        </div>
      </div>

      {/* ⚡ BATCH PROCESS + VERIFY SECTION */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">🔍 Verify & Process</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Run AI on all unanalyzed props, then verify against real scores
              </p>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-border text-xs">
              <button onClick={() => setVerifyDate('today')}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  verifyDate === 'today' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/60'
                }`}>Today</button>
              <button onClick={() => setVerifyDate('yesterday')}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  verifyDate === 'yesterday' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/60'
                }`}>Yesterday</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={batchProcessAllProps} disabled={batchProcessing || verifying}
              className="bg-purple-600 hover:bg-purple-700 text-white">
              {batchProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              {batchProcessing ? batchProcessProgress.step : '⚡ Process & Verify ALL'}
            </Button>
            <Button onClick={() => runVerification(verifyDate === 'yesterday', false)}
              disabled={verifying || batchProcessing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {verifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {verifying ? 'Verifying...' : `🔍 Verify ${verifyDate === 'yesterday' ? "Yesterday" : "Today"}`}
            </Button>
            <Button onClick={() => runVerification(verifyDate === 'yesterday', true)}
              disabled={verifying || batchProcessing} variant="outline" size="sm">
              🔄 Force Rerun
            </Button>
          </div>

          {/* Batch progress */}
          {batchProcessing && batchProcessProgress.total > 0 && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{batchProcessProgress.step}</span>
                <span>{batchProcessProgress.current}/{batchProcessProgress.total}</span>
              </div>
              <Progress value={batchProcessProgress.total > 0 ? (batchProcessProgress.current / batchProcessProgress.total) * 100 : 0} className="h-2" />
            </div>
          )}

          {/* Batch results inline */}
          {!batchProcessing && batchProcessProgress.results.correct + batchProcessProgress.results.incorrect > 0 && (
            <div className="flex gap-3 text-sm">
              <span className="text-emerald-500 font-bold">✅ {batchProcessProgress.results.correct}W</span>
              <span className="text-red-500 font-bold">❌ {batchProcessProgress.results.incorrect}L</span>
              {batchProcessProgress.results.pending > 0 && (
                <span className="text-amber-500">⏳ {batchProcessProgress.results.pending} pending</span>
              )}
              <span className="text-muted-foreground">
                {batchProcessProgress.results.correct + batchProcessProgress.results.incorrect > 0
                  ? Math.round(batchProcessProgress.results.correct / (batchProcessProgress.results.correct + batchProcessProgress.results.incorrect) * 100) + '%' : '—'}
              </span>
            </div>
          )}

          {/* Verify results panel */}
          {verifyResult && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                <div className="text-xl font-bold text-emerald-500">
                  {(verifyResult.correct ?? 0) - (verifyResult.props_correct ?? 0)}W - {(verifyResult.incorrect ?? 0) - (verifyResult.props_incorrect ?? 0)}L
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Game Picks</div>
              </div>
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center">
                <div className="text-xl font-bold text-blue-500">
                  {verifyResult.props_correct ?? 0}W - {verifyResult.props_incorrect ?? 0}L
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Prop Picks</div>
                <div className="text-sm font-semibold text-blue-500 mt-1">{verifyResult.props_accuracy ?? 0}%</div>
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                <div className="text-xl font-bold text-amber-500">
                  {verifyResult.correct ?? 0}W - {verifyResult.incorrect ?? 0}L
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Overall</div>
                <div className="text-sm font-semibold text-amber-500 mt-1">{verifyResult.accuracy ?? 0}%</div>
              </div>
              <div className="rounded-lg bg-muted/20 border border-border p-3 text-center">
                <div className="text-xl font-bold text-foreground">{verifyResult.props_pending ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Pending</div>
                <div className="text-xs text-muted-foreground mt-1">{verifyResult.scores_updated ?? 0} scores updated</div>
              </div>
            </div>
          )}

          {verifyResult?.props_pending > 0 && (
            <div className="text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2">
              ⏳ {verifyResult.props_pending} pending — game stats may not be posted yet. Try again later.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accuracy by Prop Type */}
      {Object.keys(accuracyByType).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">🎯 PrizePicks Accuracy by Prop Type</h3>
            <div className="flex gap-4 mb-3 pb-3 border-b border-border">
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-500">{wonCount}W</div>
                <div className="text-[10px] text-muted-foreground">Correct</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-red-500">{lostCount}L</div>
                <div className="text-[10px] text-muted-foreground">Incorrect</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-amber-500">{verifiedAccuracy}%</div>
                <div className="text-[10px] text-muted-foreground">PP Accuracy</div>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(accuracyByType)
                .sort(([, a], [, b]) => (b.correct + b.incorrect) - (a.correct + a.incorrect))
                .map(([type, stats]) => {
                  const total = stats.correct + stats.incorrect;
                  const acc = total > 0 ? Math.round(stats.correct / total * 100) : 0;
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <div className="w-24 text-xs font-medium truncate">{type}</div>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${acc >= 70 ? 'bg-emerald-500' : acc >= 55 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${acc}%` }}
                        />
                      </div>
                      <div className={`text-xs font-bold w-10 text-right ${acc >= 70 ? 'text-emerald-500' : acc >= 55 ? 'text-amber-500' : 'text-red-500'}`}>
                        {acc}%
                      </div>
                      <div className="text-[10px] text-muted-foreground w-14 text-right">
                        {stats.correct}W-{stats.incorrect}L
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 🧠 Intelligence Audit Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">🧠 AI Intelligence Audit</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deep analysis of all verified predictions — find your edge
              </p>
            </div>
            <Button onClick={runIntelligenceAudit} disabled={auditRunning}
              className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {auditRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              {auditRunning ? 'Analyzing...' : '🔬 Run Full Audit'}
            </Button>
          </div>

          {auditData && (
            <div className="space-y-4">
              {/* Overall Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted/20 border border-border p-3 text-center">
                  <div className="text-2xl font-bold text-foreground">{auditData.summary.total}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Total Verified</div>
                </div>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-500">{auditData.summary.correct}W</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Correct</div>
                </div>
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
                  <div className="text-2xl font-bold text-red-500">{auditData.summary.incorrect}L</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Incorrect</div>
                </div>
                <div className={`rounded-lg border p-3 text-center ${auditData.summary.accuracy >= 60 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                  <div className={`text-2xl font-bold ${auditData.summary.accuracy >= 60 ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {auditData.summary.accuracy}%
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Overall Accuracy</div>
                </div>
              </div>

              {/* Game vs Prop split */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/10 border border-border p-3 text-center">
                  <div className="text-lg font-bold">{auditData.game_accuracy?.correct}W-{auditData.game_accuracy?.incorrect}L</div>
                  <div className="text-[10px] text-muted-foreground">Game Picks ({auditData.game_accuracy?.accuracy}%)</div>
                </div>
                <div className="rounded-lg bg-muted/10 border border-border p-3 text-center">
                  <div className="text-lg font-bold">{auditData.prop_accuracy?.correct}W-{auditData.prop_accuracy?.incorrect}L</div>
                  <div className="text-[10px] text-muted-foreground">Prop Picks ({auditData.prop_accuracy?.accuracy}%)</div>
                </div>
              </div>

              {/* AI Recommendations */}
              <div className="rounded-lg border border-border p-4">
                <h4 className="font-bold text-sm mb-3">🎯 AI Improvement Recommendations</h4>
                <div className="space-y-2">
                  {(auditData.recommendations || []).map((rec: string, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/20 text-xs leading-relaxed">
                      {rec}
                    </div>
                  ))}
                </div>
              </div>

              {/* Accuracy by Confidence Range */}
              <div className="rounded-lg border border-border p-4">
                <h4 className="font-bold text-sm mb-3">📊 Accuracy by Confidence Range</h4>
                <div className="space-y-2">
                  {Object.entries(auditData.by_confidence_range || {})
                    .map(([range, stats]: [string, any]) => {
                      const t = stats.correct + stats.incorrect;
                      const acc = t > 0 ? Math.round(stats.correct / t * 100) : 0;
                      return { range, ...stats, total: t, accuracy: acc };
                    })
                    .filter((s: any) => s.total > 0)
                    .sort((a: any, b: any) => b.range.localeCompare(a.range))
                    .map((s: any) => (
                      <div key={s.range} className="flex items-center gap-3">
                        <div className="w-16 text-xs font-mono font-medium">{s.range}%</div>
                        <div className="flex-1 bg-muted rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${s.accuracy >= 65 ? 'bg-emerald-500' : s.accuracy >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${s.accuracy}%` }}
                          />
                        </div>
                        <div className={`text-xs font-bold w-10 text-right ${s.accuracy >= 65 ? 'text-emerald-500' : s.accuracy >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                          {s.accuracy}%
                        </div>
                        <div className="text-[10px] text-muted-foreground w-20 text-right">
                          {s.correct}W-{s.incorrect}L ({s.total})
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Brain Correlation */}
              <div className="rounded-lg border border-border p-4">
                <h4 className="font-bold text-sm mb-2">🧠 Brain Score Correlation</h4>
                <p className="text-[10px] text-muted-foreground mb-3">Avg scores on correct vs incorrect — higher gap = more predictive</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { name: '📊 Stats', key: 'stats' },
                    { name: '💰 Market', key: 'market' },
                    { name: '🧠 Context', key: 'context' },
                  ].map(brain => {
                    const data = auditData.brain_correlation?.[brain.key] || { correct_avg: 0, incorrect_avg: 0 };
                    const gap = data.correct_avg - data.incorrect_avg;
                    return (
                      <div key={brain.key} className="rounded-lg bg-muted/20 p-3">
                        <div className="text-[10px] font-medium mb-2">{brain.name}</div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">✅ Correct:</span>
                          <span className="text-emerald-500 font-bold">{data.correct_avg}</span>
                        </div>
                        <div className="flex justify-between text-[10px] mb-2">
                          <span className="text-muted-foreground">❌ Incorrect:</span>
                          <span className="text-red-500 font-bold">{data.incorrect_avg}</span>
                        </div>
                        <div className={`text-center text-[10px] font-bold py-1 rounded ${gap > 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                          Gap: {gap > 0 ? '+' : ''}{gap}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Prop Type Performance */}
              {auditData.best_prop_types?.length > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <h4 className="font-bold text-sm mb-3">🎯 Prop Type Performance</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-emerald-500 font-bold mb-2">✅ BEST</div>
                      {(auditData.best_prop_types || []).map((t: any) => (
                        <div key={t.type} className="flex justify-between items-center py-1.5 border-b border-border/30">
                          <span className="text-xs">{t.type}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">{t.correct}W-{t.incorrect}L</span>
                            <span className="text-xs font-bold text-emerald-500">{t.accuracy}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] text-red-500 font-bold mb-2">❌ WORST</div>
                      {(auditData.worst_prop_types || []).map((t: any) => (
                        <div key={t.type} className="flex justify-between items-center py-1.5 border-b border-border/30">
                          <span className="text-xs">{t.type}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">{t.correct}W-{t.incorrect}L</span>
                            <span className="text-xs font-bold text-red-500">{t.accuracy}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Over/Under Bias */}
              <div className="rounded-lg border border-border p-4">
                <h4 className="font-bold text-sm mb-3">📈 OVER vs UNDER</h4>
                <div className="grid grid-cols-2 gap-4">
                  {['over', 'under'].map(side => {
                    const stats = auditData.over_under_accuracy?.[side] || { correct: 0, incorrect: 0 };
                    const t = stats.correct + stats.incorrect;
                    const acc = t > 0 ? Math.round(stats.correct / t * 100) : 0;
                    return (
                      <div key={side} className="rounded-lg bg-muted/20 p-3 text-center">
                        <div className="text-sm font-bold mb-1">{side.toUpperCase()}</div>
                        <div className={`text-2xl font-bold ${acc >= 60 ? 'text-emerald-500' : acc >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                          {acc}%
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">{stats.correct}W-{stats.incorrect}L ({t})</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optimal Weights + Apply */}
              <div className="rounded-lg border border-border p-4">
                <h4 className="font-bold text-sm mb-2">⚙️ Optimal Brain Weights</h4>
                <p className="text-[10px] text-muted-foreground mb-3">Based on {auditData.summary.total} predictions</p>
                <div className="flex gap-4 mb-4">
                  {[
                    { label: 'Stats', val: auditData.optimal_weights?.stats },
                    { label: 'Market', val: auditData.optimal_weights?.market },
                    { label: 'Context', val: auditData.optimal_weights?.context },
                  ].map(w => (
                    <div key={w.label} className="text-center flex-1 rounded-lg bg-muted/20 p-3">
                      <div className="text-xl font-bold">{Math.round((w.val || 0) * 100)}%</div>
                      <div className="text-[10px] text-muted-foreground">{w.label}</div>
                    </div>
                  ))}
                </div>
                <Button onClick={applyOptimalWeights} className="w-full" size="sm">
                  ⚡ Apply These Weights to Live System
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>


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
          <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById('pp-file-input')?.click()}>
            <Input id="pp-file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple
              onChange={handleFileSelect} className="hidden" />
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Click or drag PrizePicks screenshot(s)</p>
            <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — up to 5 images</p>
          </div>

          {previews.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {previews.map((url, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <img src={url} alt={`Screenshot ${i + 1}`} className="h-20 rounded border" />
                  <button onClick={(e) => { e.stopPropagation(); setImageFiles(prev => prev.filter((_, j) => j !== i)); setPreviews(prev => prev.filter((_, j) => j !== i)); }}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-[10px]">×</button>
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
          {/* Date toggle for viewing props */}
          <div className="flex items-center justify-between">
            <div className="flex rounded-lg overflow-hidden border border-border text-xs">
              <button onClick={() => setViewDate('today')}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  viewDate === 'today' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/60'
                }`}>Today ({getDateEST(0)})</button>
              <button onClick={() => setViewDate('yesterday')}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  viewDate === 'yesterday' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/60'
                }`}>Yesterday ({getDateEST(-1)})</button>
            </div>
            <div className="text-xs text-muted-foreground">
              {savedProps.length} total | {analyzed.length} analyzed | {unanalyzed.length} need analysis | 🔥 {eliteCount} elite | 💪 {strongCount} strong
              {verifiedTotal > 0 && <> | ✅ {wonCount}W-{lostCount}L ({verifiedAccuracy}%)</>}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
            <Card className="p-2 text-center border-emerald-500/20">
              <p className="text-lg font-bold text-emerald-500">{wonCount}</p>
              <p className="text-[10px] text-muted-foreground">✅ Won</p>
            </Card>
            <Card className="p-2 text-center border-red-500/20">
              <p className="text-lg font-bold text-red-500">{lostCount}</p>
              <p className="text-[10px] text-muted-foreground">❌ Lost</p>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={runUnanalyzed} disabled={batchAnalyzing || !unanalyzed.length} size="sm">
              {batchAnalyzing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Zap className="h-3 w-3 mr-1" />}
              ⚡ Run AI on {unanalyzed.length} Unanalyzed
            </Button>
            <Button onClick={async () => {
              toast.info('Building stat context for all props...');
              try {
                const { data, error } = await supabase.functions.invoke('sbo-build-prop-context', {
                  body: { game_date: viewDate === 'yesterday' ? getDateEST(-1) : getDateEST(0) }
                });
                if (error) throw new Error(error.message);
                toast.success(`Stats built: ${data?.enriched || 0} full, ${data?.partial || 0} partial out of ${data?.total_props || 0}`);
              } catch (e: any) {
                toast.error(`Failed: ${e.message}`);
              }
            }} size="sm" variant="outline">
              <Database className="h-3 w-3 mr-1" /> Build Stats
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
                  ['won', `Won (${wonCount})`],
                  ['lost', `Lost (${lostCount})`],
                  ['over', `OVER (${analyzed.filter(p => p.sbo_predictions[0]?.predicted_outcome?.toUpperCase() === 'OVER').length})`],
                  ['under', `UNDER (${analyzed.filter(p => p.sbo_predictions[0]?.predicted_outcome?.toUpperCase() === 'UNDER').length})`],
                ] as [FilterType, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setActiveFilter(key)}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                      activeFilter === key ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted/70'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
              {propTypes.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => setPropTypeFilter('all')}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium ${
                      propTypeFilter === 'all' ? 'bg-primary/20 text-primary' : 'bg-muted/20 text-muted-foreground'
                    }`}>All Types</button>
                  {propTypes.map(t => {
                    const badge = PROP_TYPE_AUDIT_BADGES[t];
                    return (
                      <button key={t} onClick={() => setPropTypeFilter(t)}
                        className={`px-2 py-1 rounded-md text-[10px] font-medium ${
                          propTypeFilter === t ? 'bg-primary/20 text-primary' : 'bg-muted/20 text-muted-foreground'
                        }`}>
                        {t} ({savedProps.filter(p => normalizePropType(p.prop_type) === t).length})
                        {badge && <span className="ml-1">{badge}</span>}
                      </button>
                    );
                  })}
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
            <p className="text-center text-sm text-muted-foreground py-8">No props match the current filters.</p>
          ) : (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                No PrizePicks props for {viewDate === 'yesterday' ? 'yesterday' : 'today'} ({viewDate === 'yesterday' ? getDateEST(-1) : getDateEST(0)}).
              </p>
              {viewDate === 'today' && (
                <Button variant="outline" size="sm" onClick={() => setViewDate('yesterday')}>
                  View Yesterday's Props
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
