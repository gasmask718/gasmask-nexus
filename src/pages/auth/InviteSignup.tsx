import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Crown, Loader2, AlertCircle, UserPlus } from "lucide-react";
import { validateInviteToken, acceptInvitation, type Invitation } from "@/services/invitationService";
import { supabase } from "@/integrations/supabase/client";
import { getRoleDisplayName } from "@/services/roleService";
import { createUserProfile, createRoleProfile } from "@/services/roleService";
import { OSRole } from "@/config/osNavigation";

export default function InviteSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided");
      setLoading(false);
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) return;

    const { invitation, error } = await validateInviteToken(token);

    if (error) {
      setError(error);
      setLoading(false);
      return;
    }

    setInvitation(invitation);
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitation || !token) {
      toast.error("Invalid invitation");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            role: invitation.role,
          },
        },
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error("Failed to create user account");

      const userId = authData.user.id;

      // 2. Accept invitation FIRST — source of truth mutation
      const { success: accepted, error: acceptError } = await acceptInvitation(token, userId);
      if (!accepted) {
        console.error("Accept invitation failed:", acceptError);
      }

      // 3. Create user profile
      await createUserProfile(userId, {
        full_name: fullName,
        primary_role: invitation.role as OSRole,
        preferred_language: "en",
      });

      // 4. Create role-specific profile if needed
      const roleData: Record<string, any> = {};
      if (invitation.metadata?.assigned_store_id) {
        roleData.assigned_store_id = invitation.metadata.assigned_store_id;
      }
      if (invitation.metadata?.assigned_brand_id) {
        roleData.assigned_brand_id = invitation.metadata.assigned_brand_id;
      }

      await createRoleProfile(userId, invitation.role as OSRole, roleData);

      // 5. Add to user_roles table
      await supabase.from("user_roles").insert({ user_id: userId, role: invitation.role as any });

      toast.success("Account created successfully! Redirecting to login...");

      // 6. Redirect to appropriate login page based on role
      let redirectPath = "/auth"; // Default fallback

      switch (invitation.role) {
        case "biker":
          redirectPath = "/portal/biker/login";
          break;
        case "driver":
          redirectPath = "/portal/driver/login";
          break;
        case "customer":
        case "user":
          redirectPath = "/portal/login";
          break;
        default:
          redirectPath = "/auth";
          break;
      }

      setTimeout(() => {
        navigate(redirectPath, { replace: true });
      }, 1000); // Increased delay slightly to let the toast be seen
    } catch (err: any) {
      console.error("Signup error:", err);
      toast.error(err.message || "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/auth")} variant="outline">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto shadow-lg">
            <Crown className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl">Join Dynasty OS</CardTitle>
            <CardDescription>Complete your account setup</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="font-medium">{invitation.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Role</span>
              <Badge variant="secondary">{getRoleDisplayName(invitation.role as OSRole)}</Badge>
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            <p>By creating an account, you agree to our terms of service.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
