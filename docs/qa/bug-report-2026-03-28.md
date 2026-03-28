# BudgetMate QA Bug Report — 2026-03-28

## Summary
- Total bugs: 100
- CRITICAL: 5 | HIGH: 76 | MEDIUM: 13 | LOW: 6
- Agents run: 10
- Features tested: Dashboard, Expenses, Budget, Goals, Debts, Recurring Expenses, Statistics, Settings, Shared Expenses (3-user household)

## Bugs (sorted by severity)

### BUG-001 · CRITICAL · Shared / Coordination Timeout

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create equal split expense
2. Wait for B+C approval
**Expected:** B and C approve within 2 minutes
**Actual:** Timeout waiting for signal: shared-c.c_approved_equal_split (120000ms)
**Console Errors:** None
**Notes:** None

---

### BUG-002 · CRITICAL · Shared / Custom Split Coordination

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create custom split
2. Wait for B+C
**Expected:** Both approve
**Actual:** Timeout waiting for signal: shared-c.c_approved_custom_split (120000ms)
**Console Errors:** None
**Notes:** None

---

### BUG-003 · CRITICAL · Shared / Multi-Currency Coordination

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create EUR shared expense
2. Wait for B+C
**Expected:** Both approve
**Actual:** Timeout waiting for signal: shared-c.c_approved_multicurrency_split (120000ms)
**Console Errors:** None
**Notes:** None

---

### BUG-004 · CRITICAL · Shared / Partial Rejection Coordination

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create expense
2. B approves, C rejects
**Expected:** Coordination completes
**Actual:** Timeout waiting for signal: shared-c.c_rejected_partial_rejection (120000ms)
**Console Errors:** None
**Notes:** None

---

### BUG-005 · CRITICAL · Shared / Settlement Coordination

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

### BUG-006 · HIGH · Expenses / Persistence

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Navigate to Expenses page after creating "QA Test Expense"
**Expected:** Previously created expense visible
**Actual:** Expense not found on reload
**Console Errors:** None
**Notes:** None

---

### BUG-007 · HIGH · Expenses / Multi-Currency

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Open Add Expense dialog
**Expected:** Currency selector visible
**Actual:** No currency selector found in the form
**Console Errors:** None
**Notes:** None

---

### BUG-008 · HIGH · Expenses / Persistence

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Navigate to Expenses page after creating "QA Test Expense"
**Expected:** Previously created expense visible
**Actual:** Expense not found on reload
**Console Errors:** None
**Notes:** None

---

### BUG-009 · HIGH · Expenses / Multi-Currency

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Open Add Expense dialog
**Expected:** Currency selector visible
**Actual:** No currency selector found in the form
**Console Errors:** None
**Notes:** None

---

### BUG-010 · HIGH · Expenses / Persistence

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Navigate to Expenses page after creating "QA Test Expense"
**Expected:** Previously created expense visible
**Actual:** Expense not found on reload
**Console Errors:** None
**Notes:** None

---

### BUG-011 · HIGH · Expenses / Multi-Currency

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Open Add Expense dialog
**Expected:** Currency selector visible
**Actual:** No currency selector found in the form
**Console Errors:** None
**Notes:** None

---

### BUG-012 · HIGH · Expenses / Persistence

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Navigate to Expenses page after creating "QA Test Expense"
**Expected:** Previously created expense visible
**Actual:** Expense not found on reload
**Console Errors:** None
**Notes:** None

---

### BUG-013 · HIGH · Expenses / Persistence

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Navigate to Expenses page after creating "QA Test Expense"
**Expected:** Previously created expense visible
**Actual:** Expense not found on reload
**Console Errors:** None
**Notes:** None

---

### BUG-014 · HIGH · Expenses / Persistence

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Navigate to Expenses page after creating "QA Test Expense"
**Expected:** Previously created expense visible
**Actual:** Expense not found on reload
**Console Errors:** None
**Notes:** None

---

### BUG-015 · HIGH · Expenses / Multi-Currency

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Open Add Expense dialog
**Expected:** Currency selector visible
**Actual:** No currency selector found in the form
**Console Errors:** None
**Notes:** None

---

### BUG-016 · HIGH · Expenses / Persistence

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Navigate to Expenses page after creating "QA Test Expense"
**Expected:** Previously created expense visible
**Actual:** Expense not found on reload
**Console Errors:** None
**Notes:** None

---

### BUG-017 · HIGH · Expenses / Persistence

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Navigate to Expenses page after creating "QA Test Expense"
**Expected:** Previously created expense visible
**Actual:** Expense not found on reload
**Console Errors:** None
**Notes:** None

---

### BUG-018 · HIGH · Expenses / Persistence

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Navigate to Expenses page after creating "QA Test Expense"
**Expected:** Previously created expense visible
**Actual:** Expense not found on reload
**Console Errors:** None
**Notes:** None

---

### BUG-019 · HIGH · Expenses / Persistence

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Navigate to Expenses page after creating "QA Test Expense"
**Expected:** Previously created expense visible
**Actual:** Expense not found on reload
**Console Errors:** None
**Notes:** None

---

### BUG-020 · HIGH · Budget / Create

**Agent:** budget
**Route:** http://localhost:5173/Budget
**Steps to Reproduce:**
1. Navigate to Budget page
**Expected:** Set/Add Budget button visible
**Actual:** No add budget button found on Budget page
**Console Errors:** None
**Notes:** None

---

### BUG-021 · HIGH · Budget / Create

**Agent:** budget
**Route:** http://localhost:5173/Budget
**Steps to Reproduce:**
1. Navigate to Budget page
**Expected:** Set/Add Budget button visible
**Actual:** No add budget button found on Budget page
**Console Errors:** None
**Notes:** None

---

### BUG-022 · HIGH · Goals / Persistence

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

### BUG-023 · HIGH · Goals / Persistence

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

### BUG-024 · HIGH · Goals / Create

**Agent:** goals
**Route:** http://localhost:5173/Goals
**Steps to Reproduce:**
1. Navigate to Goals
**Expected:** Add Goal button visible
**Actual:** No add button found
**Console Errors:** None
**Notes:** None

---

### BUG-025 · HIGH · Goals / Persistence

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

### BUG-026 · HIGH · Goals / Persistence

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

### BUG-027 · HIGH · Goals / Persistence

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

### BUG-028 · HIGH · Debts / Create

**Agent:** debts
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Navigate to Debts page
**Expected:** Add Debt button visible
**Actual:** No add button found
**Console Errors:** None
**Notes:** None

---

### BUG-029 · HIGH · Debts / Payment

**Agent:** debts
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. View debt of $300
**Expected:** Pay/Payment button visible
**Actual:** No payment button found
**Console Errors:** None
**Notes:** None

---

### BUG-030 · HIGH · Debts / Create

**Agent:** debts
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Navigate to Debts page
**Expected:** Add Debt button visible
**Actual:** No add button found
**Console Errors:** None
**Notes:** None

---

### BUG-031 · HIGH · Debts / Payment

**Agent:** debts
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. View debt of $300
**Expected:** Pay/Payment button visible
**Actual:** No payment button found
**Console Errors:** None
**Notes:** None

---

### BUG-032 · HIGH · Debts / Create

**Agent:** debts
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Navigate to Debts page
**Expected:** Add Debt button visible
**Actual:** No add button found
**Console Errors:** None
**Notes:** None

---

### BUG-033 · HIGH · Debts / Create

**Agent:** debts
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Navigate to Debts page
**Expected:** Add Debt button visible
**Actual:** No add button found
**Console Errors:** None
**Notes:** None

---

### BUG-034 · HIGH · Debts / Payment

**Agent:** debts
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. View debt of $300
**Expected:** Pay/Payment button visible
**Actual:** No payment button found
**Console Errors:** None
**Notes:** None

---

### BUG-035 · HIGH · Debts / Payment

**Agent:** debts
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. View debt of $300
**Expected:** Pay/Payment button visible
**Actual:** No payment button found
**Console Errors:** None
**Notes:** None

---

### BUG-036 · HIGH · Debts / Create

**Agent:** debts
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Navigate to Debts page
**Expected:** Add Debt button visible
**Actual:** No add button found
**Console Errors:** None
**Notes:** None

---

### BUG-037 · HIGH · Debts / Payment

**Agent:** debts
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. View debt of $300
**Expected:** Pay/Payment button visible
**Actual:** No payment button found
**Console Errors:** None
**Notes:** None

---

### BUG-038 · HIGH · Recurring / Create

**Agent:** recurring
**Route:** http://localhost:5173/RecurringExpenses
**Steps to Reproduce:**
1. Navigate to Recurring Expenses
**Expected:** Add button visible
**Actual:** No add button found
**Console Errors:** None
**Notes:** None

---

### BUG-039 · HIGH · Recurring / Create

**Agent:** recurring
**Route:** http://localhost:5173/RecurringExpenses
**Steps to Reproduce:**
1. Navigate to Recurring Expenses
**Expected:** Add button visible
**Actual:** No add button found
**Console Errors:** None
**Notes:** None

---

### BUG-040 · HIGH · Statistics / Category Pie Chart

**Agent:** statistics
**Route:** http://localhost:5173/Statistics
**Steps to Reproduce:**
1. Navigate to Statistics page with existing expenses
**Expected:** Category Pie Chart renders with data
**Actual:** Category Pie Chart element not found in DOM
**Console Errors:** None
**Notes:** None

---

### BUG-041 · HIGH · Settings / Language

**Agent:** settings
**Route:** http://localhost:5173/Setting
**Steps to Reproduce:**
1. Navigate to Settings
**Expected:** Language selector visible
**Actual:** No language selector found
**Console Errors:** None
**Notes:** None

---

### BUG-042 · HIGH · Shared / Equal Split Create

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create $300 equal split expense
**Expected:** Expense created
**Actual:** locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[role="dialog"]').locator('input[type="number"]').first()[22m

**Console Errors:** None
**Notes:** None

---

### BUG-043 · HIGH · Shared / Custom Split Create

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create $100 custom split expense
**Expected:** Expense created
**Actual:** locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[role="dialog"]').locator('input[type="number"]').first()[22m

**Console Errors:** None
**Notes:** None

---

### BUG-044 · HIGH · Shared / Multi-Currency Create

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create EUR shared expense
**Expected:** Expense created
**Actual:** locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[role="dialog"]').locator('input[placeholder*="description" i]').first()[22m

**Console Errors:** None
**Notes:** None

---

### BUG-045 · HIGH · Shared / Partial Rejection Create

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create partial rejection shared expense
**Expected:** Expense created
**Actual:** locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[role="dialog"]').locator('input[placeholder*="description" i]').first()[22m

**Console Errors:** None
**Notes:** None

---

### BUG-046 · HIGH · Shared / Equal Split Create

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create $300 equal split expense
**Expected:** Expense created
**Actual:** locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[role="dialog"]').locator('input[type="number"]').first()[22m

**Console Errors:** None
**Notes:** None

---

### BUG-047 · HIGH · Shared / Equal Split Debt Creation

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

### BUG-048 · HIGH · Shared / Custom Split Create

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create $100 custom split expense
**Expected:** Expense created
**Actual:** locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[role="dialog"]').locator('input[type="number"]').first()[22m

**Console Errors:** None
**Notes:** None

---

### BUG-049 · HIGH · Shared / Custom Split Amounts

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

### BUG-050 · HIGH · Shared / Multi-Currency Create

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create EUR shared expense
**Expected:** Expense created
**Actual:** locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[role="dialog"]').locator('input[type="number"]').first()[22m

**Console Errors:** None
**Notes:** None

---

### BUG-051 · HIGH · Shared / Partial Rejection Create

**Agent:** shared-a
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Create partial rejection shared expense
**Expected:** Expense created
**Actual:** locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[role="dialog"]').locator('input[type="number"]').first()[22m

**Console Errors:** None
**Notes:** None

---

### BUG-052 · HIGH · Shared / Approve Expense (B)

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

### BUG-053 · HIGH · Shared / B Debt After Approval

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve $300 equal split
**Expected:** B's Debts page shows $100 owed
**Actual:** No $100 debt found for User B
**Console Errors:** None
**Notes:** None

---

### BUG-054 · HIGH · Shared / Custom Split B Amount

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve custom split (B=30%)
**Expected:** $30 debt for B
**Actual:** No $30 debt found
**Console Errors:** None
**Notes:** None

---

### BUG-055 · HIGH · Shared / B Partial Payment Balance

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. A records $50 partial payment from B
**Expected:** B sees remaining $50 debt
**Actual:** No $50 balance found
**Console Errors:** None
**Notes:** None

---

### BUG-056 · HIGH · Shared / Approve Expense (B)

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

### BUG-057 · HIGH · Shared / B Debt After Approval

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve $300 equal split
**Expected:** B's Debts page shows $100 owed
**Actual:** No $100 debt found for User B
**Console Errors:** None
**Notes:** None

---

### BUG-058 · HIGH · Shared / Approve Expense (B)

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

### BUG-059 · HIGH · Shared / B Debt After Approval

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve $300 equal split
**Expected:** B's Debts page shows $100 owed
**Actual:** No $100 debt found for User B
**Console Errors:** None
**Notes:** None

---

### BUG-060 · HIGH · Shared / Custom Split B Amount

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve custom split (B=30%)
**Expected:** $30 debt for B
**Actual:** No $30 debt found
**Console Errors:** None
**Notes:** None

---

### BUG-061 · HIGH · Shared / Custom Split B Amount

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve custom split (B=30%)
**Expected:** $30 debt for B
**Actual:** No $30 debt found
**Console Errors:** None
**Notes:** None

---

### BUG-062 · HIGH · Shared / Approve Expense (B)

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

### BUG-063 · HIGH · Shared / B Debt After Approval

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve $300 equal split
**Expected:** B's Debts page shows $100 owed
**Actual:** No $100 debt found for User B
**Console Errors:** None
**Notes:** None

---

### BUG-064 · HIGH · Shared / Custom Split B Amount

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve custom split (B=30%)
**Expected:** $30 debt for B
**Actual:** No $30 debt found
**Console Errors:** None
**Notes:** None

---

### BUG-065 · HIGH · Shared / B Partial Payment Balance

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. A records $50 partial payment from B
**Expected:** B sees remaining $50 debt
**Actual:** No $50 balance found
**Console Errors:** None
**Notes:** None

---

### BUG-066 · HIGH · Shared / C Custom Split Amount

**Agent:** shared-c
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve custom split (C=20%)
**Expected:** C sees $20 debt
**Actual:** No $20 debt found
**Console Errors:** None
**Notes:** None

---

### BUG-067 · HIGH · Shared / C Custom Split Amount

**Agent:** shared-c
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve custom split (C=20%)
**Expected:** C sees $20 debt
**Actual:** No $20 debt found
**Console Errors:** None
**Notes:** None

---

### BUG-068 · HIGH · Shared / Reject Expense (C)

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

### BUG-069 · HIGH · Shared / C Payment Button

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

### BUG-070 · HIGH · Shared / C Debt After Approval

**Agent:** shared-c
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. C approves $300 equal split
**Expected:** C sees $100 debt
**Actual:** No $100 debt found for User C
**Console Errors:** None
**Notes:** None

---

### BUG-071 · HIGH · Shared / C Custom Split Amount

**Agent:** shared-c
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve custom split (C=20%)
**Expected:** C sees $20 debt
**Actual:** No $20 debt found
**Console Errors:** None
**Notes:** None

---

### BUG-072 · HIGH · Shared / Reject Expense (C)

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

### BUG-073 · HIGH · Shared / C Payment Button

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

### BUG-074 · HIGH · Shared / C Debt After Approval

**Agent:** shared-c
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. C approves $300 equal split
**Expected:** C sees $100 debt
**Actual:** No $100 debt found for User C
**Console Errors:** None
**Notes:** None

---

### BUG-075 · HIGH · Shared / C Custom Split Amount

**Agent:** shared-c
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve custom split (C=20%)
**Expected:** C sees $20 debt
**Actual:** No $20 debt found
**Console Errors:** None
**Notes:** None

---

### BUG-076 · HIGH · Shared / Reject Expense (C)

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

### BUG-077 · HIGH · Shared / C Payment Button

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

### BUG-078 · HIGH · Shared / C Debt After Approval

**Agent:** shared-c
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. C approves $300 equal split
**Expected:** C sees $100 debt
**Actual:** No $100 debt found for User C
**Console Errors:** None
**Notes:** None

---

### BUG-079 · HIGH · Shared / C Custom Split Amount

**Agent:** shared-c
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve custom split (C=20%)
**Expected:** C sees $20 debt
**Actual:** No $20 debt found
**Console Errors:** None
**Notes:** None

---

### BUG-080 · HIGH · Shared / Reject Expense (C)

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

### BUG-081 · HIGH · Shared / C Payment Button

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

### BUG-082 · MEDIUM · Expenses / Exchange Rate Display

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Open Add Expense
2. Select EUR currency
**Expected:** Live exchange rate shown
**Actual:** No exchange rate label visible after selecting foreign currency
**Console Errors:** None
**Notes:** None

---

### BUG-083 · MEDIUM · Expenses / Exchange Rate Display

**Agent:** expenses
**Route:** http://localhost:5173/Expenses
**Steps to Reproduce:**
1. Open Add Expense
2. Select EUR currency
**Expected:** Live exchange rate shown
**Actual:** No exchange rate label visible after selecting foreign currency
**Console Errors:** None
**Notes:** None

---

### BUG-084 · MEDIUM · Statistics / Empty State

**Agent:** statistics
**Route:** http://localhost:5173/Statistics
**Steps to Reproduce:**
1. Filter statistics to year 2020 (no data)
**Expected:** Empty state message or empty chart shown
**Actual:** No empty state indicator when no data exists for selected range
**Console Errors:** None
**Notes:** None

---

### BUG-085 · MEDIUM · Statistics / Empty State

**Agent:** statistics
**Route:** http://localhost:5173/Statistics
**Steps to Reproduce:**
1. Filter statistics to year 2020 (no data)
**Expected:** Empty state message or empty chart shown
**Actual:** No empty state indicator when no data exists for selected range
**Console Errors:** None
**Notes:** None

---

### BUG-086 · MEDIUM · Statistics / Empty State

**Agent:** statistics
**Route:** http://localhost:5173/Statistics
**Steps to Reproduce:**
1. Filter statistics to year 2020 (no data)
**Expected:** Empty state message or empty chart shown
**Actual:** No empty state indicator when no data exists for selected range
**Console Errors:** None
**Notes:** None

---

### BUG-087 · MEDIUM · Statistics / Empty State

**Agent:** statistics
**Route:** http://localhost:5173/Statistics
**Steps to Reproduce:**
1. Filter statistics to year 2020 (no data)
**Expected:** Empty state message or empty chart shown
**Actual:** No empty state indicator when no data exists for selected range
**Console Errors:** None
**Notes:** None

---

### BUG-088 · MEDIUM · Settings / Currency

**Agent:** settings
**Route:** http://localhost:5173/Setting
**Steps to Reproduce:**
1. Navigate to Settings
**Expected:** Currency selector visible
**Actual:** No currency selector found
**Console Errors:** None
**Notes:** None

---

### BUG-089 · MEDIUM · Settings / Category Manager

**Agent:** settings
**Route:** http://localhost:5173/Setting
**Steps to Reproduce:**
1. Navigate to Settings
**Expected:** Add Category button visible
**Actual:** Not found
**Console Errors:** None
**Notes:** None

---

### BUG-090 · MEDIUM · Shared / Multi-Currency Display

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

### BUG-091 · MEDIUM · Shared / Multi-Currency B View

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve EUR shared expense
**Expected:** B sees debt in USD (base currency)
**Actual:** No USD amount found on B debts page
**Console Errors:** None
**Notes:** None

---

### BUG-092 · MEDIUM · Shared / Multi-Currency B View

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve EUR shared expense
**Expected:** B sees debt in USD (base currency)
**Actual:** No USD amount found on B debts page
**Console Errors:** None
**Notes:** None

---

### BUG-093 · MEDIUM · Shared / Multi-Currency B View

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve EUR shared expense
**Expected:** B sees debt in USD (base currency)
**Actual:** No USD amount found on B debts page
**Console Errors:** None
**Notes:** None

---

### BUG-094 · MEDIUM · Shared / Multi-Currency B View

**Agent:** shared-b
**Route:** http://localhost:5173/Debts
**Steps to Reproduce:**
1. Approve EUR shared expense
**Expected:** B sees debt in USD (base currency)
**Actual:** No USD amount found on B debts page
**Console Errors:** None
**Notes:** None

---

### BUG-095 · LOW · Dashboard / Budget Progress

**Agent:** budget
**Route:** http://localhost:5173
**Steps to Reproduce:**
1. Navigate to Dashboard after adding budget and expenses
**Expected:** Budget progress indicator visible on dashboard
**Actual:** No budget progress found on dashboard
**Console Errors:** None
**Notes:** None

---

### BUG-096 · LOW · Dashboard / Budget Progress

**Agent:** budget
**Route:** http://localhost:5173
**Steps to Reproduce:**
1. Navigate to Dashboard after adding budget and expenses
**Expected:** Budget progress indicator visible on dashboard
**Actual:** No budget progress found on dashboard
**Console Errors:** None
**Notes:** None

---

### BUG-097 · LOW · Dashboard / Budget Progress

**Agent:** budget
**Route:** http://localhost:5173
**Steps to Reproduce:**
1. Navigate to Dashboard after adding budget and expenses
**Expected:** Budget progress indicator visible on dashboard
**Actual:** No budget progress found on dashboard
**Console Errors:** None
**Notes:** None

---

### BUG-098 · LOW · Dashboard / Budget Progress

**Agent:** budget
**Route:** http://localhost:5173
**Steps to Reproduce:**
1. Navigate to Dashboard after adding budget and expenses
**Expected:** Budget progress indicator visible on dashboard
**Actual:** No budget progress found on dashboard
**Console Errors:** None
**Notes:** None

---

### BUG-099 · LOW · Dashboard / Budget Progress

**Agent:** budget
**Route:** http://localhost:5173
**Steps to Reproduce:**
1. Navigate to Dashboard after adding budget and expenses
**Expected:** Budget progress indicator visible on dashboard
**Actual:** No budget progress found on dashboard
**Console Errors:** None
**Notes:** None

---

### BUG-100 · LOW · Dashboard / Budget Progress

**Agent:** budget
**Route:** http://localhost:5173
**Steps to Reproduce:**
1. Navigate to Dashboard after adding budget and expenses
**Expected:** Budget progress indicator visible on dashboard
**Actual:** No budget progress found on dashboard
**Console Errors:** None
**Notes:** None

---