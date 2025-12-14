import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  userRole: null,
  signOut: async () => {},
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const initialized = useRef(false);

  useEffect(() => {
    // Prevent multiple initializations (handles React Strict Mode)
    if (initialized.current) return;
    initialized.current = true;

    let isMounted = true;

    // Get initial session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile, error }) => {
            if (!isMounted) return;
            if (profile && !error) {
              setUserRole(profile.role);
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    // Set up auth state listener for future changes only
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        // Handle all relevant auth events
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            // Defer profile fetch to avoid deadlock
            setTimeout(() => {
              if (!isMounted) return;
              supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single()
                .then(({ data: profile }) => {
                  if (!isMounted) return;
                  if (profile) {
                    setUserRole(profile.role);
                  }
                  setLoading(false);
                });
            }, 0);
          } else {
            setLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setUserRole(null);
          setLoading(false);
        }
        // Ignore TOKEN_REFRESHED - session is already valid, no state update needed
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
