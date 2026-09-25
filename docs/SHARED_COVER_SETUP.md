# Activate the shared Covers workspace

The live Vercel site still shows the browser-local preview until the backend is configured. The preview does **not** relay manager actions to another device. The shared screen activates only after `/api/auth` can reach a configured Supabase PostgreSQL project.

## Provision services

1. Create a Supabase project for MyTeam. In its SQL editor, run `db/001_initial_schema.sql`, `db/002_cover_workflows.sql`, then `db/003_shared_cover_api.sql` in order. Migration 003 uses Supabase Auth's `auth.uid()` and is specific to that environment.
2. In Supabase Auth, create the manager and instructor users. Disable unrestricted public signup. Each person's password should be set privately in Supabase; never put it in this repository or a chat message.
3. Create the Barry's organisation and map each Auth user to `people.auth_subject = auth.users.id::text`, with a matching active `organisation_memberships` row and `roles` containing `manager` or `instructor`. Assign each posting instructor an `owner_manager_assignments` row pointing to their assigned manager. Set `preferred_name` for the Covers UI.
4. In the Vercel project, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as server environment variables for the desired environment; redeploy. These keys are read only by `/api/*`. Do not put a service-role key or database password in a `VITE_` variable.
5. Sign in with two provisioned accounts in separate browsers. Post a future class from the instructor account, invite two instructors from the assigned manager account, accept the first invitation, and verify the other invitation closes with a notification. Repeat with a decline and a withdrawal. Check that a reload or second device sees the same state.

The shared workspace polls every eight seconds for in-app notifications. Browser push and email delivery, reliable delivery/retries, compliance documents, schedule imports, class eligibility from Mariana Tek, the one-hour source check and source-change detection still need integrations. A manager mark that Mariana Tek was updated remains provisional. The availability conflict check currently uses saved `external_schedule_entries` and a 50-minute class with a 30-minute travel margin; connect real class durations and instructor availability before production cover decisions.

The SQL functions require an authenticated user and verify active organisation membership. Each invitation or acceptance locks its `cover_classes` row in one PostgreSQL transaction. Shared data must not be tested with real instructors until account mapping, studio permissions and the database functions have been checked in the sandbox.
