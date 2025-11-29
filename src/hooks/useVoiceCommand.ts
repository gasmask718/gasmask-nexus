// ═══════════════════════════════════════════════════════════════════════════════
// VOICE COMMAND HOOK — Web Speech API Integration
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface VoiceCommandState {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  lastCommand: string | null;
}

interface VoiceCommandOptions {
  language?: string;
  continuous?: boolean;
}

// Extend Window interface for Speech Recognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
};

// Check browser support
const getSpeechRecognition = (): (new () => SpeechRecognitionType) | null => {
  if (typeof window === 'undefined') return null;
  
  const SpeechRecognition = 
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionType }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionType }).webkitSpeechRecognition;
  
  return SpeechRecognition || null;
};

export function useVoiceCommand() {
  const [state, setState] = useState<VoiceCommandState>({
    isSupported: false,
    isListening: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    lastCommand: null,
  });

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const commandCallbackRef = useRef<((text: string) => void) | null>(null);

  // Check support on mount
  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    setState(prev => ({ ...prev, isSupported: !!SpeechRecognition }));
  }, []);

  const startListening = useCallback((options: VoiceCommandOptions = {}) => {
    const SpeechRecognition = getSpeechRecognition();
    
    if (!SpeechRecognition) {
      setState(prev => ({ ...prev, error: 'Speech recognition not supported' }));
      toast.error('Your browser does not support voice recognition.');
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = options.continuous ?? false;
    recognition.interimResults = true;
    recognition.lang = options.language ?? 'en-US';

    recognition.onstart = () => {
      setState(prev => ({
        ...prev,
        isListening: true,
        error: null,
        transcript: '',
        interimTranscript: '',
      }));
      toast.info('Voice assistant activated');
    };

    recognition.onend = () => {
      setState(prev => {
        // If we have a transcript and a callback, call it
        if (prev.transcript && commandCallbackRef.current) {
          commandCallbackRef.current(prev.transcript);
        }
        return {
          ...prev,
          isListening: false,
          lastCommand: prev.transcript || prev.lastCommand,
        };
      });
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setState(prev => ({
        ...prev,
        transcript: prev.transcript + finalTranscript,
        interimTranscript,
      }));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMessage = getErrorMessage(event.error);
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isListening: false,
      }));
      
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        toast.error(`Microphone error: ${errorMessage}`);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: 'Failed to start voice recognition',
        isListening: false,
      }));
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    setState(prev => ({
      ...prev,
      isListening: false,
      transcript: '',
      interimTranscript: '',
      error: null,
    }));
  }, []);

  // Helper to wire voice to command handler
  const useVoiceToCommand = useCallback((commandHandler: (text: string) => void) => {
    commandCallbackRef.current = commandHandler;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    reset,
    useVoiceToCommand,
  };
}

function getErrorMessage(error: string): string {
  switch (error) {
    case 'no-speech':
      return 'No speech detected. Please try again.';
    case 'audio-capture':
      return 'No microphone found. Please check your microphone.';
    case 'not-allowed':
      return 'Microphone access denied. Please allow microphone access.';
    case 'network':
      return 'Network error occurred. Please check your connection.';
    case 'aborted':
      return 'Voice recognition was stopped.';
    case 'service-not-allowed':
      return 'Speech service not available.';
    default:
      return `Voice error: ${error}`;
  }
}

export default useVoiceCommand;
