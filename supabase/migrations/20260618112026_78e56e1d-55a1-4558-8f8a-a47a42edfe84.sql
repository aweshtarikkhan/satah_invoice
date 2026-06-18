
CREATE POLICY "empdocs_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'employee-documents' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);
CREATE POLICY "empdocs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'employee-documents' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);
CREATE POLICY "empdocs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'employee-documents' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);
CREATE POLICY "empdocs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'employee-documents' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);
