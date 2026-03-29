# Email Confirmation via Resend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Supabase Auth email confirmation through Resend's SMTP server so signup confirmation emails are reliably delivered.

**Architecture:** Supabase Auth already sends confirmation emails — it just needs a real SMTP relay. Resend provides that relay via standard SMTP credentials configured entirely in the Supabase dashboard. No application code changes required.

**Tech Stack:** Supabase Auth (dashboard config), Resend (external email service, free tier)

---

### Task 1: Create a Resend Account and API Key

**Files:**
- No files — this is a browser-based setup step

- [ ] **Step 1: Sign up for Resend**

  Go to https://resend.com and click "Sign Up". Use your email address. Verify your Resend account via the confirmation email they send you (Resend uses their own service for this).

- [ ] **Step 2: Generate an API key**

  In the Resend dashboard:
  1. Click **API Keys** in the left sidebar
  2. Click **Create API Key**
  3. Name: `BudgetMate Supabase`
  4. Permission: **Sending access**
  5. Domain: **All domains**
  6. Click **Add**

- [ ] **Step 3: Copy and save the API key**

  The key is shown **only once**. Copy it and save it somewhere safe (e.g. your `.env.local` as a comment, or a password manager). It looks like: `re_xxxxxxxxxxxxxxxxxxxx`

  > Do NOT commit this key to git.

---

### Task 2: Configure Supabase SMTP Settings

**Files:**
- No files — this is a Supabase dashboard config step

- [ ] **Step 1: Open Supabase Auth email settings**

  Go to your Supabase project dashboard:
  1. Click **Authentication** in the left sidebar
  2. Click **Email** (under Configuration) or navigate to: `https://supabase.com/dashboard/project/<your-project-id>/auth/email`

- [ ] **Step 2: Enable custom SMTP**

  Scroll down to the **SMTP Settings** section and toggle **Enable Custom SMTP** to ON.

- [ ] **Step 3: Fill in the SMTP credentials**

  Enter the following values exactly:

  | Field | Value |
  |---|---|
  | Host | `smtp.resend.com` |
  | Port | `465` |
  | Username | `resend` |
  | Password | *(paste your Resend API key from Task 1)* |
  | Sender email | `onboarding@resend.dev` |
  | Sender name | `BudgetMate` |

  > `onboarding@resend.dev` is Resend's shared sender — no domain verification needed. It works immediately.

- [ ] **Step 4: Save settings**

  Click **Save** at the bottom of the page.

---

### Task 3: Verify Email Delivery End-to-End

**Files:**
- No files — this is a manual verification step

- [ ] **Step 1: Start the dev server**

  ```bash
  npm run dev
  ```

- [ ] **Step 2: Sign up with a test email**

  Open the app in your browser. Click **Sign Up** and register with a real email address you can check (your own email, or a free test inbox like https://temp-mail.org).

  Fill in:
  - Email: a real inbox you can access
  - Password: any password (min 6 chars)

  Click **Create Account**.

- [ ] **Step 3: Verify the confirmation email arrives**

  Check the inbox of the email you used. You should receive a **"Confirm your signup"** email from `onboarding@resend.dev` within 30 seconds.

  Expected subject: `Confirm your signup` (Supabase default template)

  If nothing arrives after 2 minutes, check spam folder.

- [ ] **Step 4: Click the confirmation link**

  Click the link inside the email. You should be redirected to `http://localhost:5173/` (or your I updan automatically.

- [ ] **Step 5: Verify in Resend dashboard**

  Go to https://resend.com/emails — you should see the sent email listed with status **Delivered**.

- [ ] **Step 6: Verify in Supabase dashboard**

  Go to **Authentication → Users** in Supabase. Find the user you just signed up. Their **Last Sign In** and email confirmed status should be set.

---

### Task 4: (Future) Custom Domain Upgrade

**Files:**
- No files — future dashboard steps documented here for reference

When you have a custom domain (e.g. `budgetmate.app`), follow these steps to upgrade:

- [ ] **Step 1: Add your domain to Resend**

  In Resend dashboard → **Domains** → **Add Domain** → enter your domain.

- [ ] **Step 2: Add DNS records**

  Resend will show you DNS records (TXT + MX) to add at your domain registrar (Namecheap, Cloudflare, etc.). Add them and wait for verification (can take up to 24h).

- [ ] **Step 3: Update Supabase sender email**

  In Supabase Auth → SMTP Settings → change **Sender email** from `onboarding@resend.dev` to `noreply@yourdomain.com`.

  Click **Save**. All future confirmation emails will come from your domain.

  > No code changes required. No redeployment needed.
