import { useState } from 'react';
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

  const handlePreview = async () => {
    if (!voiceModelId) {
      toast.error('No voice model configured');
      return;
    }

    if (isPlaying) {
      // Stop playing
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    
    // Mock preview - will integrate with ElevenLabs API later
    toast.info('Voice preview will be available once API is connected');
    
    // Simulate loading
    setTimeout(() => {
      setIsLoading(false);
      setIsPlaying(true);
      
      // Simulate playback duration
      setTimeout(() => {
        setIsPlaying(false);
      }, 3000);
    }, 500);
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
