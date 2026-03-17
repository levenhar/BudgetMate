import { supabase } from './supabaseClient';

// Map PascalCase entity names to snake_case table names
const tableMap = {
  Budget: 'budgets',
  Category: 'categories',
  Debt: 'debts',
  Expense: 'expenses',
  UserProfile: 'user_profiles',
  UserSettings: 'user_settings',
  RecurringExpense: 'recurring_expenses',
  SharedExpense: 'shared_expenses',
  SharedExpenseApproval: 'shared_expense_approvals',
  SharedExpenseSplit: 'shared_expense_splits',
  Notification: 'notifications',
  AlwaysApprovedUser: 'always_approved_users',
  SavingsGoal: 'savings_goals',
  Household: 'households',
  User: 'user_profiles', // base44 built-in User maps to user_profiles
};

function getTable(entityName) {
  return tableMap[entityName] || entityName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '') + 's';
}

function createEntityProxy(entityName) {
  const table = getTable(entityName);

  return {
    async list() {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;
      return data || [];
    },

    async filter(criteria) {
      let query = supabase.from(table).select('*');
      for (const [key, value] of Object.entries(criteria)) {
        if (value === null || value === undefined) {
          query = query.is(key, null);
        } else if (typeof value === 'boolean') {
          query = query.eq(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(record) {
      // Get current user email for created_by
      const { data: { user } } = await supabase.auth.getUser();
      const created_by = user?.email || null;
      const { data, error } = await supabase
        .from(table)
        .insert({ ...record, created_by })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async bulkCreate(records) {
      const { data: { user } } = await supabase.auth.getUser();
      const created_by = user?.email || null;
      const withCreatedBy = records.map(r => ({ ...r, created_by }));
      const { data, error } = await supabase
        .from(table)
        .insert(withCreatedBy)
        .select();
      if (error) throw error;
      return data || [];
    },

    async update(id, updates) {
      const { data, error } = await supabase
        .from(table)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
  };
}

// Create a proxy that auto-creates entity handlers on access
const entitiesProxy = new Proxy({}, {
  get(target, entityName) {
    if (typeof entityName !== 'string') return undefined;
    if (!target[entityName]) {
      target[entityName] = createEntityProxy(entityName);
    }
    return target[entityName];
  }
});

// Auth compatibility layer
const auth = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw { status: 401, message: 'Not authenticated' };
    return {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      picture: user.user_metadata?.picture || user.user_metadata?.avatar_url || null,
      role: user.role || 'user',
      data: {
        picture: user.user_metadata?.picture || user.user_metadata?.avatar_url || null,
        current_household_id: user.user_metadata?.current_household_id || null,
      },
    };
  },

  async logout(redirectUrl) {
    await supabase.auth.signOut();
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      window.location.href = '/';
    }
  },

  redirectToLogin(returnUrl) {
    // Store return URL for post-login redirect
    if (returnUrl) {
      localStorage.setItem('budgetmate_return_url', returnUrl);
    }
    window.location.href = '/login';
  },
};

// App logs compatibility (no-op)
const appLogs = {
  async logUserInApp() {
    // No-op: base44-specific logging not needed
  },
};

export const base44 = {
  entities: entitiesProxy,
  auth,
  appLogs,
};
