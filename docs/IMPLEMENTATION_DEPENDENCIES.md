# Integration gates after the interactive preview

The preview persists sample cover, availability, compliance and notification state in localStorage on one device. This is for review, not a multi-user system.

An optional shared Covers screen and authenticated API are scaffolded in `api/`, `src/sharedApp.tsx` and `db/003_shared_cover_api.sql`. They are inactive until Supabase Auth users, manager assignments, schema and Vercel environment variables are configured. Follow `SHARED_COVER_SETUP.md` before testing with two devices. The existing preview remains browser-local when the API returns the explicit unconfigured response.

## Required to make cover decisions durable
- Authenticated person and organisation memberships, with assigned-manager mapping.
- PostgreSQL (starter migrations `001_initial_schema.sql`, `002_cover_workflows.sql`).
- Server-side transactional invitation/acceptance/withdrawal endpoints using a row lock on `cover_classes`. Race protection must be tested with concurrent requests.
- Server-side notifications for the assigned manager and affected instructors, with delivery and retry tracking.
- Secure document upload, access control and manager verification audit trail.

## External sources
- Obtain instructor authorization and integration credentials before importing another brand's schedule. Manual shifts entered by the instructor are a temporary fallback; do not expose the employer or location to managers.
- Obtain Mariana Tek read-only assignment access. The manager's “I updated Mariana Tek” mark must store the time and schedule an actual source check one hour later. Match every class, or keep its reconciliation task open and alert the assigned manager.
- When Mariana Tek sandbox access is available, implement detection of subs made directly in Mariana Tek and assigned-manager review before settling MyTeam cover state. See `COVER_WORKFLOW_DECISIONS.md` §4 and GitHub issue #1. Do not show this sandbox dependency as a manager-facing workflow until source detection works.

Do not describe browser-local state or a manager mark as verified source truth.
