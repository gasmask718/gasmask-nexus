import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Send, Loader2, Terminal, Lightbulb, Command, Trash2, HelpCircle
} from 'lucide-react';
import { useCommandConsole } from '@/hooks/useCommandConsole';
import { CommandResponseCard } from './CommandResponseCard';
import { ActionIntent } from '@/lib/commands/IntentRegistry';

export function CommandConsole() {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    history,
    isProcessing,
    selectedResults,
    submitCommand,
    executeAction,
    toggleSelection,
    selectAll,
    clearSelection,
    clearHistory,
    suggestions,
    shortcuts,
  } = useCommandConsole();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      submitCommand(input);
      setInput('');
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const handleShortcutClick = (shortcut: string) => {
    submitCommand(shortcut);
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Terminal className="h-6 w-6 text-primary" />
          AI Command Console
        </h1>
        <p className="text-muted-foreground">
          Ask questions or run commands across all Grabba floors
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        {/* Left Panel - Shortcuts & Suggestions */}
        <Card className="lg:col-span-1">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="shortcuts">
              <TabsList className="w-full grid grid-cols-2 rounded-none">
                <TabsTrigger value="shortcuts" className="text-xs">
                  <Command className="h-3 w-3 mr-1" />
                  Shortcuts
                </TabsTrigger>
                <TabsTrigger value="suggestions" className="text-xs">
                  <HelpCircle className="h-3 w-3 mr-1" />
                  Examples
                </TabsTrigger>
              </TabsList>

              <TabsContent value="shortcuts" className="m-0">
                <ScrollArea className="h-[300px]">
                  <div className="p-2 space-y-1">
                    {shortcuts.map((item) => (
                      <button
                        key={item.shortcut}
                        onClick={() => handleShortcutClick(item.shortcut)}
                        className="w-full text-left p-2 rounded hover:bg-muted transition-colors"
                      >
                        <Badge variant="secondary" className="font-mono text-xs">
                          {item.shortcut}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="suggestions" className="m-0">
                <ScrollArea className="h-[300px]">
                  <div className="p-2 space-y-1">
                    {suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full text-left p-2 rounded hover:bg-muted transition-colors text-sm"
                      >
                        "{suggestion}"
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Main Panel - Command Input & Results */}
        <div className="lg:col-span-3 flex flex-col min-h-0">
          {/* Input Area */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a question or use /shortcuts..."
                    className="pl-10 pr-4"
                    disabled={isProcessing}
                  />
                </div>
                <Button type="submit" disabled={!input.trim() || isProcessing}>
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>

              {/* AI Suggestions */}
              {!input && history.length === 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground">Try:</span>
                  {suggestions.slice(0, 3).map((s, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSuggestionClick(s)}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Area */}
          <div className="flex-1 min-h-0">
            {history.length > 0 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {history.length} {history.length === 1 ? 'query' : 'queries'}
                </span>
                <Button variant="ghost" size="sm" onClick={clearHistory}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            )}

            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="space-y-4 pr-4">
                {history.map((response) => (
                  <CommandResponseCard
                    key={response.id}
                    response={response}
                    selectedResults={selectedResults}
                    onToggleSelection={toggleSelection}
                    onSelectAll={() => selectAll(response.id)}
                    onClearSelection={clearSelection}
                    onExecuteAction={(action: ActionIntent, params?: Record<string, unknown>) =>
                      executeAction(response.id, action, params)
                    }
                  />
                ))}

                {history.length === 0 && (
                  <div className="text-center py-12">
                    <Terminal className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Ready for your command</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Ask questions about your data, find stores, check inventory, or run actions across all floors.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
