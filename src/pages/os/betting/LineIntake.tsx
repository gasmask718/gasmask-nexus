import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Trash2, CheckCircle } from "lucide-react";
import { useMarketLines, useAddMarketLine } from '@/hooks/useBettingSimulation';
import { toast } from 'sonner';

export default function LineIntake() {
  const { data: lines, isLoading } = useMarketLines();
  const addLine = useAddMarketLine();

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
  });

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
    });

    // Reset form
    setFormData({
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
    });
  };

  const isPlayerProp = formData.market_type === 'player_prop' || formData.market_type === 'fantasy_prop';

  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-background via-background to-purple-950/10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Line Intake</h1>
          <p className="text-muted-foreground">Add sportsbook and pick'em lines for simulation</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Line Form */}
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
                  <Select 
                    value={formData.platform} 
                    onValueChange={(v) => setFormData(p => ({ ...p, platform: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FanDuel">FanDuel</SelectItem>
                      <SelectItem value="DraftKings">DraftKings</SelectItem>
                      <SelectItem value="BetMGM">BetMGM</SelectItem>
                      <SelectItem value="Caesars">Caesars</SelectItem>
                      <SelectItem value="PrizePicks">PrizePicks</SelectItem>
                      <SelectItem value="Underdog">Underdog</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Market Type *</Label>
                  <Select 
                    value={formData.market_type} 
                    onValueChange={(v) => setFormData(p => ({ ...p, market_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spread">Spread</SelectItem>
                      <SelectItem value="total">Total</SelectItem>
                      <SelectItem value="moneyline">Moneyline</SelectItem>
                      <SelectItem value="player_prop">Player Prop</SelectItem>
                      <SelectItem value="fantasy_prop">Fantasy Prop (Pick'em)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sport</Label>
                  <Select 
                    value={formData.sport} 
                    onValueChange={(v) => setFormData(p => ({ ...p, sport: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sport" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NBA">NBA</SelectItem>
                      <SelectItem value="NFL">NFL</SelectItem>
                      <SelectItem value="MLB">MLB</SelectItem>
                      <SelectItem value="NHL">NHL</SelectItem>
                      <SelectItem value="NCAAB">NCAAB</SelectItem>
                      <SelectItem value="NCAAF">NCAAF</SelectItem>
                      <SelectItem value="Soccer">Soccer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>League</Label>
                  <Input 
                    placeholder="e.g., Eastern Conference"
                    value={formData.league}
                    onChange={(e) => setFormData(p => ({ ...p, league: e.target.value }))}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Event *</Label>
                  <Input 
                    placeholder="Lakers vs Warriors"
                    value={formData.event}
                    onChange={(e) => setFormData(p => ({ ...p, event: e.target.value }))}
                  />
                </div>

                {isPlayerProp && (
                  <>
                    <div className="space-y-2">
                      <Label>Player Name *</Label>
                      <Input 
                        placeholder="LeBron James"
                        value={formData.player_name}
                        onChange={(e) => setFormData(p => ({ ...p, player_name: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Stat Type *</Label>
                      <Select 
                        value={formData.stat_type} 
                        onValueChange={(v) => setFormData(p => ({ ...p, stat_type: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select stat" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PTS">Points (PTS)</SelectItem>
                          <SelectItem value="AST">Assists (AST)</SelectItem>
                          <SelectItem value="REB">Rebounds (REB)</SelectItem>
                          <SelectItem value="PRA">Pts+Reb+Ast (PRA)</SelectItem>
                          <SelectItem value="3PM">3-Pointers Made</SelectItem>
                          <SelectItem value="STL">Steals</SelectItem>
                          <SelectItem value="BLK">Blocks</SelectItem>
                          <SelectItem value="YDS">Passing Yards</SelectItem>
                          <SelectItem value="TD">Touchdowns</SelectItem>
                          <SelectItem value="REC">Receptions</SelectItem>
                          <SelectItem value="RUSH">Rushing Yards</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Line Value *</Label>
                  <Input 
                    type="number"
                    step="0.5"
                    placeholder="25.5"
                    value={formData.line_value}
                    onChange={(e) => setFormData(p => ({ ...p, line_value: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Over/Under</Label>
                  <Select 
                    value={formData.over_under} 
                    onValueChange={(v) => setFormData(p => ({ ...p, over_under: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="over">Over</SelectItem>
                      <SelectItem value="under">Under</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Odds/Payout</Label>
                  <Input 
                    type="text"
                    placeholder="-110 or 1.9x"
                    value={formData.odds_or_payout}
                    onChange={(e) => setFormData(p => ({ ...p, odds_or_payout: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    American odds (e.g., -110) or payout multiplier (e.g., 1.9)
                  </p>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-purple-600 to-blue-500"
                disabled={addLine.isPending}
              >
                {addLine.isPending ? 'Saving...' : 'Save Line'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Lines */}
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
                {lines.slice(0, 20).map((line, i) => (
                  <div key={line.id || i} className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{line.platform}</Badge>
                          <Badge variant="outline" className="text-xs">{line.sport}</Badge>
                          <Badge variant="outline" className="text-xs">{line.market_type}</Badge>
                        </div>
                        <p className="font-medium mt-1">{line.event}</p>
                        {line.player_name && (
                          <p className="text-sm text-muted-foreground">
                            {line.player_name} {line.over_under} {line.line_value} {line.stat_type}
                          </p>
                        )}
                        {!line.player_name && line.line_value && (
                          <p className="text-sm text-muted-foreground">
                            Line: {line.line_value}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{line.odds_or_payout}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(line.created_at || '').toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="text-muted-foreground mt-4">No lines added yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add market lines to start simulating</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      {lines && lines.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{lines.filter(l => l.market_type === 'player_prop').length}</p>
              <p className="text-sm text-muted-foreground">Player Props</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{lines.filter(l => l.market_type === 'fantasy_prop').length}</p>
              <p className="text-sm text-muted-foreground">Pick'em Props</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{new Set(lines.map(l => l.platform)).size}</p>
              <p className="text-sm text-muted-foreground">Platforms</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{new Set(lines.map(l => l.sport)).size}</p>
              <p className="text-sm text-muted-foreground">Sports</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-center text-muted-foreground mt-8">
        For informational and entertainment purposes only. Not a sportsbook.
      </p>
    </div>
  );
}
