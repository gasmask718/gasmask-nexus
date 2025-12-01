import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Terminal,
  Send,
  Bot,
  User,
  Sparkles,
  Clock,
  Loader2,
} from 'lucide-react';
import { runOwnerCommand } from '@/services/aiEngine';

const sampleCommands = [
  "Summarize today's performance across all businesses",
  "Which business needs my attention most right now?",
  "Show me the Funding Company pipeline status",
  "How are ambassadors performing this week?",
  "What are the biggest risks and opportunities right now?",
  "Show me TopTier Experience performance",
  "Sports betting AI status and recommendations",
];

interface CommandHistoryEntry {
  id: string;
  command: string;
  response: string;
  timestamp: string;
}

const initialHistory: CommandHistoryEntry[] = [
  {
    id: '1',
    command: "What's the status of the Funding Company pipeline?",
    response: "The Funding Company pipeline has 12 active files. 4 are in underwriting (2 over SLA), 5 awaiting documentation, and 3 ready for closing. Total potential revenue: $45,000 in fees. Recommendation: Focus on the 2 over-SLA files immediately.",
    timestamp: '10 min ago',
  },
  {
    id: '2',
    command: "How are ambassadors performing this week?",
    response: "Ambassador performance this week: 40 active ambassadors generated 85 referrals (+12% vs last week). Top performer: Marcus T. with 14 referrals. 12 ambassadors are dormant (no activity in 30 days). Recommendation: Send re-engagement campaign to dormant ambassadors.",
    timestamp: '1 hour ago',
  },
];

export default function OwnerAICommandConsole() {
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<CommandHistoryEntry[]>(initialHistory);

  const handleSubmit = async () => {
    if (!command.trim()) return;
    
    setIsProcessing(true);
    console.log('[OWNER AI COMMAND] Processing:', command);
    
    try {
      const result = await runOwnerCommand(command);
      
      const newEntry: CommandHistoryEntry = {
        id: Date.now().toString(),
        command: command,
        response: result.response,
        timestamp: 'Just now',
      };
      
      setHistory([newEntry, ...history]);
      setCommand('');
      
      if (result.success) {
        toast.success('Command processed successfully');
      }
    } catch (error) {
      console.error('[OWNER AI COMMAND] Error:', error);
      toast.error('Failed to process command. Please try again.');
      
      // Still add to history with error message
      const errorEntry: CommandHistoryEntry = {
        id: Date.now().toString(),
        command: command,
        response: 'Command processing encountered an error. The AI engine is working to resolve this. Your command has been logged.',
        timestamp: 'Just now',
      };
      setHistory([errorEntry, ...history]);
      setCommand('');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30">
            <Terminal className="h-8 w-8 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Command Console</h1>
            <p className="text-sm text-muted-foreground">
              Natural language control over your entire empire
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-violet-500/20 text-violet-400 border-violet-500/30 w-fit">
          <Sparkles className="h-3 w-3 mr-1" />
          AI-Powered
        </Badge>
      </div>

      {/* Command Input */}
      <Card className="rounded-xl border-violet-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-violet-400" />
            Enter Command
          </CardTitle>
          <CardDescription className="text-xs">
            Ask anything about your businesses, data, or operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Type your command here... e.g., 'Summarize yesterday's performance across all businesses'"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="min-h-[100px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) {
                handleSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Press ⌘+Enter to run
            </p>
            <Button 
              onClick={handleSubmit} 
              disabled={isProcessing || !command.trim()}
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Run Command
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sample Commands */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sample Commands</CardTitle>
          <CardDescription className="text-xs">Click to use</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {sampleCommands.map((sample, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setCommand(sample)}
              >
                {sample.length > 50 ? sample.slice(0, 50) + '...' : sample}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Command History */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Command History
          </CardTitle>
          <CardDescription className="text-xs">Previous commands and AI responses</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {history.map((entry) => (
                <div key={entry.id} className="space-y-3 pb-4 border-b border-border/50 last:border-0">
                  {/* User Command */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{entry.command}</p>
                      <p className="text-xs text-muted-foreground">{entry.timestamp}</p>
                    </div>
                  </div>
                  {/* AI Response */}
                  <div className="flex items-start gap-3 ml-6">
                    <div className="p-2 rounded-lg bg-violet-500/20">
                      <Bot className="h-4 w-4 text-violet-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">{entry.response}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
