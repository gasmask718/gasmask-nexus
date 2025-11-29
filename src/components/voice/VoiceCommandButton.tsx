// ═══════════════════════════════════════════════════════════════════════════════
// VOICE COMMAND BUTTON — Microphone trigger for voice commands
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface VoiceCommandButtonProps {
  onCommand: (text: string) => void;
  variant?: 'icon' | 'full';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function VoiceCommandButton({
  onCommand,
  variant = 'icon',
  size = 'md',
  className,
}: VoiceCommandButtonProps) {
  const {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    useVoiceToCommand,
  } = useVoiceCommand();

  // Wire voice to command handler
  useEffect(() => {
    useVoiceToCommand(onCommand);
  }, [onCommand, useVoiceToCommand]);

  const handleClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  if (!isSupported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled
              className={cn(sizeClasses[size], 'opacity-50 cursor-not-allowed', className)}
            >
              <MicOff className={iconSizes[size]} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Voice commands not supported in this browser
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'full') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isListening ? 'default' : 'outline'}
              onClick={handleClick}
              className={cn(
                'gap-2 transition-all',
                isListening && 'bg-red-500 hover:bg-red-600 animate-pulse',
                className
              )}
            >
              <Mic className={cn(iconSizes[size], isListening && 'animate-bounce')} />
              {isListening ? 'Listening...' : 'Tap to speak'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isListening 
              ? (interimTranscript || transcript || 'Speak now...') 
              : 'Click to start voice command'
            }
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isListening ? 'default' : 'ghost'}
            size="icon"
            onClick={handleClick}
            className={cn(
              sizeClasses[size],
              'rounded-full transition-all relative',
              isListening && 'bg-red-500 hover:bg-red-600',
              className
            )}
          >
            <Mic className={cn(iconSizes[size], isListening && 'animate-bounce text-white')} />
            {isListening && (
              <span className="absolute inset-0 rounded-full bg-red-500/50 animate-ping" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isListening 
            ? (interimTranscript || transcript || 'Listening...') 
            : 'Voice command'
          }
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default VoiceCommandButton;
