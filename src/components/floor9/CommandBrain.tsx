import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, Send, Loader2, Sparkles, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useCommandBrain, CommandResult } from '@/hooks/useCommandBrain';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const SUGGESTED_COMMANDS = [
  "Show me stores with lowest health scores",
  "Which stores haven't been visited in 30 days?",
  "How many total stores do we have?",
  "Show me all critical alerts",
  "Which products have the most zero-stock stores?",
];

export function CommandBrain() {
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { executeCommand, isProcessing, lastResult, history } = useCommandBrain();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    const cmd = input;
    setInput('');
    await executeCommand(cmd);
  };

  const handleSuggestion = (cmd: string) => {
    setInput(cmd);
    inputRef.current?.focus();
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Dynasty Command Brain</span>
          <Badge variant="outline" className="text-[10px] ml-auto">AI-Powered</Badge>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything... e.g. 'Show me stores needing attention'"
            className="flex-1 bg-background"
            disabled={isProcessing}
          />
          <Button type="submit" size="icon" disabled={isProcessing || !input.trim()}>
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>

        {!lastResult && !isProcessing && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                onClick={() => handleSuggestion(cmd)}
                className="text-[11px] px-2 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
              >
                <Sparkles className="h-3 w-3 inline mr-1" />{cmd}
              </button>
            ))}
          </div>
        )}

        {lastResult && (
          <Card className="bg-muted/50">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={lastResult.error ? 'destructive' : 'default'} className="text-[10px]">
                  {lastResult.action}
                </Badge>
              </div>
              <p className="text-sm">{lastResult.explanation}</p>
              {lastResult.results?.length ? (
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {lastResult.results.slice(0, 10).map((r: any, i: number) => (
                      <div key={i} className="text-xs p-2 rounded bg-background flex items-center justify-between">
                        <span className="font-medium">{r.store_name || r.title || r.name || JSON.stringify(r).slice(0, 60)}</span>
                        {r.overall_score !== undefined && (
                          <Badge variant="outline" className={cn("text-[10px]",
                            r.overall_score >= 80 ? "text-green-500" :
                            r.overall_score >= 60 ? "text-amber-500" :
                            r.overall_score >= 40 ? "text-orange-500" : "text-red-500"
                          )}>
                            {r.overall_score}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : null}
            </CardContent>
          </Card>
        )}

        {history.length > 1 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
          >
            {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {history.length} previous commands
          </button>
        )}

        {showHistory && history.length > 1 && (
          <ScrollArea className="max-h-32">
            <div className="space-y-1">
              {history.slice(1).map((h, i) => (
                <div key={i} className="text-xs p-1.5 rounded bg-muted/30 flex items-center justify-between">
                  <span className="text-muted-foreground truncate flex-1">{h.command}</span>
                  <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                    <Clock className="h-3 w-3 inline mr-0.5" />
                    {formatDistanceToNow(h.timestamp, { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
