import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useManualBackfill, CreateBackfillInput } from '@/hooks/useManualBackfill';
import { format } from 'date-fns';
import { CalendarIcon, Plus, CheckCircle, XCircle, MinusCircle, Trophy, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const NBA_TEAMS = [
  'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets',
  'Chicago Bulls', 'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets',
  'Detroit Pistons', 'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers',
  'LA Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies', 'Miami Heat',
  'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
  'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns',
  'Portland Trail Blazers', 'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors',
  'Utah Jazz', 'Washington Wizards'
];

const STAT_TYPES = ['Points', 'Rebounds', 'Assists', 'Steals', 'Blocks', 'Threes', 'PRA'];

export function ManualBackfill() {
  const { entries, isLoading, stats, createEntry, dateRange, setDateRange } = useManualBackfill();
  const [market, setMarket] = useState<'Moneyline' | 'Player Prop'>('Moneyline');
  const [formData, setFormData] = useState<Partial<CreateBackfillInput>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    sport: 'NBA',
    market: 'Moneyline',
    result: 'W'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.date || !formData.result) {
      return;
    }

    if (market === 'Moneyline' && (!formData.home_team || !formData.away_team || !formData.predicted_side)) {
      return;
    }

    if (market === 'Player Prop' && (!formData.player_name || !formData.stat_type || !formData.predicted_direction)) {
      return;
    }

    createEntry.mutate({
      ...formData,
      market
    } as CreateBackfillInput);

    // Reset form
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      sport: 'NBA',
      market: 'Moneyline',
      result: 'W'
    });
  };

  const ResultIcon = ({ result }: { result: string }) => {
    switch (result) {
      case 'W':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'L':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <MinusCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Entries</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Wins</p>
                <p className="text-2xl font-bold text-green-500">{stats.wins}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Losses</p>
                <p className="text-2xl font-bold text-red-500">{stats.losses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Entry Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Manual Backfill Entry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Date Selection */}
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.date ? format(new Date(formData.date), 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.date ? new Date(formData.date) : undefined}
                      onSelect={(date) => setFormData({ ...formData, date: date ? format(date, 'yyyy-MM-dd') : '' })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Market Type */}
              <div className="space-y-2">
                <Label>Market Type</Label>
                <Tabs value={market} onValueChange={(v) => setMarket(v as 'Moneyline' | 'Player Prop')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="Moneyline">Moneyline</TabsTrigger>
                    <TabsTrigger value="Player Prop">Player Prop</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {market === 'Moneyline' ? (
                <>
                  {/* Home Team */}
                  <div className="space-y-2">
                    <Label>Home Team</Label>
                    <Select
                      value={formData.home_team}
                      onValueChange={(v) => setFormData({ ...formData, home_team: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select home team" />
                      </SelectTrigger>
                      <SelectContent>
                        {NBA_TEAMS.map(team => (
                          <SelectItem key={team} value={team}>{team}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Away Team */}
                  <div className="space-y-2">
                    <Label>Away Team</Label>
                    <Select
                      value={formData.away_team}
                      onValueChange={(v) => setFormData({ ...formData, away_team: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select away team" />
                      </SelectTrigger>
                      <SelectContent>
                        {NBA_TEAMS.map(team => (
                          <SelectItem key={team} value={team}>{team}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Predicted Side */}
                  <div className="space-y-2">
                    <Label>Predicted Winner</Label>
                    <Select
                      value={formData.predicted_side}
                      onValueChange={(v) => setFormData({ ...formData, predicted_side: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select prediction" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Home">Home Team</SelectItem>
                        <SelectItem value="Away">Away Team</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Actual Winner */}
                  <div className="space-y-2">
                    <Label>Actual Winner</Label>
                    <Select
                      value={formData.actual_winner}
                      onValueChange={(v) => setFormData({ ...formData, actual_winner: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select actual winner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Home">Home Team</SelectItem>
                        <SelectItem value="Away">Away Team</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Scores */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Home Score</Label>
                      <Input
                        type="number"
                        value={formData.home_score || ''}
                        onChange={(e) => setFormData({ ...formData, home_score: parseInt(e.target.value) || undefined })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Away Score</Label>
                      <Input
                        type="number"
                        value={formData.away_score || ''}
                        onChange={(e) => setFormData({ ...formData, away_score: parseInt(e.target.value) || undefined })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Player Name */}
                  <div className="space-y-2">
                    <Label>Player Name</Label>
                    <Input
                      value={formData.player_name || ''}
                      onChange={(e) => setFormData({ ...formData, player_name: e.target.value })}
                      placeholder="e.g. LeBron James"
                    />
                  </div>

                  {/* Stat Type */}
                  <div className="space-y-2">
                    <Label>Stat Type</Label>
                    <Select
                      value={formData.stat_type}
                      onValueChange={(v) => setFormData({ ...formData, stat_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select stat type" />
                      </SelectTrigger>
                      <SelectContent>
                        {STAT_TYPES.map(stat => (
                          <SelectItem key={stat} value={stat}>{stat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Prop Line */}
                  <div className="space-y-2">
                    <Label>Prop Line</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={formData.prop_line || ''}
                      onChange={(e) => setFormData({ ...formData, prop_line: parseFloat(e.target.value) || undefined })}
                      placeholder="e.g. 25.5"
                    />
                  </div>

                  {/* Predicted Direction */}
                  <div className="space-y-2">
                    <Label>Predicted Direction</Label>
                    <Select
                      value={formData.predicted_direction}
                      onValueChange={(v) => setFormData({ ...formData, predicted_direction: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select direction" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MORE">MORE (Over)</SelectItem>
                        <SelectItem value="LESS">LESS (Under)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Actual Stat Value */}
                  <div className="space-y-2">
                    <Label>Actual Stat Value</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.actual_stat_value || ''}
                      onChange={(e) => setFormData({ ...formData, actual_stat_value: parseFloat(e.target.value) || undefined })}
                      placeholder="e.g. 28"
                    />
                  </div>
                </>
              )}

              {/* Confidence */}
              <div className="space-y-2">
                <Label>Confidence % (Optional)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.confidence || ''}
                  onChange={(e) => setFormData({ ...formData, confidence: parseFloat(e.target.value) || undefined })}
                  placeholder="e.g. 75"
                />
              </div>

              {/* Result */}
              <div className="space-y-2">
                <Label>Result</Label>
                <Select
                  value={formData.result}
                  onValueChange={(v) => setFormData({ ...formData, result: v as 'W' | 'L' | 'Push' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select result" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="W">Win (W)</SelectItem>
                    <SelectItem value="L">Loss (L)</SelectItem>
                    <SelectItem value="Push">Push</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>

              <Button type="submit" className="w-full" disabled={createEntry.isPending}>
                {createEntry.isPending ? 'Saving...' : 'Save Entry'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Entries List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Entries</CardTitle>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading entries...</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No entries found. Add your first backfill entry.
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "p-3 rounded-lg border",
                      entry.result === 'W' && "border-green-500/30 bg-green-500/5",
                      entry.result === 'L' && "border-red-500/30 bg-red-500/5",
                      entry.result === 'Push' && "border-yellow-500/30 bg-yellow-500/5"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ResultIcon result={entry.result} />
                        <span className="font-medium">
                          {format(new Date(entry.date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{entry.market}</Badge>
                        <Badge
                          variant={entry.result === 'W' ? 'default' : entry.result === 'L' ? 'destructive' : 'secondary'}
                        >
                          {entry.result}
                        </Badge>
                      </div>
                    </div>
                    
                    {entry.market === 'Moneyline' ? (
                      <div className="text-sm">
                        <p className="text-muted-foreground">
                          {entry.away_team} @ {entry.home_team}
                        </p>
                        <p>
                          Predicted: <span className="font-medium">{entry.predicted_side}</span>
                          {entry.home_score != null && entry.away_score != null && (
                            <span className="ml-2 text-muted-foreground">
                              Final: {entry.away_score} - {entry.home_score}
                            </span>
                          )}
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm">
                        <p className="font-medium">{entry.player_name}</p>
                        <p className="text-muted-foreground">
                          {entry.stat_type}: {entry.predicted_direction} {entry.prop_line}
                          {entry.actual_stat_value != null && (
                            <span className="ml-2">
                              (Actual: {entry.actual_stat_value})
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                    
                    {entry.confidence && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Confidence: {entry.confidence}%
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
