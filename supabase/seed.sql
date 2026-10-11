-- =============================================================================
-- SEED DATA — Sample hostel with rooms, tenants, payments, expenses
-- Run this AFTER all schema/policies/storage scripts
-- NOTE: You must replace 'YOUR_USER_ID' with your actual Supabase auth user ID
-- after you create your first account via the app's sign-up.
-- =============================================================================

-- To get your user ID, run:
-- SELECT id FROM auth.users WHERE email = 'your-email@example.com';

-- Then replace all instances of 'YOUR_USER_ID' below with that UUID.

-- EXAMPLE (uncomment and replace YOUR_USER_ID):

/*
-- Insert hostel
INSERT INTO public.hostels (id, name, address, phone, owner_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Al-Noor Boys Hostel', '123 University Road, Lahore', '0301-1234567', 'YOUR_USER_ID');

-- Insert rooms
INSERT INTO public.rooms (id, hostel_id, room_no, floor, room_type, beds, rent_per_bed) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '101', 'Ground', 'double', 2, 8000),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '102', 'Ground', 'triple', 3, 6500),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '201', '1st', 'single', 1, 12000);

-- Insert tenants
INSERT INTO public.tenants (id, hostel_id, full_name, tenant_type, institution, phone, room_id, join_date, monthly_rent, security_deposit, status) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ahmed Khan', 'student', 'LUMS', '0312-1111111', 'b0000000-0000-0000-0000-000000000001', '2026-01-15', 8000, 8000, 'active'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Bilal Hussain', 'student', 'UET Lahore', '0321-2222222', 'b0000000-0000-0000-0000-000000000001', '2026-02-01', 8000, 8000, 'active'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Waseem Akram', 'professional', 'TechCorp', '0333-3333333', 'b0000000-0000-0000-0000-000000000003', '2026-03-01', 12000, 12000, 'active');

-- Insert payments
INSERT INTO public.payments (hostel_id, tenant_id, receipt_no, payment_date, month_for, type, amount, method, created_by) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'RCP-001', '2026-09-05', '2026-09-01', 'rent', 8000, 'cash', 'YOUR_USER_ID'),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'RCP-002', '2026-09-07', '2026-09-01', 'rent', 8000, 'bank_transfer', 'YOUR_USER_ID'),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'RCP-003', '2026-09-10', '2026-09-01', 'rent', 12000, 'mobile_wallet', 'YOUR_USER_ID'),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'RCP-004', '2026-01-15', '2026-01-01', 'security_deposit', 8000, 'cash', 'YOUR_USER_ID'),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'RCP-005', '2026-10-03', '2026-10-01', 'rent', 5000, 'cash', 'YOUR_USER_ID');

-- Insert expenses
INSERT INTO public.expenses (hostel_id, expense_date, category, description, amount, paid_to, method, created_by) VALUES
  ('a0000000-0000-0000-0000-000000000001', '2026-09-01', 'electricity', 'September electricity bill', 15000, 'LESCO', 'bank_transfer', 'YOUR_USER_ID'),
  ('a0000000-0000-0000-0000-000000000001', '2026-09-05', 'water', 'Water bill September', 3000, 'WASA', 'cash', 'YOUR_USER_ID'),
  ('a0000000-0000-0000-0000-000000000001', '2026-09-10', 'internet', 'Monthly internet', 5000, 'PTCL', 'bank_transfer', 'YOUR_USER_ID'),
  ('a0000000-0000-0000-0000-000000000001', '2026-09-15', 'salaries', 'Guard salary', 20000, 'Rashid (Guard)', 'cash', 'YOUR_USER_ID'),
  ('a0000000-0000-0000-0000-000000000001', '2026-10-01', 'maintenance', 'Plumbing repair room 102', 2500, 'Ali Plumber', 'cash', 'YOUR_USER_ID');
*/
