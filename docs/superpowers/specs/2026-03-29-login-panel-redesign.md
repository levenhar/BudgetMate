# Login Panel Redesign — Design Spec
**Date:** 2026-03-29
**Status:** Approved

## Overview

Improve the login/signup panel with four goals:
1. Mobile small-window gets the gradient background (matches desktop left panel)
2. Full name field on sign-up
3. Optional profile photo upload during sign-up (overrides Google photo)
4. Visually distinct sign-in vs sign-up modes

---

## Design Decisions

### Approach: Tab Switcher (Option B)
Keep the existing desktop split-panel layout. Add a prominent **Sign In / Sign Up tab bar** at the top of the right (form) panel. No separate pages or routes — a single `Login.jsx` with tab state.

### Left Panel Gradient Shift
The left decorative panel changes gradient based on active tab:
- **Sign In**: `indigo-600 → violet-600` (current colors, unchanged)
- **Sign Up**: `violet-600 → purple-500 → pink-600`

Left panel content also changes:
- Sign In: existing feature bullets (track, goals, insights)
- Sign Up: "free forever" feature list (unlimited expenses, budget tracking, savings goals, shared expenses)

### Mobile Layout (M1)
On small screens (`< lg`), instead of showing only the white form:
- Full gradient background fills the screen (same as desktop left panel gradient, responds to active tab)
- Decorative background circles (same as desktop left panel)
- Logo displayed above the form card on the gradient
- White form card floats over the gradient with a box-shadow

### Sign In Tab
Identical to current implementation:
- Google OAuth button
- Email + password fields
- Forgot password link
- Heading: "Welcome back" / subtitle: "Sign in to your account to continue."

### Sign Up Tab
New fields and layout:
1. **Optional photo upload** — compact row: avatar circle preview + "Add photo (optional)" tap target. Hidden `<input type="file" accept="image/*">`. On file select, preview updates immediately.
2. **Full name** field (required, text input)
3. **Email** field
4. **Password** field (6+ chars)
5. **Google OAuth** button (still available for sign-up)
6. Heading: "Create account" / subtitle: "Sign up to start tracking your finances."

### Profile Photo Storage
- Upload to **Supabase Storage** bucket: `avatars` (public bucket)
- Since no `user_id` exists yet at upload time, path uses a random UUID: `avatars/{crypto.randomUUID()}.{ext}`
- Upload happens **before** `signUp()` call. On upload success, pass the public URL as `options.data.avatar_url` in `supabase.auth.signUp()`
- If upload fails, sign-up proceeds without photo (non-blocking — no error shown for photo failure)
- `Layout.jsx` already reads `user.user_metadata?.avatar_url` — uploaded photos automatically take priority over Google photos app-wide
- Bucket RLS: allow public reads, allow authenticated + anon inserts (needed for pre-auth upload)
- **Note for PR**: Supabase Storage bucket `avatars` must be created manually in the Supabase dashboard before this feature works

### i18n
New translation keys needed (both `he` and `en`):
- `full_name_label` — "שם מלא" / "Full Name"
- `full_name_placeholder` — "ישראל ישראלי" / "Your full name"
- `add_photo_optional` — "הוסף תמונה (אופציונלי)" / "Add photo (optional)"
- `tap_to_upload` — "לחץ להעלאה" / "Tap to upload"
- `signup_free_title` — "חינם לתמיד" / "Free Forever"
- `signup_feature_1` — "הוצאות ללא הגבלה" / "Unlimited expenses"
- `signup_feature_2` — "מעקב תקציב" / "Budget tracking"
- `signup_feature_3` — "יעדי חיסכון" / "Savings goals"
- `signup_feature_4` — "הוצאות משותפות" / "Shared expenses"
- `signin_tab` — "כניסה" / "Sign In"
- `signup_tab` — "הרשמה" / "Sign Up"
- `signup_subtitle` updated — "הירשם כדי להתחיל לעקוב אחר הכספים שלך." (unchanged)

---

## Files to Change

| File | Change |
|------|--------|
| `src/pages/Login.jsx` | Full rewrite — tabs, gradient shift, mobile M1 layout, new sign-up fields |
| `src/components/i18n/translations.jsx` | Add new translation keys (he + en) |

---

## Out of Scope
- Password confirmation field on sign-up (not requested)
- Email verification UX changes
- Profile photo editing after sign-up (separate feature)
- Supabase bucket creation (manual step, noted in PR)
