import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Mic, Square, Play, Pause, Trash2, Save, Radio } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Recording {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  timestamp: Date;
}

export default function VoiceRecorderPanel() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [voiceName, setVoiceName] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordings.forEach(r => URL.revokeObjectURL(r.url));
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const recording: Recording = {
          id: crypto.randomUUID(),
          blob,
          url,
          duration: recordingTime,
          timestamp: new Date(),
        };
        setRecordings(prev => [...prev, recording]);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to record voice samples",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const togglePause = () => {
    if (mediaRecorderRef.current) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) clearInterval(timerRef.current);
      }
      setIsPaused(!isPaused);
    }
  };

  const playRecording = (recording: Recording) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(recording.url);
    audioRef.current = audio;
    audio.play();
    setPlayingId(recording.id);
    
    audio.onended = () => setPlayingId(null);
  };

  const deleteRecording = (id: string) => {
    const recording = recordings.find(r => r.id === id);
    if (recording) {
      URL.revokeObjectURL(recording.url);
    }
    setRecordings(prev => prev.filter(r => r.id !== id));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDuration = recordings.reduce((acc, r) => acc + r.duration, 0);
  const progressPercent = Math.min((totalDuration / 180) * 100, 100); // 3 minutes target

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Record Voice Samples</CardTitle>
          <CardDescription>
            Use your browser's microphone to record voice samples directly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="voice-name-record">Voice Name</Label>
            <Input 
              id="voice-name-record"
              placeholder="e.g., My Voice"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
            />
          </div>

          <div className="flex flex-col items-center space-y-4 p-8 border-2 border-dashed rounded-lg">
            {isRecording ? (
              <>
                <div className="relative">
                  <div className="h-24 w-24 rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
                    <Mic className="h-12 w-12 text-destructive" />
                  </div>
                </div>
                <p className="text-3xl font-mono font-bold">{formatTime(recordingTime)}</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={togglePause}>
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button variant="destructive" onClick={stopRecording}>
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mic className="h-12 w-12 text-primary" />
                </div>
                <p className="text-muted-foreground">Click to start recording</p>
                <Button onClick={startRecording} size="lg">
                  <Mic className="h-5 w-5 mr-2" />
                  Start Recording
                </Button>
              </>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Recording Progress</span>
              <span>{formatTime(totalDuration)} / 3:00 recommended</span>
            </div>
            <Progress value={progressPercent} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recorded Samples ({recordings.length})</CardTitle>
          <CardDescription>
            Review and manage your recorded voice samples
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recordings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recordings yet</p>
              <p className="text-sm">Start recording to create voice samples</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {recordings.map((recording, index) => (
                  <div key={recording.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => playRecording(recording)}
                    >
                      {playingId === recording.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Sample {index + 1}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(recording.duration)} • {recording.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteRecording(recording.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button className="w-full" disabled={!voiceName || recordings.length === 0}>
                <Save className="h-4 w-4 mr-2" />
                Save & Train Voice
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
