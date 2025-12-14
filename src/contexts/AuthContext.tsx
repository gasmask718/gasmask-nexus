import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 🔐 Manual sign-in marker (module-level for hook access)
let markManualSignInFn = () => {};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 🔒 Guards
  const initialized = useRef(false);
  const manualSignIn = useRef(false);

  // Set the module-level function
  markManualSignInFn = () => {
    manualSignIn.current = true;
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let isMounted = true;

    // Helper to fetch user role
    const fetchUserRole = (userId: string) => {
      setTimeout(() => {
        if (!isMounted) return;
        supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single()
          .then(({ data: profile }) => {
            if (!isMounted) return;
            if (profile) {
              setUserRole(profile.role);
            }
            setLoading(false);
          });
      }, 0);
    };

    // 1️⃣ Get existing session ONCE
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        fetchUserRole(data.session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2️⃣ Subscribe to auth events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;
      console.log("[AUTH EVENT]", event);

      switch (event) {
        case "SIGNED_IN": {
          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (newSession?.user) {
            fetchUserRole(newSession.user.id);
          }

          if (manualSignIn.current) {
            console.log("[AUTH] Manual sign-in confirmed");
            manualSignIn.current = false;
          } else {
            console.log("[AUTH] Session restored silently");
          }
          break;
        }

        case "TOKEN_REFRESHED": {
          // Silent update only - no UI feedback
          setSession(newSession);
          setUser(newSession?.user ?? null);
          break;
        }

        case "SIGNED_OUT": {
          setSession(null);
          setUser(null);
          setUserRole(null);
          setLoading(false);
          break;
        }

        default:
          // Ignore all other events
          break;
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setUserRole(null);
    navigate('/auth');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// 🔐 Hook
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}

// 🔑 EXPORT THIS FOR LOGIN FORMS
export function useMarkManualSignIn() {
  return () => markManualSignInFn();
}
