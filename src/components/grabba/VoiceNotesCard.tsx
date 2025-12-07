// V7: Voice Notes Card Component
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Mic, Upload, Play, Pause, FileAudio, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface VoiceNotesCardProps {
  storeId: string;
}

interface VoiceNote {
  id: string;
  file_url: string;
  transcript: string | null;
  summary: string | null;
  sentiment: string | null;
  status: string;
  created_at: string;
  duration_seconds: number | null;
}

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  uploaded: { label: "Uploaded", variant: "secondary" },
  transcribing: { label: "Transcribing...", variant: "outline" },
  transcribed: { label: "Transcribed", variant: "default" },
  analyzed: { label: "Analyzed", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

const SENTIMENT_EMOJI: Record<string, string> = {
  positive: "😊",
  neutral: "😐",
  negative: "😟",
  mixed: "🤔",
};

export function VoiceNotesCard({ storeId }: VoiceNotesCardProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch voice notes for this store
  const { data: voiceNotes, isLoading } = useQuery({
    queryKey: ["store-voice-notes", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_voice_notes")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as VoiceNote[];
    },
    enabled: !!storeId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileName = `${storeId}/${Date.now()}_${file.name}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("store-voice-notes")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create database record
      const { error: insertError } = await supabase
        .from("store_voice_notes")
        .insert({
          store_id: storeId,
          file_url: fileName,
          status: "uploaded",
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-voice-notes", storeId] });
      toast.success("Voice note uploaded successfully");
    },
    onError: (error) => {
      console.error("Upload error:", error);
      toast.error("Failed to upload voice note");
    },
  });

  // Transcribe mutation
  const transcribeMutation = useMutation({
    mutationFn: async (noteId: string) => {
      // Update status to transcribing
      await supabase
        .from("store_voice_notes")
        .update({ status: "transcribing" })
        .eq("id", noteId);

      // Call the transcription edge function
      const { data, error } = await supabase.functions.invoke("store-voice-notes-transcribe", {
        body: { noteId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-voice-notes", storeId] });
      queryClient.invalidateQueries({ queryKey: ["extracted-profile", storeId] });
      toast.success("Transcription complete");
    },
    onError: (error) => {
      console.error("Transcription error:", error);
      toast.error("Transcription failed");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handlePlay = async (note: VoiceNote) => {
    if (playingId === note.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    try {
      const { data } = await supabase.storage
        .from("store-voice-notes")
        .createSignedUrl(note.file_url, 3600);

      if (data?.signedUrl) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        audioRef.current = new Audio(data.signedUrl);
        audioRef.current.play();
        audioRef.current.onended = () => setPlayingId(null);
        setPlayingId(note.id);
      }
    } catch (error) {
      console.error("Playback error:", error);
      toast.error("Failed to play audio");
    }
  };

  return (
    <Card className="border-2 border-blue-500/30 bg-blue-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg text-blue-600">Voice Notes</CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Record or upload quick notes about this store. AI will transcribe and learn from them.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !voiceNotes?.length ? (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            <FileAudio className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No voice notes yet.</p>
            <p className="text-xs mt-1">Upload an audio file to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {voiceNotes.map((note) => (
              <div
                key={note.id}
                className="rounded-lg border bg-background/50 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handlePlay(note)}
                    >
                      {playingId === note.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(note.created_at), "MMM d, h:mm a")}
                    </span>
                    {note.sentiment && (
                      <span title={note.sentiment}>
                        {SENTIMENT_EMOJI[note.sentiment] || ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_BADGES[note.status]?.variant || "secondary"}>
                      {STATUS_BADGES[note.status]?.label || note.status}
                    </Badge>
                    {note.status === "uploaded" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => transcribeMutation.mutate(note.id)}
                        disabled={transcribeMutation.isPending}
                      >
                        {transcribeMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {note.transcript && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {note.transcript}
                  </p>
                )}

                {note.summary && (
                  <p className="text-xs text-blue-600 italic">
                    Summary: {note.summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
