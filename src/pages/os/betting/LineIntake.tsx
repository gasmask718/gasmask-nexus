import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload } from "lucide-react";

export default function LineIntake() {
  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Line Intake</h1>
          <p className="text-muted-foreground">Add sportsbook and pick'em lines</p>
        </div>
        <Button><Plus className="h-4 w-4 mr-2" />Add Line</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Market Line</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Platform</label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fanduel">FanDuel</SelectItem>
                  <SelectItem value="draftkings">DraftKings</SelectItem>
                  <SelectItem value="prizepicks">PrizePicks</SelectItem>
                  <SelectItem value="underdog">Underdog</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Market Type</label>
              <Select>
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
            <div>
              <label className="text-sm text-muted-foreground">Sport</label>
              <input type="text" placeholder="NBA" className="w-full mt-1 p-2 rounded-lg bg-muted/50 border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Event</label>
              <input type="text" placeholder="Lakers vs Warriors" className="w-full mt-1 p-2 rounded-lg bg-muted/50 border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Player Name (for props)</label>
              <input type="text" placeholder="LeBron James" className="w-full mt-1 p-2 rounded-lg bg-muted/50 border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Stat Type</label>
              <input type="text" placeholder="PTS" className="w-full mt-1 p-2 rounded-lg bg-muted/50 border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Line Value</label>
              <input type="number" placeholder="25.5" className="w-full mt-1 p-2 rounded-lg bg-muted/50 border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Odds/Payout</label>
              <input type="text" placeholder="-110" className="w-full mt-1 p-2 rounded-lg bg-muted/50 border" />
            </div>
          </div>
          <Button className="w-full">Save Line</Button>
        </CardContent>
      </Card>
    </div>
  );
}
