# Release scope

This delivery implements the connected MVP described in README. It is source code with working persistence, authorization and UI, not a set of static mockups.

| Area            | Included                                                             | Boundary / follow-up                                                                             |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| School identity | Manual name/index/class claims, duplicate handling, scoped review    | No school API or bulk roster import; no automatic approval from class totals                     |
| Roles           | Student, teacher, manager, admin                                     | One role per account; bootstrap admin uses CLI                                                   |
| Classes         | Capacity, teacher assignment, transfer, archive                      | No automatic annual promotion or reopen workflow                                                 |
| Chat            | Class/direct/group, replies, edit/delete, read state, retries        | No voice/video calls, typing indicator, online presence or message full-text search              |
| Invitations     | Cross-class direct consent; group acceptance                         | Single invitation record per recipient/conversation; no reinvite after decline/removal           |
| Files           | Private scanned PNG/JPEG/PDF in messages                             | No announcement attachments, antivirus admin UI, object storage or thumbnail generation          |
| Announcements   | Draft/publish, revisions, priority, expiry display, acknowledgements | No scheduled publishing, export or programme-wide audience selector; expiry is a display marker  |
| Notifications   | In-app list and socket refresh                                       | No push notifications, offline message queue, SMS or email announcement broadcasts               |
| Recovery        | Verified email reset, password change, audited CLI assistance        | No self-service email change, MFA or external SSO                                                |
| Moderation      | Blocking, reports, limited evidence, hide/dismiss, suspension        | No unrestricted staff access to private chat, automatic content classifier or appeals portal     |
| Data operations | Migrations, audit events, backup instructions, ephemeral cleanup     | School must establish retention policy; no automatic deletion of school records/messages/reports |
| Scaling         | One app instance, persistent sessions and outbox                     | No horizontal-scale adapter, distributed rate limiting or performance claim                      |

## Before real student rollout

Configure production HTTPS, SMTP and ClamAV; verify domain ownership and secrets; run the MySQL integration job and Docker smoke test on the target host; rehearse backup and restore; and have staff exercise application review and moderation with synthetic accounts. Decide who administers the system, who handles holiday reports, and how students recover accounts without email. Agree a data retention and deletion process appropriate to the school's obligations before accepting real student records.

## Useful next increments

Prioritize school roster CSV import with reconciliation, MFA for staff, an accessible roster administration workflow, notification preferences, announcement attachments, invitation lifecycle improvements and measured performance work. Add more features only after a pilot validates school workflows and supervision capacity.
