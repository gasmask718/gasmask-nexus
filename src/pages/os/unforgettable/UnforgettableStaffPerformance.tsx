import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, Star, Calendar, Clock, CheckCircle, AlertCircle, 
  ArrowLeft, Award, ThumbsUp, ThumbsDown, BarChart3, FileText, ImageIcon
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';

interface PerformanceData {
  staffId: string;
  staffName: string;
  role: string;
  eventsWorked: number;
  punctualityRate: number;
  clientSatisfaction: number;
  reliabilityScore: number;
  overallRating: number;
  aiSummary: string;
  recentEvents: {
    id: string;
    eventName: string;
    date: string;
    venue: string;
    role: string;
    rating: number;
    notes: string;
  }[];
  managerNotes: {
    id: string;
    text: string;
    author: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    createdAt: string;
  }[];
  linkedMedia: {
    id: string;
    type: 'image' | 'video';
    thumbnail: string;
    eventName: string;
  }[];
}

const SIMULATED_PERFORMANCE: PerformanceData = {
  staffId: 'staff-001',
  staffName: 'Marcus Johnson',
  role: 'DJ / Entertainer',
  eventsWorked: 47,
  punctualityRate: 96,
  clientSatisfaction: 4.8,
  reliabilityScore: 92,
  overallRating: 4.7,
  aiSummary: `Marcus Johnson is a top-performing DJ with exceptional client satisfaction scores. 
He consistently arrives on time (96% punctuality) and has worked 47 events in the past 12 months. 
Clients frequently praise his ability to read the crowd and adapt music selection accordingly. 
Areas for improvement: occasional equipment setup delays noted in 2 events. 
Recommendation: Consider for premium/VIP events and potential team lead role.`,
  recentEvents: [
    {
      id: 'event-1',
      eventName: 'Rodriguez Quinceañera',
      date: '2024-01-13',
      venue: 'Grand Ballroom NYC',
      role: 'Lead DJ',
      rating: 5,
      notes: 'Excellent performance. Client specifically requested Marcus for their other daughter\'s event next year.'
    },
    {
      id: 'event-2',
      eventName: 'Corporate Holiday Party',
      date: '2024-01-06',
      venue: 'Sunset Gardens LA',
      role: 'DJ',
      rating: 4,
      notes: 'Good performance. Minor delay in setup but recovered well.'
    },
    {
      id: 'event-3',
      eventName: 'Thompson Wedding Reception',
      date: '2023-12-28',
      venue: 'Elite Venue Miami',
      role: 'Lead DJ',
      rating: 5,
      notes: 'Outstanding! Bride mentioned it was the best wedding entertainment she\'d ever seen.'
    },
    {
      id: 'event-4',
      eventName: 'Sweet 16 Birthday',
      date: '2023-12-20',
      venue: 'Party Palace Houston',
      role: 'DJ',
      rating: 5,
      notes: 'Perfect execution. Great with the teenage crowd.'
    },
    {
      id: 'event-5',
      eventName: 'New Year\'s Eve Gala',
      date: '2023-12-31',
      venue: 'Grand Ballroom NYC',
      role: 'Lead DJ',
      rating: 5,
      notes: 'Handled 500+ guests flawlessly. Countdown was spectacular.'
    }
  ],
  managerNotes: [
    {
      id: 'note-1',
      text: 'Marcus showed exceptional professionalism during the NYE event. Handled equipment malfunction mid-event without any disruption.',
      author: 'Sarah Manager',
      sentiment: 'positive',
      createdAt: '2024-01-02T10:00:00Z'
    },
    {
      id: 'note-2',
      text: 'Clients love his energy. Three repeat booking requests this month alone.',
      author: 'James Supervisor',
      sentiment: 'positive',
      createdAt: '2024-01-10T14:30:00Z'
    },
    {
      id: 'note-3',
      text: 'Minor issue with arrival time at Jan 6 event - traffic related. Marcus communicated proactively.',
      author: 'Sarah Manager',
      sentiment: 'neutral',
      createdAt: '2024-01-07T09:00:00Z'
    }
  ],
  linkedMedia: [
    { id: 'media-1', type: 'image', thumbnail: '/placeholder.svg', eventName: 'NYE Gala 2023' },
    { id: 'media-2', type: 'video', thumbnail: '/placeholder.svg', eventName: 'Rodriguez Quinceañera' },
    { id: 'media-3', type: 'image', thumbnail: '/placeholder.svg', eventName: 'Thompson Wedding' }
  ]
};

export default function UnforgettableStaffPerformance() {
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();

  const performance = simulationMode ? SIMULATED_PERFORMANCE : null;

  if (!performance) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">Performance Data Not Found</h3>
            <p className="text-muted-foreground mb-4">
              {simulationMode ? 'This staff record does not exist' : 'Enable Simulation Mode to see demo data'}
            </p>
            <Button onClick={() => navigate('/os/unforgettable/staff')}>
              ← Back to Staff
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-400';
    if (rating >= 3.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/os/unforgettable/staff/${staffId}`)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Profile
            </Button>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Performance: {performance.staffName}
            {simulationMode && <SimulationBadge />}
          </h1>
          <p className="text-muted-foreground">{performance.role}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Overall Rating</p>
            <div className="flex items-center gap-2">
              <Star className={`h-6 w-6 ${getRatingColor(performance.overallRating)} fill-current`} />
              <span className={`text-3xl font-bold ${getRatingColor(performance.overallRating)}`}>
                {performance.overallRating}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Events Worked</p>
                <p className="text-2xl font-bold">{performance.eventsWorked}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Punctuality</p>
                <p className="text-2xl font-bold text-green-400">{performance.punctualityRate}%</p>
              </div>
              <Clock className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Client Satisfaction</p>
                <p className="text-2xl font-bold text-yellow-400">{performance.clientSatisfaction}/5</p>
              </div>
              <Star className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reliability Score</p>
                <p className="text-2xl font-bold text-blue-400">{performance.reliabilityScore}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Performance Summary */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            AI Performance Summary
          </CardTitle>
          <CardDescription>Auto-generated analysis based on event history and feedback</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm leading-relaxed whitespace-pre-line">{performance.aiSummary}</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Recent Events ({performance.recentEvents.length})</TabsTrigger>
          <TabsTrigger value="notes">Manager Notes ({performance.managerNotes.length})</TabsTrigger>
          <TabsTrigger value="media">Linked Media ({performance.linkedMedia.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Event History</CardTitle>
              <CardDescription>Performance at recent events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performance.recentEvents.map((event) => (
                  <div key={event.id} className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{event.eventName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {event.venue} • {new Date(event.date).toLocaleDateString()}
                        </p>
                        <Badge variant="outline" className="mt-1">{event.role}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            className={`h-4 w-4 ${i < event.rating ? 'text-yellow-400 fill-current' : 'text-gray-600'}`} 
                          />
                        ))}
                      </div>
                    </div>
                    {event.notes && (
                      <p className="text-sm mt-2 text-muted-foreground italic">"{event.notes}"</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Manager Notes</CardTitle>
              <CardDescription>Feedback from supervisors and managers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {performance.managerNotes.map((note) => (
                  <div key={note.id} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-start gap-3">
                      {note.sentiment === 'positive' && <ThumbsUp className="h-5 w-5 text-green-400 mt-0.5" />}
                      {note.sentiment === 'neutral' && <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />}
                      {note.sentiment === 'negative' && <ThumbsDown className="h-5 w-5 text-red-400 mt-0.5" />}
                      <div className="flex-1">
                        <p className="text-sm">{note.text}</p>
                        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                          <span>{note.author}</span>
                          <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media">
          <Card>
            <CardHeader>
              <CardTitle>Linked Media</CardTitle>
              <CardDescription>Photos and videos from events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {performance.linkedMedia.map((media) => (
                  <div key={media.id} className="relative aspect-video rounded-lg border overflow-hidden bg-muted cursor-pointer hover:ring-2 ring-primary transition-all">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2">
                      <p className="text-xs text-white truncate">{media.eventName}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
