
-- 1. Secure portal lookup RPC (validates token + expiry)
CREATE OR REPLACE FUNCTION public.get_portal_bundle(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pt portal_tokens%ROWTYPE;
  v_org jsonb;
  v_entity jsonb;
  v_lines jsonb;
  v_client jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_pt FROM portal_tokens WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_pt.expires_at IS NOT NULL AND v_pt.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT to_jsonb(o.*) INTO v_org FROM organizations o WHERE o.id = v_pt.org_id;

  IF v_pt.entity_type = 'invoice' THEN
    SELECT to_jsonb(i.*) INTO v_entity FROM invoices i WHERE i.id = v_pt.entity_id;
    SELECT to_jsonb(c.*) INTO v_client FROM clients c WHERE c.id = (v_entity->>'client_id')::uuid;
    SELECT COALESCE(jsonb_agg(to_jsonb(l.*) ORDER BY l.sort_order), '[]'::jsonb) INTO v_lines
      FROM invoice_lines l WHERE l.invoice_id = v_pt.entity_id;
  ELSIF v_pt.entity_type = 'estimate' THEN
    SELECT to_jsonb(e.*) INTO v_entity FROM estimates e WHERE e.id = v_pt.entity_id;
    SELECT to_jsonb(c.*) INTO v_client FROM clients c WHERE c.id = (v_entity->>'client_id')::uuid;
    SELECT COALESCE(jsonb_agg(to_jsonb(l.*) ORDER BY l.sort_order), '[]'::jsonb) INTO v_lines
      FROM estimate_lines l WHERE l.estimate_id = v_pt.entity_id;
  ELSIF v_pt.entity_type = 'credit_note' THEN
    SELECT to_jsonb(cn.*) INTO v_entity FROM credit_notes cn WHERE cn.id = v_pt.entity_id;
    SELECT to_jsonb(c.*) INTO v_client FROM clients c WHERE c.id = (v_entity->>'client_id')::uuid;
    SELECT COALESCE(jsonb_agg(to_jsonb(l.*) ORDER BY l.sort_order), '[]'::jsonb) INTO v_lines
      FROM credit_note_lines l WHERE l.credit_note_id = v_pt.entity_id;
  ELSE
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'token', to_jsonb(v_pt),
    'org', v_org,
    'entity', v_entity,
    'client', v_client,
    'lines', v_lines
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_bundle(text) TO anon, authenticated;

-- Mark-as-viewed RPC (anon callable, only updates if token matches)
CREATE OR REPLACE FUNCTION public.mark_portal_viewed(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pt portal_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_pt FROM portal_tokens WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_pt.expires_at IS NOT NULL AND v_pt.expires_at < now() THEN RETURN; END IF;

  IF v_pt.entity_type = 'invoice' THEN
    UPDATE invoices SET viewed_at = COALESCE(viewed_at, now()),
      status = CASE WHEN status = 'sent' THEN 'viewed'::invoice_status ELSE status END
      WHERE id = v_pt.entity_id;
  ELSIF v_pt.entity_type = 'estimate' THEN
    UPDATE estimates SET viewed_at = COALESCE(viewed_at, now()),
      status = CASE WHEN status = 'sent' THEN 'viewed'::estimate_status ELSE status END
      WHERE id = v_pt.entity_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_portal_viewed(text) TO anon, authenticated;

-- 2. Drop all anon SELECT policies (portal access now via RPC only)
DROP POLICY IF EXISTS "Anyone can view portal by token" ON public.portal_tokens;
DROP POLICY IF EXISTS "Anon can view invoices via portal" ON public.invoices;
DROP POLICY IF EXISTS "Anon can view invoice lines via portal" ON public.invoice_lines;
DROP POLICY IF EXISTS "Anon can view estimates via portal" ON public.estimates;
DROP POLICY IF EXISTS "Anon can view estimate lines via portal" ON public.estimate_lines;
DROP POLICY IF EXISTS "Anon can view credit notes via portal" ON public.credit_notes;
DROP POLICY IF EXISTS "Anon can view credit note lines via portal" ON public.credit_note_lines;
DROP POLICY IF EXISTS "Anon can view clients via portal" ON public.clients;
DROP POLICY IF EXISTS "Anon can view org via portal" ON public.organizations;

-- 3. Restrict exchange_rates writes to owners only
DROP POLICY IF EXISTS "Authenticated users can insert exchange rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Authenticated users can update exchange rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Authenticated users can delete exchange rates" ON public.exchange_rates;

CREATE POLICY "Owners can insert exchange rates" ON public.exchange_rates
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update exchange rates" ON public.exchange_rates
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete exchange rates" ON public.exchange_rates
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- 4. Org-logos storage: scope writes to user's own org folder
DROP POLICY IF EXISTS "Anyone can upload org logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update org logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete org logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload org logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update org logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete org logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their org logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their org logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their org logo" ON storage.objects;

CREATE POLICY "Users can upload their org logo" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-logos' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);
CREATE POLICY "Users can update their org logo" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'org-logos' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);
CREATE POLICY "Users can delete their org logo" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'org-logos' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);
