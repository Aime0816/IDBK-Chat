# API reference

Base path: `/api/v1`. JSON bodies use `Content-Type: application/json`. Uploads use multipart form data with one `file` field. API responses return JSON except private attachment downloads.

## Authentication

`POST /auth/login` takes `username` and `password`, sets an HttpOnly same-site session cookie, and returns `{user, csrf}`. Include the cookie on requests and the returned token in `x-csrf-token` on authenticated mutations. `GET /auth/me` refreshes the browser's session information. Cross-origin mutations are rejected unless their Origin matches `APP_ORIGIN`. Pending accounts can use their account/application endpoints; communication endpoints require active status.

Successful collection reads return arrays, except message history (`{messages, hasMore}`). Errors use `{error: string}` with 401 for sign-in, 403 for permission, 404 for inaccessible/missing resources, 409 for conflicts, 413 for oversized files, 422 for validation and 503 for scanner failure. Validation schema and route code are authoritative. UUID path identifiers must refer to accessible records.

## Route inventory

### Auth

| Method | Path                  |
| ------ | --------------------- |
| GET    | `/auth/classes`       |
| POST   | `/auth/register`      |
| POST   | `/auth/login`         |
| GET    | `/auth/me`            |
| POST   | `/auth/logout`        |
| POST   | `/auth/recovery`      |
| POST   | `/auth/reset`         |
| POST   | `/auth/verify`        |
| POST   | `/auth/verify/resend` |
| POST   | `/auth/password`      |
| GET    | `/auth/application`   |
| PATCH  | `/auth/application`   |
| POST   | `/auth/invitation`    |

### School

| Method | Path                                |
| ------ | ----------------------------------- |
| GET    | `/school/classes`                   |
| POST   | `/school/classes`                   |
| PATCH  | `/school/classes/:id`               |
| GET    | `/school/applications`              |
| POST   | `/school/applications/:id/decision` |
| GET    | `/school/users`                     |
| POST   | `/school/users/:id/status`          |
| POST   | `/school/users/:id/transfer`        |
| POST   | `/school/staff-invitations`         |
| GET    | `/school/audit`                     |
| POST   | `/school/classes/:id/teacher`       |
| POST   | `/school/classes/:id/archive`       |

### Conversations

| Method | Path                             |
| ------ | -------------------------------- |
| GET    | `/conversations/directory`       |
| GET    | `/conversations/invitations`     |
| POST   | `/conversations/invitations/:id` |
| GET    | `/conversations`                 |
| POST   | `/conversations`                 |
| POST   | `/conversations/direct`          |
| POST   | `/conversations/:id/invite`      |
| POST   | `/conversations/:id/leave`       |
| POST   | `/conversations/:id/remove`      |
| POST   | `/conversations/:id/read`        |

### Messages

| Method | Path                 |
| ------ | -------------------- |
| GET    | `/messages/:cid`     |
| POST   | `/messages/:cid`     |
| PATCH  | `/messages/item/:id` |
| DELETE | `/messages/item/:id` |

### Announcements

| Method | Path                     |
| ------ | ------------------------ |
| GET    | `/announcements`         |
| POST   | `/announcements`         |
| PUT    | `/announcements/:id`     |
| POST   | `/announcements/:id/ack` |

### Attachments

| Method | Path               |
| ------ | ------------------ |
| POST   | `/attachments`     |
| GET    | `/attachments/:id` |

### Moderation

| Method | Path                              |
| ------ | --------------------------------- |
| GET    | `/moderation/blocks`              |
| POST   | `/moderation/blocks/:id`          |
| DELETE | `/moderation/blocks/:id`          |
| POST   | `/moderation/reports`             |
| GET    | `/moderation/reports`             |
| POST   | `/moderation/reports/:id/resolve` |
| GET    | `/moderation/notifications`       |
| POST   | `/moderation/notifications/read`  |

## Common payloads

Registration:

```json
{
  "name": "Student Name",
  "username": "student.name",
  "number": "001234",
  "classId": "CLASS_UUID",
  "password": "a-unique-long-password",
  "email": "student@example.com"
}
```

Omit `email` if unavailable. Class options are available anonymously through `/auth/classes`. Claim numbers are strings; do not strip leading zeroes.

Approval:

```json
{
  "decision": "approve",
  "reason": "School records matched",
  "evidence": "Checked current register with class teacher"
}
```

Other decisions: `correction` or `reject`. This endpoint requires teacher scope, manager or administrator.

Message creation:

```json
{
  "clientId": "CLIENT_GENERATED_UUID",
  "body": "Hello class",
  "attachmentIds": [],
  "replyTo": "OPTIONAL_MESSAGE_UUID"
}
```

Omit `replyTo` when unused. Keep `clientId` stable on retry; changing content requires a new id. Text is at most 4,000 characters. Use `GET /messages/:cid?before=SEQUENCE` for older pages and `?after=SEQUENCE` for forward recovery. Each page is at most 50. Attachments must already be uploaded by the sender and not attached to another message.

Notice creation/edit:

```json
{
  "title": "School announcement",
  "body": "Announcement text",
  "classId": null,
  "priority": "important",
  "requiresAck": true,
  "status": "published",
  "expiresAt": null
}
```

`classId: null` means school-wide. For class notices pass a class UUID. `expiresAt` is an optional epoch-millisecond timestamp; use the UI for formatting. Acknowledgement body: `{"revision":1}`. Published edits cannot revert to draft.

Group creation body: `{"title":"Study group"}`. Direct creation and group invitation body: `{"userId":"USER_UUID"}`. Invitation decision body: `{"accept":true}`. Group owner exit requires `successorId` if members remain. Read cursor body: `{"sequence":12}`.

Report body: `{"messageId":"MESSAGE_UUID","reason":"Reason of at least five characters"}`. Resolution body: `{"action":"hide","reason":"Moderator explanation"}`; `dismiss` is the alternative.

## Socket contract

Connect Socket.IO to the same application origin with the session cookie. The server authenticates an active account and joins only its server-selected user room. Listen for `refresh` with `{eventId}` and refetch applicable HTTP resources. Do not send messages over sockets or assume refresh events are delivered exactly once. The server periodically disconnects expired/suspended sessions. Polling in the UI recovers missed invalidations.

`GET /api/health` is outside the versioned API and returns `{status: "ok"}` after a database query.
