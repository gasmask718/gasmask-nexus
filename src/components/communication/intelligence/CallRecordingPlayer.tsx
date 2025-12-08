import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Volume2, Download, Clock } from "lucide-react";
import { CallRecording } from "@/hooks/useCallIntelligence";
import { formatDistanceToNow } from "date-fns";

interface CallRecordingPlayerProps {
  recording: CallRecording | null;
  compact?: boolean;
}

export function CallRecordingPlayer({ recording, compact = false }: CallRecordingPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!recording) {
    return null;
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={!recording.recording_url}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">
            {formatDuration(recording.recording_duration)}
          </div>
        </div>
        {recording.recording_url && (
          <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
            <a href={recording.recording_url} download>
              <Download className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Call Recording
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {recording.provider || "Unknown"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {recording.recording_url ? (
          <>
            <audio
              controls
              className="w-full h-10"
              src={recording.recording_url}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              Your browser does not support the audio element.
            </audio>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>{formatDuration(recording.recording_duration)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Channels: {recording.channels}</span>
                <span>•</span>
                <span>
                  {recording.started_at
                    ? formatDistanceToNow(new Date(recording.started_at), {
                        addSuffix: true,
                      })
                    : "Unknown time"}
                </span>
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full gap-2" asChild>
              <a href={recording.recording_url} download>
                <Download className="h-4 w-4" />
                Download Recording
              </a>
            </Button>
          </>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">
            No recording available
          </div>
        )}
      </CardContent>
    </Card>
  );
}