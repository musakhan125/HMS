-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- Run this AFTER schema.sql in the Supabase SQL Editor
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- HELPER FUNCTION: Check if user has access to a hostel (owner or staff)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.user_has_hostel_access(hostel_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.hostels WHERE id = hostel_uuid AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.hostel_staff WHERE hostel_id = hostel_uuid AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Check if current user is the hostel owner
CREATE OR REPLACE FUNCTION public.user_is_hostel_owner(hostel_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.hostels WHERE id = hostel_uuid AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Get the current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(user_role, 'staff');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PROFILES POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Owners can view all profiles" ON public.profiles;
CREATE POLICY "Owners can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_user_role() = 'owner');

-- =============================================================================
-- HOSTELS POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Owners can create hostels" ON public.hostels;
CREATE POLICY "Owners can create hostels"
  ON public.hostels FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can view hostels they have access to" ON public.hostels;
CREATE POLICY "Users can view hostels they have access to"
  ON public.hostels FOR SELECT
  USING (public.user_has_hostel_access(id));

DROP POLICY IF EXISTS "Owners can update their hostels" ON public.hostels;
CREATE POLICY "Owners can update their hostels"
  ON public.hostels FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete their hostels" ON public.hostels;
CREATE POLICY "Owners can delete their hostels"
  ON public.hostels FOR DELETE
  USING (owner_id = auth.uid());

-- =============================================================================
-- HOSTEL_STAFF POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Owners can manage staff assignments" ON public.hostel_staff;
CREATE POLICY "Owners can manage staff assignments"
  ON public.hostel_staff FOR ALL
  USING (public.user_is_hostel_owner(hostel_id));

DROP POLICY IF EXISTS "Staff can view their own assignments" ON public.hostel_staff;
CREATE POLICY "Staff can view their own assignments"
  ON public.hostel_staff FOR SELECT
  USING (user_id = auth.uid());

-- =============================================================================
-- ROOMS POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Users can view rooms in their hostels" ON public.rooms;
CREATE POLICY "Users can view rooms in their hostels"
  ON public.rooms FOR SELECT
  USING (public.user_has_hostel_access(hostel_id));

DROP POLICY IF EXISTS "Users can insert rooms" ON public.rooms;
CREATE POLICY "Users can insert rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (public.user_has_hostel_access(hostel_id));

DROP POLICY IF EXISTS "Users can update rooms" ON public.rooms;
CREATE POLICY "Users can update rooms"
  ON public.rooms FOR UPDATE
  USING (public.user_has_hostel_access(hostel_id));

DROP POLICY IF EXISTS "Only owners can delete rooms" ON public.rooms;
CREATE POLICY "Only owners can delete rooms"
  ON public.rooms FOR DELETE
  USING (public.user_is_hostel_owner(hostel_id));

-- =============================================================================
-- TENANTS POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Users can view tenants in their hostels" ON public.tenants;
CREATE POLICY "Users can view tenants in their hostels"
  ON public.tenants FOR SELECT
  USING (public.user_has_hostel_access(hostel_id));

DROP POLICY IF EXISTS "Users can insert tenants" ON public.tenants;
CREATE POLICY "Users can insert tenants"
  ON public.tenants FOR INSERT
  WITH CHECK (public.user_has_hostel_access(hostel_id));

DROP POLICY IF EXISTS "Users can update tenants" ON public.tenants;
CREATE POLICY "Users can update tenants"
  ON public.tenants FOR UPDATE
  USING (public.user_has_hostel_access(hostel_id));

DROP POLICY IF EXISTS "Only owners can delete tenants" ON public.tenants;
CREATE POLICY "Only owners can delete tenants"
  ON public.tenants FOR DELETE
  USING (public.user_is_hostel_owner(hostel_id));

-- =============================================================================
-- PAYMENTS POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Users can view payments in their hostels" ON public.payments;
CREATE POLICY "Users can view payments in their hostels"
  ON public.payments FOR SELECT
  USING (public.user_has_hostel_access(hostel_id));

DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;
CREATE POLICY "Users can insert payments"
  ON public.payments FOR INSERT
  WITH CHECK (public.user_has_hostel_access(hostel_id));

DROP POLICY IF EXISTS "Users can update payments" ON public.payments;
CREATE POLICY "Users can update payments"
  ON public.payments FOR UPDATE
  USING (public.user_has_hostel_access(hostel_id));

DROP POLICY IF EXISTS "Only owners can delete payments" ON public.payments;
CREATE POLICY "Only owners can delete payments"
  ON public.payments FOR DELETE
  USING (public.user_is_hostel_owner(hostel_id));

-- =============================================================================
-- EXPENSES POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Users can view expenses in their hostels" ON public.expenses;
CREATE POLICY "Users can view expenses in their hostels"
  ON public.expenses FOR SELECT
  USING (public.user_has_hostel_access(hostel_id));

DROP POLICY IF EXISTS "Users can insert expenses" ON public.expenses;
CREATE POLICY "Users can insert expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (public.user_has_hostel_access(hostel_id));

DROP POLICY IF EXISTS "Users can update expenses" ON public.expenses;
CREATE POLICY "Users can update expenses"
  ON public.expenses FOR UPDATE
  USING (public.user_has_hostel_access(hostel_id));

DROP POLICY IF EXISTS "Only owners can delete expenses" ON public.expenses;
CREATE POLICY "Only owners can delete expenses"
  ON public.expenses FOR DELETE
  USING (public.user_is_hostel_owner(hostel_id));
