
-- Create storage bucket for org logos
INSERT INTO storage.buckets (id, name, public) VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their org folder
CREATE POLICY "Users can upload org logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-logos');

CREATE POLICY "Users can update org logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'org-logos');

CREATE POLICY "Public can view org logos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'org-logos');

CREATE POLICY "Users can delete org logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'org-logos');
