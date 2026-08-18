# Organization membership and private member email

DraftCenter has one public organization directory at `/organizations`. An organization appears to everyone only when its public visibility and independent-joining policy are both enabled. Signed-in users may join or leave those open organizations without changing any separate league membership.

Organization roles remain intentionally distinct:

- Owners and administrators are organization commissioners. They can manage private season plans, manager availability, organization settings, and organization announcements.
- General members can see the directory and the same published organization information available to the community. They cannot open private planning data, manager availability, or administrator controls.
- League roles are unchanged. League commissioners and co-commissioners may email active commissioners, co-commissioners, and coaches in that league. View-only spectators are excluded.

## Member privacy

Every eligible recipient receives an individual provider message. DraftCenter never exposes recipient addresses or a recipient list to commissioners, other recipients, browser code, directory RPCs, logs, or the response from the send endpoint.

Members control `email_member_announcements` in their private profile. It defaults to enabled because this is an opt-out announcement feature. Only accounts with a confirmed email address are eligible.

Address resolution is performed by `resolve_member_email_audience`, which is executable only by the Supabase service role. It independently rechecks the authenticated sender's current commissioner role. The browser cannot call it.

## Delivery safeguards

- Three sends per sender and audience per hour.
- Ten sends per sender per day.
- A maximum of 500 eligible recipients per announcement.
- Provider batches never exceed 100 separate messages.
- Each batch has a stable provider idempotency key.
- The private service-only ledger records the sender, scope, subject, aggregate counts, batch count, status, and a bounded failure summary. It never stores recipient addresses.
- A partial provider failure locks the request as failed and tells the commissioner not to resend until the submission record is reviewed.

The endpoint uses the existing server-only `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. No public environment variable or additional provider setting is required.

## Release validation

Migration 430 must be applied to one isolated Supabase Preview branch. Run `supabase/tests/430-organization-membership-and-member-email-preview-regression.sql`, verify the focused application tests and build, then delete the temporary Preview branch immediately. Do not send a real email during Preview or production smoke validation.
