# QA Workflow Setup

## Required GitHub Secrets

Go to Settings → Secrets and variables → Actions → New repository secret:

| Secret | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL (from .env.local) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key (from .env.local) |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (Settings → API in Supabase dashboard) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (for the fix pipeline) |

## First Run

1. Add all 4 secrets above
2. Go to Actions → Weekly QA → Run workflow (manual trigger)
3. Monitor the run. The QA agents will create test accounts automatically.

## Notes

- Test accounts (`qa-user-a/b/c@budgetmate.local`) are created fresh each run and deleted after
- Bug reports are committed to `docs/qa/` on the main branch
- Fix PRs are created on `qa-fixes-YYYY-MM-DD` branches for manual review
