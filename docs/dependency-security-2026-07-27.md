# Dependency security review — 2026-07-27

## xlsx 0.18.5

The dependency audit reports two high-severity advisories against `xlsx`:

- GHSA-4r6h-8v6p-xvw6: prototype pollution while parsing a malicious workbook.
- GHSA-5pgg-2g8v-p4x9: regular-expression denial of service while parsing a malicious workbook.

### Current exposure

The application uses `xlsx` only to create client-side downloads:

- `PersonalTeams.jsx` creates the My Teams and Planning worksheets and calls `XLSX.writeFile`.
- `PokemonDraftLeague.jsx` creates a readable league-backup workbook and calls `XLSX.writeFile`.

The module is dynamically imported only when an export is requested. No application path calls `XLSX.read`, `XLSX.readFile`, or another workbook parser. The league restore upload accepts JSON, reads it as text, and passes it to the separate JSON recovery importer; it does not pass uploaded bytes or text to `xlsx`.

The two reported parser vulnerabilities are therefore not reachable through the current application behavior. The audit remains non-zero because the vulnerable package version is still installed.

### Required guardrails

- Do not add Excel/CSV workbook upload or parsing with `xlsx`.
- Do not pass request bodies, remote files, user uploads, or other untrusted workbook data to `xlsx`.
- Keep `xlsx` behind the existing user-initiated dynamic import and export-only code paths.
- Re-run this review if workbook import becomes a product requirement.

### Follow-up

Replace `xlsx` with a maintained export library, or with purpose-built CSV/XLSX generation, in a separately scoped change. Acceptance criteria:

- My Teams export retains both worksheets and current column ordering.
- League backup export retains all current worksheets, names, and readable values.
- Generated files open successfully in Excel, LibreOffice, and Google Sheets.
- The replacement introduces no high- or critical-severity production dependency findings.

