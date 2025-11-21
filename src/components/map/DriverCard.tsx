import { X, Phone, MessageCircle, MapPin, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DemoDriver {
  id: string;
  name: string;
  role: 'driver' | 'biker';
  territory: string;
  updated_at: Date;
}

interface DriverCardProps {
  driver: DemoDriver;
  onClose: () => void;
}

export const DriverCard = ({ driver, onClose }: DriverCardProps) => {
  const roleColor = driver.role === 'driver' ? 'bg-blue-500' : 'bg-purple-500';
  const timeAgo = Math.floor((Date.now() - driver.updated_at.getTime()) / 1000);
  const timeText = timeAgo < 60 ? 'Just now' : `${Math.floor(timeAgo / 60)}m ago`;

  return (
    <Card className="bg-card/95 backdrop-blur border-border/50 shadow-2xl overflow-hidden">
      <div className="relative p-6">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex items-start gap-4 mb-4">
          <div className={`p-3 rounded-full ${roleColor} bg-opacity-20`}>
            <User className={`h-6 w-6 ${driver.role === 'driver' ? 'text-blue-500' : 'text-purple-500'}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-1">{driver.name}</h3>
            <div className="flex gap-2 mb-2">
              <Badge variant="secondary" className="capitalize">
                {driver.role}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {driver.territory}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Last update: {timeText}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Call
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Text
          </Button>
        </div>

        <Button variant="default" className="w-full mt-2" size="sm">
          View Active Route
        </Button>
      </div>
    </Card>
  );
};
