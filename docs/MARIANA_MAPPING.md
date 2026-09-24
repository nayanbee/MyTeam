# Mariana Tek -> MyTeam Mapping & Sandbox Audit

**Status:** Pre-sandbox skeleton  
**Purpose:** Validate whether Mariana Tek can supply the canonical MyTeam data required for V1 without coupling MyTeam's internal schema to Mariana.

> Exact endpoints, payload fields, scopes, pagination, history and webhook behaviour must be verified against the sandbox/current official documentation before implementation.

## Legend

- 🟢 Direct: provider exposes the required fact directly
- 🟡 Derived/workaround: MyTeam can derive or reconstruct it
- 🔴 Unavailable: cannot currently obtain reliably
- ⚪ Pending: sandbox verification required

## 1. Critical gates

| Gate | Required capability | Why it matters | Status |
|---|---|---|---|
| 1 | Historical customer x class attendance/check-in | Retention, migration, milestones | ⚪ |
| 2 | Reservation creation/lifecycle timestamps | Booking curves and demand prediction | ⚪ |
| 3 | Authorised attendee contact data | Automated post-class feedback | ⚪ |
| 4 | Future class/session + instructor assignments | Instructor schedule | ⚪ |
| 5 | Actual/sellable capacity | Accurate utilisation/demand fill | ⚪ |
| 6 | Multi-location data in one authorised connection | Multi-studio operation | ⚪ |

## 2. Canonical entity mapping

| MyTeam entity/field | Expected Mariana concept | Need | Direct/derived | Sandbox status |
|---|---|---|---|---|
| Organisation | tenant/company | tenancy | direct/config | ⚪ |
| Studio | location | schedule/analytics | direct | ⚪ |
| Studio timezone | location timezone | local comparisons | direct/config | ⚪ |
| ClassType | class type | comparable cohorts | direct | ⚪ |
| ClassSession.external_id | class/session ID | stable sync | direct | ⚪ |
| ClassSession start/end | class date/time | schedule | direct | ⚪ |
| nominal capacity | class/layout capacity | context | direct | ⚪ |
| sellable capacity | actual capacity after holds | utilisation | direct or derived | ⚪ |
| session status/cancelled | class state | exclude cancelled | direct | ⚪ |
| InstructorProfile | instructor/public profile | schedule/performance | direct | ⚪ |
| SessionInstructor role | primary/sub/team teach | attribution | direct/derived | ⚪ |
| Customer.external_id | Customer ID | stable retention identity | direct | ⚪ |
| customer first name | customer | roster | direct with scope | ⚪ |
| customer email | customer | feedback | direct with scope | ⚪ |
| customer DOB/birthday | customer | milestones | unknown | ⚪ |
| Reservation.external_id | reservation ID | lifecycle | direct | ⚪ |
| reservation created_at | Creation Date | demand trajectory | direct | ⚪ |
| reservation cancelled_at | Cancelled Date | net demand | direct | ⚪ |
| reservation status | pending/check-in/cancel/no-show/etc | lifecycle | direct | ⚪ |
| checked-in attendance | Check in/status | retention | direct | ⚪ |
| waitlist state/history | waitlist | excess demand | unknown | ⚪ |
| late cancellation | reservation status | class outcome | direct | ⚪ |
| no-show | reservation status | class outcome | direct | ⚪ |
| substitute indicator | Class Has Substitute? | attribution | direct | ⚪ |

## 3. Evidence already suggested by Mariana reporting

Existing Mariana reporting documentation indicates the underlying reporting model includes customer IDs, class IDs, instructor IDs, locations, class date/time/type/capacity, reservation creation/cancellation dates, reservation status and customer contact fields in the Reservations report.

Class Session Utilization Details documentation indicates class-level fields including location, date/time/day, instructors, substitute indicator, class type, pending reservations, checked-in reservations, late cancellations, no-shows, waitlist, holds, layout capacity, actual capacity and utilisation.

**Important:** reporting availability does not prove equivalent Admin API access. The sandbox audit must confirm programmatic availability, scopes and history.

## 4. RecurringSlot mapping

Mariana does not need to expose a native MyTeam RecurringSlot.

MyTeam can construct/suggest lineage from:
- studio
- weekday
- local start time/time band
- class type
- continuity across schedule periods

Example:
- Thu KX 17:30 Total Body
- changes to Thu KX 17:40 Total Body
- MyTeam suggests same RecurringSlot lineage
- manager can confirm/correct

This is a MyTeam-owned concept and enables before/after schedule analysis.

## 5. Reservation lifecycle audit

For at least several historical and future sessions test:

1. Can all reservations be listed?
2. Stable reservation ID?
3. Stable customer ID?
4. Created timestamp?
5. Cancelled timestamp?
6. Current status?
7. Historical check-in?
8. No-show?
9. Late cancel?
10. Waitlist state?
11. Removed reservation?
12. Moved/rescheduled reservation?
13. Third-party/migrated reservation behaviour?
14. Pagination and maximum date range?

If full event history is unavailable but created_at + cancelled_at + final status exist, MyTeam can synthesise a useful ReservationEvent history with provenance=`synthesised`.

## 6. Demand feasibility audit

For an upcoming session verify:
- live active reservation count
- capacity/actual capacity
- waitlist
- cancellation updates
- reservation created timestamps
- update latency

Then compare two reconstruction methods:

**Event reconstruction**
Count reservations whose lifecycle says they were active at each historical checkpoint.

**Snapshot collection**
MyTeam periodically records current state for future sessions.

Preferred production design uses both where possible: historical backfill from lifecycle data plus forward snapshots for robust operational forecasting.

## 7. Retention feasibility audit

For a known checked-in customer:
- retrieve attendance across arbitrary historical range
- confirm visits across locations
- identify instructors for each session
- identify recurring-slot mapping
- confirm cancellation/no-show records do not count as attendance

If these work, business/studio/instructor/class retention is computed inside MyTeam rather than requiring a Mariana retention endpoint.

## 8. Roster and client-context audit

Verify authorised API access to:
- first name
- last name
- email
- DOB/birthday if available
- total visit/class count if exposed
- first visit or account creation
- reservation/check-in history
- customer flags/notes, if any

MyTeam should derive milestones from attendance history where possible rather than depending on provider-specific milestone fields.

Client notes created in MyTeam remain MyTeam-owned in V1.

## 9. Schedule audit

Verify:
- arbitrary future date range
- historical date range
- multiple studios
- class type
- capacity
- one/multiple instructors
- substitute representation
- cancelled sessions
- changed start time
- source updated timestamp

Determine whether schedule updates have webhooks. If not, poll/reconcile.

## 10. Webhook audit

Verify current supported events and payloads for:
- reservation created
- reservation cancelled/changed
- check-in
- customer creation/update
- class session change
- instructor assignment change

For every event record:
- stable provider event ID?
- session ID?
- reservation ID?
- customer ID?
- location?
- instructor?
- timestamp?
- retry/signature behaviour?

Polling reconciliation remains required even with webhooks.

## 11. Authentication and multi-location

Verify:
- sandbox base URL
- API-key authentication headers
- credential scope
- whether one connection spans all authorised locations
- pagination/rate limits
- production/private-integration approval process
- secret rotation

Never store API secrets in GitHub, frontend code or chat. Local/deployed secrets use environment/secret management.

## 12. Future write-back audit

V1 is read-only. Still determine whether current/future API capability exists for:
- change/add instructor assignment
- remove instructor assignment
- update class session

If supported later, MyTeam's CoverDecision can invoke a provider command after manager approval. If unsupported, the existing manual Mariana step remains.

## 13. Sandbox test sequence

When credentials are ready, run in this order:

1. locations
2. instructors
3. class types
4. future class sessions
5. one session's reservations
6. customer identity
7. check-in/attendance
8. historical sessions
9. historical reservations
10. reservation timestamps
11. multi-location customer history
12. capacity/holds/waitlist
13. webhooks
14. rate limits/pagination
15. write capabilities (discovery only; do not mutate unless deliberately testing safe sandbox data)

## 14. Exit criteria

The first integration milestone is passed when:

- Gate 1 attendance history is 🟢 or viable 🟡
- Gate 2 booking timestamps are 🟢 or viable 🟡
- future schedules/instructors are accessible
- actual capacity can be obtained/derived
- multi-location scope is understood

Automated feedback can ship later if Gate 3 contact access is delayed.

After audit, replace every ⚪ with 🟢/🟡/🔴 and document exact endpoint/field/provenance.


## V2 outbound write-back contract

MyTeam should be implemented as read-first in V1 but write-capable at the integration boundary. Mariana Tek remains the source of truth.

### Cover assignment target flow

1. Management approves a cover per individual MyTeam class session.
2. Resolve the stored Mariana class-session external ID through `external_identity_maps`.
3. Create an idempotent `outbound_sync_commands` record for the desired instructor assignment.
4. Re-read/compare the provider state before mutation. If it no longer matches the expected source state, stop with `conflict`; do not overwrite an external change.
5. If the connected Mariana tenant exposes an authorised instructor-assignment mutation, send it.
6. Persist the provider response and re-read/reconcile the class session.
7. Mark the MyTeam cover decision `synced` only after observed Mariana state matches the approved assignment.
8. Inbound sync/webhook reconciliation continues after success so later external changes are detected.

### UI states

- Confirmed in MyTeam · Mariana Tek update pending
- Updating Mariana Tek
- Live schedule updated
- Sync failed · management action required
- Mariana Tek changed externally · review required

V1 uses the first/manual state and never pretends a write occurred.

### Capability gating

Do not infer write capability from API-key authentication alone. During sandbox audit record provider capabilities on `integration_connections.capabilities`, including:
- class-session read
- instructor read
- class-session instructor assignment write
- mutation idempotency support
- source version / updated-at support
- relevant webhook coverage

The write worker must remain disabled unless the exact mutation is confirmed and authorised for that organisation.

### Safety and consistency

- One outbound command per individual class-session assignment, even when MyTeam presents a bundle.
- Use idempotency keys to prevent duplicate provider writes.
- Store expected source state before mutation to avoid clobbering changes made directly in Mariana.
- Retry transient failures with bounded backoff; do not retry validation/permission conflicts indefinitely.
- Keep a complete audit trail of actor, approved assignment, attempted provider mutation, response, reconciliation and any manual resolution.
- Never place provider credentials or raw secrets in the repository/database rows; store only secret references.
