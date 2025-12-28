import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Upload, Trash2, CheckCircle, XCircle, FileSpreadsheet, ClipboardPaste, PenLine, Loader2 } from "lucide-react";
import { useMarketLines, useAddMarketLine } from '@/hooks/useBettingSimulation';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface SportsbookLine {
  id: string;
  sport: string;
  market_type: string;
  player_or_team: string;
  opponent: string;
  line_value: string;
  over_odds: string;
  under_odds: string;
  sportsbook: string;
  game_date: string;
  isValid?: boolean;
  validationError?: string;
}

const MARKET_TYPES = ['PTS', 'AST', 'REB', 'PRA', 'Moneyline', '3PM', 'STL', 'BLK', 'TO'];
const SPORTSBOOKS = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet', 'Bet365', 'PrizePicks', 'Underdog', 'Other'];

const createEmptyLine = (): SportsbookLine => ({
  id: crypto.randomUUID(),
  sport: 'NBA',
  market_type: 'PTS',
  player_or_team: '',
  opponent: '',
  line_value: '',
  over_odds: '-110',
  under_odds: '-110',
  sportsbook: 'DraftKings',
  game_date: new Date().toISOString().split('T')[0],
});

export default function LineIntake() {
  const { data: lines, isLoading } = useMarketLines();
  const addLine = useAddMarketLine();

  // Legacy form state (for the old tab)
  const [formData, setFormData] = useState({
    platform: '',
    sport: '',
    league: '',
    event: '',
    market_type: '',
    player_name: '',
    stat_type: '',
    line_value: '',
    over_under: 'over',
    odds_or_payout: '',
    player_recent_avg: '',
    player_recent_std: '',
    player_season_avg: '',
    minutes_trend: '',
    opponent_def_tier: '',
    pace_tier: '',
    home_game: '',
  });

  // New sportsbook line states
  const [manualLines, setManualLines] = useState<SportsbookLine[]>([createEmptyLine()]);
  const [bulkText, setBulkText] = useState('');
  const [parsedLines, setParsedLines] = useState<SportsbookLine[]>([]);
  const [uploadedLines, setUploadedLines] = useState<SportsbookLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    ingested: number;
    simulated: number;
    rejected: number;
    errors: string[];
  } | null>(null);

  // Manual entry handlers
  const addManualLine = () => setManualLines([...manualLines, createEmptyLine()]);
  
  const removeManualLine = (id: string) => {
    if (manualLines.length > 1) {
      setManualLines(manualLines.filter(line => line.id !== id));
    }
  };

  const updateManualLine = (id: string, field: keyof SportsbookLine, value: string) => {
    setManualLines(manualLines.map(line => 
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  // Bulk paste parser
  const parseBulkText = () => {
    const textLines = bulkText.trim().split('\n').filter(l => l.trim());
    if (textLines.length === 0) {
      toast.error('No lines to parse');
      return;
    }

    const parsed: SportsbookLine[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const line of textLines) {
      const parts = line.split(/[|\t,]/).map(p => p.trim()).filter(Boolean);
      
      if (parts.length >= 4) {
        const entry: SportsbookLine = {
          id: crypto.randomUUID(),
          sport: 'NBA',
          player_or_team: parts[0] || '',
          market_type: parts[1]?.toUpperCase() || 'PTS',
          line_value: parts[2] || '',
          over_odds: parts[3] || '-110',
          under_odds: parts[4] || '-110',
          sportsbook: parts[5] || 'Unknown',
          opponent: parts[6] || '',
          game_date: today,
        };
        parsed.push(entry);
      }
    }

    if (parsed.length === 0) {
      toast.error('Could not parse lines. Format: Player | Market | Line | OverOdds | UnderOdds | Book');
    } else {
      setParsedLines(parsed);
      toast.success(`Parsed ${parsed.length} lines`);
    }
  };

  // CSV/Excel upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        const today = new Date().toISOString().split('T')[0];
        const parsed: SportsbookLine[] = json.map((row) => ({
          id: crypto.randomUUID(),
          sport: String(row.Sport || row.sport || 'NBA'),
          market_type: String(row.Market || row.market_type || row.MarketType || 'PTS').toUpperCase(),
          player_or_team: String(row.Player || row.player_or_team || row.Team || row.team || ''),
          opponent: String(row.Opponent || row.opponent || ''),
          line_value: String(row.Line || row.line_value || row.LineValue || ''),
          over_odds: String(row.OverOdds || row.over_odds || row.Over || '-110'),
          under_odds: String(row.UnderOdds || row.under_odds || row.Under || '-110'),
          sportsbook: String(row.Book || row.sportsbook || row.Sportsbook || 'Unknown'),
          game_date: String(row.Date || row.game_date || today),
        }));

        setUploadedLines(parsed);
        toast.success(`Loaded ${parsed.length} lines from file`);
      } catch (err) {
        toast.error('Failed to parse file');
        console.error(err);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Submit sportsbook lines
  const submitSportsbookLines = async (linesToSubmit: SportsbookLine[]) => {
    if (linesToSubmit.length === 0) {
      toast.error('No lines to submit');
      return;
    }

    setIsSubmitting(true);
    setSubmissionResult(null);

    const validLines: SportsbookLine[] = [];
    const errors: string[] = [];

    for (const line of linesToSubmit) {
      if (!line.player_or_team.trim()) {
        errors.push(`Missing player/team name`);
        line.isValid = false;
        line.validationError = 'Missing player/team';
        continue;
      }
      if (!line.line_value && line.market_type !== 'Moneyline') {
        errors.push(`${line.player_or_team}: Missing line value`);
        line.isValid = false;
        line.validationError = 'Missing line value';
        continue;
      }
      line.isValid = true;
      validLines.push(line);
    }

    try {
      const insertData = validLines.map(line => ({
        sport: line.sport,
        market_type: line.market_type,
        player_or_team: line.player_or_team,
        opponent: line.opponent || null,
        line_value: line.line_value ? parseFloat(line.line_value) : null,
        over_odds: line.over_odds ? parseInt(line.over_odds) : null,
        under_odds: line.under_odds ? parseInt(line.under_odds) : null,
        sportsbook: line.sportsbook,
        game_date: line.game_date,
        is_valid: true,
      }));

      const { data: insertedLines, error: insertError } = await supabase
        .from('sportsbook_lines')
        .insert(insertData)
        .select();

      if (insertError) throw insertError;

      // Run simulation
      const { data: simResult, error: simError } = await supabase.functions.invoke('simulate-lines', {
        body: { line_ids: insertedLines?.map(l => l.id) || [] }
      });

      if (simError) console.error('Simulation error:', simError);

      setSubmissionResult({
        ingested: insertedLines?.length || 0,
        simulated: simResult?.simulated || 0,
        rejected: errors.length,
        errors: errors.slice(0, 5),
      });

      toast.success(`Ingested ${insertedLines?.length || 0} lines`);
      setManualLines([createEmptyLine()]);
      setBulkText('');
      setParsedLines([]);
      setUploadedLines([]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit lines';
      toast.error(errorMessage);
      setSubmissionResult({
        ingested: 0,
        simulated: 0,
        rejected: linesToSubmit.length,
        errors: [errorMessage],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Legacy form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.platform || !formData.event || !formData.market_type || !formData.line_value) {
      toast.error('Please fill in required fields');
      return;
    }

    await addLine.mutateAsync({
      platform: formData.platform,
      sport: formData.sport,
      league: formData.league || undefined,
      event: formData.event,
      market_type: formData.market_type as 'fantasy_prop' | 'moneyline' | 'player_prop' | 'spread' | 'total',
      player_name: formData.player_name || undefined,
      stat_type: formData.stat_type || undefined,
      line_value: parseFloat(formData.line_value),
      over_under: formData.over_under,
      odds_or_payout: parseFloat(formData.odds_or_payout) || -110,
      player_recent_avg: formData.player_recent_avg ? parseFloat(formData.player_recent_avg) : undefined,
      player_recent_std: formData.player_recent_std ? parseFloat(formData.player_recent_std) : undefined,
      player_season_avg: formData.player_season_avg ? parseFloat(formData.player_season_avg) : undefined,
      minutes_trend: formData.minutes_trend || undefined,
      opponent_def_tier: formData.opponent_def_tier || undefined,
      pace_tier: formData.pace_tier || undefined,
      home_game: formData.home_game === 'true' ? true : formData.home_game === 'false' ? false : undefined,
    });

    setFormData({
      platform: '', sport: '', league: '', event: '', market_type: '', player_name: '',
      stat_type: '', line_value: '', over_under: 'over', odds_or_payout: '',
      player_recent_avg: '', player_recent_std: '', player_season_avg: '',
      minutes_trend: '', opponent_def_tier: '', pace_tier: '', home_game: '',
    });
  };

  const isPlayerProp = formData.market_type === 'player_prop' || formData.market_type === 'fantasy_prop';

  const LinePreviewTable = ({ lineData, onSubmit }: { lineData: SportsbookLine[]; onSubmit: () => void }) => (
    <div className="space-y-4">
      <div className="rounded-md border max-h-[400px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player/Team</TableHead>
              <TableHead>Market</TableHead>
              <TableHead>Line</TableHead>
              <TableHead>Over</TableHead>
              <TableHead>Under</TableHead>
              <TableHead>Book</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineData.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="font-medium">{line.player_or_team}</TableCell>
                <TableCell><Badge variant="outline">{line.market_type}</Badge></TableCell>
                <TableCell>{line.line_value}</TableCell>
                <TableCell className="text-green-600">{line.over_odds}</TableCell>
                <TableCell className="text-red-600">{line.under_odds}</TableCell>
                <TableCell>{line.sportsbook}</TableCell>
                <TableCell>
                  {line.isValid === false ? (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      {line.validationError}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Ready
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button onClick={onSubmit} disabled={isSubmitting} className="w-full">
        {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        Submit {lineData.length} Lines
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-background via-background to-purple-950/10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Line Intake</h1>
          <p className="text-muted-foreground">Upload sportsbook lines for AI simulation and comparison</p>
        </div>
      </div>

      {submissionResult && (
        <Card className={submissionResult.rejected > 0 ? 'border-yellow-500' : 'border-green-500'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              {submissionResult.rejected === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-yellow-500" />
              )}
              Submission Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{submissionResult.ingested}</div>
                <div className="text-sm text-muted-foreground">Lines Ingested</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{submissionResult.simulated}</div>
                <div className="text-sm text-muted-foreground">Simulated</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{submissionResult.rejected}</div>
                <div className="text-sm text-muted-foreground">Rejected</div>
              </div>
            </div>
            {submissionResult.errors.length > 0 && (
              <div className="mt-4 text-sm text-muted-foreground">
                <p className="font-medium">Errors:</p>
                <ul className="list-disc list-inside">{submissionResult.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="quick" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="quick" className="gap-2"><PenLine className="h-4 w-4" />Quick Entry</TabsTrigger>
          <TabsTrigger value="multi" className="gap-2"><Plus className="h-4 w-4" />Multi-Line</TabsTrigger>
          <TabsTrigger value="bulk" className="gap-2"><ClipboardPaste className="h-4 w-4" />Bulk Paste</TabsTrigger>
          <TabsTrigger value="upload" className="gap-2"><FileSpreadsheet className="h-4 w-4" />CSV/Excel</TabsTrigger>
        </TabsList>

        {/* Quick Entry (Legacy Form) */}
        <TabsContent value="quick">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-purple-500" />
                  Add Market Line
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Platform *</Label>
                      <Select value={formData.platform} onValueChange={(v) => setFormData(p => ({ ...p, platform: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                        <SelectContent>
                          {SPORTSBOOKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Market Type *</Label>
                      <Select value={formData.market_type} onValueChange={(v) => setFormData(p => ({ ...p, market_type: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="spread">Spread</SelectItem>
                          <SelectItem value="total">Total</SelectItem>
                          <SelectItem value="moneyline">Moneyline</SelectItem>
                          <SelectItem value="player_prop">Player Prop</SelectItem>
                          <SelectItem value="fantasy_prop">Fantasy Prop</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sport</Label>
                      <Select value={formData.sport} onValueChange={(v) => setFormData(p => ({ ...p, sport: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select sport" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NBA">NBA</SelectItem>
                          <SelectItem value="NFL">NFL</SelectItem>
                          <SelectItem value="MLB">MLB</SelectItem>
                          <SelectItem value="NHL">NHL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>League</Label>
                      <Input placeholder="e.g., Eastern Conference" value={formData.league} onChange={(e) => setFormData(p => ({ ...p, league: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Event *</Label>
                      <Input placeholder="Lakers vs Warriors" value={formData.event} onChange={(e) => setFormData(p => ({ ...p, event: e.target.value }))} />
                    </div>
                    {isPlayerProp && (
                      <>
                        <div className="space-y-2">
                          <Label>Player Name *</Label>
                          <Input placeholder="LeBron James" value={formData.player_name} onChange={(e) => setFormData(p => ({ ...p, player_name: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Stat Type *</Label>
                          <Select value={formData.stat_type} onValueChange={(v) => setFormData(p => ({ ...p, stat_type: v }))}>
                            <SelectTrigger><SelectValue placeholder="Select stat" /></SelectTrigger>
                            <SelectContent>
                              {MARKET_TYPES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    <div className="space-y-2">
                      <Label>Line Value *</Label>
                      <Input type="number" step="0.5" placeholder="25.5" value={formData.line_value} onChange={(e) => setFormData(p => ({ ...p, line_value: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Over/Under</Label>
                      <Select value={formData.over_under} onValueChange={(v) => setFormData(p => ({ ...p, over_under: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="over">Over</SelectItem>
                          <SelectItem value="under">Under</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Odds</Label>
                      <Input placeholder="-110" value={formData.odds_or_payout} onChange={(e) => setFormData(p => ({ ...p, odds_or_payout: e.target.value }))} />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-blue-500" disabled={addLine.isPending}>
                    {addLine.isPending ? 'Saving...' : 'Save Line'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Recent Lines</span>
                  <Badge variant="outline">{lines?.length || 0} total</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground text-center py-8">Loading...</p>
                ) : lines && lines.length > 0 ? (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {lines.slice(0, 15).map((line, i) => (
                      <div key={line.id || i} className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{line.platform}</Badge>
                              <Badge variant="outline" className="text-xs">{line.market_type}</Badge>
                            </div>
                            <p className="font-medium mt-1">{line.player_name || line.event}</p>
                            <p className="text-sm text-muted-foreground">{line.over_under} {line.line_value} {line.stat_type}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{line.odds_or_payout}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p className="text-muted-foreground mt-4">No lines added yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Multi-Line Entry */}
        <TabsContent value="multi">
          <Card>
            <CardHeader>
              <CardTitle>Multi-Line Entry</CardTitle>
              <CardDescription>Add multiple sportsbook lines before submitting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {manualLines.map((line) => (
                <div key={line.id} className="grid grid-cols-12 gap-2 items-end p-4 border rounded-lg">
                  <div className="col-span-2">
                    <Label className="text-xs">Player/Team</Label>
                    <Input value={line.player_or_team} onChange={(e) => updateManualLine(line.id, 'player_or_team', e.target.value)} placeholder="LeBron James" />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">Market</Label>
                    <Select value={line.market_type} onValueChange={(v) => updateManualLine(line.id, 'market_type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MARKET_TYPES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">Line</Label>
                    <Input type="number" value={line.line_value} onChange={(e) => updateManualLine(line.id, 'line_value', e.target.value)} placeholder="24.5" />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">Over</Label>
                    <Input value={line.over_odds} onChange={(e) => updateManualLine(line.id, 'over_odds', e.target.value)} placeholder="-110" />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">Under</Label>
                    <Input value={line.under_odds} onChange={(e) => updateManualLine(line.id, 'under_odds', e.target.value)} placeholder="-110" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Opponent</Label>
                    <Input value={line.opponent} onChange={(e) => updateManualLine(line.id, 'opponent', e.target.value)} placeholder="vs GSW" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Book</Label>
                    <Select value={line.sportsbook} onValueChange={(v) => updateManualLine(line.id, 'sportsbook', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SPORTSBOOKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={line.game_date} onChange={(e) => updateManualLine(line.id, 'game_date', e.target.value)} />
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" onClick={() => removeManualLine(line.id)} disabled={manualLines.length === 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" onClick={addManualLine} className="gap-2"><Plus className="h-4 w-4" />Add Line</Button>
                <Button onClick={() => submitSportsbookLines(manualLines)} disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Submit Lines
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Paste */}
        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Paste</CardTitle>
              <CardDescription>Paste multiple lines: <code>Player | Market | Line | OverOdds | UnderOdds | Book</code></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder={`LeBron James | PTS | 24.5 | -110 | -110 | DraftKings
Stephen Curry | 3PM | 4.5 | -115 | -105 | FanDuel
Kevin Durant | PRA | 42.5 | -110 | -110 | BetMGM`}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <Button onClick={parseBulkText} variant="outline" className="gap-2"><ClipboardPaste className="h-4 w-4" />Parse Lines</Button>
              {parsedLines.length > 0 && <LinePreviewTable lineData={parsedLines} onSubmit={() => submitSportsbookLines(parsedLines)} />}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CSV/Excel Upload */}
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>CSV / Excel Upload</CardTitle>
              <CardDescription>Upload a file with columns: Player, Market, Line, OverOdds, UnderOdds, Book, Opponent, Date</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="max-w-xs mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Supports .csv, .xlsx, .xls</p>
              </div>
              <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
                <p className="font-medium mb-2">Expected columns:</p>
                <code className="text-xs">Player, Market, Line, OverOdds, UnderOdds, Book, Opponent, Date</code>
              </div>
              {uploadedLines.length > 0 && <LinePreviewTable lineData={uploadedLines} onSubmit={() => submitSportsbookLines(uploadedLines)} />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-center text-muted-foreground mt-8">For informational and entertainment purposes only. Not a sportsbook.</p>
    </div>
  );
}
