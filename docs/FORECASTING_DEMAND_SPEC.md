# Forecasting & Demand Intelligence Specification

**Status:** Locked architecture baseline — 24 September 2026

## Product objective
MyTeam separates **Demand** (how a class is likely to book), **Performance** (how it performed relative to context), and **Capacity planning** (whether demand was served, displaced, or suppressed). A soft forecast is not evidence of poor instructor quality; a sell-out is not automatically evidence of uniquely strong intrinsic demand.

## Forecast outputs
For each upcoming ClassSession preserve timestamped forecasts rather than overwriting them:
- expected bookings now
- expected final bookings and prediction interval
- pace variance vs expected
- expected remaining pickup
- booking velocity
- likely check-ins where supported
- demand state: **Sold out early / Strong / On track / Needs attention / At risk**
- confidence and comparable-session sample size
- concise instructor explanation and deeper management evidence

Default display horizons: T-7d, T-5d, T-3d, T-48h, T-24h, T-12h and start. Retain granular reservation events so modelling is not restricted to these checkpoints.

## V1: explainable first
V1 uses comparable historical booking curves, current bookings, expected pickup, velocity, cancellations, capacity, sell-out timing, waitlist where available, and recurring-slot history.

Comparable sessions prioritize the recurring slot, then weighted similarity across studio, weekday, time, format, instructor, capacity, seasonality and recent behaviour. Recent equivalent sessions normally receive more weight while longer history supports seasonality.

Example: **21 / 50 booked · 8 behind expected pace · forecast 38–44 · booking velocity slower than usual.**

## Capacity censoring
A 50/50 class sold out four days early is not equivalent to one reaching 50/50 shortly before start. Waitlist is only an observable subset of excess demand; clients may never join it.

Store/model first sell-out time, sustained sell-out state, waitlist joins/size, cancellations after sell-out, reopened spaces/rebooking, gross reservation demand, net bookings and final check-ins.

## Latent, displaced and suppressed demand
When a preferred class is constrained distinguish:
- **Latent demand:** demand for the constrained class not fully observable.
- **Displaced demand:** clients booking another class.
- **Suppressed demand:** no observable substitute booking.
- **Capacity relief:** added capacity serves demand that previously could not be served.
- **Cannibalisation:** new/changed capacity redistributes demand from existing unconstrained classes.

These are aggregate inferred patterns. Do not claim individual intent without direct evidence.

## Substitution network
Classes are not forecast independently. “Neighbouring” means **behaviourally substitutable**, not merely same studio or nearest time.

Possible movements include:
- earlier, same studio
- later, same studio
- similar time, different studio
- earlier/later at another studio
- same instructor elsewhere
- same format elsewhere
- another day
- client-specific historical movement
- no substitute

Represent directional relationships: `Source RecurringSlot -> Destination RecurringSlot`. Relationships may be asymmetric and context dependent.

Features include time difference, studio pair, weekday, instructor relationship, format, source capacity state, sell-out lead time, destination spare capacity, client cohort mix and historical migration. Do not hard-code KX ↔ MP or spillover percentages; learn them.

## Studio relationships
Studio relationships are first-class learned features. The same pair may substitute differently by daypart or cohort.

Support same-studio backward/forward spillover, cross-studio lateral spillover, cross-studio earlier/later movement, cross-day movement and instructor-following behaviour.

## Client behaviour signals
Where permissions allow, aggregate customer behaviour can improve forecasts: recurring-slot regulars, advance/last-minute bookers, studio/instructor/time loyalty, format preferences, proportion of expected regular cohort already booked, and weakening attendance frequency.

These are model features; instructor UX remains relationship-oriented and non-invasive.

## Prevent forecast contamination
A destination class receiving spillover from a constrained source must not automatically teach the model that its intrinsic baseline permanently increased. Preserve intrinsic/baseline demand estimate, contemporaneous network capacity state, estimated spillover contribution where supportable, and observed bookings. Use “associated with” rather than unsupported causal language.

## External context
Future ContextFeatures may include weather, rainfall, temperature, public/school holidays, concerts/festivals/sport, transport/road disruption, major events, season/month, daylight, campaigns/promotions and potentially pay-cycle timing. Never encode arbitrary causal rules such as rain = -10%; learn predictive associations.

## Learning progression
**V1:** historical curves + pickup + rules-based states.  
**V1.5:** statistical forecasting with weighted features, seasonality, velocity, cancellations and prediction intervals.  
**V2:** learned models such as regularized regression / gradient boosted trees, richer customer mix and substitution-network features.  
**Later:** external context, drift monitoring and continuous retraining.

Always benchmark complex models against simple out-of-sample baselines.

## Learning/action loop
Each completed session becomes a training example:
`context + historical demand + booking curve + network state -> forecast -> action -> eventual bookings/check-ins`

Record forecast/time/model version, alert state, opened/acknowledged, marked-promoted time, subsequent booking curve, final bookings, cancellations/no-shows and check-ins. Promotion is an observed intervention, not proof of causation.

## Evaluation
Track MAE, RMSE where useful, prediction-interval calibration, bias by studio/daypart/slot, error by horizon and booking-window drift. Historical forecasts retain their model version.

## Core records
Extend architecture with:
- `DemandSnapshot`
- `DemandForecast`
- `ForecastModelVersion`
- `RecurringSlotDemandProfile`
- `SubstitutionRelationship`
- `CapacityConstraintEvent`
- `DemandActionEvent`
- `ContextFeatures`

SubstitutionRelationship supports source/destination recurring slot, observation window, relationship dimensions, learned strength/probability, sample size/confidence and model/version metadata.

## Management questions
MyTeam should answer:
- Which classes are genuinely demand constrained?
- Where does demand go when one sells out?
- Earlier, later, cross-studio, another day, or nowhere?
- Did a new class create incremental demand, relieve capacity, or cannibalise?
- Is a destination intrinsically stronger or benefiting from overflow?
- Which schedule networks are capacity constrained?
- Where could added capacity relieve demand with least cannibalisation?

## Instructor UX
Keep it simple: bookings/capacity, ahead/behind expected pace, forecast range, booking velocity, demand state and one useful action such as **Mark promoted**. Do not expose unnecessary model complexity or unsupported causal explanations.

## Mariana Tek data gates
When sandbox is ready verify reservation creation timestamps/history, cancellation timestamps, waitlist events, capacity changes, check-ins, stable customer IDs across locations, class/instructor/location IDs, substitute fields, historical backfill and webhook/event latency. Forecasting must degrade gracefully when signals are unavailable.
