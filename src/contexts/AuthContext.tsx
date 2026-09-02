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
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  backendUnreachable: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let markManualSignInFn = () => {};

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const AUTH_TIMEOUT = 8000;

function OfflineFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8 max-w-md">
        <div className="animate-pulse">
          <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Dynasty OS is reconnecting...
        </h1>
        <p className="text-muted-foreground">
          Please wait or refresh the page.
        </p>
        <Button
          onClick={() => {
            localStorage.removeItem("sb-qalaaroashbggynpvqct-auth-token");
            window.location.reload();
          }}
          variant="outline"
          size="lg"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Now
        </Button>
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendUnreachable, setBackendUnreachable] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const initialized = useRef(false);
  const manualSignIn = useRef(false);
  // Last authenticated user id — used to tell a real login apart from a
  // background session recovery / token refresh.
  const lastUserId = useRef<string | null>(null);

  markManualSignInFn = () => {
    manualSignIn.current = true;
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let isMounted = true;

    // Clear stale/invalid session tokens on startup
    const clearStaleSession = () => {
      try {
        const stored = localStorage.getItem("sb-qalaaroashbggynpvqct-auth-token");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!parsed?.access_token || !parsed?.refresh_token) {
            console.warn("[AUTH] Clearing invalid stored session");
            localStorage.removeItem("sb-qalaaroashbggynpvqct-auth-token");
          }
          // Check if token is expired beyond refresh window (7 days)
          if (parsed?.expires_at) {
            const expiresAt = parsed.expires_at * 1000;
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            if (expiresAt < sevenDaysAgo) {
              console.warn("[AUTH] Clearing expired session (>7 days old)");
              localStorage.removeItem("sb-qalaaroashbggynpvqct-auth-token");
            }
          }
        }
      } catch {
        localStorage.removeItem("sb-qalaaroashbggynpvqct-auth-token");
      }
    };

    clearStaleSession();

    const fetchUserRole = (userId: string) => {
      setTimeout(() => {
        if (!isMounted) return;
        supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single()
          .then(({ data: profile }) => {
            if (!isMounted) return;
            if (profile) setUserRole(profile.role);
          });
      }, 0);
    };

    // Retry wrapper for getSession
    const getSessionWithRetry = async (): Promise<Session | null> => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Auth timeout")), AUTH_TIMEOUT)
            ),
          ]);
          return result.data.session;
        } catch (err) {
          console.warn(`[AUTH] getSession attempt ${attempt}/${MAX_RETRIES} failed:`, err);
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY));
          }
        }
      }
      return null; // All retries exhausted
    };

    const initAuth = async () => {
      try {
        const sess = await getSessionWithRetry();

        if (!isMounted) return;

        if (sess) {
          setSession(sess);
          lastUserId.current = sess.user.id;
          setUser(sess.user);
          fetchUserRole(sess.user.id);
          setBackendUnreachable(false);
        } else {
          // Check if we had a stored token but couldn't reach backend
          const hadToken = localStorage.getItem("sb-qalaaroashbggynpvqct-auth-token");
          if (hadToken) {
            console.warn("[AUTH] Backend unreachable with stored token");
            setBackendUnreachable(true);
          }
        }
      } catch (err) {
        console.error("[AUTH] Init failed after all retries:", err);
        if (isMounted) setBackendUnreachable(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;
      console.log("[AUTH EVENT]", event);

      switch (event) {
        case "SIGNED_IN": {
          // Supabase re-emits SIGNED_IN when the tab regains focus / the session
          // is recovered. That is NOT a new login — only treat it as one when the
          // user identity actually changes. Otherwise we would wipe the profile
          // cache and send the whole app back through "Verifying access...".
          const nextUserId = newSession?.user?.id ?? null;
          const isSameUser = nextUserId !== null && nextUserId === lastUserId.current;

          setSession(newSession);
          setBackendUnreachable(false);

          if (!isSameUser) {
            lastUserId.current = nextUserId;
            setUser(newSession?.user ?? null);
            if (newSession?.user) fetchUserRole(newSession.user.id);
            qc.removeQueries({ queryKey: ["currentUserProfile"] });
            qc.invalidateQueries({ queryKey: ["dp-is-admin"] });
          }

          if (manualSignIn.current) {
            manualSignIn.current = false;
          }
          break;
        }
        case "TOKEN_REFRESHED": {
          // Credentials only. Identity/role/company state must stay untouched.
          setSession(newSession);
          setBackendUnreachable(false);
          break;
        }
        case "SIGNED_OUT": {
          setSession(null);
          lastUserId.current = null;
          setUser(null);
          setUserRole(null);
          setBackendUnreachable(false);
          setLoading(false);
          qc.clear();
          break;
        }
        default:
          break;
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [qc]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setUser(null);
      setUserRole(null);
      setBackendUnreachable(false);
      qc.clear();
      navigate("/auth", { replace: true });
    }
  };

  // Show offline fallback if backend is unreachable and no session
  if (!loading && backendUnreachable && !session) {
    return <OfflineFallback />;
  }

  return (
    <AuthContext.Provider
      value={{ user, session, userRole, loading, signOut, backendUnreachable }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function useMarkManualSignIn() {
  return () => markManualSignInFn();
}
