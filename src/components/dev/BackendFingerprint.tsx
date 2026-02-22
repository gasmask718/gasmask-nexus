import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Fingerprint, X, AlertTriangle, CheckCircle } from 'lucide-react';

const APP_NAME = 'Dynasty OS';
const BUILD_VERSION = 'v3.0';
const EXPECTED_REF = 'qalaaroashbggynpvqct';

function extractRef(url: string): string {
  try {
    const host = new URL(url).hostname;
    return host.split('.')[0];
  } catch {
    return 'unknown';
  }
}

export function BackendFingerprint() {
  const [visible, setVisible] = useState(false);
  const { user } = useAuth();

  // Only show in dev or for admin users
  const isDev = import.meta.env.DEV;
  if (!isDev) return null;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const currentRef = extractRef(supabaseUrl);
  const isMatch = currentRef === EXPECTED_REF;

  if (!visible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setVisible(true)}
        className="fixed top-2 right-2 z-[9999] h-7 w-7 p-0 opacity-40 hover:opacity-100 transition-opacity"
        title="Backend Fingerprint"
      >
        <Fingerprint className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="fixed top-2 right-2 z-[9999] flex items-center gap-2 rounded-lg border bg-background/95 backdrop-blur px-3 py-1.5 shadow-lg text-xs font-mono">
      {isMatch ? (
        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 animate-pulse" />
      )}

      <span className="text-muted-foreground">Backend:</span>
      <Badge variant={isMatch ? 'outline' : 'destructive'} className="text-[10px] px-1.5 py-0">
        {currentRef}
      </Badge>

      <span className="text-muted-foreground">•</span>
      <span className="text-foreground">{APP_NAME}</span>

      <span className="text-muted-foreground">•</span>
      <span className="text-muted-foreground">{BUILD_VERSION}</span>

      {user && (
        <>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground truncate max-w-[100px]" title={user.id}>
            {user.id.slice(0, 8)}…
          </span>
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0 ml-1"
        onClick={() => setVisible(false)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

/** Full-screen blocker if backend ref doesn't match */
export function BackendMismatchGuard({ children }: { children: React.ReactNode }) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const currentRef = extractRef(supabaseUrl);
  const isMatch = currentRef === EXPECTED_REF;

  if (!isMatch && import.meta.env.DEV) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-destructive/10 p-8">
        <div className="max-w-lg text-center space-y-4">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-destructive">BACKEND MISMATCH</h1>
          <p className="text-muted-foreground">
            This app is pointing to <code className="font-mono bg-muted px-1 rounded">{currentRef}</code> but expected{' '}
            <code className="font-mono bg-muted px-1 rounded">{EXPECTED_REF}</code>.
          </p>
          <p className="text-sm text-muted-foreground">
            Check your environment configuration. This app will not function correctly against the wrong database.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
