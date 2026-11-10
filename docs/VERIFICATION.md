# Verification record

Delivery checked on 3 October 2026 with Node.js 24.19.0, npm 11.9.0, local SQLite and Chromium headless.

## Executed checks

| Check                                       | Result                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| TypeScript backend and frontend compilation | Passed                                                                                                      |
| Vite production bundle                      | Passed                                                                                                      |
| API integration suite                       | 22 passed, 0 failed                                                                                         |
| Desktop browser test at 1440 × 960          | Passed: login, navigation, send, reload persistence, notices                                                |
| Mobile browser test at 390 × 844            | Passed: login, navigation, conversation, composer, no horizontal overflow                                   |
| Runtime dependency audit                    | No advisories reported by `npm audit --omit=dev` at delivery time                                           |
| Source formatting                           | Prettier checked                                                                                            |
| ZIP content check                           | Source, lockfile, docs, migration and configuration included; local secrets/databases/dependencies excluded |

The integration suite covers pending-account isolation, teacher scope, CSRF and origin rejection, atomic approval and competing final-place approvals, duplicate verified numbers, foreign conversation denial, idempotent messages, monotonic read state, announcement revisions, group invitations and exit, direct blocking, scoped reports, disguised-file rejection, scan failure, transfer, suspension, recovery enumeration resistance, authorized attachment downloads, teacher assignment/removal, class archive and single-use reset/session revocation.

Tests use synthetic accounts and isolated data. An attachment test temporarily bypasses scanning for a harmless synthetic PNG in the test environment; a separate test verifies uploads fail closed without the scanner. This does not validate a live antivirus service.

The browser screenshots in `docs/previews` come from the actual running application. They illustrate the implemented UI, not a Figma rendering. The first desktop test run failed because a text selector matched both a preview and a message; the selector was scoped and the rerun passed.

## Not executed in this environment

- MySQL 8.4 integration and the Docker Compose stack: no running Docker/MySQL service was available. A MySQL CI test step and local deployment configuration are included.
- Live SMTP delivery and ClamAV scanning/signature updates.
- Browser matrix beyond Chromium, formal accessibility audit, load testing, penetration testing or recovery on a production host.
- A production deployment, school-record reconciliation or acceptance testing by school staff.

Run these target-environment checks before real student rollout. Passing automated tests is evidence for the covered behaviors; it does not establish production scale, legal compliance or absence of vulnerabilities.
