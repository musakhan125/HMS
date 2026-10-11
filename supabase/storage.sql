-- =============================================================================
-- SUPABASE STORAGE BUCKETS
-- Run this AFTER schema.sql and rls-policies.sql
-- =============================================================================

-- Create storage bucket for tenant photos and documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-files',
  'tenant-files',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for expense receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts',
  'expense-receipts',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for tenant-files
DROP POLICY IF EXISTS "Authenticated users can upload tenant files" ON storage.objects;
CREATE POLICY "Authenticated users can upload tenant files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'tenant-files');

DROP POLICY IF EXISTS "Anyone can view tenant files" ON storage.objects;
CREATE POLICY "Anyone can view tenant files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'tenant-files');

DROP POLICY IF EXISTS "Authenticated users can update tenant files" ON storage.objects;
CREATE POLICY "Authenticated users can update tenant files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'tenant-files');

DROP POLICY IF EXISTS "Authenticated users can delete tenant files" ON storage.objects;
CREATE POLICY "Authenticated users can delete tenant files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'tenant-files');

-- Storage policies for expense-receipts
DROP POLICY IF EXISTS "Authenticated users can upload expense receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload expense receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'expense-receipts');

DROP POLICY IF EXISTS "Anyone can view expense receipts" ON storage.objects;
CREATE POLICY "Anyone can view expense receipts"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'expense-receipts');

DROP POLICY IF EXISTS "Authenticated users can update expense receipts" ON storage.objects;
CREATE POLICY "Authenticated users can update expense receipts"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'expense-receipts');

DROP POLICY IF EXISTS "Authenticated users can delete expense receipts" ON storage.objects;
CREATE POLICY "Authenticated users can delete expense receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'expense-receipts');
