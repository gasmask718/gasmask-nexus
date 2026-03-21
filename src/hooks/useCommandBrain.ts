import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CommandResult {
  action: string;
  params?: Record<string, any>;
  explanation: string;
  results?: any[];
  error?: string;
}

export function useCommandBrain() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const [history, setHistory] = useState<Array<{ command: string; result: CommandResult; timestamp: Date }>>([]);

  const executeCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('dynasty-command-brain', {
        body: { command },
      });
      if (error) throw error;

      const result = data as CommandResult;
      setLastResult(result);
      setHistory(prev => [{ command, result, timestamp: new Date() }, ...prev].slice(0, 20));
      return result;
    } catch (e: any) {
      const errorResult: CommandResult = {
        action: 'ERROR',
        explanation: e.message || 'Command failed',
        error: e.message,
      };
      setLastResult(errorResult);
      toast.error('Command failed: ' + (e.message || 'Unknown error'));
      return errorResult;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setLastResult(null);
  }, []);

  return { executeCommand, isProcessing, lastResult, history, clearHistory };
}

export function useSmartNoteComposer() {
  const [isComposing, setIsComposing] = useState(false);

  const composeNote = useCallback(async (rawInput: string, storeName?: string) => {
    if (!rawInput.trim()) return null;
    setIsComposing(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-note-composer', {
        body: { raw_input: rawInput, store_name: storeName },
      });
      if (error) throw error;
      return data?.composed_note as string;
    } catch (e: any) {
      toast.error('Note composition failed: ' + (e.message || 'Unknown error'));
      return null;
    } finally {
      setIsComposing(false);
    }
  }, []);

  return { composeNote, isComposing };
}
