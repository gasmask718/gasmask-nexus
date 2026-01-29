import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bug, X, ChevronDown, ChevronUp, Database, Clock, Hash } from "lucide-react";

interface DebugData {
  label: string;
  value: string | number | null | undefined;
  type?: 'id' | 'timestamp' | 'count' | 'status';
}

interface DebugOverlayProps {
  entityType: string;
  entityId?: string;
  data: DebugData[];
  isAdmin?: boolean;
}

export function DebugOverlay({ entityType, entityId, data, isAdmin = false }: DebugOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Only show for admins
  if (!isAdmin) return null;

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50 bg-background/95 backdrop-blur shadow-lg"
        onClick={() => setIsOpen(true)}
      >
        <Bug className="h-4 w-4 mr-2" />
        Debug
      </Button>
    );
  }

  const getIcon = (type?: string) => {
    switch (type) {
      case 'id': return <Hash className="h-3 w-3" />;
      case 'timestamp': return <Clock className="h-3 w-3" />;
      case 'count': return <Database className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 shadow-xl border-2 border-primary/50 bg-background/95 backdrop-blur">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bug className="h-4 w-4 text-primary" />
            Debug: {entityType}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {entityId && (
          <code className="text-xs text-muted-foreground font-mono break-all">
            {entityId}
          </code>
        )}
      </CardHeader>
      {!isMinimized && (
        <CardContent className="p-3 pt-0 max-h-64 overflow-y-auto">
          <div className="space-y-2">
            {data.map((item, index) => (
              <div 
                key={index}
                className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
              >
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  {getIcon(item.type)}
                  {item.label}
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {item.value?.toString() ?? 'null'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
