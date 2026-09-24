# MyTeam Performance & Retention Specification

**Status:** V1 locked baseline  
**Purpose:** Define how MyTeam measures class demand, attendance, utilisation, retention, feedback and instructor development. New ideas should be versioned additions rather than silently changing these definitions.

## 1. Product principles

MyTeam is an action platform, not just a reporting dashboard. It should help instructors and managers understand what is happening, identify classes needing attention before they happen, take action, and measure what happens next.

A performance number should rarely appear without context. Prefer: "38 attendees · 86% utilisation · +12% vs 12-week class baseline" over "38 attendees."

Commercial demand is not the same as coaching quality. Weak bookings must not automatically be interpreted as weak instructor performance. Demand, attendance, retention, feedback and development remain distinct signals.

## 2. Unit of analysis

The primary class-performance unit is a **class session** identified by:
- class/session ID
- instructor(s)
- studio/location
- class type/format
- scheduled start/end
- weekday and local time
- actual sellable capacity
- substitute status where available

A **recurring class** is the comparable series defined primarily by studio + weekday + local start time + class type, with instructor included when evaluating an instructor's own recurring slot.

## 3. Performance pillars

1. **Demand** — Are clients booking, how early, and how does current demand compare with expected trajectory?
2. **Attendance & Utilisation** — How many clients actually attended relative to sellable capacity?
3. **Retention** — Did clients return to the business, studio, instructor or recurring class?
4. **Client Feedback** — What did clients report about the experience?
5. **Development** — What coaching/development priorities are recorded for the instructor?

## 4. Demand

### 4.1 Advance booking checkpoints

For each session calculate booked count and fill percentage at:
- T-7 days
- T-5 days
- T-3 days
- T-48 hours
- T-24 hours
- T-12 hours
- class start

**Checkpoint fill % = active reservations at checkpoint / sellable capacity at checkpoint (or best available session capacity).**

Where historical reservation lifecycle data permits, a reservation counts at a checkpoint only if it had been created by that checkpoint and had not yet been cancelled/removed by that checkpoint.

### 4.2 Core demand metrics

- **Booking velocity:** change in active bookings per unit time.
- **Advance-booked share:** proportion of final active bookings already held at a defined checkpoint; default reporting checkpoint is T-48h.
- **Late-booking dependence:** proportion of final active bookings created during the final 24 hours.
- **First sell-out lead time:** time between the first point active bookings reach sellable capacity and class start.
- **Sustained sell-out lead time:** earliest point before class after which active bookings remain at/above effective capacity, subject to data resolution.
- **Waitlist demand:** waitlist volume and, where available, waitlist conversion.
- **Gross demand:** all reservation creation events.
- **Net demand:** active reservations after cancellations/removals at a given point.

### 4.3 Expected booking trajectory

An upcoming session's booking curve is compared with historical equivalent sessions. The preferred benchmark hierarchy is:

1. exact recurring class + same instructor
2. exact recurring class regardless of instructor
3. same studio + weekday + time band + class type
4. comparable studio/time/class cohort

Recent rolling history should be prioritised while retaining longer-term/YTD context. Seasonal effects and material schedule/capacity changes should be accounted for as data volume permits.

Display:
- current active bookings
- expected active bookings at the same lead time
- absolute variance
- percentage variance
- current fill %
- expected fill %
- projected final booking range when prediction quality is sufficient

Do not present a precise forecast when sample size or historical comparability is inadequate.

### 4.4 Demand states

Upcoming sessions may be classified:
- **Sold out early**
- **Strong**
- **On track**
- **Needs attention**
- **At risk**

Thresholds must be configurable and should be based on variance from expected trajectory plus time remaining, not arbitrary universal booking counts.

Every warning must explain why it fired, e.g. "24 booked at T-72h; normally 34; 10 bookings / 29% behind expected pace."

### 4.5 Action loop

MyTeam should support:
**Predict -> Alert -> Promote -> Track response -> Class occurs -> Measure attendance/retention/feedback -> Improve future benchmark.**

When an instructor/manager records a promotion action, store timestamp, class/session and action type. MyTeam may report subsequent booking lift against expected trajectory but must not claim the promotion caused the lift without causal evidence.

## 5. Attendance & Utilisation

For each session:
- checked-in attendance
- sellable/actual capacity
- utilisation %
- active/pending reservations
- late cancellations
- no-shows
- waitlist where available

**Utilisation % = checked-in attendance / actual sellable capacity.**

Prefer actual/sellable capacity over nominal layout capacity.

Comparison windows:
- previous equivalent session
- rolling 4 sessions
- rolling 8 sessions
- rolling 12 sessions
- YTD
- instructor comparable-class baseline
- exact recurring-class baseline
- studio/day/time benchmark
- broader comparable-class benchmark

Cancelled sessions should be excluded from performance denominators and flagged rather than treated as zero-attendance sessions.

## 6. Retention

Retention is calculated from **checked-in attendance**, not merely reservations.

Default horizons: **7, 30 and 60 days** after the index attendance.

For an attendee of an index session:

- **Business return:** checked into any subsequent class within the horizon.
- **Studio return:** checked into any subsequent class at the same studio within the horizon.
- **Instructor return:** checked into any subsequent class taught by the index instructor, regardless of studio/timeslot, within the horizon.
- **Class return:** checked into the same recurring class within the horizon.

Always retain numerator and denominator, e.g. **11 of 17 (64.7%)**, not percentage alone where practical.

### 6.1 First-time-to-instructor conversion

A client is first-time-to-instructor when no earlier checked-in attendance with that instructor exists in available history.

**Conversion = first-time-to-instructor clients who check in with that instructor again within horizon / eligible first-time-to-instructor clients.**

The UI must show the cohort denominator and indicate when historical lookback is insufficient to establish true first-time status.

### 6.2 Cohorts

Support at minimum:
- all attendees
- new to business
- new to instructor
- existing instructor clients

Additional cohorts can be versioned later.

### 6.3 Client migration

For an index class, classify subsequent behaviour within the selected horizon, allowing the UI to distinguish:
- returned to same recurring class
- returned to same instructor in another class
- returned to another class at same studio
- returned at another studio
- no business return within horizon

The implementation must define precedence when a client satisfies multiple categories. For "next destination" views, use the client's next checked-in visit. For broader retention views, dimensions may overlap and must be labelled as non-mutually-exclusive.

This enables analysis of customer loss versus migration/cannibalisation.

### 6.4 Business retention vs instructor retention

The same client journey must support different role-specific interpretations without changing the underlying facts.

**Business lens:** a client who stops attending an index class but continues checking in elsewhere within the organisation is internally migrated and remains business-retained. The material organisation-level risk is a client with no subsequent checked-in attendance within the selected horizon.

**Instructor lens:** movement away from the instructor or their recurring class remains relevant even when the organisation retains the client, because the instructor is building a regular client base and attendance may affect compensation/commission.

**Management lens:** show both. Management must be able to distinguish true organisation-level inactivity from redistribution caused or associated with changes in instructor, time, studio, format, capacity or adjacent timetable supply.

Do not describe a client as definitively "lost" merely because they stopped attending a class or instructor. Use explicit states such as migrated internally, missing from usual class, inactive within 30 days, or reactivated.

### 6.5 Regularity, lapse and return signals

MyTeam should derive a client regularity profile at the recurring-slot/schedule-lineage level and, where relevant, instructor level. Regularity should consider frequency, recency, observation window and available history rather than a single missed class.

Instructor-facing relationship signals may include:
- becoming a regular
- attendance weakening
- missing from usual recurring class
- moved between the same instructor's classes
- returning regular / back today

If a previously missing or inactive regular later books/checks into the instructor again, MyTeam may notify the instructor and mark the client in the roster as a returning regular so the instructor can deliberately reconnect.

Instructor messaging should not expose competitive migration unnecessarily (for example, "you lost this client to Instructor X"). Management may access destination-level migration where permitted.

### 6.6 Management client movement intelligence

Management migration analysis should aggregate individual journeys to identify broad behavioural patterns while preserving the distinction between internal migration and organisation-level inactivity.

Required analysis includes:
- destination distribution after leaving a recurring slot
- same instructor vs different instructor movement
- same studio vs cross-studio movement
- business-level inactivity at 7/30/60 days
- reactivation after inactivity
- movement before/after schedule-lineage changes
- migration/cannibalisation around new or adjacent classes
- changes in attendance frequency that may precede inactivity

Schedule changes (time, instructor, format, capacity and related changes) should be linked to migration analysis. MyTeam may report observed associations but must not claim that a schedule change caused migration without appropriate causal evidence.

The management objective is to answer: **Did clients leave the class, move elsewhere within the business, or stop attending the business altogether?**

## 7. Client feedback

Post-class feedback model:
- 1-10 score
- optional comment
- optional request for contact/follow-up
- customer/reservation/session/instructor/studio linkage
- response timestamp

Reporting:
- average score
- response count
- score distribution
- trend over time
- class/studio/instructor breakdown where sample size permits

Survey frequency should be configurable to avoid over-surveying frequent clients. Management sees feedback subject to permissions; instructor access to individual written comments is a configurable business policy.

Feedback collection must respect applicable consent, privacy and communication requirements.

## 8. Development

Evaluations are a separate performance signal and may include configurable criteria such as:
- pre-class
- programming
- cueing
- music
- vocal journey
- client interaction
- hero moments
- operations
- social/brand

Suggested rating model:
**Needs work / Meets standard / Exceptional**, with notes and 2-3 development priorities.

Performance analytics can provide context for development but must not automatically convert commercial metrics into coaching-quality judgments.

Example:
"Advance demand below benchmark; retention and client feedback above benchmark. Promotion opportunity."

## 9. Multi-location instructor performance

Instructor performance must work across multiple studios and allow:
- all-location aggregate
- per-location breakdown
- per-recurring-class breakdown
- class type/format breakdown
- comparable timeslot context

Instructor retention follows the instructor across locations. Studio retention remains location-specific.

## 10. Comparison rules

Comparisons should be as like-for-like as practical. Key dimensions:
- studio
- weekday
- local start time/time band
- class type
- instructor
- capacity
- recent schedule context
- substitute status

MyTeam should expose what benchmark is being used. Avoid misleading comparisons when sample size is too small or the comparison cohort materially differs.

## 11. Data quality and edge cases

The analytics implementation must explicitly handle:
- substitutes and multiple instructors
- class cancellations
- capacity changes/equipment holds
- cancellations and late cancellations
- no-shows
- waitlists
- moved/rescheduled classes
- missing historical data
- duplicate/migrated/third-party reservations
- timezone/local studio time
- incomplete customer history
- insufficient sample sizes

Attribution rules for multi-instructor/team-teach classes must be defined before production scoring.

## 12. Instructor Performance experience

Headline areas:
- advance demand
- attendance/utilisation
- retention
- client feedback
- development

Allow drill-down:
**Instructor -> Location -> Recurring class -> Individual session -> Demand curve / attendance / retention / feedback.**

Upcoming classes requiring action should appear prominently on Home/Performance, not buried in historical reporting.

## 13. Manager Performance experience

Manager dashboard should surface:
- upcoming classes by demand state
- classes needing attention/at risk
- promotion action/acknowledgement status
- location performance
- instructor performance with contextual benchmarks
- recurring-class performance
- retention/migration
- feedback trends
- development context

## 14. Mariana Tek data dependency

Documented Mariana reporting indicates the underlying system contains class/session, instructor, location, customer/reservation, reservation creation/cancellation timing, status/check-in and utilisation/capacity data needed for much of this model.

Production feasibility remains subject to confirming equivalent API access, scopes, historical depth, lifecycle timestamps, webhooks, rate limits and privacy/communication permissions.

During the API audit each required source field will be classified:
- 🟢 directly available
- 🟡 derivable/workaround
- 🔴 unavailable

## 15. V1 success principle

MyTeam should answer three questions quickly:

1. **What needs my attention before it happens?**
2. **How did the class actually perform in relevant context?**
3. **Did the clients come back, and where did they go?**

This specification is the V1 baseline. Changes to definitions should be explicit and versioned.
