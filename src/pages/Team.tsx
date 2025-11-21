import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Phone, Mail, User as UserIcon } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  preferred_language: string;
}

const Team = () => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, phone, role, preferred_language')
        .order('name');

      if (error) {
        console.error('Error fetching team:', error);
      } else {
        setTeam(data || []);
      }
      setLoading(false);
    };

    fetchTeam();
  }, []);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-primary/10 text-primary border-primary/20';
      case 'csr': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'driver': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'biker': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'ambassador': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'wholesaler': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'warehouse': return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
      case 'accountant': return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Team</h2>
        <p className="text-muted-foreground">
          Manage your GasMask Universe team members
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : team.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {team.map((member, index) => (
            <Card
              key={member.id}
              className="glass-card border-border/50 hover-lift hover-glow"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <CardTitle className="text-lg">{member.name}</CardTitle>
                    <Badge className={getRoleColor(member.role)}>
                      {member.role}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {member.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{member.email}</span>
                  </div>
                )}
                {member.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{member.phone}</span>
                  </div>
                )}
                {member.preferred_language && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserIcon className="h-4 w-4" />
                    <span>Speaks: {member.preferred_language.toUpperCase()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="glass-card border-border/50">
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No team members yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Team;
