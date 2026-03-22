# BudgetMate QA Bug Report — 2026-03-22

## Summary
- Total bugs: 15
- CRITICAL: 1 | HIGH: 10 | MEDIUM: 2 | LOW: 2
- Agents run: 10
- Features tested: Dashboard, Expenses, Budget, Goals, Debts, Recurring Expenses, Statistics, Settings, Shared Expenses (3-user household)

## Bugs (sorted by severity)

### BUG-001 · CRITICAL · Shared / Settlement Coordination

**Agent:** shared-a
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Record B partial payment
2. Wait for C full payment
**Expected:** C pays within 2 minutes
**Actual:** Timeout waiting for signal: shared-c.c_recorded_c_full_payment (120000ms)
**Console Errors:** None
**Notes:** None

---

### BUG-002 · HIGH · Expenses / Persistence

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Navigate to Expenses page after creating "QA Test Expense"
**Expected:** Previously created expense visible
**Actual:** Expense not found on reload
**Console Errors:** None
**Notes:** None

---

### BUG-003 · HIGH · Budget / Create

**Agent:** budget
**Route:** http://localhost:5173/Budget
**Steps to Reproduce:**
1. Navigate to Budget page
**Expected:** Add Budget button visible
**Actual:** No add button found on Budget page
**Console Errors:** None
**Notes:** None

---

### BUG-004 · HIGH · Goals / Create

**Agent:** goals
**Route:** http://localhost:5173/Goals
**Steps to Reproduce:**
1. Navigate to Goals
**Expected:** Add Goal button visible
**Actual:** No add button found
**Console Errors:** None
**Notes:** None

---

### BUG-005 · HIGH · Goals / Persistence

**Agent:** goals
**Route:** http://localhost:5173/Goals
**Steps to Reproduce:**
1. Create goal
2. Navigate away
3. Return to Goals
**Expected:** Goal still visible
**Actual:** Goal lost after navigation
**Console Errors:** None
**Notes:** None

---

### BUG-006 · HIGH · Debts / Create

**Agent:** debts
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Navigate to Debts page
**Expected:** Add Debt button visible
**Actual:** No add button found
**Console Errors:** None
**Notes:** None

---

### BUG-007 · HIGH · Debts / Payment

**Agent:** debts
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. View debt of $300
**Expected:** Pay/Payment button visible
**Actual:** No payment button found
**Console Errors:** None
**Notes:** None

---

### BUG-008 · HIGH · Recurring / Create

**Agent:** recurring
**Route:** http://localhost:5173/RecurringExpenses
**Steps to Reproduce:**
1. Navigate to Recurring Expenses
**Expected:** Add button visible
**Actual:** No add button found
**Console Errors:** None
**Notes:** None

---

### BUG-009 · HIGH · Statistics / Category Pie Chart

**Agent:** statistics
**Route:** http://localhost:5173/Statistics
**Steps to Reproduce:**
1. Navigate to Statistics page with existing expenses
**Expected:** Category Pie Chart renders with data
**Actual:** Category Pie Chart element not found in DOM
**Console Errors:** None
**Notes:** None

---

### BUG-010 · HIGH · Shared / B Partial Payment Balance

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. A records $50 partial payment from B
**Expected:** B sees remaining $50 debt
**Actual:** No $50 balance found
**Console Errors:** None
**Notes:** None

---

### BUG-011 · HIGH · Shared / C Payment Button

**Agent:** shared-c
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. After B pays partial
2. C tries to pay $20
**Expected:** Pay button visible for C
**Actual:** No pay button found
**Console Errors:** None
**Notes:** None

---

### BUG-012 · MEDIUM · Expenses / Filters

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Navigate to Expenses page
**Expected:** Filter controls visible
**Actual:** No filter/category controls found
**Console Errors:** None
**Notes:** None

---

### BUG-013 · MEDIUM · Dashboard / Expense Total

**Agent:** expenses
**Route:** http://localhost:5173
**Steps to Reproduce:**
1. Navigate to Dashboard after creating expenses
**Expected:** Expense total or summary visible on dashboard
**Actual:** No expense total text found
**Console Errors:** None
**Notes:** None

---

### BUG-014 · LOW · Dashboard / Goals Widget

**Agent:** goals
**Route:** http://localhost:5173
**Steps to Reproduce:**
1. Navigate to Dashboard
**Expected:** Goals widget visible
**Actual:** No goals widget found
**Console Errors:** None
**Notes:** None

---

### BUG-015 · LOW · Dashboard / Debt Summary

**Agent:** debts
**Route:** http://localhost:5173
**Steps to Reproduce:**
1. Navigate to Dashboard
**Expected:** Debt summary visible
**Actual:** No debt summary on dashboard
**Console Errors:** None
**Notes:** None

---