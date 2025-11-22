import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ShieldAlert, Clock, Camera, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FraudPanelProps {
  onFlagClick?: (storeId: string, lat: number, lng: number) => void;
}

export const FraudPanel = ({ onFlagClick }: FraudPanelProps) => {
  const { data: fraudFlags, isLoading } = useQuery({
    queryKey: ['fraud-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fraud_flags')
        .select('*, stores(*), profiles(*)')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'low': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'suspicious_duration': return <Clock className="w-4 h-4" />;
      case 'missing_photos': return <Camera className="w-4 h-4" />;
      case 'cash_mismatch': return <DollarSign className="w-4 h-4" />;
      case 'idle_driver': return <AlertTriangle className="w-4 h-4" />;
      default: return <ShieldAlert className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Loading fraud detection...</div>;
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-5 h-5 text-red-500" />
          <h3 className="font-bold text-lg">Fraud Detection</h3>
          <Badge variant="destructive" className="ml-auto">{fraudFlags?.length || 0}</Badge>
        </div>

        {fraudFlags && fraudFlags.length === 0 && (
          <Card className="p-4 bg-green-500/10 border-green-500/20">
            <p className="text-green-500 text-sm">No fraud flags detected. System clean.</p>
          </Card>
        )}

        {fraudFlags?.map((flag) => (
          <Card
            key={flag.id}
            className={`p-4 border cursor-pointer transition-all hover:scale-[1.02] ${getSeverityColor(flag.severity)}`}
            onClick={() => {
              if (flag.stores && onFlagClick) {
                onFlagClick(flag.store_id, flag.stores.lat, flag.stores.lng);
              }
            }}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {getIcon(flag.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className={getSeverityColor(flag.severity)}>
                    {flag.severity.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(flag.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="font-medium text-sm mb-1">{flag.message}</p>
                {flag.profiles && (
                  <p className="text-xs text-muted-foreground">Driver: {flag.profiles.name}</p>
                )}
                {flag.stores && (
                  <p className="text-xs text-muted-foreground">Store: {flag.stores.name}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};