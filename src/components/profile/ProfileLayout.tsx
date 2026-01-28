/**
 * ProfileLayout - Shared profile skeleton for all entity types
 * Provides consistent header, tabs, and notes/activity system
 */
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

export interface ProfileTab {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
}

export interface ProfileHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  status?: {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  badges?: Array<{
    label: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  }>;
  metadata?: Array<{
    icon: ReactNode;
    label: string;
  }>;
}

export interface ProfileLayoutProps {
  header: ProfileHeaderProps;
  stats?: ReactNode;
  tabs: ProfileTab[];
  defaultTab?: string;
  backPath: string;
  backLabel?: string;
  isLoading?: boolean;
  actions?: ReactNode;
  onCall?: () => void;
  onMessage?: () => void;
  onAddNote?: () => void;
}

export function ProfileLayout({
  header,
  stats,
  tabs,
  defaultTab,
  backPath,
  backLabel = 'Back',
  isLoading,
  actions,
  onCall,
  onMessage,
  onAddNote,
}: ProfileLayoutProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const initials = header.title
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {backLabel}
      </Button>

      {/* Header Card */}
      <Card className="border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              {/* Avatar */}
              <Avatar className="h-16 w-16 border-2 border-primary/20">
                <AvatarImage src={header.avatarUrl} alt={header.title} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-2xl font-bold truncate">{header.title}</h1>
                  {header.status && (
                    <Badge variant={header.status.variant}>{header.status.label}</Badge>
                  )}
                  {header.badges?.map((badge, i) => (
                    <Badge key={i} variant={badge.variant || 'outline'}>
                      {badge.label}
                    </Badge>
                  ))}
                </div>

                {header.subtitle && (
                  <p className="text-muted-foreground mb-2">{header.subtitle}</p>
                )}

                {header.metadata && header.metadata.length > 0 && (
                  <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                    {header.metadata.map((item, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        {item.icon}
                        {item.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 shrink-0">
              {onCall && (
                <Button size="sm" onClick={onCall}>
                  <Phone className="mr-1 h-4 w-4" />
                  Call
                </Button>
              )}
              {onMessage && (
                <Button size="sm" variant="outline" onClick={onMessage}>
                  <MessageSquare className="mr-1 h-4 w-4" />
                  Message
                </Button>
              )}
              {onAddNote && (
                <Button size="sm" variant="outline" onClick={onAddNote}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Note
                </Button>
              )}
              {actions}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      {stats}

      {/* Tabs */}
      <Tabs defaultValue={defaultTab || tabs[0]?.id} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1">
              {tab.label}
              {tab.count !== undefined && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {tab.count}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default ProfileLayout;
