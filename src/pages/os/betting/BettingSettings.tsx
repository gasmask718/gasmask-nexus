import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, MapPin, ShieldCheck, DollarSign, Building2, Layers } from 'lucide-react';
import { StateSelector } from '@/components/betting/StateSelector';
import { useStateCompliance, STATE_LABELS, FORMAT_LABELS, SupportedState } from '@/hooks/useStateCompliance';
import { useToast } from '@/hooks/use-toast';

export default function BettingSettings() {
  const { toast } = useToast();
  const [stateSelectorOpen, setStateSelectorOpen] = useState(false);
  const {
    currentState,
    currentStateRules,
    allowedPlatforms,
    disabledPlatforms,
    allowedFormats,
    bankroll,
    updateBankroll,
    isUpdatingBankroll,
  } = useStateCompliance();

  const [globalBankroll, setGlobalBankroll] = useState(bankroll?.global_bankroll?.toString() || '0');
  const [stateBankrolls, setStateBankrolls] = useState<Record<SupportedState, string>>({
    NY: bankroll?.state_bankrolls?.NY?.toString() || '0',
    GA: bankroll?.state_bankrolls?.GA?.toString() || '0',
    CA: bankroll?.state_bankrolls?.CA?.toString() || '0',
  });
  const [maxPctPerEntry, setMaxPctPerEntry] = useState((bankroll?.max_pct_per_entry || 0.02) * 100);
  const [maxPctPerStatePerDay, setMaxPctPerStatePerDay] = useState((bankroll?.max_pct_per_state_per_day || 0.05) * 100);

  const handleSaveBankroll = () => {
    updateBankroll({
      global_bankroll: parseFloat(globalBankroll) || 0,
      state_bankrolls: {
        NY: parseFloat(stateBankrolls.NY) || 0,
        GA: parseFloat(stateBankrolls.GA) || 0,
        CA: parseFloat(stateBankrolls.CA) || 0,
      },
      max_pct_per_entry: maxPctPerEntry / 100,
      max_pct_per_state_per_day: maxPctPerStatePerDay / 100,
    });
    toast({
      title: 'Bankroll Updated',
      description: 'Your bankroll settings have been saved.',
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Settings & Compliance</h1>
          <p className="text-muted-foreground">Manage your state, platforms, and risk parameters</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* State Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              State Selection
            </CardTitle>
            <CardDescription>
              Your state determines available platforms and entry formats
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">{STATE_LABELS[currentState]}</p>
                <p className="text-sm text-muted-foreground">Current State</p>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-1">
                {currentState}
              </Badge>
            </div>
            <Button onClick={() => setStateSelectorOpen(true)} className="w-full">
              Change State
            </Button>
            <StateSelector open={stateSelectorOpen} onOpenChange={setStateSelectorOpen} />
          </CardContent>
        </Card>

        {/* Compliance Notice */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Compliance Notice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm">{currentStateRules?.tooltip_text || 'Loading state rules...'}</p>
            </div>
            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10">
              <p className="text-sm text-destructive">
                No VPN or location bypass is supported. Cross-state execution is prohibited.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Allowed Platforms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Available Platforms
            </CardTitle>
            <CardDescription>
              Platforms enabled for {STATE_LABELS[currentState]}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allowedPlatforms.map((platform) => (
                <div key={platform.platform_key} className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <span className="font-medium">{platform.platform_name}</span>
                  <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-300">
                    {platform.platform_type === 'sportsbook' ? 'Sportsbook' : 'Pick\'em'}
                  </Badge>
                </div>
              ))}
              {disabledPlatforms.map((platform) => (
                <div key={platform.platform_key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 opacity-50">
                  <span className="font-medium line-through">{platform.platform_name}</span>
                  <Badge variant="secondary">Unavailable</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Allowed Formats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Available Entry Formats
            </CardTitle>
            <CardDescription>
              Entry types enabled for {STATE_LABELS[currentState]}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allowedFormats.map((format) => (
                <div key={format} className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <span className="font-medium">{FORMAT_LABELS[format]}</span>
                </div>
              ))}
              {(['sportsbook_prop', 'same_game_parlay', 'fantasy_pickem', 'live_bet'] as const)
                .filter(f => !allowedFormats.includes(f))
                .map((format) => (
                  <div key={format} className="p-3 rounded-lg bg-muted/50 opacity-50">
                    <span className="font-medium line-through">{FORMAT_LABELS[format]}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Bankroll Management */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Bankroll & Risk Management
            </CardTitle>
            <CardDescription>
              Configure your global and state-specific bankrolls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="global">Global Bankroll</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="global"
                    type="number"
                    className="pl-7"
                    value={globalBankroll}
                    onChange={(e) => setGlobalBankroll(e.target.value)}
                  />
                </div>
              </div>
              {(['NY', 'GA', 'CA'] as SupportedState[]).map((state) => (
                <div key={state} className="space-y-2">
                  <Label htmlFor={`bankroll-${state}`}>{STATE_LABELS[state]} Bankroll</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id={`bankroll-${state}`}
                      type="number"
                      className="pl-7"
                      value={stateBankrolls[state]}
                      onChange={(e) => setStateBankrolls(prev => ({ ...prev, [state]: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxEntry">Max % Per Entry</Label>
                <div className="relative">
                  <Input
                    id="maxEntry"
                    type="number"
                    step="0.5"
                    value={maxPctPerEntry}
                    onChange={(e) => setMaxPctPerEntry(parseFloat(e.target.value) || 0)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">Maximum stake per single entry</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxDaily">Max % Per State Per Day</Label>
                <div className="relative">
                  <Input
                    id="maxDaily"
                    type="number"
                    step="0.5"
                    value={maxPctPerStatePerDay}
                    onChange={(e) => setMaxPctPerStatePerDay(parseFloat(e.target.value) || 0)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">Maximum daily exposure per state</p>
              </div>
            </div>

            <Button onClick={handleSaveBankroll} disabled={isUpdatingBankroll}>
              {isUpdatingBankroll ? 'Saving...' : 'Save Bankroll Settings'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
