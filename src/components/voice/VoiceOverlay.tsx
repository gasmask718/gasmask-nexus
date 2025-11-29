// ═══════════════════════════════════════════════════════════════════════════════
// VOICE OVERLAY — Full screen listening mode
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, X, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';

interface VoiceOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (text: string) => void;
}

export function VoiceOverlay({ isOpen, onClose, onCommand }: VoiceOverlayProps) {
  const {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    reset,
    useVoiceToCommand,
  } = useVoiceCommand();

  // Wire voice to command handler
  useEffect(() => {
    useVoiceToCommand((text) => {
      onCommand(text);
      onClose();
    });
  }, [onCommand, onClose, useVoiceToCommand]);

  // Start listening when overlay opens
  useEffect(() => {
    if (isOpen && isSupported && !isListening) {
      startListening();
    }
    
    return () => {
      if (isOpen) {
        reset();
      }
    };
  }, [isOpen, isSupported]);

  const handleStop = () => {
    stopListening();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Content */}
      <Card className="relative z-10 w-full max-w-lg mx-4 shadow-2xl border-2 border-primary/20">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4"
          onClick={handleClose}
        >
          <X className="h-5 w-5" />
        </Button>

        <CardContent className="pt-12 pb-8 px-8 text-center">
          {/* Main mic icon */}
          <div className="relative mx-auto mb-6 w-24 h-24">
            <div
              className={cn(
                'absolute inset-0 rounded-full',
                isListening
                  ? 'bg-red-500/20 animate-ping'
                  : 'bg-muted'
              )}
            />
            <div
              className={cn(
                'relative z-10 w-full h-full rounded-full flex items-center justify-center transition-colors',
                isListening
                  ? 'bg-red-500 text-white'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <Mic className={cn('h-10 w-10', isListening && 'animate-bounce')} />
            </div>
            
            {/* Ripple effects when listening */}
            {isListening && (
              <>
                <div className="absolute inset-0 rounded-full bg-red-500/30 animate-[ping_1.5s_ease-in-out_infinite]" />
                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-[ping_2s_ease-in-out_infinite_0.5s]" />
              </>
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold mb-2">
            {isListening ? 'Listening...' : 'Voice Command'}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {isListening
              ? 'Speak your instruction to the Empire'
              : isSupported
              ? 'Click Start to begin'
              : 'Voice not supported in this browser'
            }
          </p>

          {/* Transcript display */}
          <div className="min-h-[80px] p-4 rounded-lg bg-muted/50 border mb-6">
            {transcript || interimTranscript ? (
              <div className="space-y-2">
                {transcript && (
                  <p className="text-base font-medium">{transcript}</p>
                )}
                {interimTranscript && (
                  <p className="text-sm text-muted-foreground italic">
                    {interimTranscript}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isListening ? 'Your words will appear here...' : 'No transcript yet'}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-3">
            {isListening ? (
              <Button
                variant="destructive"
                size="lg"
                onClick={handleStop}
                className="gap-2"
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button
                variant="default"
                size="lg"
                onClick={() => startListening()}
                disabled={!isSupported}
                className="gap-2"
              >
                <Mic className="h-4 w-4" />
                Start Listening
              </Button>
            )}
            
            <Button variant="outline" size="lg" onClick={handleClose}>
              Cancel
            </Button>
          </div>

          {/* Status indicator */}
          {isListening && (
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-red-500">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Recording active
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default VoiceOverlay;
