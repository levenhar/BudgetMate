# Email Confirmation via Resend + Supabase SMTP

**Date:** 2026-03-28
**Status:** Approved

## Problem

Users who sign up with email/password receive no confirmation email because Supabase's built-in email service is unreliable on the free tier (2 emails/hour limit, poor deliverability).

## Solution

Wire Supabase Auth to Resend's SMTP server. No code changes required — pure dashboard configuration.

## Architecture

```
User signs up
    ↓
supabase.auth.signUp() [Login.jsx — unchanged]
    ↓
Supabase Auth engine
    ↓
Resend SMTP (smtp.resend.com:465)
    ↓
User's inbox ✓
```

## Setup

### Phase 1 — Resend account
1. Sign up at https://resend.com (free, no credit card)
2. Go to **API Keys** → Create key with "Sending access"
3. Save the key (shown only once)

### Phase 2 — Supabase SMTP config
In Supabase Dashboard → **Authentication → Email Settings**:

| Field | Value |
|---|---|
| Enable Custom SMTP | ✅ On |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | *(Resend API key)* |
| Sender email | `onboarding@resend.dev` |
| Sender name | `BudgetMate` |

`onboarding@resend.dev` is Resend's shared sender domain — works immediately with no domain verification needed.

### Phase 3 — Custom domain (future, optional)
1. Buy a domain (Namecheap, Google Domains, etc.)
2. Verify it in Resend dashboard (add DNS records)
3. Update "Sender email" in Supabase to `noreply@yourdomain.com`

**No code changes needed at any phase.**

## Free Tier Limits

| Service | Free limit |
|---|---|
| Resend | 100 emails/day, 3,000/month |

Sufficient for a personal/small app. Paid plans available if needed.

## Upgrade Path

When a custom domain is ready:
- Verify domain in Resend (DNS TXT/MX records)
- Update "Sender email" in Supabase Auth settings
- All future emails send from `noreply@yourdomain.com`

No changes to `Login.jsx` or any other app code at any point.
