# Disposable rehearsal resources

The following production records are reserved for supervised safety testing.
They are not real competition records.

- League: `Concurrency Rehearsal Jul 27`
- Slug: `concurrency-rehearsal-jul-27-9nnn5`
- Commissioner: `MyFriendMalamar`
- Test managers: `OmniSports`, `DraftCenter`
- Expected restored ownership:
  - Surat Swalots: OmniSports
  - Artazon Smolivs: MyFriendMalamar
  - Littleroot Mudkips: open
  - Baghdad Braviaries: open
  - Lima Liepards: open
  - Tokyo Togekiss: open

Use `ops/sql/verify-rehearsal-ownership.sql` for a read-only ownership check.
Use `ops/sql/rehearsal-health-report.sql` for the preflight summary.

`ops/sql/reset-disposable-rehearsal.sql` mutates data. Run it only for this exact
league, then immediately run the read-only ownership check. Do not repurpose the
reset script by changing its slug or account names during a live rehearsal.
