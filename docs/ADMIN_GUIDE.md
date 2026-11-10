# School administrator guide

## First-day setup

1. Bootstrap the initial administrator using README. Log in and change its password. Add and verify an administrator recovery email through the bootstrap settings before account creation if required; this version has no self-service email change.
2. Open **Administration → Classes**. Create each class with its actual programme, academic year and expected count from school records. Counts constrain approvals; they never verify identity.
3. Open **Administration → Staff** and use the staff invitation form. Select teacher or manager. Copy the generated invitation link and privately give it to the intended staff member. It expires after 48 hours. Staff create their own username and password.
4. Assign teachers to the classes they supervise. An assigned teacher can review that class's applications, publish notices, participate in its conversation and handle its class reports.
5. Publish a school-wide welcome announcement explaining responsible use, support contacts and holiday moderation availability.

## Student onboarding

Students register with their real full name, a username, claimed index number, class and password. A recovery email is optional. They sign in to a pending screen until school staff review the application. Without access to school APIs, compare the identity against your trusted register through your established process. Keep index numbers private.

The review dashboard displays pending applications and duplicate warnings. Approve only when records match and capacity allows it. Record a concise verification method without uploading identity documents. Request correction for an incorrect number or class. Reject suspicious or unresolvable applications with a clear reason. A rejected applicant cannot enter chats.

If a legitimate student cannot fit the class capacity, reconcile the school's count first. Do not increase the number simply to bypass the check. If another account already owns the verified index number, investigate; the system prevents reassignment through ordinary approval.

## Ongoing class administration

Expected count cannot be reduced below current enrolment. Transfers end the old enrolment and class access, then create the destination membership if there is space. Use teacher assignment/removal to keep scope current. Archiving closes the class and ends its memberships; existing students can still use other authorized conversations and school-wide notices. Archive is not an account suspension, and there is no reopen button in this MVP.

Students see only messages from their current membership period. A newly added teacher or student does not automatically gain earlier chat history. Current class announcements are available according to notice audience rules.

## Announcements

Teachers publish to assigned classes; managers and administrators can publish school-wide or to a class. Choose title, text, priority, optional expiry and whether acknowledgement is required. Save a draft or publish. Editing a published notice creates a new revision; recipients must acknowledge the new version. Acknowledgement counts refer to that revision's recipient snapshot. Expiry is shown in the UI; it does not erase the notice.

## Reports and account actions

Members can report a message from its action menu and block direct contact. Staff see report evidence limited to the reported message and up to two neighbouring messages on each side. Teachers see reports in assigned classes; managers/admins handle wider reports. Review the evidence and dismiss or hide the reported message with a reason. Ordinary staff cannot browse all private conversations.

Use account suspension when access must stop. It revokes current sessions. Reactivation is available for suspended accounts, but pending applicants must go through review. Account actions and relevant administrative operations are audited. The administrator sees recent audit entries; the full history remains in the database.

## Holiday operation

The application remains usable from any internet connection while hosting is available. Set realistic monitoring and support availability. In-app notifications are visible when users open the application; this release does not send push notifications or school announcement emails. Give students a reliable external recovery contact for forgotten passwords, especially if they have no verified email.
