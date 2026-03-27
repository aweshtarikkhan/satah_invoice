
-- Fix: restrict org creation to only allow authenticated users, and tighten the policy
DROP POLICY "Authenticated users can create orgs" ON public.organizations;

CREATE POLICY "Authenticated users can create orgs" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND org_id IS NOT NULL)
  );
