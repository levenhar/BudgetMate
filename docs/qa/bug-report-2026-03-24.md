# BudgetMate QA Bug Report — 2026-03-24

## Summary
- Total bugs: 22
- CRITICAL: 1 | HIGH: 17 | MEDIUM: 3 | LOW: 1
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

### BUG-003 · HIGH · Goals / Persistence

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

### BUG-004 · HIGH · Debts / Create

**Agent:** debts
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Navigate to Debts page
**Expected:** Add Debt button visible
**Actual:** No add button found
**Console Errors:** None
**Notes:** None

---

### BUG-005 · HIGH · Debts / Payment

**Agent:** debts
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. View debt of $300
**Expected:** Pay/Payment button visible
**Actual:** No payment button found
**Console Errors:** None
**Notes:** None

---

### BUG-006 · HIGH · Recurring / Create

**Agent:** recurring
**Route:** http://localhost:5173/RecurringExpenses
**Steps to Reproduce:**
1. Navigate to Recurring Expenses
**Expected:** Add button visible
**Actual:** No add button found
**Console Errors:** None
**Notes:** None

---

### BUG-007 · HIGH · Shared / Equal Split Create

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create $300 equal split expense
**Expected:** Expense created
**Actual:** locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[role="dialog"]') to be visible[22m

**Console Errors:** None
**Notes:** None

---

### BUG-008 · HIGH · Shared / Equal Split Debt Creation

**Agent:** shared-a
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Create $300 equal split with B+C
2. Both approve
**Expected:** Two debt records of $100 each visible
**Actual:** Only 0 amount matching "100" found on Debts page
**Console Errors:** None
**Notes:** None

---

### BUG-009 · HIGH · Shared / Custom Split Create

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create $100 custom split expense
**Expected:** Expense created
**Actual:** locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[role="dialog"]').locator('input[placeholder*="description" i]').first()[22m

**Console Errors:** None
**Notes:** None

---

### BUG-010 · HIGH · Shared / Custom Split Amounts

**Agent:** shared-a
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Create $100 custom split (B=30%, C=20%)
2. Both approve
**Expected:** Debt records of $30 (B) and $20 (C) visible
**Actual:** $30 found: 0, $20 found: 0
**Console Errors:** None
**Notes:** None

---

### BUG-011 · HIGH · Shared / Multi-Currency Create

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create EUR shared expense
**Expected:** Expense created
**Actual:** locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[role="dialog"]') to be visible[22m

**Console Errors:** None
**Notes:** None

---

### BUG-012 · HIGH · Shared / Partial Rejection Create

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create partial rejection shared expense
**Expected:** Expense created
**Actual:** locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[role="dialog"]') to be visible[22m

**Console Errors:** None
**Notes:** None

---

### BUG-013 · HIGH · Shared / Approve Expense (B)

**Agent:** shared-b
**Route:** http://localhost:5173
**Steps to Reproduce:**
1. Wait for A to create equal split
2. Look for approve button
**Expected:** Approve button visible in notifications
**Actual:** No approve button found after A created expense
**Console Errors:** None
**Notes:** None

---

### BUG-014 · HIGH · Shared / B Debt After Approval

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve $300 equal split
**Expected:** B's Debts page shows $100 owed
**Actual:** No $100 debt found for User B
**Console Errors:** None
**Notes:** None

---

### BUG-015 · HIGH · Shared / Custom Split B Amount

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve custom split (B=30%)
**Expected:** $30 debt for B
**Actual:** No $30 debt found
**Console Errors:** None
**Notes:** None

---

### BUG-016 · HIGH · Shared / C Debt After Approval

**Agent:** shared-c
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. C approves $300 equal split
**Expected:** C sees $100 debt
**Actual:** No $100 debt found for User C
**Console Errors:** None
**Notes:** None

---

### BUG-017 · HIGH · Shared / C Custom Split Amount

**Agent:** shared-c
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve custom split (C=20%)
**Expected:** C sees $20 debt
**Actual:** No $20 debt found
**Console Errors:** None
**Notes:** None

---

### BUG-018 · HIGH · Shared / Reject Expense (C)

**Agent:** shared-c
**Route:** http://localhost:5173
**Steps to Reproduce:**
1. A creates expense
2. C looks for reject button
**Expected:** Reject button visible in notifications
**Actual:** No reject button found
**Console Errors:** None
**Notes:** None

---

### BUG-019 · MEDIUM · Statistics / Date Filter

**Agent:** statistics
**Route:** http://localhost:5173/Statistics
**Steps to Reproduce:**
1. Navigate to Statistics
**Expected:** Date range filter controls visible
**Actual:** No date range controls found
**Console Errors:** None
**Notes:** None

---

### BUG-020 · MEDIUM · Shared / Multi-Currency Display

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create EUR shared expense
2. View expenses list
**Expected:** EUR amount and conversion visible for User A
**Actual:** No EUR indicator found
**Console Errors:** None
**Notes:** None

---

### BUG-021 · MEDIUM · Shared / Multi-Currency B View

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve EUR shared expense
**Expected:** B sees debt in USD (base currency)
**Actual:** No USD amount found on B debts page
**Console Errors:** None
**Notes:** None

---

### BUG-022 · LOW · Dashboard / Budget Progress

**Agent:** budget
**Route:** http://localhost:5173
**Steps to Reproduce:**
1. Navigate to Dashboard after adding budget and expenses
**Expected:** Budget progress indicator visible on dashboard
**Actual:** No budget progress found on dashboard
**Console Errors:** None
**Notes:** None

---