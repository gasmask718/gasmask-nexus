import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Star,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  Search,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  Users,
  Calendar
} from 'lucide-react';

// Mock performance data
const mockPerformanceData = [
  { id: '1', name: 'Marcus Johnson', role: 'Lead DJ', rating: 4.9, events: 24, onTime: 100, clientRating: 4.8, trend: 'up' },
  { id: '2', name: 'Sarah Chen', role: 'Event Coordinator', rating: 4.7, events: 32, onTime: 98, clientRating: 4.9, trend: 'up' },
  { id: '3', name: 'Mike Torres', role: 'Bartender', rating: 4.3, events: 18, onTime: 94, clientRating: 4.5, trend: 'down' },
  { id: '4', name: 'Jessica Williams', role: 'MC/Host', rating: 4.8, events: 20, onTime: 100, clientRating: 4.7, trend: 'stable' },
  { id: '5', name: 'David Kim', role: 'Setup Crew Lead', rating: 4.5, events: 28, onTime: 96, clientRating: 4.4, trend: 'up' },
  { id: '6', name: 'Amanda Brown', role: 'Photographer', rating: 4.9, events: 15, onTime: 100, clientRating: 5.0, trend: 'up' },
];

const mockReviews = [
  { id: '1', staffName: 'Marcus Johnson', clientName: 'Thompson Wedding', date: '2024-01-20', rating: 5, comment: 'Amazing DJ! Kept the party going all night.' },
  { id: '2', staffName: 'Sarah Chen', clientName: 'Johnson Corp Event', date: '2024-01-18', rating: 5, comment: 'Incredible attention to detail. Everything was perfect.' },
  { id: '3', staffName: 'Mike Torres', clientName: 'Smith Birthday Party', date: '2024-01-15', rating: 4, comment: 'Good service, drinks were well made.' },
  { id: '4', staffName: 'Amanda Brown', clientName: 'Garcia Quinceañera', date: '2024-01-12', rating: 5, comment: 'Photos were absolutely stunning!' },
];

const topPerformers = mockPerformanceData.sort((a, b) => b.rating - a.rating).slice(0, 3);

export default function UnforgettablePerformance() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStaff = mockPerformanceData.filter(staff =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-emerald-400" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-400" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-muted" />;
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.7) return 'text-emerald-400';
    if (rating >= 4.3) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Staff Performance</h1>
          <p className="text-muted-foreground">Track ratings, reviews, and performance metrics</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Award className="h-4 w-4 mr-2" />
          Generate Reports
        </Button>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topPerformers.map((performer, index) => (
          <Card key={performer.id} className="bg-card border-border relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                index === 0 ? 'bg-amber-500 text-black' :
                index === 1 ? 'bg-slate-400 text-black' :
                'bg-amber-700 text-white'
              }`}>
                #{index + 1}
              </div>
            </div>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{performer.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{performer.name}</p>
                  <p className="text-xs text-muted-foreground">{performer.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < Math.floor(performer.rating) ? 'text-amber-400 fill-amber-400' : 'text-muted'}`} />
                ))}
                <span className="ml-2 font-semibold text-foreground">{performer.rating}</span>
              </div>
              <p className="text-sm text-muted-foreground">{performer.events} events completed</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Star className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Rating</p>
                <p className="text-2xl font-bold text-foreground">4.68</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <ThumbsUp className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Positive Reviews</p>
                <p className="text-2xl font-bold text-foreground">94%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Target className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">On-Time Rate</p>
                <p className="text-2xl font-bold text-foreground">97%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <BarChart3 className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold text-foreground">137</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="leaderboard" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="reviews">Client Reviews</TabsTrigger>
          <TabsTrigger value="metrics">Detailed Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background border-border"
            />
          </div>

          {/* Performance Table */}
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Staff Member</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Rating</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Events</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">On-Time %</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Client Rating</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((staff) => (
                    <tr key={staff.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-foreground">{staff.name}</p>
                        <p className="text-xs text-muted-foreground">{staff.role}</p>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                          <span className={`font-semibold ${getRatingColor(staff.rating)}`}>{staff.rating}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center text-foreground">{staff.events}</td>
                      <td className="p-4 text-center">
                        <span className={staff.onTime >= 98 ? 'text-emerald-400' : staff.onTime >= 95 ? 'text-amber-400' : 'text-red-400'}>
                          {staff.onTime}%
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                          <span className="text-foreground">{staff.clientRating}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">{getTrendIcon(staff.trend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Recent Client Reviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockReviews.map((review) => (
                <div key={review.id} className="p-4 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-foreground">{review.staffName}</p>
                      <p className="text-xs text-muted-foreground">{review.clientName} • {review.date}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-muted'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{review.comment}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockPerformanceData.slice(0, 4).map((staff) => (
              <Card key={staff.id} className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{staff.name}</span>
                    <Badge variant="outline">{staff.role}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Overall Rating</span>
                      <span className="text-foreground">{staff.rating}/5.0</span>
                    </div>
                    <Progress value={staff.rating * 20} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">On-Time Performance</span>
                      <span className="text-foreground">{staff.onTime}%</span>
                    </div>
                    <Progress value={staff.onTime} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Client Satisfaction</span>
                      <span className="text-foreground">{staff.clientRating}/5.0</span>
                    </div>
                    <Progress value={staff.clientRating * 20} className="h-2" />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{staff.events} events</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(staff.trend)}
                      <span className="text-xs text-muted-foreground capitalize">{staff.trend}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
