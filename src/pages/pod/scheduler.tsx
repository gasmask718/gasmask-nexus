import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Instagram, Facebook, Video } from "lucide-react";

export default function PODScheduler() {
  const platforms = [
    { name: "TikTok", icon: Video, scheduled: 0 },
    { name: "Instagram", icon: Instagram, scheduled: 0 },
    { name: "Facebook", icon: Facebook, scheduled: 0 },
    { name: "YouTube Shorts", icon: Video, scheduled: 0 },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Content Scheduler</h1>
        <p className="text-muted-foreground">
          Auto-schedule posts across all platforms
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {platforms.map((platform) => (
          <Card key={platform.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{platform.name}</CardTitle>
              <platform.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{platform.scheduled}</div>
              <p className="text-xs text-muted-foreground mt-1">scheduled posts</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 text-center py-12">
          <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Content scheduling coming soon. Generate videos first!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
