# ScribeX Implementation Plan — Switch Git Account to `Nisarg39`

> **Status:** Awaiting User Approval  
> **Scope:** Local Git configuration and macOS Keychain credentials for `github.com` (no repository source files modified)

## Current State Observed

- **Remote (`origin`):** `https://github.com/Nisarg39/scribeX.git` (already points to `Nisarg39/scribeX`).
- **Git Author Identity:** `user.name = Nisarg Shah`, `user.email = nisarg@scriptlanes.com` (recent commits are authored with this identity).
- **Credential Helper:** `osxkeychain` (`/opt/homebrew/etc/gitconfig`), currently storing `username=89008298` for `https://github.com`.

## Proposed Steps

1. **Update Repo-Local Git Author Identity:**
   - Set `git config --local user.name "Nisarg39"` (or preferred display name) and `git config --local user.email "<nisarg39-email>"` (or `Nisarg39@users.noreply.github.com` if you prefer GitHub noreply) so new commits are attributed to `Nisarg39`.
2. **Clear Cached `github.com` Keychain Credentials & Re-authenticate as `Nisarg39`:**
   - Erase the existing `github.com` entry from `osxkeychain` via `git credential-osxkeychain erase` (`protocol=https`, `host=github.com`).
   - Either:
     - **Option A (HTTPS + PAT):** Run `git ls-remote origin` or `git credential-osxkeychain store` so you can authenticate with `username=Nisarg39` and a `Nisarg39` Personal Access Token, **or**
     - **Option B (SSH):** Switch `origin` to `git@github.com:Nisarg39/scribeX.git` if your SSH key is already registered on `Nisarg39`.
3. **Verify:**
   - Run `git config --local --list` to confirm `user.name` and `user.email`.
   - Run `git ls-remote origin` (read-only) to confirm authentication succeeds as `Nisarg39` without pushing.

## Recommended Execution

| Command | Fit | Reason |
| :--- | :--- | :--- |
| `/plan` | **Best Fit** | Simple, deterministic 3-step local Git config and credential update; needs quick confirmation of your `Nisarg39` email and auth method (HTTPS PAT vs. SSH) before running. |
| `/grill-me` | Overkill | Only two small choices (commit email and HTTPS vs. SSH). |
| `/swarm`, `/teamwork`, `/run-workflow` | Not Needed | Single-machine shell configuration with no parallelizable code tasks. |
| `/boost`, `/goal` | Not Needed | Trivial configuration change; no deep research or long-running loop required. |
| `/compact` | Not Needed | Conversation just started. |
