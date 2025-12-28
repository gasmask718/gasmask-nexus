import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Check, AlertTriangle, Building2, Layers, FileText, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStateCompliance, FORMAT_LABELS, FormatTag, PlatformKey } from '@/hooks/useStateCompliance';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const STEPS = ['Platform', 'Format', 'Details', 'Confirm'];

export default function PickEntryWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { 
    currentState, 
    allowedPlatforms, 
    allowedFormats, 
    isPlatformAllowed, 
    isFormatAllowed,
    validateStake,
    bankroll,
  } = useStateCompliance();

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    platform: '' as PlatformKey | '',
    format_tag: '' as FormatTag | '',
    sport: 'NBA',
    player: '',
    team: '',
    opponent: '',
    market: '',
    line_value: '',
    side: '' as 'MORE' | 'LESS' | 'over' | 'under' | 'home' | 'away' | '',
    stake: '',
    odds: '',
    multiplier: '',
    notes: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  // Fetch daily stake total for current state
  const { data: dailyTotal } = useQuery({
    queryKey: ['daily-stake-total', currentState, formData.date],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data, error } = await supabase
        .from('pick_entries')
        .select('stake')
        .eq('user_id', user.id)
        .eq('state', currentState)
        .eq('date', formData.date);

      if (error) throw error;
      return data?.reduce((sum, row) => sum + (row.stake || 0), 0) || 0;
    },
  });

  const stakeValidation = validateStake(parseFloat(formData.stake) || 0, dailyTotal || 0);

  const createEntryMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Validate platform + format for state
      if (!isPlatformAllowed(formData.platform as PlatformKey)) {
        throw new Error(`Platform ${formData.platform} is not available in ${currentState}`);
      }
      if (!isFormatAllowed(formData.format_tag as FormatTag)) {
        throw new Error(`Format ${formData.format_tag} is not available in ${currentState}`);
      }

      const { error } = await supabase.from('pick_entries').insert({
        user_id: user.id,
        date: formData.date,
        state: currentState,
        platform: formData.platform,
        sport: formData.sport,
        format_tag: formData.format_tag,
        player: formData.player || null,
        team: formData.team || null,
        opponent: formData.opponent || null,
        market: formData.market,
        line_value: formData.line_value ? parseFloat(formData.line_value) : null,
        side: formData.side || null,
        stake: parseFloat(formData.stake),
        odds: formData.odds ? parseFloat(formData.odds) : null,
        multiplier: formData.multiplier ? parseFloat(formData.multiplier) : null,
        notes: formData.notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Entry Created', description: 'Your pick entry has been logged.' });
      queryClient.invalidateQueries({ queryKey: ['pick-entries'] });
      navigate('/os/sports-betting/entries');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const canProceed = () => {
    switch (step) {
      case 0: return !!formData.platform;
      case 1: return !!formData.format_tag;
      case 2: return !!formData.market && !!formData.stake && stakeValidation.valid;
      case 3: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else createEntryMutation.mutate();
  };

  const isSportsbook = formData.format_tag && formData.format_tag !== 'fantasy_pickem';

  return (
    <div className="space-y-6 p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">New Entry</h1>
          <p className="text-muted-foreground">Log a new pick for {currentState}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= step ? 'text-primary font-medium' : 'text-muted-foreground'}>
              {s}
            </span>
          ))}
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {step === 0 && <Building2 className="h-5 w-5" />}
            {step === 1 && <Layers className="h-5 w-5" />}
            {step === 2 && <FileText className="h-5 w-5" />}
            {step === 3 && <Check className="h-5 w-5" />}
            {STEPS[step]}
          </CardTitle>
          <CardDescription>
            {step === 0 && 'Select the platform for this entry'}
            {step === 1 && 'Choose the entry format'}
            {step === 2 && 'Enter the details of your pick'}
            {step === 3 && 'Review and confirm your entry'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 0: Platform */}
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {allowedPlatforms.map((platform) => (
                <button
                  key={platform.platform_key}
                  onClick={() => setFormData(prev => ({ ...prev, platform: platform.platform_key }))}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    formData.platform === platform.platform_key
                      ? 'border-primary bg-primary/10'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="font-medium">{platform.platform_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {platform.platform_type === 'sportsbook' ? 'Sportsbook' : 'Pick\'em'}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 1: Format */}
          {step === 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {allowedFormats.map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormData(prev => ({ ...prev, format_tag: fmt }))}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    formData.format_tag === fmt
                      ? 'border-primary bg-primary/10'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="font-medium">{FORMAT_LABELS[fmt]}</div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sport">Sport</Label>
                  <Select value={formData.sport} onValueChange={(v) => setFormData(prev => ({ ...prev, sport: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NBA">NBA</SelectItem>
                      <SelectItem value="NFL">NFL</SelectItem>
                      <SelectItem value="MLB">MLB</SelectItem>
                      <SelectItem value="NHL">NHL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="player">Player (optional)</Label>
                  <Input
                    id="player"
                    placeholder="e.g., LeBron James"
                    value={formData.player}
                    onChange={(e) => setFormData(prev => ({ ...prev, player: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team">Team (optional)</Label>
                  <Input
                    id="team"
                    placeholder="e.g., Lakers"
                    value={formData.team}
                    onChange={(e) => setFormData(prev => ({ ...prev, team: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="market">Market *</Label>
                  <Input
                    id="market"
                    placeholder="PTS, AST, Moneyline..."
                    value={formData.market}
                    onChange={(e) => setFormData(prev => ({ ...prev, market: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="line">Line Value</Label>
                  <Input
                    id="line"
                    type="number"
                    step="0.5"
                    placeholder="25.5"
                    value={formData.line_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, line_value: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="side">Side</Label>
                  <Select value={formData.side} onValueChange={(v: any) => setFormData(prev => ({ ...prev, side: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {formData.format_tag === 'fantasy_pickem' ? (
                        <>
                          <SelectItem value="MORE">
                            <span className="flex items-center gap-2">
                              <span className="text-green-600">▲</span> MORE
                            </span>
                          </SelectItem>
                          <SelectItem value="LESS">
                            <span className="flex items-center gap-2">
                              <span className="text-red-600">▼</span> LESS
                            </span>
                          </SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="over">Over</SelectItem>
                          <SelectItem value="under">Under</SelectItem>
                          <SelectItem value="home">Home</SelectItem>
                          <SelectItem value="away">Away</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="stake">Stake *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="stake"
                      type="number"
                      className="pl-7"
                      placeholder="50"
                      value={formData.stake}
                      onChange={(e) => setFormData(prev => ({ ...prev, stake: e.target.value }))}
                    />
                  </div>
                  {!stakeValidation.valid && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {stakeValidation.error}
                    </p>
                  )}
                </div>
                {isSportsbook && (
                  <div className="space-y-2">
                    <Label htmlFor="odds">Odds</Label>
                    <Input
                      id="odds"
                      type="number"
                      placeholder="-110"
                      value={formData.odds}
                      onChange={(e) => setFormData(prev => ({ ...prev, odds: e.target.value }))}
                    />
                  </div>
                )}
                {!isSportsbook && (
                  <div className="space-y-2">
                    <Label htmlFor="multiplier">Multiplier</Label>
                    <Input
                      id="multiplier"
                      type="number"
                      step="0.1"
                      placeholder="3x"
                      value={formData.multiplier}
                      onChange={(e) => setFormData(prev => ({ ...prev, multiplier: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Optional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">State</span>
                  <Badge>{currentState}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform</span>
                  <span className="font-medium">{formData.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format</span>
                  <span className="font-medium">{FORMAT_LABELS[formData.format_tag as FormatTag]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{formData.date}</span>
                </div>
                {formData.player && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Player</span>
                    <span className="font-medium">{formData.player}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Market</span>
                  <span className="font-medium flex items-center gap-1">
                    {formData.market} {formData.line_value}{' '}
                    {formData.side === 'MORE' && <span className="text-green-600">▲ MORE</span>}
                    {formData.side === 'LESS' && <span className="text-red-600">▼ LESS</span>}
                    {formData.side && !['MORE', 'LESS'].includes(formData.side) && (
                      <span className="capitalize">({formData.side})</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stake</span>
                  <span className="font-medium">${formData.stake}</span>
                </div>
                {formData.odds && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Odds</span>
                    <span className="font-medium">{formData.odds}</span>
                  </div>
                )}
                {formData.multiplier && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Multiplier</span>
                    <span className="font-medium">{formData.multiplier}x</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canProceed() || createEntryMutation.isPending}
        >
          {step === STEPS.length - 1 ? (
            <>
              <Save className="h-4 w-4 mr-1" />
              {createEntryMutation.isPending ? 'Saving...' : 'Save Entry'}
            </>
          ) : (
            <>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
