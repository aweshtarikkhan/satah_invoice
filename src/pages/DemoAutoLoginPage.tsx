import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/shared/SEO";

export default function DemoAutoLoginPage() {
  const navigate = useNavigate();
  const ranRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        // If already signed in, go straight to dashboard
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          navigate("/dashboard", { replace: true });
          return;
        }

        const { data, error } = await supabase.functions.invoke("setup-demo");
        if (error) throw error;

        const { email, password } = data ?? {};
        if (!email || !password) throw new Error("Demo credentials missing");

        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;

        navigate("/dashboard", { replace: true });
      } catch (err: any) {
        setError(err?.message || "Failed to start demo session");
      }
    })();
  }, [navigate]);

  return (
    <>
      <SEO title="Demo Access" description="Instant demo access to Satah Invoices with full features." path="/demo" />
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 px-4 text-center">
        {error ? (
          <>
            <AlertCircle className="h-10 w-10 text-destructive" />
            <h1 className="text-xl font-semibold">Couldn't start demo</h1>
            <p className="max-w-md text-sm text-muted-foreground">{error}</p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>Try again</Button>
              <Button variant="outline" onClick={() => navigate("/login")}>Go to login</Button>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <h1 className="text-xl font-semibold">Preparing your demo workspace…</h1>
            <p className="text-sm text-muted-foreground">Provisioning sample data and signing you in.</p>
          </>
        )}
      </div>
    </>
  );
}
