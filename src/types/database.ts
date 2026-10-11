// =============================================================================
// Database types matching the Supabase schema
// =============================================================================

export type UserRole = 'owner' | 'staff';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Hostel {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  currency_symbol: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  hostel_id: string;
  room_no: string;
  floor: string;
  room_type: RoomType;
  beds: number;
  rent_per_bed: number;
  notes: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  occupants?: Tenant[];
  occupied_beds?: number;
}

export type RoomType = 'single' | 'double' | 'triple' | 'dormitory';

export interface Tenant {
  id: string;
  hostel_id: string;
  full_name: string;
  tenant_type: TenantType;
  institution: string;
  phone: string;
  id_card_no: string;
  guardian_name: string;
  guardian_phone: string;
  home_address: string;
  room_id: string | null;
  join_date: string;
  leave_date: string | null;
  monthly_rent: number;
  security_deposit: number;
  status: TenantStatus;
  photo_url: string;
  id_doc_url: string;
  notes: string;
  created_at: string;
  updated_at: string;
  // Joined
  room?: Room;
}

export type TenantType = 'student' | 'professional' | 'other';
export type TenantStatus = 'active' | 'left';

export interface Payment {
  id: string;
  hostel_id: string;
  tenant_id: string;
  receipt_no: string;
  payment_date: string;
  month_for: string;
  type: PaymentType;
  amount: number;
  method: PaymentMethod;
  notes: string;
  created_by: string;
  created_at: string;
  // Joined
  tenant?: Tenant;
}

export type PaymentType = 'rent' | 'security_deposit' | 'mess' | 'electricity' | 'laundry' | 'late_fee' | 'other';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'mobile_wallet' | 'cheque';

export interface Expense {
  id: string;
  hostel_id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paid_to: string;
  method: PaymentMethod;
  receipt_url: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ExpenseCategory =
  | 'rent_to_owner' | 'electricity' | 'gas' | 'water' | 'internet'
  | 'salaries' | 'food' | 'maintenance' | 'cleaning' | 'supplies'
  | 'deposit_refund' | 'marketing' | 'other';

export interface MonthlyRentStatus {
  tenant_id: string;
  hostel_id: string;
  full_name: string;
  room_id: string;
  room_no: string;
  expected_rent: number;
  phone: string;
  month_date: string;
  paid_amount: number;
  balance: number;
  payment_status: 'paid' | 'partial' | 'unpaid';
}

export interface MonthlyIncome {
  hostel_id: string;
  month_date: string;
  total_income: number;
  rent_income: number;
  deposits_collected: number;
  other_income: number;
  payment_count: number;
}

export interface MonthlyExpenses {
  hostel_id: string;
  month_date: string;
  total_expenses: number;
  deposits_refunded: number;
  total_outflow: number;
  expense_count: number;
}

export interface MonthlyProfit {
  hostel_id: string;
  month_date: string;
  total_income: number;
  total_expenses: number;
  net_profit: number;
}

// Form types
export interface HostelFormData {
  name: string;
  address: string;
  phone: string;
  email: string;
  currency_symbol: string;
}

export interface RoomFormData {
  room_no: string;
  floor: string;
  room_type: RoomType;
  beds: number;
  rent_per_bed: number;
  notes: string;
}

export interface TenantFormData {
  full_name: string;
  tenant_type: TenantType;
  institution: string;
  phone: string;
  id_card_no: string;
  guardian_name: string;
  guardian_phone: string;
  home_address: string;
  room_id: string;
  join_date: string;
  monthly_rent: number;
  security_deposit: number;
  notes: string;
}

export interface PaymentFormData {
  tenant_id: string;
  payment_date: string;
  month_for: string;
  type: PaymentType;
  amount: number;
  method: PaymentMethod;
  notes: string;
}

export interface ExpenseFormData {
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paid_to: string;
  method: PaymentMethod;
  notes: string;
}
