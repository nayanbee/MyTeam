# Cover workflow decisions — 25 September 2026

## 1. Instructor-posted cover requests
- A posted request opens immediately to eligible instructors. Management is notified and can review applicants or invite available instructors.
- The posting instructor sees the request status and may withdraw it at any time. A withdrawal before confirmation closes the request and pending invitations, with notices to affected people.
- A withdrawal after confirmation reopens the class for management review, urgently alerts management and the selected cover, and flags Mariana Tek for reconciliation. Do not silently reverse a source-schedule assignment.
- Requests within the urgent cutoff alert management immediately and appear in the same manager workflow, with urgency visible.

## 2. Applications and manual invitations
- Applicants are separate from manually invited candidates. Managers see application state and class-specific fit.
- For a split bundle, each class has its own invitation race and a maximum of two active invitations. An instructor can accept only the classes offered to them. The first valid acceptance wins each class; the other active invitation for that class closes with a missed-out notice.
- A decline frees one invitation slot for that class and alerts management. Partially filled bundles stay open for uncovered classes.
- A withdrawal of a pending application removes that applicant from the manager's pool and alerts management. A withdrawal after confirmation reopens affected classes and alerts management and affected instructors. The source schedule remains flagged for reconciliation.
- Enforce concurrency and the two-invitation cap in durable server-side state, not in one browser session.

## 3. Cross-brand schedule and privacy
- Each instructor explicitly authorizes connecting their other-brand schedule before My Team imports shifts. The instructor can review and correct imported shifts and revoke the connection.
- The matching engine may use shift times and location privately to calculate overlaps and travel buffers, including the 30-minute cross-studio rule.
- Managers see only **Working elsewhere** for a competing-brand conflict. They do not see the other employer, venue, shift time details beyond the relevant blocked period, or location.
- Corrections must retain their source and revision history so later imports do not silently overwrite an instructor's correction. Define a safe fallback when a connection stops updating.
- Source connections and authorization must be built before claiming the availability matrix is automatically complete.

## 4. Mariana Tek reconciliation
- My Team manages the cover decision; a manager updates Mariana Tek separately and marks the update done in My Team.
- That mark is provisional. One hour later, My Team reads the source assignment for **every covered class**. If each selected instructor matches, mark the cover verified/closed. If any assignment is missing or different, alert the manager and leave the cover open for reconciliation.
- Record the manager's mark time, the one-hour check, the observed source assignment, alert state, and final closure. A later edit or withdrawal reopens reconciliation.
- Read-only Mariana Tek assignment access and a durable scheduled job are dependencies. Until they exist, show verification as unavailable rather than claiming the source was checked.

## Acceptance paths to test
1. Instructor posts normal and urgent cover; manager receives them in one decision flow.
2. Applicant is approved or withdraws; other applicants receive outcomes.
3. Two invitations for one class; first accepts, other misses out; decline reopens a slot.
4. Three-class bundle is split across instructors with independent two-invitation limits and no class left implicitly covered.
5. Confirmed cover is withdrawn; manager and selected cover are alerted; Mariana reconciliation reopens.
6. Instructor authorizes an external schedule, corrects a shift, and revokes access; manager sees only Working elsewhere while travel checks still use private location.
7. Manager marks Mariana Tek updated; one-hour check verifies all class assignments or alerts on mismatch.
8. State and notifications survive reload and another device, with server-side race protection.
