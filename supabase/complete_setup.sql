-- =============================================================================
-- HOSTEL MANAGEMENT SYSTEM — COMPLETE ONE-FILE DATABASE SETUP (FAST & NO RLS RECURSION)
-- Run this ENTIRE file ONCE in Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. TABLES CREATION & MIGRATION ALTER STATEMENTS
-- =============================================================================

-- PROFILES TABLE (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HOSTELS TABLE
CREATE TABLE IF NOT EXISTS public.hostels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  currency_symbol TEXT NOT NULL DEFAULT 'Rs.',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HOSTEL STAFF TABLE (many-to-many junction)
CREATE TABLE IF NOT EXISTS public.hostel_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(hostel_id, user_id)
);

-- ROOMS TABLE
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  room_no TEXT NOT NULL,
  floor TEXT NOT NULL DEFAULT 'Ground',
  room_type TEXT NOT NULL DEFAULT 'single' CHECK (room_type IN ('single', 'double', 'triple', 'dormitory')),
  beds INT NOT NULL DEFAULT 1 CHECK (beds > 0),
  rent_per_bed NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(hostel_id, room_no)
);

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- TENANTS TABLE
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  tenant_type TEXT NOT NULL DEFAULT 'student' CHECK (tenant_type IN ('student', 'professional', 'other')),
  institution TEXT DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  id_card_no TEXT DEFAULT '',
  guardian_name TEXT DEFAULT '',
  guardian_phone TEXT DEFAULT '',
  home_address TEXT DEFAULT '',
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  leave_date DATE,
  monthly_rent NUMERIC(10,2) NOT NULL DEFAULT 0,
  security_deposit NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left')),
  photo_url TEXT DEFAULT '',
  id_doc_url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS id_doc_url TEXT DEFAULT '';

-- PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  receipt_no TEXT NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  month_for DATE NOT NULL,
  type TEXT NOT NULL DEFAULT 'rent' CHECK (type IN ('rent', 'security_deposit', 'mess', 'electricity', 'laundry', 'late_fee', 'other')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'bank_transfer', 'mobile_wallet', 'cheque')),
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(hostel_id, receipt_no)
);

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_month_for_check;

-- EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN (
    'rent_to_owner', 'electricity', 'gas', 'water', 'internet',
    'salaries', 'food', 'maintenance', 'cleaning', 'supplies',
    'deposit_refund', 'marketing', 'other'
  )),
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  paid_to TEXT DEFAULT '',
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'bank_transfer', 'mobile_wallet', 'cheque')),
  receipt_url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT DEFAULT '';

-- =============================================================================
-- 2. AUTOMATIC PROFILE TRIGGER ON AUTH SIGNUP
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'owner')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 3. INDEXES FOR HIGH PERFORMANCE
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_tenants_hostel ON public.tenants(hostel_id);
CREATE INDEX IF NOT EXISTS idx_tenants_room ON public.tenants(room_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON public.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_month ON public.payments(month_for);
CREATE INDEX IF NOT EXISTS idx_payments_hostel ON public.payments(hostel_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_hostel ON public.expenses(hostel_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_rooms_hostel ON public.rooms(hostel_id);

-- =============================================================================
-- 4. DATABASE VIEWS
-- =============================================================================
DROP VIEW IF EXISTS public.monthly_profit CASCADE;
DROP VIEW IF EXISTS public.monthly_expenses CASCADE;
DROP VIEW IF EXISTS public.monthly_income CASCADE;
DROP VIEW IF EXISTS public.monthly_rent_status CASCADE;

-- Monthly rent status per tenant per month
CREATE VIEW public.monthly_rent_status AS
SELECT
  t.id AS tenant_id,
  t.hostel_id,
  t.full_name,
  t.room_id,
  r.room_no,
  t.monthly_rent AS expected_rent,
  t.phone,
  months.month_date,
  COALESCE(SUM(p.amount) FILTER (WHERE p.type = 'rent'), 0) AS paid_amount,
  t.monthly_rent - COALESCE(SUM(p.amount) FILTER (WHERE p.type = 'rent'), 0) AS balance,
  CASE
    WHEN COALESCE(SUM(p.amount) FILTER (WHERE p.type = 'rent'), 0) >= t.monthly_rent THEN 'paid'
    WHEN COALESCE(SUM(p.amount) FILTER (WHERE p.type = 'rent'), 0) > 0 THEN 'partial'
    ELSE 'unpaid'
  END AS payment_status
FROM public.tenants t
CROSS JOIN (
  SELECT generate_series(
    DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months'),
    DATE_TRUNC('month', CURRENT_DATE),
    '1 month'::interval
  )::date AS month_date
) months
LEFT JOIN public.payments p
  ON p.tenant_id = t.id
  AND p.month_for = months.month_date
  AND p.type = 'rent'
LEFT JOIN public.rooms r ON r.id = t.room_id
WHERE t.status = 'active'
  AND months.month_date >= DATE_TRUNC('month', t.join_date)
  AND (t.leave_date IS NULL OR months.month_date <= DATE_TRUNC('month', t.leave_date))
GROUP BY t.id, t.hostel_id, t.full_name, t.room_id, r.room_no, t.monthly_rent, t.phone, months.month_date;

-- Monthly income summary
CREATE VIEW public.monthly_income AS
SELECT
  p.hostel_id,
  DATE_TRUNC('month', p.payment_date)::date AS month_date,
  SUM(p.amount) FILTER (WHERE p.type != 'security_deposit') AS total_income,
  SUM(p.amount) FILTER (WHERE p.type = 'rent') AS rent_income,
  SUM(p.amount) FILTER (WHERE p.type = 'security_deposit') AS deposits_collected,
  SUM(p.amount) FILTER (WHERE p.type NOT IN ('rent', 'security_deposit')) AS other_income,
  COUNT(*) AS payment_count
FROM public.payments p
GROUP BY p.hostel_id, DATE_TRUNC('month', p.payment_date);

-- Monthly expenses summary
CREATE VIEW public.monthly_expenses AS
SELECT
  e.hostel_id,
  DATE_TRUNC('month', e.expense_date)::date AS month_date,
  SUM(e.amount) FILTER (WHERE e.category != 'deposit_refund') AS total_expenses,
  SUM(e.amount) FILTER (WHERE e.category = 'deposit_refund') AS deposits_refunded,
  SUM(e.amount) AS total_outflow,
  COUNT(*) AS expense_count
FROM public.expenses e
GROUP BY e.hostel_id, DATE_TRUNC('month', e.expense_date);

-- Monthly net profit view
CREATE VIEW public.monthly_profit AS
SELECT
  COALESCE(i.hostel_id, e.hostel_id) AS hostel_id,
  COALESCE(i.month_date, e.month_date) AS month_date,
  COALESCE(i.total_income, 0) AS total_income,
  COALESCE(e.total_expenses, 0) AS total_expenses,
  COALESCE(i.total_income, 0) - COALESCE(e.total_expenses, 0) AS net_profit
FROM public.monthly_income i
FULL OUTER JOIN public.monthly_expenses e
  ON i.hostel_id = e.hostel_id AND i.month_date = e.month_date;

-- =============================================================================
-- 5. FAST & NON-RECURSIVE ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Clean existing policies to prevent recursion
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can access profiles" ON public.profiles;

CREATE POLICY "Authenticated users can access profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Hostels Policies
DROP POLICY IF EXISTS "Owners can create hostels" ON public.hostels;
DROP POLICY IF EXISTS "Users can view hostels they have access to" ON public.hostels;
DROP POLICY IF EXISTS "Owners can update their hostels" ON public.hostels;
DROP POLICY IF EXISTS "Owners can delete their hostels" ON public.hostels;
DROP POLICY IF EXISTS "Authenticated users can access hostels" ON public.hostels;

CREATE POLICY "Authenticated users can access hostels" ON public.hostels FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Hostel Staff Policies
DROP POLICY IF EXISTS "Owners can manage staff assignments" ON public.hostel_staff;
DROP POLICY IF EXISTS "Staff can view their own assignments" ON public.hostel_staff;
DROP POLICY IF EXISTS "Authenticated users can access hostel_staff" ON public.hostel_staff;

CREATE POLICY "Authenticated users can access hostel_staff" ON public.hostel_staff FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Rooms Policies
DROP POLICY IF EXISTS "Users can view rooms in their hostels" ON public.rooms;
DROP POLICY IF EXISTS "Users can insert rooms" ON public.rooms;
DROP POLICY IF EXISTS "Users can update rooms" ON public.rooms;
DROP POLICY IF EXISTS "Only owners can delete rooms" ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can access rooms" ON public.rooms;

CREATE POLICY "Authenticated users can access rooms" ON public.rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tenants Policies
DROP POLICY IF EXISTS "Users can view tenants in their hostels" ON public.tenants;
DROP POLICY IF EXISTS "Users can insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Users can update tenants" ON public.tenants;
DROP POLICY IF EXISTS "Only owners can delete tenants" ON public.tenants;
DROP POLICY IF EXISTS "Authenticated users can access tenants" ON public.tenants;

CREATE POLICY "Authenticated users can access tenants" ON public.tenants FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Payments Policies
DROP POLICY IF EXISTS "Users can view payments in their hostels" ON public.payments;
DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update payments" ON public.payments;
DROP POLICY IF EXISTS "Only owners can delete payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can access payments" ON public.payments;

CREATE POLICY "Authenticated users can access payments" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Expenses Policies
DROP POLICY IF EXISTS "Users can view expenses in their hostels" ON public.expenses;
DROP POLICY IF EXISTS "Users can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Only owners can delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can access expenses" ON public.expenses;

CREATE POLICY "Authenticated users can access expenses" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- 6. STORAGE BUCKETS & STORAGE POLICIES
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-files',
  'tenant-files',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts',
  'expense-receipts',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload tenant files" ON storage.objects;
CREATE POLICY "Authenticated users can upload tenant files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tenant-files');

DROP POLICY IF EXISTS "Anyone can view tenant files" ON storage.objects;
CREATE POLICY "Anyone can view tenant files" ON storage.objects FOR SELECT TO public USING (bucket_id = 'tenant-files');

DROP POLICY IF EXISTS "Authenticated users can update tenant files" ON storage.objects;
CREATE POLICY "Authenticated users can update tenant files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'tenant-files');

DROP POLICY IF EXISTS "Authenticated users can delete tenant files" ON storage.objects;
CREATE POLICY "Authenticated users can delete tenant files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'tenant-files');

DROP POLICY IF EXISTS "Authenticated users can upload expense receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload expense receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'expense-receipts');

DROP POLICY IF EXISTS "Anyone can view expense receipts" ON storage.objects;
CREATE POLICY "Anyone can view expense receipts" ON storage.objects FOR SELECT TO public USING (bucket_id = 'expense-receipts');

DROP POLICY IF EXISTS "Authenticated users can update expense receipts" ON storage.objects;
CREATE POLICY "Authenticated users can update expense receipts" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'expense-receipts');

DROP POLICY IF EXISTS "Authenticated users can delete expense receipts" ON storage.objects;
CREATE POLICY "Authenticated users can delete expense receipts" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'expense-receipts');
