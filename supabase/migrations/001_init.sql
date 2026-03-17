-- ============================================
-- BudgetMate - Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- User Profiles (discoverable user directory)
create table if not exists user_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_email text not null,
  full_name text default '',
  status text default 'active' check (status in ('active', 'inactive')),
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists idx_user_profiles_email on user_profiles(user_email);

-- User Settings
create table if not exists user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_email text not null,
  mode text default 'personal' check (mode in ('personal', 'household')),
  current_household_id text,
  currency text default 'USD',
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_user_settings_email on user_settings(user_email);

-- Households
create table if not exists households (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_email text not null,
  member_emails text[] default '{}',
  invite_code text unique,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Categories
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text,
  icon text,
  household_id text,
  user_email text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_categories_user on categories(user_email);
create index if not exists idx_categories_household on categories(household_id);

-- Expenses
create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
  amount numeric not null,
  date date not null,
  category_id text,
  category_name text,
  description text,
  user_email text,
  household_id text,
  source_shared_expense_id text,
  paid_by_user_id text,
  is_shared boolean default false,
  is_pending boolean default false,
  approval_status text default 'approved' check (approval_status in ('pending', 'approved', 'rejected')),
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_expenses_user on expenses(user_email);
create index if not exists idx_expenses_household on expenses(household_id);
create index if not exists idx_expenses_date on expenses(date);
create index if not exists idx_expenses_shared on expenses(source_shared_expense_id);

-- Budgets
create table if not exists budgets (
  id uuid primary key default uuid_generate_v4(),
  budget_type text default 'per_category' check (budget_type in ('total', 'per_category')),
  total_budget numeric,
  category_id text,
  category_name text,
  amount numeric,
  percentage numeric,
  household_id text,
  user_email text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_budgets_user on budgets(created_by);
create index if not exists idx_budgets_household on budgets(household_id);

-- Recurring Expenses
create table if not exists recurring_expenses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  amount numeric not null,
  category_id text not null,
  category_name text,
  frequency text default 'monthly' check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  start_date date not null,
  end_date date,
  description text,
  household_id text,
  user_email text,
  is_active boolean default true,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_recurring_user on recurring_expenses(user_email);
create index if not exists idx_recurring_household on recurring_expenses(household_id);

-- Debts
create table if not exists debts (
  id uuid primary key default uuid_generate_v4(),
  from_user_id text not null,
  from_user_name text,
  to_user_id text not null,
  to_user_name text,
  amount numeric not null,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_debts_from on debts(from_user_id);
create index if not exists idx_debts_to on debts(to_user_id);

-- Shared Expenses
create table if not exists shared_expenses (
  id uuid primary key default uuid_generate_v4(),
  created_by_user_id text not null,
  total_amount numeric not null,
  date date not null,
  category_id text not null,
  category_name text,
  description text,
  paid_by_user_id text not null,
  split_method text default 'equal' check (split_method in ('equal', 'custom_amount', 'custom_percent')),
  household_id text,
  is_pending boolean default false,
  pending_with_users text[] default '{}',
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Shared Expense Approvals
create table if not exists shared_expense_approvals (
  id uuid primary key default uuid_generate_v4(),
  from_user_id text not null,
  from_user_name text,
  to_user_id text not null,
  to_user_name text,
  approval_status text default 'pending' check (approval_status in ('pending', 'one_time', 'permanent')),
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Shared Expense Splits
create table if not exists shared_expense_splits (
  id uuid primary key default uuid_generate_v4(),
  shared_expense_id text not null,
  user_id text not null,
  user_name text,
  share_amount numeric not null,
  share_percent numeric,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_splits_expense on shared_expense_splits(shared_expense_id);

-- Notifications
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  to_user_id text not null,
  from_user_id text not null,
  from_user_name text,
  type text check (type in ('shared_expense_request', 'shared_expense_approved', 'shared_expense_rejected')),
  shared_expense_id text,
  total_amount numeric,
  user_share_amount numeric,
  description text,
  category_name text,
  is_read boolean default false,
  action_taken text default 'none' check (action_taken in ('none', 'approved', 'rejected')),
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_notifications_to on notifications(to_user_id);
create index if not exists idx_notifications_from on notifications(from_user_id);

-- Always Approved Users
create table if not exists always_approved_users (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  approved_user_id text not null,
  approved_user_name text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_always_approved_user on always_approved_users(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- Enable RLS on all tables
alter table user_profiles enable row level security;
alter table user_settings enable row level security;
alter table households enable row level security;
alter table categories enable row level security;
alter table expenses enable row level security;
alter table budgets enable row level security;
alter table recurring_expenses enable row level security;
alter table debts enable row level security;
alter table shared_expenses enable row level security;
alter table shared_expense_approvals enable row level security;
alter table shared_expense_splits enable row level security;
alter table notifications enable row level security;
alter table always_approved_users enable row level security;

-- User Profiles: anyone authenticated can read, users can manage their own
create policy "user_profiles_read" on user_profiles for select to authenticated using (true);
create policy "user_profiles_insert" on user_profiles for insert to authenticated with check (created_by = auth.jwt()->>'email');
create policy "user_profiles_update" on user_profiles for update to authenticated using (created_by = auth.jwt()->>'email');

-- User Settings: users can only access their own
create policy "user_settings_all" on user_settings for all to authenticated
  using (user_email = auth.jwt()->>'email')
  with check (user_email = auth.jwt()->>'email');

-- Households: authenticated users can access
create policy "households_read" on households for select to authenticated using (true);
create policy "households_insert" on households for insert to authenticated with check (true);
create policy "households_update" on households for update to authenticated using (true);
create policy "households_delete" on households for delete to authenticated using (owner_email = auth.jwt()->>'email');

-- Categories: read own + household, manage own + household
create policy "categories_read" on categories for select to authenticated
  using (user_email = auth.jwt()->>'email' or household_id is not null);
create policy "categories_insert" on categories for insert to authenticated with check (true);
create policy "categories_update" on categories for update to authenticated
  using (user_email = auth.jwt()->>'email' or household_id is not null);
create policy "categories_delete" on categories for delete to authenticated
  using (user_email = auth.jwt()->>'email' or household_id is not null);

-- Expenses: read own + household, manage own
create policy "expenses_read" on expenses for select to authenticated
  using (user_email = auth.jwt()->>'email' or household_id is not null or created_by = auth.jwt()->>'email');
create policy "expenses_insert" on expenses for insert to authenticated with check (true);
create policy "expenses_update" on expenses for update to authenticated using (true);
create policy "expenses_delete" on expenses for delete to authenticated using (true);

-- Budgets: read own + household
create policy "budgets_read" on budgets for select to authenticated
  using (created_by = auth.jwt()->>'email' or household_id is not null);
create policy "budgets_insert" on budgets for insert to authenticated with check (true);
create policy "budgets_update" on budgets for update to authenticated
  using (created_by = auth.jwt()->>'email' or household_id is not null);
create policy "budgets_delete" on budgets for delete to authenticated
  using (created_by = auth.jwt()->>'email' or household_id is not null);

-- Recurring Expenses
create policy "recurring_expenses_read" on recurring_expenses for select to authenticated
  using (created_by = auth.jwt()->>'email' or household_id is not null);
create policy "recurring_expenses_insert" on recurring_expenses for insert to authenticated with check (true);
create policy "recurring_expenses_update" on recurring_expenses for update to authenticated
  using (created_by = auth.jwt()->>'email' or household_id is not null);
create policy "recurring_expenses_delete" on recurring_expenses for delete to authenticated
  using (created_by = auth.jwt()->>'email' or household_id is not null);

-- Debts: all authenticated users can access (shared resource)
create policy "debts_all" on debts for all to authenticated using (true) with check (true);

-- Shared Expenses: all authenticated users can access
create policy "shared_expenses_all" on shared_expenses for all to authenticated using (true) with check (true);

-- Shared Expense Approvals: users can see their own
create policy "shared_expense_approvals_read" on shared_expense_approvals for select to authenticated
  using (from_user_id = auth.jwt()->>'email' or to_user_id = auth.jwt()->>'email');
create policy "shared_expense_approvals_insert" on shared_expense_approvals for insert to authenticated with check (true);
create policy "shared_expense_approvals_update" on shared_expense_approvals for update to authenticated
  using (from_user_id = auth.jwt()->>'email' or to_user_id = auth.jwt()->>'email');
create policy "shared_expense_approvals_delete" on shared_expense_approvals for delete to authenticated
  using (from_user_id = auth.jwt()->>'email' or to_user_id = auth.jwt()->>'email');

-- Shared Expense Splits: all authenticated users can access
create policy "shared_expense_splits_all" on shared_expense_splits for all to authenticated using (true) with check (true);

-- Notifications: users can read/manage their own
create policy "notifications_read" on notifications for select to authenticated
  using (to_user_id = auth.jwt()->>'email' or from_user_id = auth.jwt()->>'email');
create policy "notifications_insert" on notifications for insert to authenticated with check (true);
create policy "notifications_update" on notifications for update to authenticated
  using (to_user_id = auth.jwt()->>'email');
create policy "notifications_delete" on notifications for delete to authenticated
  using (to_user_id = auth.jwt()->>'email');

-- Always Approved Users: all authenticated users can access
create policy "always_approved_users_all" on always_approved_users for all to authenticated using (true) with check (true);

-- ============================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply trigger to all tables
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'user_profiles', 'user_settings', 'households', 'categories',
      'expenses', 'budgets', 'recurring_expenses', 'debts',
      'shared_expenses', 'shared_expense_approvals', 'shared_expense_splits',
      'notifications', 'always_approved_users'
    ])
  loop
    execute format(
      'create trigger set_updated_at before update on %I for each row execute function update_updated_at()',
      tbl
    );
  end loop;
end;
$$;
