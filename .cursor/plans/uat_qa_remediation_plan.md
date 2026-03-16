# UAT/QA Remediation Plan — Build & FK Issues

Plan to resolve the two issues identified in UAT/QA testing.

---

## Issue 1: Broken CSS import (pnpm build failure)

### Symptom
- **Error:** Pre-existing broken CSS import during `pnpm build`.
- **Location:** `app/admin/layout.tsx`.
- **Current (wrong):** `../admin.css`
- **Correct:** `./admin.css`

### Root cause
Relative path `../admin.css` resolves to the parent of the file’s directory. If `admin.css` lives next to (or under) the same route segment as `layout.tsx`, the correct import is same-directory: `./admin.css`.

### Resolution steps

1. **Locate the file**
   - Open `app/admin/layout.tsx` (or equivalent admin layout in your app).

2. **Locate `admin.css`**
   - Confirm where `admin.css` is (e.g. `app/admin/admin.css` or `app/admin/styles/admin.css`).

3. **Fix the import**
   - If `admin.css` is in the same directory as `layout.tsx`:
     - Change: `import '../admin.css'` → `import './admin.css'`.
   - If `admin.css` is in a subfolder (e.g. `app/admin/styles/admin.css`):
     - Use: `import './styles/admin.css'` (or the correct relative path from `layout.tsx`).

4. **Verify**
   - Run `pnpm build` and confirm the build completes without CSS import errors.

### Prevention
- Use path aliases (e.g. `@/styles/admin.css`) so paths are stable when files move.
- Add a simple build step or CI that runs `pnpm build` so broken imports are caught early.

---

## Issue 2: FK violation — DEFAULT_USER_ID does not exist

### Symptom
- **Error:** Pre-existing FK violation during “Energy assessment ‘Confirm & Continue’”.
- **Cause:** `DEFAULT_USER_ID` with value `"user-poweruser"` does not exist in the database.
- **Effect:** Creating or updating a record that references this user id fails at the DB layer.

### Root cause
A flow (Energy assessment → Confirm & Continue) uses a constant or env value `DEFAULT_USER_ID = "user-poweruser"`. That id is used in a foreign-key relationship (e.g. `user_id` → `auth.id`), but no row with `id = 'user-poweruser'` exists in the `auth` (or users) table in the UAT/QA database.

### Resolution steps

1. **Find usages of DEFAULT_USER_ID / "user-poweruser"**
   - Search codebase for: `DEFAULT_USER_ID`, `user-poweruser`, and “Energy assessment” / “Confirm & Continue”.
   - Identify the exact place that writes to the DB with this user id (e.g. creating an assessment or linking to a user).

2. **Choose a strategy**

   **Option A — Seed the user (if this user should exist in UAT/QA)**  
   - Add a seed/migration that ensures a user with `id = 'user-poweruser'` exists (or create it via a script).
   - Example (conceptual): in a seed script or migration, `INSERT INTO auth (id, username, ...) VALUES ('user-poweruser', 'poweruser', ...) ON CONFLICT (id) DO NOTHING;`
   - Run the seed in UAT/QA so the FK can be satisfied.

   **Option B — Use an existing user in UAT/QA**  
   - Replace `DEFAULT_USER_ID` with a real user id that already exists in the environment (e.g. from env: `DEFAULT_USER_ID=env('UAT_DEFAULT_USER_ID')`).
   - Configure UAT/QA env with that id and ensure that user exists in the DB.

   **Option C — Create user on first use**  
   - In the “Confirm & Continue” flow, if no default user exists: create the user first, then create the assessment with that user’s id (or use a service account that is created at app startup).

3. **Implement and deploy**
   - Apply the chosen option in code and/or DB.
   - Re-run the Energy assessment flow in UAT/QA and confirm “Confirm & Continue” completes without FK errors.

### Prevention
- Document any default/test user ids and ensure they are created in every environment (dev, staging, UAT, QA) via migrations or seed scripts.
- In code, validate that the referenced user exists before performing the action that triggers the FK (e.g. lookup user by id; if missing, return a clear error or create the user).
- Avoid hardcoding production-like user ids in app code; prefer env or config and document required setup per environment.

---

## Checklist

- [ ] **Issue 1:** Change CSS import in `app/admin/layout.tsx` from `../admin.css` to `./admin.css` (or correct path); run `pnpm build` and confirm success.
- [ ] **Issue 2:** Locate `DEFAULT_USER_ID` / `"user-poweruser"` and the Energy assessment “Confirm & Continue” flow; seed the user in UAT/QA or switch to an existing user / create-on-first-use; verify flow completes without FK violation.

---

## Quick fix summary

| Issue | File / area | Change |
|-------|-------------|--------|
| CSS import | `app/admin/layout.tsx` | Replace `import '../admin.css'` with `import './admin.css'` (or correct path to where `admin.css` lives). |
| FK violation | Code that uses `DEFAULT_USER_ID` / `"user-poweruser"` | Ensure that user exists in DB (seed/migration), or use an existing user id from config, or create the user before the "Confirm & Continue" action. |

---

## Note for AdAstra repo

In the **AdAstra** codebase:
- There is no `app/admin/layout.tsx`; the admin UI lives under `admin-app/` with `index.css` imported in `main.tsx`. No change needed for Issue 1 unless a separate Next.js (or similar) app is added with `app/admin/`.
- There is no “Energy assessment” flow or `DEFAULT_USER_ID`/`user-poweruser`. If such a feature is added later, ensure the default user is created in each environment (e.g. via seed or `ensureSuperadmin`-style bootstrap) to avoid the same FK issue.
