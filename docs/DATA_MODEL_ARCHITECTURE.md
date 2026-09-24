# MyTeam Data Model & Architecture

**Status:** V1 architecture baseline  
**Goal:** Build MyTeam as a provider-neutral, multi-company instructor operations and intelligence platform. Mariana Tek is the first integration, not the internal data model.

## 1. Architecture principles

1. **Multi-company from day one.** Independent studios and multi-location brands use the same platform.
2. **One instructor identity, many employers.** A person can teach for Barry's, Pilates Studio A and Studio B from one MyTeam account while company data remains isolated.
3. **Provider-neutral core.** MyTeam owns a canonical schema. Mariana Tek data is translated through an integration adapter.
4. **Read-first integrations.** V1 reads/syncs source systems. Future write-back can be enabled per provider/capability without redesigning workflows.
5. **Raw history + fast derived analytics.** Preserve as much source history as practical; precompute common metrics so long history does not slow the app.
6. **Event-aware.** Preserve reservation lifecycle, schedule changes, alerts, actions and contextual conditions so future models can learn from history.
7. **Privacy boundaries are structural.** Company-owned client/performance data never becomes globally visible just because an instructor works for multiple companies.
8. **Explainable intelligence.** Forecasts and warnings retain their benchmark, inputs, model version and reason codes.

## 2. High-level system

```
External studio platforms                Public/context sources
(Mariana Tek first)                      (future)
        |                                  |
        v                                  v
Provider Adapter                    Context Ingestion
        |                                  |
        +----------> Canonical Data <------+
                         |
              +----------+-----------+
              |                      |
        Operational Services     Analytics / Forecasting
        schedule, covers,        demand, utilisation,
        roster, feedback         retention, migration
              |                      |
              +----------+-----------+
                         |
                       API
                         |
             Instructor / Manager Apps
```

The application should not query Mariana directly for every screen. Provider data is synchronised into MyTeam's canonical store, then operational and analytics services read from MyTeam.

## 3. Tenant and identity model

### Organisation
A company/business using MyTeam.

Key fields:
- id
- name
- timezone/default locale
- settings
- feedback policy
- cover policy
- demand-alert policy
- active status

### Studio
A physical location owned by an Organisation.

Key fields:
- id
- organisation_id
- name
- address/geospatial reference
- timezone
- external/provider IDs
- active status

### Person
Global human identity used for login/profile.

Key fields:
- id
- auth identity
- preferred name
- contact settings
- notification preferences

A Person does **not** automatically expose employer-specific data across organisations.

### OrganisationMembership
Connects a Person to an Organisation.

Key fields:
- id
- person_id
- organisation_id
- role(s)
- employment/engagement status
- provider instructor/employee IDs
- start/end dates

### StudioAccess
Optional membership-to-studio scope.

Supports managers with one, several or all locations.

### InstructorProfile
Organisation-specific instructor profile.

Examples:
- public display name
- bio
- class qualifications
- organisation-specific settings
- provider IDs

The same Person can therefore have multiple InstructorProfiles across different companies.

## 4. Scheduling domain

### ClassType
Organisation-specific class format/type.

### RecurringSlot
A durable schedule lineage independent of the current instructor and exact minute.

This is critical for longitudinal comparison.

Example:

```
RecurringSlot #172
KX / Thursday evening / Total Body

Jan-Jun  17:30
Jul-Sep  17:40
Oct-     17:30
```

Key fields:
- id
- organisation_id
- studio_id
- class_type_id
- canonical weekday
- canonical time band
- active dates
- comparison-group metadata

### RecurringSlotVersion
Records schedule changes within the same lineage.

Key fields:
- recurring_slot_id
- effective_from / effective_to
- scheduled local start
- duration
- class type if changed
- nominal capacity
- change reason where known

This lets MyTeam compare before/after a 17:30 -> 17:40 shift while still knowing both sessions belong to the same schedule lineage.

### ClassSession
One actual occurrence.

Key fields:
- id
- organisation_id
- studio_id
- recurring_slot_id
- class_type_id
- provider session ID
- scheduled_start / scheduled_end
- nominal capacity
- actual/sellable capacity
- status
- cancellation metadata
- substitute flag
- source timestamps

### SessionInstructor
Many-to-many between ClassSession and InstructorProfile.

Supports:
- primary instructor
- substitute
- team teach
- attribution role

Multi-instructor analytics attribution rules must be explicit before scoring.

## 5. Customer and roster domain

### Customer
**Organisation-scoped**, not a global cross-company consumer profile.

Key fields:
- id
- organisation_id
- provider customer ID
- minimal permitted profile/contact fields
- provider-created timestamp
- consent/communication flags where available

Cross-company customer matching is not assumed.

### Reservation
Customer-to-ClassSession relationship.

Key fields:
- id
- provider reservation ID
- customer_id
- class_session_id
- created_at
- cancelled_at
- current status
- source/provider metadata

### ReservationEvent
Append-only lifecycle where source data permits:
- created
- waitlisted
- confirmed
- cancelled
- late cancelled
- removed
- checked in
- no-show
- moved

This event history is the preferred source for reconstructing booking demand at arbitrary lead times.

### Attendance
Canonical outcome for analytics.

Key fields:
- customer_id
- class_session_id
- checked_in_at/status
- attendance classification

Retention calculations use attendance/check-in rather than reservation alone.

### ClientMilestone
Organisation-scoped milestones such as:
- first business visit
- first class with instructor
- 10th/50th/100th class
- birthday (only where legitimately available/permitted)
- organisation-defined milestones

### ClientNote
Permissioned organisation-owned note.

Key fields:
- organisation_id
- customer_id
- author membership
- optional session/instructor context
- note
- visibility scope
- created/updated timestamps

Do not create a cross-employer personal notebook. Notes remain within the company context and should have policy/audit controls.

## 6. Demand data

### DemandSnapshot
Time-series state of an upcoming ClassSession.

Key fields:
- class_session_id
- captured_at
- minutes_to_start
- active bookings
- gross reservations
- cancellations
- waitlist count
- sellable capacity
- fill percentage

Snapshots may be derived from reservation events and/or periodically materialised.

Standard reporting checkpoints:
- T-7d
- T-5d
- T-3d
- T-48h
- T-24h
- T-12h
- start

### DemandBenchmark
Materialised expected curve for a comparison cohort.

Stores:
- cohort definition
- checkpoint/lead time
- expected bookings/fill
- uncertainty/range
- sample size
- period used
- benchmark/model version

### DemandForecast
Forecast for one upcoming session.

Stores:
- generated_at
- current demand
- expected demand at current lead time
- projected final range
- demand state
- confidence/data-quality indicator
- benchmark/model version
- reason/explanation codes

### DemandAlert
Operational warning.

States/events:
- issued
- delivered
- opened
- acknowledged
- dismissed
- resolved

### PromotionAction
Instructor/manager records an action such as:
- marked promoted
- shared approved asset
- other organisation-defined action

Stores timestamp so subsequent booking movement can be compared with expected trajectory. MyTeam reports association/lift, not unsupported causation.

## 7. External context and learning architecture

### ContextSnapshot
Context associated with a ClassSession and relevant lead-time window.

Potential features:
- weather forecast/observed weather
- rainfall probability/amount
- temperature
- severe weather
- public holiday
- school holiday
- major local event
- concert/festival/sport
- transport disruption
- road disruption
- season/month
- daylight/sunrise/sunset
- organisation campaign
- promotion state
- other future public features

### ContextSource
Tracks provenance, source, retrieval time and licensing/usage metadata.

### ForecastFeature
Versioned feature representation used by forecasting models.

The system should be designed so new features can be added without changing core session/reservation tables.

### ForecastModelVersion
Stores:
- model/version identifier
- training window
- feature set
- target definition
- evaluation metrics
- deployment date

Initial forecasting may be rules/statistics based. Later models can learn relationships between context + booking history + eventual demand.

Do not hard-code assumptions such as "rain reduces bookings by 10%." Learn associations from data and retain explainability.

## 8. Performance and retention analytics

Canonical definitions live in `docs/PERFORMANCE_RETENTION_SPEC.md`.

### SessionMetric
Precomputed session-level measures:
- attendance
- utilisation
- reservation demand
- cancellation/no-show measures
- demand checkpoints
- benchmark deltas

### AggregateMetric
Materialised rollups by:
- instructor
- studio
- recurring slot
- class type
- organisation
- day/week/month/YTD
- rolling 4/8/12 sessions or weeks as appropriate

### RetentionCohort
Defines an index population and horizon.

### RetentionOutcome
Supports:
- business return
- studio return
- instructor return
- recurring-class return
- first-time-to-instructor conversion

Default horizons: 7 / 30 / 60 days.

### ClientJourneyEvent / MigrationOutcome
Client movement is a first-class intelligence domain, not a separate retention feature. The same canonical journey data powers management migration analysis and instructor relationship signals.

Supports next-destination and broader migration analysis:
- same recurring class / schedule lineage
- same instructor in another recurring class or studio
- same timeslot/lineage with a different instructor
- another class at the same studio
- another studio within the organisation
- no checked-in business return within the selected horizon
- reactivation after a period of inactivity

Movement must be evaluated against RecurringSlot / ScheduleLineage so timetable edits (for example 17:30 -> 17:40) are not falsely classified as client loss.

Business and instructor lenses intentionally differ:
- **Business:** internal migration is retained business; no business return is the material retention risk.
- **Instructor:** movement away from the instructor or their recurring slot remains relevant because attendance may affect instructor compensation/commission.
- **Management:** can analyse both lenses and distinguish timetable redistribution/cannibalisation from genuine organisation-level inactivity.

### ClientRegularityProfile
Derived organisation-scoped client-to-slot/instructor relationship used for actionable relationship intelligence.

Stores/derives:
- customer_id
- recurring_slot_id / schedule lineage
- instructor_profile_id where relevant
- observation window
- attendance frequency and recency
- expected attendance cadence
- regularity state
- last checked-in attendance
- confidence/sample size

Regularity states may include emerging regular, regular, attendance weakening, missing from usual slot, migrated internally, inactive at business level and reactivated. Thresholds must be configurable/data-driven and should not label a client permanently "lost."

### ClientSignal
Operational signal generated from regularity + migration outcomes.

Examples:
- regular missing from their usual recurring slot
- regular moved to another class with the same instructor
- former regular booked/checked in again ("back today")
- business-level inactivity risk
- reactivation

Instructor-facing signals should be relationship-oriented and actionable, not competitive. Do not tell an instructor they "lost Sarah to George." Management retains the underlying destination analysis.

### ClientBehaviourPattern
Aggregate/materialised analysis across journeys for management.

Supports questions such as:
- are clients migrating internally or leaving the organisation?
- where do displaced clients go after a schedule/instructor change?
- did a new adjacent class create demand or cannibalise another slot?
- are attendance-frequency declines preceding business inactivity?
- which schedule changes are associated with migration or reactivation?

Store observed associations and relevant change/context references. Do not represent correlation as causal evidence.

### CommissionPolicy / CommissionImpact (optional future organisation layer)
Compensation is not part of canonical retention definitions. An organisation may optionally configure commission/compensation rules so instructor-level attendance and migration can be translated into estimated compensation impact without changing the underlying journey facts.

## 9. Covers and open shifts

### CoverRequest
Created by an instructor for an assigned session.

V1 policy supports configurable cutoff; Barry's-style default:
- more than 7 days: instructor can request in app
- 7 days or less: request disabled and instructor directed to contact management

### OpenShift
A session or set of sessions made available by management/approved cover workflow.

### ShiftBundle
Groups sessions.

Modes:
- keep together
- prefer together (default)
- independent

### ShiftApplication
Instructor submits availability for all or an exact subset.

### ShiftEligibilityResult
Stores explainable checks:
- schedule conflict
- travel buffer
- qualification
- organisation eligibility
- other policy

### CoverReminder
Generated after a cover is approved and tied to the **preceding equivalent occurrence of the covered RecurringSlot**, not simply the instructor's previous chronological class.

Default reminder policy:
- T-15 minutes before the instructor teaches that equivalent class one week prior
- deliver as in-app notification and mobile push where enabled
- identify the approved covering instructor and covered future session
- suppress/cancel reminders if the cover is cancelled, reassigned or the relevant session is cancelled
- organisation-configurable in future

This gives the instructor a just-before-class prompt to tell regular clients who will teach the following week.

### CoverDecision
Manager approval/rejection and audit trail.

V1:
MyTeam approval -> manager updates source schedule manually.

Future:
Provider write capability -> approved decision can sync assignment back to Mariana/provider, subject to API scopes and organisation settings.

### CoverSuitabilityContext
Future decision support may surface relevant historical evidence for eligible applicants, e.g. experience/utilisation in comparable slots, without reducing selection to a simplistic single ranking.

## 10. Feedback

### FeedbackRequest
Links customer/reservation/session and delivery status.

### FeedbackResponse
- score 1-10
- optional comment
- follow-up requested
- submitted_at

### FeedbackModeration
Organisation-configurable visibility workflow.

Default supported policy:
- management can always view responses
- scores/comments below configurable threshold (e.g. <7) route to management review before instructor visibility
- higher scores may flow directly depending on company settings
- management controls final instructor visibility

## 11. Development, compliance and communications

### Evaluation
Organisation-specific instructor evaluation.

### EvaluationCriterion / EvaluationResponse
Configurable criteria, rating and notes.

### DevelopmentGoal
Tracks focus areas across evaluations.

### Qualification
e.g. CPR, First Aid, Cert III or organisation-defined requirements.

### InstructorQualification
Document/status/verification/expiry.

### Announcement
Targetable by organisation, studio, role or person.

### AnnouncementReceipt
Delivered/read/acknowledged state.

These modules should share identity/permissions but remain separate from analytics facts.

## 12. Integration architecture

### IntegrationConnection
Organisation-to-provider connection.

Stores:
- provider type
- tenant/site identifiers
- credential reference (secret itself stored in secure secret manager, never normal DB/logs)
- scopes/capabilities
- sync status

### ExternalIdentityMap
Maps provider IDs to canonical MyTeam IDs.

Examples:
- provider location -> Studio
- provider instructor -> InstructorProfile
- provider class session -> ClassSession
- provider customer -> Customer
- provider reservation -> Reservation

### SyncCursor
Tracks incremental sync progress by resource.

### SyncRun
Audit/monitoring:
- started/completed
- records read/upserted/failed
- cursor
- error summary

### ProviderCapability
Feature flags such as:
- read sessions
- read reservations
- read customers
- read attendance
- reservation lifecycle timestamps
- webhooks
- write instructor assignment

This allows Mariana to be read-only in V1 while another provider could later support write-back.

## 13. Sync strategy

Preferred order:
1. organisation/location metadata
2. instructors
3. class types
4. recurring-slot mapping
5. class sessions
6. customers
7. reservations/events
8. attendance/check-ins
9. analytics materialisation
10. forecasts/alerts

Use webhooks for low-latency changes where available, with scheduled reconciliation/polling so missed webhooks do not corrupt state.

Historical backfill runs separately from live sync so importing years of history does not block current app use.

## 14. Performance strategy

Store raw history cheaply; do not calculate years of analytics synchronously on every screen.

Use:
- canonical transactional tables
- append-only event tables where useful
- precomputed/materialised metrics
- background jobs
- cached common dashboard queries

UI defaults can load recent/weekly/8-week/YTD summaries instantly while deeper history remains queryable.

## 15. Recurring-slot lineage and schedule experiments

Schedule changes should be first-class events.

A manager should be able to preserve or explicitly link lineage when:
- 17:30 becomes 17:40
- 18:30 becomes 18:35
- class type changes
- capacity changes
- instructor changes
- slot temporarily moves

### ScheduleChange
Stores:
- recurring_slot_id
- before/after values
- effective date
- change type
- optional reason

This enables future analyses such as:
"Did moving Thu KX from 17:30 to 17:40 materially change advance demand, final utilisation or client migration?"

Automatic matching can suggest lineage, but management should be able to confirm/correct it.

## 16. Permissions

Minimum roles:
- Instructor
- Manager
- Organisation Admin
- Platform Admin

Permissions should be capability-based and studio-scoped where appropriate.

Examples:
- instructor: own cross-company schedule, but company-specific roster/performance only within each membership
- manager: permitted studios/team/customer context
- organisation admin: organisation-wide settings/data
- platform admin: operational platform access with strict audit controls

Sensitive actions and client-note access should be audited.

## 17. Instructor cross-company experience

One MyTeam login can show a unified personal schedule:

```
Monday
06:50  Barry's KX
12:30  Pilates Studio A

Tuesday
07:00  Barry's MP
18:00  Studio B
```

But performance, customer rosters, notes, feedback and company operational data remain partitioned by Organisation.

Cross-company scheduling can identify personal time conflicts without exposing one employer's confidential details to another employer.

## 18. V1 product boundary

V1:
- unified instructor identity / multi-company foundation
- synced schedule
- class roster/client context subject to permissions
- covers/open shifts/bundles
- demand checkpoints and warnings
- performance/utilisation
- retention/migration
- basic feedback + moderation
- profile/compliance

Near-following modules:
- evaluations/development
- richer communications
- promotion/content tooling
- external-context forecasting
- provider write-back

Architecture supports these from day one even if UI/automation ships later.

## 19. Proposed logical database groups

A relational database (e.g. PostgreSQL) is appropriate for the canonical operational model, with analytics/materialised tables alongside it initially.

Logical groups:

```
identity:
  people, organisations, memberships, studio_access, instructor_profiles

schedule:
  studios, class_types, recurring_slots, recurring_slot_versions,
  class_sessions, session_instructors, schedule_changes

customers:
  customers, reservations, reservation_events, attendance,
  client_milestones, client_notes

demand:
  demand_snapshots, demand_benchmarks, demand_forecasts,
  demand_alerts, promotion_actions

context:
  context_sources, context_snapshots, forecast_features,
  forecast_model_versions

analytics:
  session_metrics, aggregate_metrics, retention_cohorts,
  retention_outcomes, migration_outcomes

covers:
  cover_requests, open_shifts, shift_bundles, shift_applications,
  shift_eligibility_results, cover_decisions

feedback:
  feedback_requests, feedback_responses, feedback_moderation

development:
  evaluations, evaluation_criteria, evaluation_responses,
  development_goals

compliance:
  qualifications, instructor_qualifications

communications:
  announcements, announcement_receipts

integrations:
  integration_connections, external_identity_maps,
  sync_cursors, sync_runs, provider_capabilities
```

Do not split these into separate microservices/databases prematurely. A modular monolith with clear domain boundaries is the preferred V1 architecture; extract services later only when scale or team structure justifies it.

## 20. Next technical steps

1. Convert this logical model into an ERD and concrete database schema.
2. Create a Mariana field-mapping/audit document against the canonical entities.
3. Define provider adapter interfaces and sync contracts.
4. Generate realistic seed/mock data across multiple companies/studios/instructors.
5. Build the first instructor and manager flows against the canonical model.
6. Replace/mock provider data progressively with Mariana sandbox data when credentials are ready.

This architecture is deliberately broader than the first release while keeping the first implementation simple enough to build quickly.
