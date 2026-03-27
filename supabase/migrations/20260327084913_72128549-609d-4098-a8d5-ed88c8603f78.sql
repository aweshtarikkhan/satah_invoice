-- Fix secure organization onboarding and add paper size support for document templates

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS template_paper_size text NOT NULL DEFAULT 'a4';

-- Secure server-side organization creation flow to avoid client-side RLS race conditions
CREATE OR REPLACE FUNCTION public.create_organization_for_current_user(org_name text)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_org_id uuid;
  v_org public.organizations;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF org_name IS NULL OR btrim(org_name) = '' THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (v_user_id, '', '')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT org_id
  INTO v_existing_org_id
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_existing_org_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;

  INSERT INTO public.organizations (name, template_paper_size)
  VALUES (btrim(org_name), 'a4')
  RETURNING * INTO v_org;

  UPDATE public.profiles
  SET org_id = v_org.id,
      updated_at = now()
  WHERE user_id = v_user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN v_org;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization_for_current_user(text) TO authenticated;