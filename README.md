# 🏨 Hostel Management System (React + TypeScript + Supabase + Tailwind CSS)

A complete, production-ready, mobile-friendly Hostel Management Web Application built with **React (Vite)**, **TypeScript**, **Tailwind CSS**, and **Supabase (PostgreSQL + Auth + Row Level Security + Storage)**.

---

## 🌟 Key Features

- **🔐 Dual Roles & Security (RLS)**:
  - `owner`: Full access to dashboard, reports, settings, tenant/payment/expense deletion, and staff management.
  - `staff`: Can view, add, and edit tenants, payments, and expenses. Cannot delete records or view financial profit reports. Enforced by Postgres Row Level Security (RLS).
- **📊 Executive Dashboard**:
  - Month selector.
  - KPI Cards: Rent expected, collected, outstanding, collection rate %, total income, total expenses, net profit, occupancy %, beds vacant, deposits held.
  - 12-month Income vs Expenses bar chart & Expense category pie chart (Recharts).
  - Live top defaulters list.
- **👥 Tenants Management**:
  - Searchable/filterable table by status, room, and search terms.
  - Add/Edit modal with automatic room capacity enforcement.
  - Mark-as-left flow recording departure date and freeing bed capacity.
  - Profile detail page with full payment history, deposit status, attached CNIC/document scans, and WhatsApp reminder link.
- **🛏️ Rooms & Bed Layout**:
  - Interactive grid view showing bed capacity slots (Occupied vs Vacant).
  - Status badges: `FULL`, `AVAILABLE`, `EMPTY`.
  - Add/Edit rooms with per-bed pricing.
- **💳 Payments & Official Receipts**:
  - Record payment modal with receipt auto-generation (`RCP-YYYYMMDD-XXXX`).
  - Printable official PDF/paper receipt featuring hostel header, tenant info, room no, and signature box.
  - CSV log export.
- **📅 Monthly Rent Tracker**:
  - Colour-coded status indicators: Paid (Green), Partial (Yellow), Unpaid (Red).
  - One-click payment modal pre-filling balance due.
  - One-click WhatsApp button opening `wa.me` with pre-filled personalized payment reminder.
- **💸 Expenses Ledger**:
  - Log operational expenses across 13 categories (electricity, food, salaries, maintenance, etc.).
  - Deposit refunds properly excluded from operating expenses.
  - Receipt bill scan file upload to Supabase Storage.
  - CSV export.
- **📈 Reports & Audits**:
  - 12-Month Profit & Loss Statement (Operating income vs operating expenses).
  - Tenant defaulters accumulated balance audit.
  - Occupancy breakdown report.
  - Print / PDF export ready.
- **⚙️ Settings & Administration**:
  - Configurable hostel details & currency symbol (e.g., `Rs.`, `$`, `PKR`, `€`).
  - Invite & manage staff accounts linked to hostel.
  - Bulk CSV Tenant Importer.

---

## 📁 Directory Structure

```
Hostel/
├── .env.example              # Environment variables template
├── index.html                # Vite HTML entry point
├── package.json              # Project dependencies & scripts
├── postcss.config.js         # PostCSS Tailwind config
├── tailwind.config.js        # Tailwind CSS & shadcn/ui design tokens
├── tsconfig.json             # TypeScript config
├── vite.config.ts            # Vite bundler config with path alias (@/)
├── supabase/
│   ├── schema.sql            # Core SQL tables, triggers, and views
│   ├── rls-policies.sql      # Row Level Security (RLS) policies
│   ├── storage.sql           # Storage bucket configuration & policies
│   └── seed.sql              # Sample seed data script
└── src/
    ├── App.tsx               # App router & route protection
    ├── index.css             # Global Tailwind & theme CSS
    ├── main.tsx              # React mounting entry point
    ├── vite-env.d.ts         # TypeScript environment declarations
    ├── components/
    │   ├── auth/
    │   │   └── ProtectedRoute.tsx # Auth & Role route guard
    │   ├── layout/
    │   │   ├── AppLayout.tsx      # Main application layout wrapper
    │   │   └── Sidebar.tsx        # Responsive desktop/mobile navigation
    │   └── ui/                   # shadcn/ui components (button, card, dialog, etc.)
    ├── contexts/
    │   └── AuthContext.tsx   # Supabase Auth provider & state management
    ├── lib/
    │   ├── supabase.ts       # Supabase Client initialization
    │   └── utils.ts          # Utility functions (formatting, CSV, WhatsApp, etc.)
    ├── pages/
    │   ├── Dashboard.tsx     # Executive Analytics Dashboard
    │   ├── Expenses.tsx      # Expenses ledger
    │   ├── Login.tsx         # Sign In & Registration page
    │   ├── Payments.tsx      # Payments history & printable receipts
    │   ├── RentTracker.tsx   # Monthly rent collection tracker
    │   ├── Reports.tsx       # Profit & Loss, Defaulters, Occupancy reports
    │   ├── Rooms.tsx         # Rooms grid & bed capacity layout
    │   ├── Settings.tsx      # Hostel details, staff & CSV import
    │   ├── TenantDetail.tsx  # Tenant profile & payment log
    │   └── Tenants.tsx       # Tenants directory
    └── types/
        └── database.ts       # Complete TypeScript database types
```

---

## 🚀 Step-by-Step Setup Guide

### Step 1: Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and log in.
2. Click **New Project**, select an organization, name your project (e.g. `Hostel Management`), set a database password, and choose a region close to you.
3. Once created, navigate to **Project Settings → API**.
4. Copy your **Project URL** and **`anon` `public` key**.

---

### Step 2: Execute SQL Migrations in Supabase
In your Supabase Dashboard, open the **SQL Editor** (left navigation bar) and execute the SQL files in the following order:

1. **Copy & Run `supabase/schema.sql`**:
   - Creates `profiles`, `hostels`, `hostel_staff`, `rooms`, `tenants`, `payments`, `expenses` tables.
   - Sets up auto-profile creation trigger on user signup.
   - Creates database views: `monthly_rent_status`, `monthly_income`, `monthly_expenses`, `monthly_profit`.
2. **Copy & Run `supabase/rls-policies.sql`**:
   - Enables RLS on all tables.
   - Enforces owner vs staff access controls at the database level.
3. **Copy & Run `supabase/storage.sql`**:
   - Creates public storage buckets `tenant-files` and `expense-receipts` with file upload policies.

---

### Step 3: Configure Environment Variables
Create a file named `.env` in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and paste your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-supabase-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
VITE_CURRENCY_SYMBOL=Rs.
```

---

### Step 4: Run Locally

1. Open your terminal in the project directory:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.
4. Click **Register** on the sign-in page to create your **Owner Account** with your hostel name.

---

### Step 5 (Optional): Populate Seed Data
1. Sign up your owner account first.
2. In Supabase SQL Editor, find your user ID:
   ```sql
   SELECT id FROM auth.users WHERE email = 'your-owner-email@example.com';
   ```
3. Open `supabase/seed.sql`, uncomment the script, replace `YOUR_USER_ID` with your actual UUID, and run it in the SQL Editor.

---

### Step 6: Deploy to Vercel

1. Push your repository to GitHub / GitLab.
2. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
3. Import your repository.
4. Framework Preset: **Vite**.
5. Build Command: `npm run build`.
6. Output Directory: `dist`.
7. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_CURRENCY_SYMBOL` (optional, default `Rs.`)
8. Click **Deploy**.

---

## 🔒 Security & Roles Overview

| Action | Owner | Staff |
|---|:---:|:---:|
| View Dashboard & Metrics | ✅ | ✅ |
| View Tenants, Rooms, Payments | ✅ | ✅ |
| Add / Edit Tenants, Payments, Expenses | ✅ | ✅ |
| Mark Tenant as Left | ✅ | ✅ |
| Print Receipts & WhatsApp Reminders | ✅ | ✅ |
| View Financial Profit & Loss Reports | ✅ | ❌ |
| Delete Tenants, Rooms, Payments, Expenses | ✅ | ❌ |
| Manage Staff Accounts | ✅ | ❌ |

---

## 🛠️ Built With

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** (Postgres DB, Auth, Row Level Security, Storage)
- **Recharts** (12-Month Financial Bar & Pie Charts)
- **Lucide React** (Icons)
