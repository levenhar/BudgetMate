---
name: quick-fix
description: Spawn a background agent in a worktree to implement a small fix, test it, and commit — without interrupting your current work.
user-invocable: true
arguments:
  - name: description
    description: What to fix or add (e.g. "capitalize hard skills like videography → Videography")
    required: true
---

# Quick Fix

Launch a background agent in an isolated worktree to implement a small fix or feature. The agent works independently while the user continues their main task.

## Steps

### 1. Understand the request

Parse the user's description to understand what needs to change. If the description is ambiguous, ask one clarifying question before launching — but err on the side of just doing it.

### 2. Launch background agent

Spawn an agent with `isolation: "worktree"` and `run_in_background: true`.

The agent's prompt must include:
1. Read relevant files first to understand existing patterns and conventions
2. Implement the fix following existing code style
3. Add or update tests covering the change
4. Run `python tests/run_tests.py` (or the project's test command) and fix any failures
5. Commit with a descriptive message when tests pass

### 3. Confirm launch

Tell the user:
- What the agent is working on (one line)
- That it's running in the background in a worktree
- That they'll be notified when it's done
- Remind them they can continue working on their main task

Do NOT block. Return immediately after launching.

### 4. When the agent completes

After the background agent finishes successfully and reports its worktree branch:

1. Get the worktree path and branch name from the agent result.
2. Merge the branch into main:
   ```bash
   git merge <branch> --no-ff -m "Merge <branch>: <short description>"
   ```
3. **MANDATORY cleanup** — always run both commands, even if merge failed:
   ```bash
   git worktree remove --force <worktree-path>
   git branch -d <branch>
   ```
   The worktree path follows the pattern `.claude/worktrees/<branch-name>`.
   Verify removal with `git worktree list` — main should be the only entry.
4. Tell the user the fix has been merged and the worktree has been cleaned up.