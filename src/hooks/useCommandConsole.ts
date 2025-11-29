import { useState, useCallback } from 'react';
import { 
  processCommand, 
  CommandResponse, 
  executeCommandAction 
} from '@/lib/commands/CommandEngine';
import { getSuggestedQueries, getShortcutHelp } from '@/lib/commands/CommandParser';
import { ActionIntent } from '@/lib/commands/IntentRegistry';
import { ExecutionResult } from '@/lib/commands/ExecutionEngine';
import { toast } from 'sonner';

export function useCommandConsole() {
  const [history, setHistory] = useState<CommandResponse[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());

  const submitCommand = useCallback(async (input: string) => {
    if (!input.trim()) return;

    setIsProcessing(true);
    try {
      const response = await processCommand(input);
      setHistory((prev) => [response, ...prev]);
      setSelectedResults(new Set());
      
      if (response.status === 'error') {
        toast.error(response.error || 'Command failed');
      }
    } catch (error) {
      toast.error('Failed to process command');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const executeAction = useCallback(async (
    responseId: string,
    action: ActionIntent,
    params?: Record<string, unknown>
  ): Promise<ExecutionResult> => {
    const response = history.find((h) => h.id === responseId);
    if (!response) {
      return { success: false, message: 'Response not found' };
    }

    const selectedResultsList = response.results.filter(
      (r) => selectedResults.has(r.id) || selectedResults.size === 0
    );

    if (selectedResultsList.length === 0) {
      return { success: false, message: 'No items selected' };
    }

    try {
      const result = await executeCommandAction(action, selectedResultsList, params);
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed';
      toast.error(message);
      return { success: false, message };
    }
  }, [history, selectedResults]);

  const toggleSelection = useCallback((resultId: string) => {
    setSelectedResults((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((responseId: string) => {
    const response = history.find((h) => h.id === responseId);
    if (response) {
      setSelectedResults(new Set(response.results.map((r) => r.id)));
    }
  }, [history]);

  const clearSelection = useCallback(() => {
    setSelectedResults(new Set());
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setSelectedResults(new Set());
  }, []);

  return {
    history,
    isProcessing,
    selectedResults,
    submitCommand,
    executeAction,
    toggleSelection,
    selectAll,
    clearSelection,
    clearHistory,
    suggestions: getSuggestedQueries(),
    shortcuts: getShortcutHelp(),
  };
}
