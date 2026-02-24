import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VoicePreviewButtonProps {
  voiceModelId?: string | null;
  sampleText?: string;
}

export default function VoicePreviewButton({ 
  voiceModelId, 
  sampleText = "Hello! This is a preview of the voice profile." 
}: VoicePreviewButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  const handlePreview = async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    if (!voiceModelId) {
      toast.error('No voice model configured');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: sampleText, voice_id: voiceModelId }),
        }
      );

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('Voice preview error:', err);
      toast.error('Failed to generate voice preview');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handlePreview}
      disabled={isLoading || !voiceModelId}
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isPlaying ? (
        <Square className="w-4 h-4" />
      ) : (
        <Play className="w-4 h-4" />
      )}
      {isPlaying ? 'Stop' : 'Preview Voice'}
    </Button>
  );
}
