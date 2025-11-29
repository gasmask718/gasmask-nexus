// ═══════════════════════════════════════════════════════════════════════════════
// VOICE STATUS INDICATOR — Shows listening state and transcript
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Mic } from 'lucide-react';

interface VoiceStatusIndicatorProps {
  isListening: boolean;
  transcript?: string;
  interimTranscript?: string;
  className?: string;
}

export function VoiceStatusIndicator({
  isListening,
  transcript,
  interimTranscript,
  className,
}: VoiceStatusIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    if (isListening) {
      setVisible(true);
      setDisplayText(interimTranscript || transcript || 'Listening...');
    } else if (transcript) {
      setDisplayText(transcript);
      // Keep visible for a few seconds after speaking
      const timer = setTimeout(() => {
        setVisible(false);
        setDisplayText('');
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isListening, transcript, interimTranscript]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
        'bg-red-500/10 border border-red-500/20',
        isListening && 'animate-pulse',
        className
      )}
    >
      {/* Live indicator dot */}
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            'h-2 w-2 rounded-full',
            isListening ? 'bg-red-500 animate-pulse' : 'bg-muted-foreground'
          )}
        />
        <Mic className={cn('h-3.5 w-3.5', isListening ? 'text-red-500' : 'text-muted-foreground')} />
        {isListening && (
          <span className="text-xs font-medium text-red-500">Live</span>
        )}
      </div>

      {/* Transcript text */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm truncate',
            isListening && interimTranscript ? 'text-muted-foreground italic' : 'text-foreground'
          )}
        >
          {displayText}
        </p>
      </div>
    </div>
  );
}

export default VoiceStatusIndicator;
