// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA AI COMMAND CONSOLE — Natural Language AI for Grabba brands only
// ═══════════════════════════════════════════════════════════════════════════════

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
import { runGrabbaCommand } from '@/services/aiEngine';

const sampleCommands = [
  "What's the status of GasMask stores today?",
  "Show me Hot Mama performance this week",
  "Which stores need inventory restocking?",
  "How are our delivery routes performing?",
  "Ambassador network status and top performers",
  "Show unpaid accounts for all brands",
  "What's the wholesale activity this month?",
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
    command: "Show GasMask inventory status",
    response: "GasMask Inventory Alert: 5 stores below reorder threshold. Priority restock needed in Brooklyn (3 stores) and Bronx (2 stores). Estimated restock value: $3,400. Top performer this week: Flatbush location with 450 tubes sold.",
    timestamp: '15 min ago',
  },
  {
    id: '2',
    command: "How are delivery routes today?",
    response: "Grabba Delivery Ops: 6 active routes today. 28 stops scheduled, 19 completed (68%). Active drivers: 5. Brooklyn routes ahead of schedule. Queens route delayed 20 min. Next priority: Complete Bronx route before 4pm.",
    timestamp: '1 hour ago',
  },
];

export default function GrabbaAICommandConsole() {
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<CommandHistoryEntry[]>(initialHistory);

  const handleSubmit = async () => {
    if (!command.trim()) return;
    
    setIsProcessing(true);
    console.log('[GRABBA AI COMMAND] Processing:', command);
    
    try {
      const result = await runGrabbaCommand(command);
      
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
      console.error('[GRABBA AI COMMAND] Error:', error);
      toast.error('Failed to process command. Please try again.');
      
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
          <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/30">
            <Terminal className="h-8 w-8 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Grabba AI Command Console</h1>
            <p className="text-sm text-muted-foreground">
              Natural language control for GasMask, HotMama, Hot Scalati & Grabba R Us
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 w-fit">
          <Sparkles className="h-3 w-3 mr-1" />
          AI-Powered
        </Badge>
      </div>

      {/* Command Input */}
      <Card className="rounded-xl border-red-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-red-400" />
            Enter Command
          </CardTitle>
          <CardDescription className="text-xs">
            Ask anything about your Grabba brands, stores, deliveries, or ambassadors
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Type your command here... e.g., 'Show GasMask store performance for this week'"
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
          <CardDescription className="text-xs">Previous Grabba AI responses</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {history.map((entry) => (
                <div key={entry.id} className="space-y-3 pb-4 border-b border-border/50 last:border-0">
                  {/* User Command */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-red-500/20">
                      <User className="h-4 w-4 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{entry.command}</p>
                      <p className="text-xs text-muted-foreground">{entry.timestamp}</p>
                    </div>
                  </div>
                  {/* AI Response */}
                  <div className="flex items-start gap-3 ml-6">
                    <div className="p-2 rounded-lg bg-orange-500/20">
                      <Bot className="h-4 w-4 text-orange-400" />
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
