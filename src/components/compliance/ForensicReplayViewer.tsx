import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { 
  useForensicReplaySessions, 
  useForensicCallFrames,
  useBuildForensicReplay,
  useCallSessions
} from "@/hooks/useForensicReplay";
import { 
  Film, 
  Play, 
  Pause,
  SkipBack,
  SkipForward,
  User,
  Bot,
  Lock,
  AlertTriangle,
  Download,
  Shield,
  Zap
} from "lucide-react";
import { format } from "date-fns";

interface Props {
  businessId: string | null;
}

export function ForensicReplayViewer({ businessId }: Props) {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedReplay, setSelectedReplay] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const { data: callSessions } = useCallSessions(businessId);
  const { data: replaySessions } = useForensicReplaySessions(businessId);
  const { data: frames } = useForensicCallFrames(selectedReplay);
  const buildReplay = useBuildForensicReplay();

  // Auto-select first canonical replay if no selection
  useEffect(() => {
    if (!selectedReplay && replaySessions?.length) {
      const canonical = replaySessions.find(r => 
        (r.metadata as { canonical?: boolean })?.canonical === true
      );
      if (canonical) {
        setSelectedReplay(canonical.id);
      }
    }
  }, [replaySessions, selectedReplay]);

  // Playback logic
  useEffect(() => {
    if (!isPlaying || !frames?.length) return;
    
    const timer = setInterval(() => {
      setCurrentFrame(prev => {
        if (prev >= frames.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 500);
    
    return () => clearInterval(timer);
  }, [isPlaying, frames]);

  const handleBuildReplay = (sessionId: string) => {
    if (!businessId) return;
    buildReplay.mutate({
      sessionId,
      businessId,
      replayPurpose: 'Manual forensic analysis'
    }, {
      onSuccess: (data) => {
        setSelectedReplay(data.replay_session_id);
      }
    });
  };

  const getSpeakerIcon = (speaker: string | null) => {
    switch (speaker) {
      case 'ai': return <Bot className="h-4 w-4 text-purple-500" />;
      case 'human': return <User className="h-4 w-4 text-blue-500" />;
      case 'caller': return <User className="h-4 w-4 text-green-500" />;
      case 'system': return <Shield className="h-4 w-4 text-orange-500" />;
      case 'none': return <Lock className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const getStateColor = (state: string) => {
    if (state.includes('ai_speaking')) return 'bg-purple-500';
    if (state.includes('human')) return 'bg-blue-500';
    if (state.includes('caller')) return 'bg-green-500';
    if (state.includes('kill') || state.includes('block') || state.includes('muted')) return 'bg-red-500';
    if (state.includes('intent') || state.includes('pending')) return 'bg-orange-500';
    return 'bg-muted';
  };

  const getFrameColor = (frame: Record<string, unknown>) => {
    const state = frame.call_state as string;
    const speaker = frame.speaker as string;
    const eventType = frame.event_type as string;
    const isAnomaly = frame.is_anomaly as boolean;

    if (isAnomaly || eventType?.includes('blocked') || eventType?.includes('muted')) return 'bg-red-500';
    if (eventType?.includes('triggered') || state?.includes('kill')) return 'bg-red-500';
    if (speaker === 'ai') return 'bg-purple-500';
    if (speaker === 'human') return 'bg-blue-500';
    if (speaker === 'caller') return 'bg-green-500';
    if (speaker === 'system') return 'bg-orange-500';
    return 'bg-muted-foreground/20';
  };

  const currentFrameData = frames?.[currentFrame];
  const selectedReplayData = replaySessions?.find(r => r.id === selectedReplay);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Film className="h-6 w-6" />
            Forensic Replay System
          </h2>
          <p className="text-muted-foreground">
            Time-travel debugging: reconstruct any call frame-by-frame
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Replay Sessions Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Replay Sessions</CardTitle>
            <CardDescription>
              {replaySessions?.length || 0} sessions available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {replaySessions?.map(session => (
                  <div
                    key={session.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedReplay === session.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => {
                      setSelectedReplay(session.id);
                      setCurrentFrame(0);
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {session.is_locked && (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        )}
                        {(session.metadata as { canonical?: boolean })?.canonical && (
                          <Badge variant="secondary" className="text-xs">Canonical</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {session.total_frames} frames
                      </span>
                    </div>
                    <div className="text-sm font-medium truncate">
                      {session.replay_purpose || 'Forensic Replay'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(session.replayed_at), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>
                ))}

                {callSessions && callSessions.length > 0 && (
                  <>
                    <div className="text-xs text-muted-foreground mt-4 mb-2 font-medium">
                      Build from Call Sessions
                    </div>
                    {callSessions.map(session => (
                      <div
                        key={session.id}
                        className="p-3 rounded-lg border hover:bg-muted/50"
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{session.status}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(session.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBuildReplay(session.id);
                          }}
                          disabled={buildReplay.isPending}
                        >
                          Build Replay
                        </Button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Timeline Viewer */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Call Timeline</CardTitle>
            <CardDescription>
              {frames ? `${frames.length} frames captured` : 'Select a session and build replay'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!frames || frames.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No replay data available. Build a replay from a call session.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Visual Timeline */}
                <div className="h-16 bg-muted rounded-lg overflow-hidden flex">
                  {frames.map((frame, idx) => (
                    <div
                      key={frame.id}
                      className={`flex-1 cursor-pointer transition-opacity ${
                        idx === currentFrame ? 'ring-2 ring-primary' : ''
                      } ${
                        frame.actual_speaker === 'ai' ? 'bg-purple-500' :
                        frame.actual_speaker === 'human' ? 'bg-blue-500' :
                        frame.kill_switch_active ? 'bg-red-500' :
                        frame.interruption_detected ? 'bg-orange-500' :
                        'bg-muted-foreground/20'
                      }`}
                      style={{ opacity: idx <= currentFrame ? 1 : 0.3 }}
                      onClick={() => setCurrentFrame(idx)}
                      title={`Frame ${idx}: ${frame.call_state}`}
                    />
                  ))}
                </div>

                {/* Timeline Legend */}
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-purple-500 rounded" />
                    <span>AI Speaking</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500 rounded" />
                    <span>Human Speaking</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded" />
                    <span>Blocked/Kill Switch</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-orange-500 rounded" />
                    <span>Interruption</span>
                  </div>
                </div>

                {/* Playback Controls */}
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="icon" onClick={() => setCurrentFrame(0)}>
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setCurrentFrame(frames.length - 1)}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                  <div className="flex-1">
                    <Slider
                      value={[currentFrame]}
                      max={frames.length - 1}
                      step={1}
                      onValueChange={([v]) => setCurrentFrame(v)}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-20">
                    {currentFrame + 1} / {frames.length}
                  </span>
                </div>

                {/* Current Frame Details */}
                {currentFrameData && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <div className="text-xs text-muted-foreground">Timestamp</div>
                      <div className="font-mono">{currentFrameData.timestamp_ms}ms</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Call State</div>
                      <Badge className={getStateColor(currentFrameData.call_state)}>
                        {currentFrameData.call_state}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Speaker</div>
                      <div className="flex items-center gap-2">
                        {getSpeakerIcon(currentFrameData.actual_speaker)}
                        <span className="capitalize">{currentFrameData.actual_speaker || 'None'}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Confidence</div>
                      <div className={`font-bold ${
                        (currentFrameData.confidence_level || 0) < 60 ? 'text-red-500' : 'text-green-500'
                      }`}>
                        {currentFrameData.confidence_level?.toFixed(1) || 'N/A'}%
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-muted-foreground">Allowed Speaker</div>
                      <div className="flex items-center gap-2">
                        {getSpeakerIcon(currentFrameData.speaker_allowed)}
                        <span className="capitalize">{currentFrameData.speaker_allowed || 'None'}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Kill Switch</div>
                      <Badge variant={currentFrameData.kill_switch_active ? 'destructive' : 'outline'}>
                        {currentFrameData.kill_switch_active ? 'ACTIVE' : 'Inactive'}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Lock Applied</div>
                      <Badge variant={currentFrameData.lock_applied ? 'secondary' : 'outline'}>
                        {currentFrameData.lock_applied ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    {currentFrameData.transcript_fragment && (
                      <div className="col-span-4">
                        <div className="text-xs text-muted-foreground">Transcript</div>
                        <div className="text-sm italic">"{currentFrameData.transcript_fragment}"</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Export Button */}
                <div className="flex justify-end">
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export Replay (PDF/JSON)
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}